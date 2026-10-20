import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Palette } from "./materials";
import type { LandmarkDefinition } from "./types";
const boxGeo = new T.BoxGeometry(1, 1, 1),
  cylinderGeo = new T.CylinderGeometry(1, 1, 1, 16),
  sphereGeo = new T.SphereGeometry(1, 24, 16);
export function box(
  parent: T.Object3D,
  m: T.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
) {
  const o = new T.Mesh(boxGeo, m);
  o.position.set(x, y, z);
  o.scale.set(w, h, d);
  o.castShadow = o.receiveShadow = true;
  parent.add(o);
  return o;
}
export function cylinder(
  parent: T.Object3D,
  m: T.Material,
  x: number,
  y: number,
  z: number,
  r: number,
  h: number,
  rTop = r,
  sides = 16,
) {
  const geo =
    rTop === r && sides === 16
      ? cylinderGeo
      : new T.CylinderGeometry(rTop / r, 1, 1, sides);
  const o = new T.Mesh(geo, m);
  o.position.set(x, y, z);
  o.scale.set(r, h, r);
  o.castShadow = o.receiveShadow = true;
  parent.add(o);
  return o;
}
function sphere(
  parent: T.Object3D,
  m: T.Material,
  x: number,
  y: number,
  z: number,
  r: number,
) {
  const o = new T.Mesh(sphereGeo, m);
  o.position.set(x, y, z);
  o.scale.setScalar(r);
  o.castShadow = true;
  parent.add(o);
  return o;
}
function beam(
  parent: T.Object3D,
  m: T.Material,
  a: T.Vector3,
  b: T.Vector3,
  r: number,
) {
  const o = cylinder(parent, m, 0, 0, 0, r, a.distanceTo(b));
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  return o;
}
export interface ModelResult {
  group: T.Group;
  lights: T.Object3D[];
}
function edges(parent: T.Object3D, mesh: T.Mesh) {
  const line = new T.LineSegments(
    new T.EdgesGeometry(mesh.geometry, 28),
    new T.LineBasicMaterial({
      color: 0x445c60,
      transparent: true,
      opacity: 0.2,
    }),
  );
  line.position.copy(mesh.position);
  line.quaternion.copy(mesh.quaternion);
  line.scale.copy(mesh.scale);
  parent.add(line);
}
function facade(
  parent: T.Object3D,
  p: Palette,
  w: number,
  h: number,
  d: number,
  lights: T.Object3D[],
  classical = false,
) {
  const cols = Math.max(2, Math.floor(w / (classical ? 1.2 : 0.95))),
    rows = Math.max(2, Math.floor(h / (classical ? 1.1 : 1.35)));
  const count = (cols * 2 + Math.max(2, Math.floor(d / 0.95)) * 2) * rows;
  const dark = new T.InstancedMesh(boxGeo, p.window, count),
    glow = new T.InstancedMesh(boxGeo, p.light, count);
  let n = 0,
    k = 0;
  const dummy = new T.Object3D();
  for (let side = 0; side < 4; side++) {
    const span = side % 2 ? d : w;
    const cc = Math.max(2, Math.floor(span / (classical ? 1.2 : 0.95)));
    for (let iy = 0; iy < rows; iy++)
      for (let ix = 0; ix < cc; ix++) {
        const along = -span / 2 + ((ix + 0.5) * span) / cc,
          y = 0.65 + ((iy + 0.5) * (h - 1)) / rows;
        dummy.position.set(
          side % 2 ? (side === 1 ? w / 2 + 0.012 : -w / 2 - 0.012) : along,
          y,
          side % 2 ? along : side === 0 ? d / 2 + 0.012 : -d / 2 - 0.012,
        );
        dummy.rotation.set(0, side % 2 ? Math.PI / 2 : 0, 0);
        dummy.scale.set(classical ? 0.42 : 0.52, classical ? 0.66 : 0.5, 0.025);
        dummy.updateMatrix();
        dark.setMatrixAt(n++, dummy.matrix);
        if ((ix * 7 + iy * 13 + side) % 5 < 2)
          glow.setMatrixAt(k++, dummy.matrix);
      }
  }
  dark.count = n;
  glow.count = k;
  parent.add(dark, glow);
  lights.push(glow);
}
export function buildLandmark(l: LandmarkDefinition, p: Palette): ModelResult {
  const g = new T.Group(),
    lights: T.Object3D[] = [];
  g.position.set(...l.position);
  g.position.y = 0.6;
  g.userData.landmark = l.id;
  const h = l.height,
    w = l.width,
    d = l.depth;
  const b = (
    x: number,
    y: number,
    z: number,
    bw: number,
    bh: number,
    bd: number,
    m: T.Material = p.stone,
  ) => box(g, m, x, y, z, bw, bh, bd);
  if (l.kind === "pearl") {
    cylinder(g, p.white, 0, 0.5, 0, 4.3, 1);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      beam(
        g,
        p.stone,
        new T.Vector3(Math.cos(a) * 3, 0.7, Math.sin(a) * 3),
        new T.Vector3(Math.cos(a) * 0.8, 11, Math.sin(a) * 0.8),
        0.34,
      );
      cylinder(g, p.stone, Math.cos(a) * 0.6, 20, Math.sin(a) * 0.6, 0.35, 27);
    }
    sphere(g, p.rose, 0, 11.5, 0, 3.8);
    sphere(g, p.rose, 0, 29, 0, 2.45);
    sphere(g, p.rose, 0, 35.6, 0, 0.8);
    cylinder(g, p.stone, 0, 18.5, 0, 0.9, 8);
    cylinder(g, p.white, 0, 37, 0, 0.18, 6, 0.025);
    for (const [y, r] of [
      [11.5, 3.72],
      [29, 2.42],
    ] as [number, number][]) {
      const ring = new T.Mesh(new T.TorusGeometry(r, 0.13, 5, 48), p.white);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      g.add(ring);
      const strip = new T.Mesh(new T.TorusGeometry(r, 0.075, 5, 48), p.light);
      strip.rotation.x = Math.PI / 2;
      strip.position.y = y + 0.2;
      g.add(strip);
      lights.push(strip);
    }
  } else if (l.kind === "twist") {
    const positions: number[] = [],
      uv: number[] = [],
      idx: number[] = [];
    const sides = 36,
      layers = 64;
    for (let j = 0; j <= layers; j++) {
      const t = j / layers;
      const radius = 3.9 * (1 - 0.52 * t) * (1 + 0.08 * Math.sin(t * Math.PI));
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2 + t * 2.05;
        positions.push(
          Math.cos(a) * radius * (1 + 0.07 * Math.cos(3 * a)),
          t * h,
          Math.sin(a) * radius * 0.83,
        );
        uv.push(i / sides, t * 3);
      }
    }
    for (let j = 0; j < layers; j++)
      for (let i = 0; i < sides; i++) {
        const a = j * (sides + 1) + i,
          b = a + sides + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const tower = new T.Mesh(geo, p.glass);
    tower.castShadow = true;
    g.add(tower);
    for (let i = 0; i < 9; i++) {
      const points = [];
      for (let j = 0; j <= 64; j++) {
        const t = j / 64,
          a = (i / 9) * Math.PI * 2 + t * 2.05,
          r = 3.96 * (1 - 0.52 * t) * (1 + 0.08 * Math.sin(t * Math.PI));
        points.push(
          new T.Vector3(
            Math.cos(a) * r * (1 + 0.07 * Math.cos(3 * a)),
            t * h,
            Math.sin(a) * r * 0.83,
          ),
        );
      }
      const line = new T.Line(
        new T.BufferGeometry().setFromPoints(points),
        new T.LineBasicMaterial({
          color: "#d2e5dc",
          transparent: true,
          opacity: 0.7,
        }),
      );
      g.add(line);
    }
    for (let y = 1; y < h; y += 1.4) {
      const t = y / h;
      const ring = new T.Mesh(
        new T.TorusGeometry(
          3.95 * (1 - 0.52 * t) * (1 + 0.08 * Math.sin(t * Math.PI)),
          0.025,
          3,
          36,
        ),
        p.white,
      );
      ring.rotation.x = Math.PI / 2;
      ring.scale.y = 0.83;
      ring.position.y = y;
      g.add(ring);
    }
    cylinder(g, p.dark, 0, h - 0.12, 0, 1.7, 0.3);
    cylinder(g, p.light, 0, h - 0.05, 0, 1.8, 0.12);
    lights.push(g.children[g.children.length - 1]);
  } else if (l.kind === "swfc") {
    const s = new T.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w * 0.37, h);
    s.lineTo(-w * 0.37, h);
    s.closePath();
    const hole = new T.Path();
    hole.moveTo(-w * 0.24, h - 1.6);
    hole.lineTo(w * 0.24, h - 1.6);
    hole.lineTo(w * 0.29, h - 6.4);
    hole.lineTo(-w * 0.29, h - 6.4);
    hole.closePath();
    s.holes.push(hole);
    const geo = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
    geo.translate(0, 0, -d / 2);
    const tower = new T.Mesh(geo, p.glass);
    tower.castShadow = true;
    g.add(tower);
    edges(g, tower);
    for (let y = 1; y < h - 7; y += 1.3)
      b(0, y, 0, w * (1 - (0.25 * y) / h) + 0.03, 0.035, d + 0.03, p.white);
    for (const x of [-1.6, 0, 1.6])
      b(x, h * 0.43, d / 2 + 0.04, 0.04, h * 0.86, 0.04, p.white);
  } else if (l.kind === "jinmao") {
    let y = 0;
    for (let i = 0; i < 13; i++) {
      const hh = i < 5 ? 3.4 : 2.15,
        r = 3.8 - i * 0.21;
      cylinder(g, p.glass, 0, y + hh / 2, 0, r, hh, r * 0.94, 8);
      cylinder(g, p.stone, 0, y + 0.16, 0, r * 1.08, 0.32, r * 1.08, 8);
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const rod = cylinder(
          g,
          p.white,
          Math.cos(a) * r * 0.94,
          y + hh / 2,
          Math.sin(a) * r * 0.94,
          0.065,
          hh,
        );
        rod.castShadow = false;
      }
      y += hh;
    }
    cylinder(g, p.stone, 0, y + 1.8, 0, 0.75, 3.6, 0.1, 8);
    cylinder(g, p.white, 0, h - 1.1, 0, 0.1, 2.2, 0.01);
  } else if (l.kind === "ifc") {
    for (let i = 0; i < 2; i++) {
      const sub = new T.Group();
      sub.position.x = i === 0 ? -2.5 : 2.5;
      const th = i === 0 ? h : h * 0.84;
      box(sub, p.glass, 0, th / 2, 0, 3.6, th, d);
      facade(sub, p, 3.6, th, d, lights);
      g.add(sub);
      box(sub, p.white, 0, th - 0.3, 0, 3.7, 0.6, d + 0.1);
    }
    b(0, 1, 0, 10, 2, 7);
  } else if (l.kind === "aurora") {
    const tower = b(0, h / 2, 0, w, h, d, p.gold);
    edges(g, tower);
    for (let y = 1; y < h; y += 1.1)
      b(0, y, 0, w + 0.05, 0.055, d + 0.05, p.white);
    facade(g, p, w, h, d, lights);
  } else if (l.kind === "signal") {
    cylinder(g, p.stone, 0, 2.4, 0, 1.1, 4.8);
    cylinder(g, p.white, 0, 4.7, 0, 1.35, 0.35);
    cylinder(g, p.glass, 0, 5.2, 0, 0.85, 0.8);
    cylinder(g, p.roof, 0, 5.85, 0, 1.2, 0.5, 0.05);
    cylinder(g, p.dark, 0, 6.6, 0, 0.04, 1.2);
  } else {
    const bodyHeight =
      l.kind === "customs"
        ? 6
        : l.kind === "peace"
          ? 8
          : l.kind === "china"
            ? 9
            : l.kind === "hsbc"
              ? 6
              : h;
    b(0, bodyHeight / 2, 0, w, bodyHeight, d);
    facade(g, p, w, bodyHeight, d, lights, true);
    for (const y of [0.4, bodyHeight * 0.45, bodyHeight - 0.4, bodyHeight])
      b(0, y, 0, w + 0.4, 0.18, d + 0.4, p.white);
    b(0, 0.2, 0, w + 1, 0.4, d + 1, p.trim);
    if (l.kind !== "mall") {
      for (let i = 0; i < Math.floor(w / 0.9); i++) {
        const x = -w / 2 + 0.5 + i * 0.9;
        cylinder(
          g,
          p.white,
          x,
          bodyHeight * 0.42,
          d / 2 + 0.16,
          0.12,
          bodyHeight * 0.62,
        );
      }
    }
    if (l.kind === "customs") {
      b(0, 8.4, 0, 2.8, 4.8, 2.7);
      b(0, 10.7, 0, 3.2, 0.4, 3.1, p.white);
      b(0, 11.4, 0, 2, 1.1, 2, p.trim);
      for (let i = 0; i < 4; i++) {
        const clock = new T.Group();
        clock.rotation.y = (i * Math.PI) / 2;
        clock.position.y = 9.25;
        const disc = new T.Mesh(new T.CircleGeometry(0.6, 24), p.white);
        disc.position.z = 1.37;
        clock.add(disc);
        box(clock, p.dark, 0, 0.17, 1.39, 0.05, 0.38, 0.025);
        box(clock, p.dark, 0.15, 0, 1.4, 0.32, 0.05, 0.025);
        g.add(clock);
      }
    }
    if (l.kind === "hsbc") {
      cylinder(g, p.white, 0, 6.9, 0, 2, 1.3);
      const dome = sphere(g, p.roof, 0, 7.6, 0, 2.1);
      dome.scale.y = 1.45;
      cylinder(g, p.stone, 0, 9.4, 0, 0.35, 0.8, 0.1);
    }
    if (l.kind === "peace") {
      b(0, 9, 0, 3.8, 2.1, 3.8);
      const roof = new T.Mesh(new T.ConeGeometry(3, 3.2, 4), p.roof);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 11.5;
      g.add(roof);
    }
    if (l.kind === "china") {
      b(0, 10, 0, 4.5, 2, 3.5);
      b(0, 11.3, 0, 3.1, 0.6, 2.7, p.roof);
    }
    if (l.kind === "mall") {
      b(-1, 3.8, 0, w + 1, 1.1, d + 1, p.white);
      b(1, 5.1, 0, w * 0.65, 1.5, d * 0.7, p.glass);
      b(0, 0.5, d * 0.5, w * 0.8, 1, 1.2, p.white);
    }
  }
  // Merge opaque architectural parts per material, retaining windows and pickable volume.
  g.updateMatrixWorld(true);
  const inverse = g.matrixWorld.clone().invert();
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  const old: T.Mesh[] = [];
  g.traverse((o) => {
    if (o instanceof T.Mesh && !(o instanceof T.InstancedMesh)) {
      let geo = o.geometry.clone();
      if (geo.index) geo = geo.toNonIndexed();
      geo.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
      const mat = o.material as T.Material;
      const list = batches.get(mat) ?? [];
      list.push(geo);
      batches.set(mat, list);
      old.push(o);
    }
  });
  old.forEach((o) => o.removeFromParent());
  for (const [mat, geos] of batches) {
    const geo = mergeGeometries(geos);
    geos.forEach((x) => x.dispose());
    if (geo) {
      const mesh = new T.Mesh(geo, mat);
      mesh.castShadow = mat !== p.light;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
  }
  g.traverse((o) => {
    o.userData.landmark = l.id;
  });
  return { group: g, lights };
}
