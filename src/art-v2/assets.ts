import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { ArtModelDefinition } from "../art-library";

export interface CityAsset extends ArtModelDefinition {
  category: "landmark" | "heritage" | "modern" | "prop";
  materialSlots: string[];
  artIds: string[];
}
const paints: Record<string, string> = {
  stone: "V201",
  brick: "V202",
  glass: "V203",
  slate: "V204",
  copper: "RT02-copper",
  rose: "RT03-rose",
  trim: "V201-stone",
  white: "V201-stone",
};
const colors: Record<string, string> = {
  stone: "#fff8e8",
  brick: "#fff0e4",
  glass: "#bdcdd1",
  slate: "#9dabbc",
  copper: "#739581",
  rose: "#d57b86",
  trim: "#f4dfae",
  white: "#fff0d2",
  dark: "#193443",
  gold: "#bba061",
  asphalt: "#545e60",
};

export class CityAssets {
  private textures = new Map<string, Promise<T.Texture>>();
  private materials = new Map<string, T.MeshStandardMaterial>();
  private materialRequests = new Map<string, Promise<T.MeshStandardMaterial>>();
  private requests = new Map<string, Promise<T.Group>>();
  private models = new Map<string, T.Group>();
  private loader = new GLTFLoader();
  private dead = false;
  readonly lit = new Map<T.MeshStandardMaterial, number>();
  private nightFlood = { value: 0 };
  constructor(
    readonly definitions: CityAsset[],
    private base: string,
  ) {}
  texture(id: string, alpha = false): Promise<T.Texture> {
    if (this.dead) return Promise.reject(new Error("Asset library disposed"));
    if (!this.textures.has(id)) {
      const request = new T.TextureLoader()
        .loadAsync(
          `${this.base}assets/renovation/v2/textures/${id}.${id.endsWith("-windows") ? "png" : "webp"}`,
        )
        .then((t) => {
          if (this.dead) {
            t.dispose();
            throw Error("Disposed during texture load");
          }
          t.colorSpace = id.endsWith("-windows")
            ? T.NoColorSpace
            : T.SRGBColorSpace;
          t.wrapS = t.wrapT = T.RepeatWrapping;
          t.anisotropy = 8;
          t.generateMipmaps = true;
          if (alpha) t.premultiplyAlpha = false;
          return t;
        })
        .catch((error) => {
          this.textures.delete(id);
          throw error;
        });
      this.textures.set(id, request);
    }
    return this.textures.get(id)!;
  }
  material(asset: string, slot: string): Promise<T.MeshStandardMaterial> {
    const name = slot.replace(/\.\d+$/, ""),
      key = asset + ":" + name;
    if (this.materialRequests.has(key)) return this.materialRequests.get(key)!;
    const request = this.makeMaterial(asset, name, key).catch((error) => {
      this.materialRequests.delete(key);
      throw error;
    });
    this.materialRequests.set(key, request);
    return request;
  }
  private async makeMaterial(asset: string, name: string, key: string) {
    const texture = paints[name] ? await this.texture(paints[name]) : null;
    const m = new T.MeshStandardMaterial({
      name: key,
      color: colors[name] ?? "#ffffff",
      map: texture,
      roughness: name === "glass" ? 0.55 : 0.87,
      metalness: name === "glass" ? 0.035 : name === "gold" ? 0.32 : 0,
    });
    if (["stone", "brick", "glass"].includes(name)) {
      m.emissiveMap = await this.texture(paints[name] + "-windows");
      m.emissive.set("#ffc674");
      m.emissiveIntensity = 0;
      this.lit.set(m, name === "glass" ? 0.48 : 0.36);
    } else if (["gold", "rose"].includes(name)) {
      m.emissive.set(name === "rose" ? "#f590a2" : "#ffd092");
      this.lit.set(m, name === "rose" ? 0.44 : 0.12);
    }
    const bund =
      asset.startsWith("heritage") ||
      ["customs", "hsbc", "peace"].includes(asset);
    if (bund) {
      const flood = ["stone", "trim", "white"].includes(name)
        ? 0.12
        : name === "copper"
          ? 0.055
          : 0.022;
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uNightFlood = this.nightFlood;
        shader.fragmentShader =
          "uniform float uNightFlood;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vec3(1.,.54,.23) * uNightFlood * ${flood.toFixed(4)};`,
        );
      };
      m.customProgramCacheKey = () => `waterfront-night-${flood}`;
    }
    this.materials.set(key, m);
    return m;
  }
  model(id: string, level = 0): Promise<T.Group> {
    if (this.dead) return Promise.reject(new Error("Asset library disposed"));
    const key = id + ":" + level;
    if (!this.requests.has(key)) {
      const def = this.definitions.find((d) => d.id === id),
        lod = def?.lods.find((l) => l.level === level);
      if (!def || !lod)
        return Promise.reject(new Error("Missing asset definition: " + key));
      const p = this.loader
        .loadAsync(this.base + lod.path)
        .then(async (gltf) => {
          const root = gltf.scene;
          if (
            !root.getObjectByName("label-anchor") ||
            !root.getObjectByName("focus-anchor")
          )
            throw Error("Missing model anchors: " + id);
          const assignments: Promise<void>[] = [];
          root.traverse((o) => {
            if (o instanceof T.Mesh) {
              const old = Array.isArray(o.material) ? o.material : [o.material];
              assignments.push(
                Promise.all(old.map((m) => this.material(id, m.name))).then(
                  (materials) => {
                    old.forEach((m) => m.dispose());
                    o.material = Array.isArray(o.material)
                      ? materials
                      : materials[0];
                    o.castShadow = o.receiveShadow = true;
                    o.userData.libraryOwned = true;
                  },
                ),
              );
            }
          });
          await Promise.all(assignments);
          if (this.dead) {
            root.traverse((o) => {
              if (o instanceof T.Mesh) o.geometry.dispose();
            });
            throw Error("Disposed during model load");
          }
          root.userData.assetId = id;
          root.updateMatrixWorld(true);
          this.models.set(key, root);
          return root;
        })
        .catch((e) => {
          this.requests.delete(key);
          throw new Error(
            `建筑资源 ${id} 加载失败：${lod.path} · ${String(e)}`,
          );
        });
      this.requests.set(key, p);
    }
    return this.requests.get(key)!;
  }
  setNight(amount: number) {
    this.nightFlood.value = amount;
    this.lit.forEach(
      (strength, m) => (m.emissiveIntensity = strength * amount),
    );
  }
  dispose() {
    if (this.dead) return;
    this.dead = true;
    const geometries = new Set<T.BufferGeometry>();
    this.models.forEach((root) =>
      root.traverse((o) => {
        if (o instanceof T.Mesh) geometries.add(o.geometry);
      }),
    );
    geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach(
      (p) => void p.then((t) => t.dispose()).catch(() => {}),
    );
    this.models.clear();
    this.materials.clear();
    this.materialRequests.clear();
    this.textures.clear();
    this.requests.clear();
    this.lit.clear();
  }
}
