import * as THREE from "three";
export interface Palette {
  stone: THREE.MeshToonMaterial;
  glass: THREE.MeshToonMaterial;
  rose: THREE.MeshToonMaterial;
  roof: THREE.MeshToonMaterial;
  pavement: THREE.MeshToonMaterial;
  foliage: THREE.MeshToonMaterial;
  base: THREE.MeshToonMaterial;
  gold: THREE.MeshToonMaterial;
  dark: THREE.MeshToonMaterial;
  white: THREE.MeshToonMaterial;
  trim: THREE.MeshToonMaterial;
  window: THREE.MeshBasicMaterial;
  light: THREE.MeshBasicMaterial;
  textures: Record<string, THREE.Texture>;
  all: THREE.Material[];
  missing: string[];
}
export async function loadPalette(
  progress: (p: number) => void,
): Promise<Palette> {
  const ids = [
    "T01",
    "T02",
    "T03",
    "T04",
    "T05",
    "T06",
    "T07",
    "T08",
    "T09",
    "T10",
    "T11",
    "S01",
    "S02",
    "S03",
    "D01",
    "D02",
  ];
  let done = 0;
  const textures: Record<string, THREE.Texture> = {};
  const missing: string[] = [];
  await Promise.all(
    ids.map(async (id) => {
      const url = `${import.meta.env.BASE_URL}assets/${id}.${id.startsWith("D") ? "png" : "webp"}`;
      try {
        const t = await new THREE.TextureLoader().loadAsync(url);
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 4;
        textures[id] = t;
      } catch {
        missing.push(id);
        console.warn(`Missing art asset: ${id}`);
      }
      progress(++done / ids.length);
    }),
  );
  const gradient = new THREE.DataTexture(
    new Uint8Array([110, 159, 203, 235, 255]),
    5,
    1,
    THREE.RedFormat,
  );
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  const make = (color: string, id?: string) =>
    new THREE.MeshToonMaterial({
      color,
      map: id ? (textures[id] ?? null) : null,
      gradientMap: gradient,
    });
  const p = {
    stone: make("#fff1d5", "T04"),
    glass: make("#bcd9df", "T02"),
    rose: make("#e9b0af", "T03"),
    roof: make("#86afa4", "T06"),
    pavement: make("#eee5d1", "T07"),
    foliage: make("#a7be83", "T08"),
    base: make("#f0e4cb", "T10"),
    gold: make("#dfbf7f", "T11"),
    dark: make("#65787b"),
    white: make("#f9f1df", "T01"),
    trim: make("#c4b8a0", "T05"),
    window: new THREE.MeshBasicMaterial({ color: "#496d75" }),
    light: new THREE.MeshBasicMaterial({
      color: "#ffc97b",
      transparent: true,
      opacity: 0,
    }),
    textures,
    all: [] as THREE.Material[],
    missing,
  };
  if (!textures.T09) {
    const fallback = new THREE.DataTexture(
      new Uint8Array([170, 200, 199, 255]),
      1,
      1,
    );
    fallback.needsUpdate = true;
    textures.T09 = fallback;
  }
  p.all = Object.values(p).filter(
    (x) => x instanceof THREE.Material,
  ) as THREE.Material[];
  return p;
}
