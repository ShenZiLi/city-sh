import * as T from "three";

export interface CityInstance {
  assetId: string;
  position: [number, number, number];
  rotation: number;
  scale: number;
  district: "bund" | "lujiazui" | "distance";
  landmarkId?: string;
  seed: number;
}
export const coreIds = [
  "pearl",
  "shanghai",
  "swfc",
  "jinmao",
  "customs",
  "hsbc",
  "peace",
] as const;
export const curve = new T.CatmullRomCurve3(
  [
    new T.Vector3(-700, 0, -4000),
    new T.Vector3(-390, 0, -800),
    new T.Vector3(-190, 0, -400),
    new T.Vector3(-25, 0, -160),
    new T.Vector3(0, 0, 40),
    new T.Vector3(65, 0, 220),
    new T.Vector3(155, 0, 450),
    new T.Vector3(120, 0, 800),
    new T.Vector3(400, 0, 4000),
  ],
  false,
  "centripetal",
);
export const halfWidth = (t: number) => 78 + 14 * Math.sin(Math.PI * t);
export function riverAt(z: number) {
  let a = 0,
    b = 1;
  for (let i = 0; i < 24; i++) {
    const t = (a + b) / 2;
    if (curve.getPoint(t).z < z) a = t;
    else b = t;
  }
  const t = (a + b) / 2,
    point = curve.getPoint(t),
    tangent = curve.getTangent(t).normalize();
  const normal = new T.Vector3(tangent.z, 0, -tangent.x).normalize();
  return { t, point, tangent, normal, width: halfWidth(t) };
}
export function bankPosition(
  z: number,
  side: number,
  offset: number,
  height = 0.3,
) {
  const r = riverAt(z);
  return r.point
    .clone()
    .addScaledVector(r.normal, side * (r.width + offset))
    .setY(height);
}
export function inCreek(p: T.Vector3, margin = 0) {
  const r = riverAt(-314),
    delta = p.clone().sub(r.point);
  return (
    delta.dot(r.normal) < -r.width + 2 &&
    Math.abs(delta.dot(r.tangent)) < 13 + margin
  );
}
export function ribbon(inner: number, outer: number, y: number, side = 1) {
  const v: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const segments = 360;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      p = curve.getPoint(t),
      d = curve.getTangent(t),
      n = new T.Vector3(d.z, 0, -d.x).normalize();
    for (const offset of [inner, outer]) {
      const q = p.clone().addScaledVector(n, side * (halfWidth(t) + offset));
      v.push(q.x, y, q.z);
      uv.push((offset - inner) / 8, p.z / 8);
    }
    if (i < segments && !(side < 0 && p.z > -327 && p.z < -301)) {
      const j = i * 2;
      if (side > 0) indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
      else indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(v, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export function riverGeometry() {
  const v: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= 360; i++) {
    const t = i / 360,
      p = curve.getPoint(t),
      d = curve.getTangent(t),
      n = new T.Vector3(d.z, 0, -d.x).normalize();
    for (const side of [-1, 1]) {
      const q = p.clone().addScaledVector(n, side * halfWidth(t));
      v.push(q.x, 0, q.z);
      uv.push((side + 1) / 2, t);
    }
    if (i < 360) {
      const j = i * 2;
      indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(v, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export const hash = (n: number) =>
  T.MathUtils.euclideanModulo(Math.sin(n * 127.1 + 31.7) * 43758.5453, 1);

export function cityLayout(): CityInstance[] {
  const result: CityInstance[] = [];
  const add = (
    assetId: string,
    z: number,
    side: number,
    offset: number,
    scale = 1,
    landmarkId?: string,
    seed = result.length,
  ) => {
    const r = riverAt(z),
      p = bankPosition(z, side, offset);
    result.push({
      assetId,
      position: p.toArray() as [number, number, number],
      rotation:
        Math.atan2(r.tangent.x, r.tangent.z) +
        (side < 0 ? Math.PI / 2 : -Math.PI / 2),
      scale,
      district: Math.abs(z) > 450 ? "distance" : side < 0 ? "bund" : "lujiazui",
      landmarkId,
      seed,
    });
  };
  add("hsbc", 25, -1, 45, 1, "hsbc");
  add("customs", -27, -1, 44, 1, "customs");
  add("peace", -130, -1, 46, 1, "peace");
  add("pearl", -210, 1, 35, 1, "pearl");
  add("shanghai", -96, 1, 190, 1, "shanghai");
  add("swfc", -176, 1, 151, 1, "swfc");
  add("jinmao", -157, 1, 99, 1, "jinmao");
  // Explicit river-facing frontage. No landmark is randomly repeated.
  const frontage: [number, number][] = [
    [-285, 0],
    [-250, 4],
    [-212, 1],
    [-174, 3],
    [-80, 3],
    [75, 5],
    [110, 3],
    [145, 0],
    [180, 4],
    [215, 1],
    [250, 5],
    [285, 3],
    [320, 0],
    [355, 4],
  ];
  for (const [z, type] of frontage)
    add("heritage-" + type, z, -1, 43, 0.9 + hash(z) * 0.13);
  const rows = [
    {
      offset: 78,
      zs: [
        -325, -280, -235, -190, -145, -100, -55, -10, 35, 80, 125, 170, 215,
        260, 305, 350,
      ],
    },
    {
      offset: 114,
      zs: [
        -350, -303, -256, -209, -162, -115, -68, -21, 26, 73, 120, 167, 214,
        261, 308, 355,
      ],
    },
    {
      offset: 151,
      zs: [
        -340, -288, -236, -184, -132, -80, -28, 24, 76, 128, 180, 232, 284, 336,
      ],
    },
  ];
  rows.forEach((row, j) =>
    row.zs.forEach((z, i) =>
      add(
        "heritage-" + ((i * 5 + j * 2) % 6),
        z,
        -1,
        row.offset,
        0.8 + hash(i + j * 30) * 0.25,
      ),
    ),
  );
  // A second, staggered rank closes the long lawn gaps between the old rows.
  // These are separate building assets and complete roofs, not stretched facades.
  for (const [row, offset] of [190, 227, 264, 301, 338].entries())
    for (let i = 0; i < 22; i++) {
      const z = -365 + i * 34 + (row % 2) * 12;
      add(
        "heritage-" + ((i * 5 + row * 3) % 6),
        z,
        -1,
        offset,
        0.86 + hash(i + row * 101) * 0.19,
      );
    }
  // Curated height bands: commercial podiums on the river, towers set behind.
  const modern: [number, number, number, number][] = [
    [-315, 64, 1, 0.8],
    [-270, 47, 3, 1],
    [-210, 40, 5, 0.7],
    [-155, 68, 3, 0.8],
    [-40, 38, 3, 1],
    [5, 46, 5, 0.8],
    [57, 42, 1, 0.9],
    [110, 48, 4, 0.8],
    [160, 52, 3, 1.1],
    [210, 50, 0, 0.75],
    [-320, 115, 4, 0.8],
    [-280, 200, 0, 0.8],
    [-80, 100, 1, 0.85],
    [-20, 115, 0, 1.05],
    [50, 110, 2, 1],
    [110, 110, 5, 0.85],
    [170, 118, 1, 0.85],
    [230, 120, 2, 0.9],
    [-290, 250, 2, 0.9],
    [-215, 245, 5, 0.95],
    [-80, 230, 4, 0.9],
    [-20, 220, 1, 1.05],
    [50, 210, 0, 0.9],
    [120, 215, 2, 0.9],
    [190, 220, 4, 1],
    [-340, 300, 0, 0.9],
    [-260, 310, 1, 0.8],
    [-180, 310, 2, 0.9],
    [-100, 310, 5, 1],
    [0, 300, 4, 0.9],
    [90, 300, 0, 0.85],
    [180, 300, 1, 0.9],
  ];
  for (const [z, offset, type, scale] of modern)
    add("modern-" + type, z, 1, offset, scale);
  // Deliberately authored infill slots, accepted only with clearance to the
  // landmark plazas and existing buildings. This fills real urban blocks.
  const infillZ = [
    -350, -311, -272, -233, -194, -155, -116, -77, -38, 1, 40, 79, 118, 157,
    196, 235, 274, 313, 352,
  ];
  for (const [row, offset] of [45, 85, 125, 165, 205, 245, 285, 325].entries())
    for (const [i, z] of infillZ.entries()) {
      const p = bankPosition(z, 1, offset),
        clear = result.every((item) => {
          if (item.district === "bund") return true;
          const radius = item.landmarkId
            ? item.landmarkId === "pearl"
              ? 24
              : 19
            : 17;
          return (
            Math.hypot(item.position[0] - p.x, item.position[2] - p.z) >
            radius + 13
          );
        });
      if (clear)
        add(
          "modern-" + [3, 4, 1, 2, 5, 3][(i + row * 2) % 6],
          z,
          1,
          offset,
          0.72 + hash(i + row * 31) * 0.18,
        );
    }
  // Closed, lower-contrast city extension around every horizontal direction.
  for (const side of [-1, 1])
    for (let row = 0; row < 14; row++)
      for (let col = 0; col < 7; col++) {
        const seed = 1000 + (side + 1) * 400 + row * 7 + col,
          z = -1050 + row * 150 + hash(seed) * 28,
          offset = 75 + col * 62;
        if (Math.abs(z) < 390 && offset < 350) continue;
        add(
          (side < 0 ? "heritage-" : "modern-") +
            ((row * 5 + col + (side > 0 ? 1 : 0)) % 6),
          z,
          side,
          offset,
          side < 0 ? 0.9 + hash(seed + 1) * 0.25 : 0.65 + hash(seed + 1) * 0.5,
          undefined,
          seed,
        );
      }
  for (const side of [-1, 1])
    for (let row = 0; row < 11; row++)
      for (let col = 0; col < 10; col++) {
        const seed = 3000 + (side + 1) * 1000 + row * 10 + col,
          z = -430 - row * 47 + hash(seed) * 12,
          offset = 45 + col * 33 + hash(seed + 1) * 5;
        add(
          (side < 0 ? "heritage-" : "modern-") + ((row * 5 + col) % 6),
          z,
          side,
          offset,
          side < 0 ? 0.8 + hash(seed + 2) * 0.3 : 0.65 + hash(seed + 2) * 0.6,
          undefined,
          seed,
        );
      }
  // Tangible back streets on every side instead of empty terrain behind the
  // main silhouette. Lower detail is assigned by the city loader at distance.
  for (const side of [-1, 1])
    for (let row = 0; row < 19; row++)
      for (let col = 0; col < 6; col++) {
        const seed = 6000 + (side + 1) * 1000 + row * 6 + col;
        add(
          (side < 0 ? "heritage-" : "modern-") + ((row * 5 + col * 3) % 6),
          -580 + row * 64 + hash(seed) * 10,
          side,
          390 + col * 39 + hash(seed + 2) * 8,
          side < 0 ? 1.05 + hash(seed + 1) * 0.3 : 0.8 + hash(seed + 1) * 0.55,
          undefined,
          seed,
        );
        result[result.length - 1].district = "distance";
      }
  return result.filter((item) => !inCreek(new T.Vector3(...item.position), 19));
}
