import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface ArtModelDefinition {
  id: string;
  name: string;
  height: number;
  anchors: { label: [number, number, number]; focus: [number, number, number] };
  lods: {
    level: number;
    path: string;
    bytes: number;
    sha256: string;
    triangles: number;
  }[];
}

export function disposeArtObjects(objects: Iterable<T.Object3D>) {
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const textures = new Set<T.Texture>();
  for (const root of objects)
    root.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof T.Texture) textures.add(value);
      }
    });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

export class ArtLibrary {
  private loader = new GLTFLoader();
  private requests = new Map<string, Promise<T.Group>>();
  private loaded = new Map<string, T.Group>();
  private disposed = false;
  constructor(
    public definitions: ArtModelDefinition[],
    private base: string,
    private prepare: (material: T.MeshStandardMaterial) => void,
  ) {}

  async model(id: string, level = 0): Promise<T.Group> {
    if (this.disposed) throw new Error("Art library has been disposed");
    const key = `${id}:${level}`;
    if (!this.requests.has(key)) {
      const definition = this.definitions.find((a) => a.id === id);
      const variant = definition?.lods.find((a) => a.level === level);
      if (!definition || !variant)
        throw new Error(`Missing model definition: ${key}`);
      const request = this.loader
        .loadAsync(this.base + variant.path)
        .then((gltf) => {
          const root = gltf.scene;
          if (this.disposed) {
            disposeArtObjects([root]);
            throw new Error(`Art library disposed while loading ${key}`);
          }
          root.userData.assetId = id;
          root.updateMatrixWorld(true);
          if (
            !root.getObjectByName("label-anchor") ||
            !root.getObjectByName("focus-anchor")
          ) {
            disposeArtObjects([root]);
            throw new Error(`Missing GLB anchors: ${key}`);
          }
          root.traverse((object) => {
            if (!(object instanceof T.Mesh)) return;
            object.castShadow = object.receiveShadow = true;
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material]) {
              if (material instanceof T.MeshStandardMaterial)
                this.prepare(material);
            }
          });
          this.loaded.set(key, root);
          return root;
        })
        .catch((error) => {
          this.requests.delete(key);
          throw error;
        });
      this.requests.set(key, request);
    }
    return this.requests.get(key)!;
  }

  dispose() {
    this.disposed = true;
    disposeArtObjects(this.loaded.values());
    this.loaded.clear();
    this.requests.clear();
  }
}
