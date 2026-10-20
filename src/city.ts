import * as T from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Palette } from "./materials";
import { box, cylinder, buildLandmark } from "./models";
import {
  landmarks,
  riverBounds,
  isRiver,
  isCreek,
  creekCenter,
  quaySegments,
  seededRandom,
  wrapRange,
} from "./world-data";
export interface City {
  group: T.Group;
  details: T.Group;
  picks: T.Object3D[];
  occlusionBounds: { box: T.Box3; id?: string }[];
  lights: T.Object3D[];
  water: T.ShaderMaterial;
  mirror: Reflector;
  update(t: number, dt: number, night: number): void;
}
function area(
  points: [number, number][],
  depth: number,
  material: T.Material,
  y: number,
) {
  const shape = new T.Shape();
  points.forEach(([x, z], i) =>
    i ? shape.lineTo(x, -z) : shape.moveTo(x, -z),
  );
  shape.closePath();
  const geo = depth
    ? new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
    : new T.ShapeGeometry(shape, 32);
  geo.rotateX(-Math.PI / 2);
  const mesh = new T.Mesh(geo, material);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}
function roundedShape() {
  const s = new T.Shape(),
    w = 58,
    d = 43,
    r = 6;
  s.moveTo(-w + r, -d);
  s.lineTo(w - r, -d);
  s.quadraticCurveTo(w, -d, w, -d + r);
  s.lineTo(w, d - r);
  s.quadraticCurveTo(w, d, w - r, d);
  s.lineTo(-w + r, d);
  s.quadraticCurveTo(-w, d, -w, d - r);
  s.lineTo(-w, -d + r);
  s.quadraticCurveTo(-w, -d, -w + r, -d);
  return s;
}
export function createCity(p: Palette): City {
  const group = new T.Group(),
    details = new T.Group(),
    picks: T.Object3D[] = [],
    lights: T.Object3D[] = [];
  const occlusionBounds: { box: T.Box3; id?: string }[] = [];
  group.add(details);
  const baseGeo = new T.ExtrudeGeometry(roundedShape(), {
    depth: 3.3,
    bevelEnabled: true,
    bevelSize: 0.35,
    bevelThickness: 0.25,
    bevelSegments: 3,
    steps: 1,
    curveSegments: 10,
  });
  baseGeo.rotateX(-Math.PI / 2);
  const base = new T.Mesh(baseGeo, p.base);
  base.position.y = -3.4;
  base.castShadow = base.receiveShadow = true;
  group.add(base);
  const top = new T.ShapeGeometry(roundedShape(), 16);
  top.rotateX(-Math.PI / 2);
  const land = new T.Mesh(top, p.pavement);
  land.position.y = 0.03;
  land.receiveShadow = true;
  group.add(land);
  const riverPoints: [number, number][] = [];
  for (let z = -43; z <= 43; z += 1) riverPoints.push([riverBounds(z)[0], z]);
  for (let z = 43; z >= -43; z -= 1) riverPoints.push([riverBounds(z)[1], z]);
  const water = new T.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: 0 },
      uWarm: { value: 0 },
      uMap: { value: p.textures.T09 ?? null },
    },
    vertexShader: `varying vec3 vWorld;void main(){vec4 wp=modelMatrix*vec4(position,1.);vWorld=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader: `uniform float uTime,uNight,uWarm;uniform sampler2D uMap;varying vec3 vWorld;void main(){vec2 uv=vWorld.xz/19.;vec3 tex=texture2D(uMap,uv+vec2(sin(uv.y*7.+uTime*.25)*.006,uTime*.003)).rgb;float ripple=pow(max(0.,sin(vWorld.x*4.+sin(vWorld.z*1.7+uTime)*2.+uTime*.7)),18.);vec3 day=vec3(.31,.59,.59)*(.8+tex*.35);vec3 night=vec3(.045,.16,.23)*(.8+tex*.45);vec3 c=mix(day,night,uNight);c+=ripple*.07*(1.-uNight*.7);c+=vec3(.15,.075,.015)*uWarm;gl_FragColor=vec4(c,mix(.79,.61,uNight));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,
    transparent: true,
    depthWrite: false,
  });
  const waterMesh = area(riverPoints, 0, water, 0.19);
  waterMesh.renderOrder = 3;
  group.add(waterMesh);
  const mirror = new Reflector(waterMesh.geometry.clone(), {
    color: 0x658c91,
    textureWidth: 1024,
    textureHeight: 1024,
    clipBias: 0.02,
  });
  mirror.position.y = 0.16;
  mirror.rotation.x = -Math.PI / 2;
  // Reflector expects local XY plane; the world mesh geometry is horizontal already.
  mirror.geometry.rotateX(Math.PI / 2);
  group.add(mirror);
  const creekPoints: [number, number][] = [];
  for (let x = -57; x <= -13; x++) creekPoints.push([x, creekCenter(x) - 2.3]);
  for (let x = -13; x >= -57; x--) creekPoints.push([x, creekCenter(x) + 2.3]);
  group.add(area(creekPoints, 0, water, 0.2));
  // Raised pale stone quays follow the two curved riverbanks.
  for (const side of [0, 1] as const)
    for (const [from, to] of quaySegments(side)) {
      const pts: [number, number][] = [];
      for (let z = from; z <= to; z++)
        pts.push([riverBounds(z)[side] + (side === 0 ? -0.1 : 0.1), z]);
      for (let z = to; z >= from; z--)
        pts.push([riverBounds(z)[side] + (side === 0 ? -1.5 : 1.5), z]);
      group.add(area(pts, 0.35, p.stone, 0.19));
    }
  // Roads form an intelligible street grid behind the waterfront.
  for (const x of [-48, -37, 29, 43, 53])
    box(group, p.trim, x, 0.1, 1, 0.8, 0.08, 77);
  for (const z of [-35, -22, -11, 3, 17, 33]) {
    for (const side of [-1, 1]) {
      const min = side < 0 ? -55 : riverBounds(z)[1] + 4,
        max = side < 0 ? riverBounds(z)[0] - 4 : 55;
      box(group, p.trim, (min + max) / 2, 0.1, z, max - min, 0.08, 0.8);
    }
  }
  const random = seededRandom(3181);
  const generic: T.Group[] = [];
  const windowMatrices: T.Matrix4[] = [],
    glowMatrices: T.Matrix4[] = [];
  const dummy = new T.Object3D();
  let backgroundCount = 0;
  const glassColors = ["#90b9be", "#a1bdcb", "#b2c5bd", "#bac7bc", "#9bb4bd"];
  const stoneColors = ["#ddd0b7", "#e6d6bc", "#c7c6b4", "#d6c5ad", "#e0d7c4"];
  const glassMats = glassColors.map((c) => {
      const m = p.glass.clone();
      m.color.set(c);
      return m;
    }),
    stoneMats = stoneColors.map((c) => {
      const m = p.stone.clone();
      m.color.set(c);
      return m;
    });
  for (const side of [-1, 1])
    for (let row = 0; row < 9; row++)
      for (let col = 0; col < 9; col++) {
        const x = (side < 0 ? -54 : 16) + col * 4.7 + (random() - 0.5) * 0.8,
          z = -36 + row * 9 + (random() - 0.5) * 1.1;
        if (Math.abs(x) > 54 || isRiver(x, z, 4) || isCreek(x, z, 4)) continue;
        if (
          landmarks.some(
            (l) =>
              Math.abs(x - l.position[0]) < l.width / 2 + 3.4 &&
              Math.abs(z - l.position[2]) < l.depth / 2 + 3.4,
          )
        )
          continue;
        const bw = 2 + random() * 2.2,
          bd = 2.4 + random() * 2.3,
          bh = side > 0 ? 5 + random() * 13 : 2 + random() * 5;
        const material = (side > 0 ? glassMats : stoneMats)[
          Math.floor(random() * 5)
        ];
        const building = new T.Group();
        building.position.set(x, 0.25, z);
        box(building, material, 0, bh / 2, 0, bw, bh, bd);
        box(building, p.white, 0, bh + 0.08, 0, bw + 0.2, 0.2, bd + 0.2);
        if (random() > 0.55)
          box(building, p.roof, 0, bh + 0.5, 0, bw * 0.6, 0.7, bd * 0.6);
        if (side > 0 && random() > 0.6)
          box(
            building,
            p.white,
            -bw * 0.3,
            bh / 2,
            bd / 2 + 0.03,
            0.08,
            bh,
            0.05,
          );
        for (let k = 0; k < 4; k++) {
          const span = k % 2 ? bd : bw,
            cc = Math.max(2, Math.floor(span / 0.8));
          for (let iy = 0; iy < Math.floor(bh / 1.15); iy++)
            for (let ix = 0; ix < cc; ix++) {
              const along = -span / 2 + ((ix + 0.5) * span) / cc;
              dummy.position.set(
                x +
                  (k % 2 ? (k === 1 ? bw / 2 + 0.02 : -bw / 2 - 0.02) : along),
                0.9 + iy * 1.15,
                z + (k % 2 ? along : k === 0 ? bd / 2 + 0.02 : -bd / 2 - 0.02),
              );
              dummy.rotation.set(0, k % 2 ? Math.PI / 2 : 0, 0);
              dummy.scale.set(0.35, 0.48, 0.03);
              dummy.updateMatrix();
              windowMatrices.push(dummy.matrix.clone());
              if (random() < 0.38) glowMatrices.push(dummy.matrix.clone());
            }
        }
        occlusionBounds.push({
          box: new T.Box3(
            new T.Vector3(x - bw / 2, 0.25, z - bd / 2),
            new T.Vector3(x + bw / 2, bh + 1, z + bd / 2),
          ),
        });
        group.add(building);
        generic.push(building);
        backgroundCount++;
      }
  for (const [mat, matrices] of [
    [p.window, windowMatrices],
    [p.light, glowMatrices],
  ] as [T.Material, T.Matrix4[]][]) {
    const windows = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      mat,
      matrices.length,
    );
    matrices.forEach((m, i) => windows.setMatrixAt(i, m));
    group.add(windows);
    if (mat === p.light) lights.push(windows);
  }
  for (const l of landmarks) {
    const model = buildLandmark(l, p);
    group.add(model.group);
    occlusionBounds.push({
      box: new T.Box3().setFromObject(model.group),
      id: l.id,
    });
    picks.push(model.group);
    lights.push(...model.lights);
  }
  // A small steel truss crosses Suzhou Creek, never the main Huangpu channel.
  const bridge = new T.Group();
  bridge.position.set(-27, 1, creekCenter(-27));
  box(bridge, p.dark, 0, 0.1, 0, 3, 0.25, 7);
  for (const xx of [-1.5, 1.5]) {
    box(bridge, p.roof, xx, 1, 0, 0.12, 1.8, 7);
    for (let j = 0; j < 5; j++) {
      const beam = new T.Mesh(new T.BoxGeometry(0.1, 2, 0.1), p.white);
      beam.position.set(xx, 1, -2.8 + j * 1.4);
      beam.rotation.x = j % 2 ? 0.7 : -0.7;
      bridge.add(beam);
    }
    box(bridge, p.white, xx, 2, 0, 0.15, 0.12, 7);
  }
  group.add(bridge);
  // Batch trees and lamp posts; all are volumetric from every azimuth.
  const treeMatrices: T.Matrix4[] = [],
    trunkMatrices: T.Matrix4[] = [],
    lampMatrices: T.Matrix4[] = [],
    bulbMatrices: T.Matrix4[] = [];
  const tree = (x: number, z: number, s = 1) => {
    dummy.rotation.set(0, random() * 6, 0);
    dummy.position.set(x, 0.8, z);
    dummy.scale.set(0.15, 1.4, 0.15);
    dummy.updateMatrix();
    trunkMatrices.push(dummy.matrix.clone());
    dummy.position.y = 2.0;
    dummy.scale.set(s * 0.9, s * 1.1, s * 0.85);
    dummy.updateMatrix();
    treeMatrices.push(dummy.matrix.clone());
  };
  for (let z = -40; z <= 40; z += 3.5)
    for (const side of [0, 1]) {
      const x = riverBounds(z)[side] + (side === 0 ? -2.8 : 2.8);
      if (!isCreek(x, z, 2)) tree(x, z, 0.7 + random() * 0.4);
      const lx = riverBounds(z)[side] + (side === 0 ? -0.7 : 0.7);
      dummy.position.set(lx, 1.3, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.06, 2.2, 0.06);
      dummy.updateMatrix();
      lampMatrices.push(dummy.matrix.clone());
      dummy.position.y = 2.45;
      dummy.scale.set(0.2, 0.25, 0.2);
      dummy.updateMatrix();
      bulbMatrices.push(dummy.matrix.clone());
    }
  for (let i = 0; i < 200; i++) {
    const x = -54 + random() * 108,
      z = -39 + random() * 78;
    if (
      !isRiver(x, z, 4) &&
      !isCreek(x, z, 2) &&
      !landmarks.some(
        (l) =>
          Math.abs(x - l.position[0]) < l.width / 2 + 1 &&
          Math.abs(z - l.position[2]) < l.depth / 2 + 1,
      ) &&
      !generic.some(
        (g) =>
          Math.abs(x - g.position.x) < 2.4 && Math.abs(z - g.position.z) < 2.5,
      )
    )
      tree(x, z, 0.7 + random() * 0.65);
  }
  for (const [geo, mat, matrices] of [
    [new T.IcosahedronGeometry(1, 1), p.foliage, treeMatrices],
    [new T.CylinderGeometry(1, 1, 1, 6), p.trim, trunkMatrices],
    [new T.BoxGeometry(1, 1, 1), p.dark, lampMatrices],
    [new T.SphereGeometry(1, 6, 4), p.light, bulbMatrices],
  ] as [T.BufferGeometry, T.Material, T.Matrix4[]][]) {
    const batches =
      mat === p.foliage || mat === p.trim
        ? [
            matrices.filter((_, i) => i % 2 === 0),
            matrices.filter((_, i) => i % 2 === 1),
          ]
        : [matrices];
    batches.forEach((batch, index) => {
      const mesh = new T.InstancedMesh(geo, mat, batch.length);
      batch.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = mat === p.foliage;
      (index === 1 ? details : group).add(mesh);
      if (mat === p.light) lights.push(mesh);
    });
  }
  for (const [x, z] of [
    [-12, 27],
    [12, -22],
    [13, 22],
  ] as [number, number][]) {
    box(group, p.stone, x, 0.4, z, 3, 0.6, 6);
    for (let j = 0; j < 3; j++)
      box(group, p.dark, x + 1.2, 0.6, z - 2 + j * 2, 0.12, 0.8, 0.12);
  }
  const boats: T.Group[] = [];
  for (let i = 0; i < 5; i++) {
    const boat = new T.Group();
    const hull = new T.Mesh(
      new T.CylinderGeometry(1, 1, 1, 5),
      i % 2 ? p.white : p.roof,
    );
    hull.rotation.y = Math.PI / 2;
    hull.scale.set(0.85, 0.4, 2.1);
    boat.add(hull);
    box(boat, p.white, 0, 0.65, 0.1, 1.3, 0.8, 2.5);
    box(boat, p.glass, 0, 1.05, 0.15, 1.15, 0.3, 2.25);
    box(boat, i % 2 ? p.gold : p.rose, 0, 1.28, 0.1, 1.4, 0.15, 2.55);
    if (p.textures.D02) {
      const wake = new T.Mesh(
        new T.PlaneGeometry(3, 6),
        new T.MeshBasicMaterial({
          map: p.textures.D02,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
        }),
      );
      wake.rotation.x = -Math.PI / 2;
      wake.position.set(0, -0.08, 4);
      boat.add(wake);
    }
    boat.position.y = 0.45;
    group.add(boat);
    boats.push(boat);
  }
  const cars: T.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const car = box(
      details,
      i % 3 ? p.white : p.rose,
      0,
      0.45,
      0,
      0.65,
      0.5,
      1.2,
    );
    box(car, p.glass, 0, 0.35, 0, 0.5, 0.2, 0.65);
    cars.push(car);
  }
  const cloudSprites: T.Sprite[] = [];
  if (p.textures.D01)
    for (let i = 0; i < 4; i++) {
      const cloud = new T.Sprite(
        new T.SpriteMaterial({
          map: p.textures.D01,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        }),
      );
      cloud.position.set(-40 + i * 27, 62 + (i % 2) * 4, -30);
      cloud.scale.set(18, 12, 1);
      details.add(cloud);
      cloudSprites.push(cloud);
    }
  // Bake repeated block geometry by material to keep ordinary city blocks cheap.
  const materialGroups = new Map<T.Material, T.BufferGeometry[]>();
  for (const building of generic) {
    building.updateMatrixWorld(true);
    building.traverse((o) => {
      if (o instanceof T.Mesh) {
        const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
        const list = materialGroups.get(o.material as T.Material) ?? [];
        list.push(geo);
        materialGroups.set(o.material as T.Material, list);
      }
    });
    group.remove(building);
  }
  for (const [mat, geos] of materialGroups) {
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    if (merged) {
      const mesh = new T.Mesh(merged, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
      picks.push(mesh);
    }
  }
  group.userData.buildingCount = backgroundCount;
  return {
    group,
    details,
    picks,
    occlusionBounds,
    lights,
    water,
    mirror,
    update(t, dt, night) {
      water.uniforms.uTime.value = t;
      water.uniforms.uNight.value = night;
      boats.forEach((boat, i) => {
        const z =
          ((((t * (i % 2 ? -0.85 : 0.65) + i * 16 + 1000) % 74) + 74) % 74) -
          37;
        const [a, b] = riverBounds(z);
        boat.position.x = (a + b) / 2 + (i % 2 ? -3 : 3);
        boat.position.z = z;
        boat.rotation.y = i % 2 ? 0 : Math.PI;
      });
      cars.forEach((car, i) => {
        const z = wrapRange(t * (i % 2 ? -2 : 2) + i * 7 + 1000, -34, 34);
        car.position.set(i < 5 ? -37 : 53, 0.45, z);
      });
      cloudSprites.forEach((c, i) => {
        c.position.x = -40 + i * 27 + Math.sin(t * 0.025 + i) * 4;
      });
    },
  };
}
