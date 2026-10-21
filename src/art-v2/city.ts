import * as T from "three";
import { CityAssets } from "./assets";
import { cityLayout, type CityInstance } from "./layout";

export class City {
  readonly group = new T.Group();
  readonly core = new Map<string, T.Group>();
  readonly layout = cityLayout();
  private revision = 0;
  private dead = false;
  constructor(private assets: CityAssets) {}
  async load(level = 0) {
    const revision = ++this.revision,
      next = new T.Group(),
      core = new Map<string, T.Group>();
    const buckets = new Map<string, CityInstance[]>();
    for (const item of this.layout) {
      const lod = item.district === "distance" ? 2 : level;
      const key = item.assetId + ":" + lod;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(item);
    }
    try {
      await Promise.all(
        [...buckets].map(async ([key, list]) => {
          const split = key.lastIndexOf(":"),
            id = key.slice(0, split),
            lod = Number(key.slice(split + 1));
          const template = await this.assets.model(id, lod);
          template.updateMatrixWorld(true);
          if (list[0].landmarkId) {
            const item = list[0],
              root = template.clone(true);
            root.position.set(...item.position);
            root.rotation.y = item.rotation;
            root.scale.setScalar(item.scale);
            root.userData.landmarkId = item.landmarkId;
            core.set(item.landmarkId!, root);
            next.add(root);
          } else {
            template.traverse((o) => {
              if (!(o instanceof T.Mesh)) return;
              const mesh = new T.InstancedMesh(
                o.geometry,
                o.material,
                list.length,
              );
              mesh.name = id;
              mesh.userData.libraryOwned = true;
              mesh.userData.instances = list;
              mesh.castShadow = mesh.receiveShadow =
                list[0].district !== "distance";
              const dummy = new T.Object3D();
              list.forEach((item, i) => {
                dummy.position.set(...item.position);
                dummy.rotation.y = item.rotation;
                dummy.scale.setScalar(item.scale);
                dummy.updateMatrix();
                mesh.setMatrixAt(
                  i,
                  dummy.matrix.clone().multiply(o.matrixWorld),
                );
                const colors =
                  item.district === "bund"
                    ? [
                        "#fff6e0",
                        "#e4d3ba",
                        "#ead8b8",
                        "#fff4db",
                        "#d8c5aa",
                        "#e7cba8",
                      ]
                    : [
                        "#d3e2e4",
                        "#a5bcc8",
                        "#cad6cf",
                        "#c5cfd9",
                        "#e2d5bd",
                        "#b0c6c9",
                      ];
                mesh.setColorAt(i, new T.Color(colors[item.seed % 6]));
              });
              mesh.computeBoundingSphere();
              next.add(mesh);
            });
          }
        }),
      );
    } catch (error) {
      next.traverse((o) => {
        if (o instanceof T.InstancedMesh) o.dispose();
      });
      throw error;
    }
    if (this.dead || revision !== this.revision) {
      next.traverse((o) => {
        if (o instanceof T.InstancedMesh) o.dispose();
      });
      return false;
    }
    this.group.traverse((o) => {
      if (o instanceof T.InstancedMesh) o.dispose();
    });
    this.group.clear();
    this.group.add(next);
    this.core.clear();
    core.forEach((v, k) => this.core.set(k, v));
    this.group.updateMatrixWorld(true);
    return true;
  }
  dispose() {
    this.dead = true;
    this.revision++;
    this.group.traverse((o) => {
      if (o instanceof T.InstancedMesh) o.dispose();
    });
    this.group.clear();
    this.core.clear();
  }
}
