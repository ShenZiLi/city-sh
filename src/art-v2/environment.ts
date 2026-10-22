import * as T from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  bankPosition,
  hash,
  riverAt,
  riverGeometry,
  ribbon,
  cityLayout,
  inCreek,
} from "./layout";
import type { CityAssets } from "./assets";

const cube = new T.BoxGeometry(1, 1, 1);
function instances(
  g: T.BufferGeometry,
  m: T.Material,
  list: { p: T.Vector3; s: T.Vector3; r?: number; c?: string }[],
  parent: T.Group,
) {
  const mesh = new T.InstancedMesh(g, m, list.length),
    dummy = new T.Object3D();
  list.forEach((entry, i) => {
    dummy.position.copy(entry.p);
    dummy.scale.copy(entry.s);
    dummy.rotation.set(0, entry.r ?? 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (entry.c) mesh.setColorAt(i, new T.Color(entry.c));
  });
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}
export async function createEnvironment(assets: CityAssets) {
  const group = new T.Group();
  group.name = "river-and-streets";
  const [paving, leaf, marks, skyMap, wake, cloudMap, lawn] = await Promise.all(
    [
      assets.texture("V208"),
      assets.texture("V205", true),
      assets.texture("V207"),
      assets.texture("V206"),
      assets.texture("V209", true),
      assets.texture("V210", true),
      assets.texture("V212"),
    ],
  );
  const pavement = new T.MeshStandardMaterial({
    map: paving,
    color: "#e5d2ad",
    roughness: 0.92,
  });
  const land = new T.MeshStandardMaterial({
    map: paving,
    color: "#c9c8ba",
    roughness: 1,
  });
  const basePlane = new T.Mesh(
    new T.PlaneGeometry(10000, 10000).rotateX(-Math.PI / 2),
    land,
  );
  basePlane.position.y = -8;
  basePlane.receiveShadow = true;
  group.add(basePlane);
  const asphalt = new T.MeshStandardMaterial({
    color: "#737b7c",
    roughness: 1,
  });
  const stone = new T.MeshStandardMaterial({
    color: "#bdaf92",
    roughness: 0.95,
  });
  for (const side of [-1, 1]) {
    for (const [a, b, y, mat] of [
      [0, 650, -0.15, land],
      [0.3, 13, 0.34, pavement],
      [13, 27, 0.31, asphalt],
      [27, 33, 0.34, pavement],
      [0.1, 0.75, 0.49, stone],
    ] as const) {
      const mesh = new T.Mesh(ribbon(a, b, y, side), mat);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    const wall = new T.Mesh(ribbon(-0.1, 0.3, -0.35, side), stone);
    group.add(wall);
    for (const offset of side < 0
      ? [61, 96, 133, 171, 209, 246, 283, 321]
      : [80, 157, 270]) {
      const street = new T.Mesh(
        ribbon(offset, offset + 7, 0.05, side),
        asphalt,
      );
      street.receiveShadow = true;
      group.add(street);
    }
  }
  // Real tributary surface with a road-sized opening in the western ribbons.
  const creekRiver = riverAt(-314),
    creekShape = new T.Shape();
  const cp = (offset: number, width: number) =>
    creekRiver.point
      .clone()
      .addScaledVector(creekRiver.normal, -(creekRiver.width + offset))
      .addScaledVector(creekRiver.tangent, width);
  const corners = [cp(650, -12), cp(-2, -12), cp(-2, 12), cp(650, 12)];
  creekShape.moveTo(corners[0].x, corners[0].z);
  corners.slice(1).forEach((p) => creekShape.lineTo(p.x, p.z));
  creekShape.closePath();
  const creekGeometry = new T.ShapeGeometry(creekShape, 40);
  creekGeometry.rotateX(Math.PI / 2);
  const creek = new T.Mesh(
    creekGeometry,
    new T.MeshStandardMaterial({
      color: "#6c9fb0",
      side: T.DoubleSide,
      roughness: 0.6,
    }),
  );
  creek.position.y = 0.08;
  group.add(creek);
  const bridge = (await assets.model("bridge")).clone(true);
  bridge.position.copy(bankPosition(-314, -1, 20, 0.08));
  bridge.rotation.y = Math.atan2(
    riverAt(-314).tangent.x,
    riverAt(-314).tangent.z,
  );
  group.add(bridge);
  // One non-repeated sky wrap, with seam blending, painterly clouds and a clean
  // horizon. A restrained atmospheric gradient supplies dusk/night lighting.
  const skyMaterial = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    uniforms: {
      uMap: { value: skyMap },
      uPhase: { value: 0 },
      uHaze: { value: new T.Color("#c9d8dc") },
    },
    vertexShader:
      "varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `
    varying vec3 vDirection;uniform sampler2D uMap;uniform float uPhase;uniform vec3 uHaze;
    void main(){vec3 d=normalize(vDirection);float u=atan(d.z,d.x)/6.2831853+.5;
      float v=.15+asin(clamp(d.y,0.,1.))/.5/3.14159265*.8;vec3 paint=texture2D(uMap,vec2(u,v)).rgb;
      float seam=smoothstep(0.,.035,min(u,1.-u));vec3 edge=(texture2D(uMap,vec2(.01,v)).rgb+texture2D(uMap,vec2(.99,v)).rgb)*.5;
      paint=mix(edge,paint,seam);float dusk=min(uPhase,1.),night=max(uPhase-1.,0.);
      paint=mix(paint,paint*vec3(1.10,.76,.73),dusk*.62);
      paint=mix(paint,paint*vec3(.065,.11,.24),night);
      vec3 horizon=mix(mix(vec3(.87,.89,.84),vec3(.82,.64,.61),dusk),vec3(.045,.075,.14),night);
      paint=mix(uHaze,paint,smoothstep(0.,.045,d.y));gl_FragColor=vec4(paint,1.);
    }`,
  });
  const sky = new T.Mesh(new T.SphereGeometry(2600, 64, 32), skyMaterial);
  sky.name = "painted-sky";
  sky.frustumCulled = false;
  const cloudMaterial = new T.SpriteMaterial({
    map: cloudMap,
    transparent: true,
    depthWrite: false,
    opacity: 0.82,
    color: "#fff5e3",
    fog: false,
  });
  const clouds: T.Sprite[] = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39996,
      sprite = new T.Sprite(cloudMaterial),
      w = 420 + hash(i + 80) * 300;
    sprite.position.set(
      Math.cos(a) * 1750,
      190 + hash(i + 40) * 290,
      Math.sin(a) * 1750,
    );
    sprite.scale.set(w, w * 0.62, 1);
    sky.add(sprite);
    clouds.push(sprite);
  }
  // Reflection geometry is planar in its own local XY plane, as Reflector
  // expects. Sampling world XZ keeps brush strokes stable under orbit/zoom.
  const water = new Reflector(riverGeometry().rotateX(Math.PI / 2), {
    textureWidth: 960,
    textureHeight: 540,
    multisample: 0,
    clipBias: 0.005,
    color: "#397f9e",
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.04;
  water.name = "huangpu";
  const wm = water.material as T.ShaderMaterial;
  wm.uniforms.uFogColor = { value: new T.Color("#c9d8dc") };
  wm.uniforms.uFogNear = { value: 650 };
  wm.uniforms.uFogFar = { value: 1450 };
  wm.uniforms.uMarks = { value: marks };
  wm.uniforms.uPhase = { value: 0 };
  wm.uniforms.uTime = { value: 0 };
  wm.vertexShader = `uniform mat4 textureMatrix;varying vec4 vReflect;varying vec3 vWorld;varying vec2 vRiver;varying float vDistance;void main(){vDistance=-(modelViewMatrix*vec4(position,1.)).z;vReflect=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;vRiver=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  wm.fragmentShader = `uniform sampler2D tDiffuse,uMarks;uniform float uTime,uPhase;varying vec4 vReflect;varying vec3 vWorld;varying vec2 vRiver;varying float vDistance;uniform vec3 uFogColor;uniform float uFogNear,uFogFar;
    void main(){vec2 p=vWorld.xz;vec2 uv=vReflect.xy/vReflect.w;
      vec3 a=texture2D(uMarks,p*vec2(.003,.006)+vec2(uTime*.002,-uTime*.0007)).rgb;
      vec3 b=texture2D(uMarks,p*vec2(.009,.018)-vec2(uTime*.003,uTime*.0004)).rgb;
      float wave=(a.r-b.g);
      vec2 jitter=vec2((a.r-.5)*.009,(b.g-.5)*.008)+vec2(wave*.002,0.);
      vec3 reflected=texture2D(tDiffuse,uv+jitter).rgb;
      float dusk=min(uPhase,1.),night=max(uPhase-1.,0.);vec3 base=mix(mix(vec3(.055,.25,.44),vec3(.10,.18,.34),dusk),vec3(.002,.008,.025),night);
      float shore=pow(abs(vRiver.x-.5)*2.,12.);base=mix(base,vec3(.13,.31,.31)*(1.-night*.8),shore*.52);
      float brush=dot(a,vec3(.333));
      vec3 paintWater=mix(a,b,.65)*vec3(.42,.68,.88)*(1.-night*.985);
      vec3 c=mix(base*(.73+brush*.43),paintWater,.48);
      float lum=dot(reflected,vec3(.2126,.7152,.0722));
      float broken=smoothstep(.32,.63,b.b);
      float reflectionWeight=(.47*(1.-smoothstep(.35,.92,lum))+.025)*(.15+.85*broken);
      c=mix(c,reflected,reflectionWeight);float sparkle=smoothstep(.38,.60,b.g)*smoothstep(.10,.28,a.r);
      vec3 rippleN=normalize(vec3((a.r-b.r)*.9,1.,(a.g-b.g)*.9));
      float glint=pow(max(0.,dot(reflect(-normalize(vec3(-200.,270.,170.)),rippleN),normalize(cameraPosition-vWorld))),12.);
      c+=vec3(.55,.60,.55)*sparkle*(.22+glint*.65)*(1.-night*.93);
      c=mix(c,uFogColor,smoothstep(uFogNear,uFogFar,vDistance));gl_FragColor=vec4(c,1.);
    }`;
  group.add(water);
  const foliage = new T.MeshStandardMaterial({
    map: leaf,
    alphaTest: 0.45,
    side: T.DoubleSide,
    roughness: 1,
    color: "#dfdfb0",
    alphaToCoverage: true,
  });
  const bark = new T.MeshStandardMaterial({ color: "#796a4a", roughness: 1 });
  const gold = new T.MeshStandardMaterial({
    color: "#736549",
    roughness: 0.65,
    metalness: 0.15,
  });
  const lampGlass = new T.MeshStandardMaterial({
    color: "#fff0bd",
    emissive: "#ffc16c",
    emissiveIntensity: 0,
  });
  // A volume of intersecting leaf clusters, with four distinctly shaped crowns.
  const canopyGeometries: T.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const plane = new T.PlaneGeometry(1, 1);
    plane.rotateY(i * 2.39996);
    plane.rotateX((hash(i) - 0.5) * 1.3);
    plane.translate(
      (hash(i + 9) - 0.5) * 0.55,
      (hash(i + 12) - 0.5) * 0.5,
      (hash(i + 22) - 0.5) * 0.55,
    );
    canopyGeometries.push(plane);
  }
  const canopy = mergeGeometries(canopyGeometries)!;
  canopyGeometries.forEach((g) => g.dispose());
  const trees: { p: T.Vector3; s: T.Vector3; r: number; c: string }[] = [],
    trunks: typeof trees = [],
    shrubs: typeof trees = [];
  const shape = [
    [5.4, 5.2, 5.4],
    [4, 7.6, 4],
    [7, 3.6, 6],
    [4.8, 4.8, 4.3],
  ];
  let seed = 0;
  function tree(p: T.Vector3, scale = 1) {
    if (inCreek(p, 5)) return;
    const i = seed++,
      type = i % 4,
      [w, h, d] = shape[type],
      factor = scale * (0.85 + hash(i) * 0.26);
    trees.push({
      p: p.clone().add(new T.Vector3(0, 3.3 + h * 0.24, 0)),
      s: new T.Vector3(w, h, d).multiplyScalar(factor),
      r: hash(i + 5) * 6.28,
      c: ["#c1cd91", "#adbd86", "#bdc786", "#9eae76"][i % 4],
    });
    trunks.push({
      p: p.clone().add(new T.Vector3(0, 2.1 * factor, 0)),
      s: new T.Vector3(0.3, 4.2, 0.3).multiplyScalar(factor),
      r: 0,
      c: "#8c7853",
    });
  }
  for (const side of [-1, 1])
    for (let z = -650; z < 650; z += 8.7) {
      if (side < 0 && z > -340 && z < -290) continue;
      if (side > 0 && Math.abs(z + 100) < 17) continue;
      tree(bankPosition(z, side, 10.9), 0.93);
      if (Math.floor(z) % 3 === 0)
        shrubs.push({
          p: bankPosition(z, side, 11.5, 1),
          s: new T.Vector3(2.7, 1.7, 2.5),
          r: hash(z) * 6,
          c: "#93a765",
        });
    }
  // Pocket parks, street trees and distant groves fill land between blocks.
  for (const side of [-1, 1])
    for (let z = -510; z < 510; z += 26)
      for (const offset of [31, 72, 119, 170, 245, 345]) {
        if (side < 0 && z > -340 && z < -290) continue;
        if (side > 0 && offset > 60 && z < 0 && z > -280) continue;
        tree(
          bankPosition(z + hash(z + offset) * 8, side, offset),
          0.8 + hash(z + offset) * 0.25,
        );
      }
  const buildings = cityLayout();
  const definition = new Map(assets.definitions.map((d) => [d.id, d]));
  const plots: Parameters<typeof instances>[2] = [],
    parkPlots: typeof plots = [];
  for (const b of buildings) {
    if (b.district === "distance") continue;
    const bounds = definition.get(b.assetId)?.boundsBlender;
    if (!bounds) continue;
    plots.push({
      p: new T.Vector3(...b.position).setY(0.09),
      s: new T.Vector3(
        (bounds.max[0] - bounds.min[0]) * b.scale + 4,
        0.12,
        (bounds.max[1] - bounds.min[1]) * b.scale + 4,
      ),
      r: b.rotation,
      c: b.district === "bund" ? "#d4c7af" : "#c4c9c0",
    });
  }
  instances(cube, pavement, plots, group).name = "building-forecourts";
  // Keep open parcels as designed gardens rather than an unbroken green
  // plane. Their small groups of trees give streets an inhabited scale.
  for (const side of [-1, 1])
    for (let z = -420; z < 430; z += 31)
      for (const offset of side < 0
        ? [45, 78, 114, 151, 190, 227, 264, 301]
        : [50, 111, 207, 244, 319]) {
        const p = bankPosition(z, side, offset),
          r = riverAt(z);
        if (
          inCreek(p, 18) ||
          !buildings.every(
            (b) =>
              Math.hypot(b.position[0] - p.x, b.position[2] - p.z) >
              (b.landmarkId ? 31 : 26),
          )
        )
          continue;
        parkPlots.push({
          p: p.clone().setY(0.13),
          s: new T.Vector3(18, 0.15, 21),
          r: Math.atan2(r.tangent.x, r.tangent.z),
        });
        for (let n = 0; n < 5; n++)
          tree(
            p
              .clone()
              .add(
                new T.Vector3(
                  (hash(z + n) - 0.5) * 15,
                  0,
                  (hash(offset + n) - 0.5) * 17,
                ),
              ),
            1.12 + hash(n + z) * 0.24,
          );
      }
  instances(
    cube,
    new T.MeshStandardMaterial({
      map: lawn,
      color: "#bfc4a0",
      roughness: 1,
    }),
    parkPlots,
    group,
  ).name = "painted-pocket-gardens";
  for (const side of [-1, 1])
    for (let z = -360; z < 330; z += 15)
      for (let offset = 37; offset < 340; offset += 18) {
        if (side < 0 && z > -340 && z < -290) continue;
        const p = bankPosition(
          z + hash(z + offset) * 6,
          side,
          offset + hash(z - offset) * 6,
        );
        const clear = buildings.every(
          (b) =>
            Math.hypot(b.position[0] - p.x, b.position[2] - p.z) >
            (b.landmarkId ? 20 : 17),
        );
        if (clear && hash(z + offset) > 0.36)
          tree(p, 0.83 + hash(z - offset) * 0.3);
      }
  const leaves = instances(canopy, foliage, trees, group);
  leaves.name = "four-crown-families";
  leaves.castShadow = true;
  instances(new T.CylinderGeometry(1, 1.4, 1, 6), bark, trunks, group);
  instances(canopy, foliage, shrubs, group);
  const rails: Parameters<typeof instances>[2] = [],
    posts: typeof rails = [],
    lamps: typeof rails = [],
    bulbs: typeof rails = [],
    markings: typeof rails = [],
    cars: typeof rails = [],
    people: typeof rails = [];
  for (const side of [-1, 1])
    for (let z = -620; z < 620; z += 5) {
      if (side < 0 && z > -330 && z < -295) continue;
      const r = riverAt(z),
        angle = Math.atan2(r.tangent.x, r.tangent.z);
      posts.push({
        p: bankPosition(z, side, 1.1, 0.95),
        s: new T.Vector3(0.13, 1.15, 0.13),
        r: angle,
      });
      for (const y of [0.86, 1.38])
        rails.push({
          p: bankPosition(z + 2.5, side, 1.1, y),
          s: new T.Vector3(0.09, 0.09, 5.4),
          r: angle,
        });
      if (Math.round(z) % 20 === 0) {
        const p = bankPosition(z, side, 3.6, 2.9);
        lamps.push({ p, s: new T.Vector3(0.13, 5.2, 0.13) });
        bulbs.push({
          p: p.clone().setY(5.75),
          s: new T.Vector3(0.57, 0.8, 0.57),
        });
      }
      if (Math.round(z) % 10 === 0)
        markings.push({
          p: bankPosition(z, side, 20, 0.34),
          s: new T.Vector3(0.12, 0.02, 3.5),
          r: angle,
        });
    }
  for (let i = 0; i < 65; i++) {
    const side = i % 2 ? -1 : 1,
      z = -400 + hash(i + 20) * 800,
      r = riverAt(z),
      angle = Math.atan2(r.tangent.x, r.tangent.z);
    cars.push({
      p: bankPosition(z, side, i % 3 ? 17.3 : 23.2, 1),
      s: new T.Vector3(1.5, 1.15, 3.7),
      r: angle,
      c: ["#e9e1c6", "#655f50", "#748c95", "#b49c79", "#a6503e"][i % 5],
    });
  }
  for (let i = 0; i < 180; i++) {
    const side = i % 2 ? -1 : 1,
      z = -360 + hash(i + 290) * 720;
    people.push({
      p: bankPosition(z, side, 4 + hash(i) * 4, 1.15),
      s: new T.Vector3(0.29, 1.5, 0.3),
      r: hash(i) * 6,
      c: ["#696253", "#bfa47e", "#8f6758", "#627888", "#d4c3a1"][i % 5],
    });
  }
  instances(cube, gold, rails, group);
  instances(cube, stone, posts, group);
  instances(cube, gold, lamps, group);
  instances(new T.SphereGeometry(1, 6, 5), lampGlass, bulbs, group);
  instances(
    cube,
    new T.MeshStandardMaterial({ color: "#d8cfaf", roughness: 1 }),
    markings,
    group,
  );
  instances(
    cube,
    new T.MeshStandardMaterial({ color: "#ffffff", roughness: 0.7 }),
    cars,
    group,
  );
  instances(
    new T.CapsuleGeometry(0.5, 0.5, 2, 5),
    new T.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }),
    people,
    group,
  );
  for (const side of [-1, 1])
    for (const z of [-270, -15, 165, 310]) {
      const pier = new T.Mesh(new T.BoxGeometry(5.4, 0.6, 17), pavement);
      pier.position.copy(bankPosition(z, side, -6, 0.43));
      pier.rotation.y = Math.atan2(riverAt(z).tangent.x, riverAt(z).tangent.z);
      pier.receiveShadow = true;
      group.add(pier);
    }
  const boats: {
    root: T.Group;
    wake: T.Mesh;
    offset: number;
    lane: number;
    direction: number;
  }[] = [];
  const templates = await Promise.all([
    assets.model("boat-0"),
    assets.model("boat-1"),
  ]);
  for (let i = 0; i < 9; i++) {
    const root = templates[i % 2].clone(true);
    // Moving hull shadows would fall on custom water, which does not sample a
    // shadow map. Keep the useful architectural shadows entirely static.
    root.traverse((o) => {
      if (o instanceof T.Mesh) o.castShadow = false;
    });
    const wakeMesh = new T.Mesh(
      new T.PlaneGeometry(10, 30),
      new T.MeshBasicMaterial({
        map: wake,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    wakeMesh.rotation.x = -Math.PI / 2;
    wakeMesh.position.set(0, 0.1, -22);
    wakeMesh.rotation.z = Math.PI;
    root.add(wakeMesh);
    root.scale.setScalar(0.8 + hash(i) * 0.35);
    group.add(root);
    boats.push({
      root,
      wake: wakeMesh,
      offset: -340 + i * 74,
      lane: i % 2 ? -27 : 25,
      direction: i % 2 ? 1 : -1,
    });
  }
  let lastReflection = -1;
  const reflect = water.onBeforeRender.bind(water);
  let elapsed = 0,
    quality: "high" | "low" = "high";
  water.onBeforeRender = (...args) => {
    if (elapsed - lastReflection < (quality === "high" ? 0.05 : 0.12)) return;
    lastReflection = elapsed;
    const old = leaves.visible,
      oldSky = sky.visible;
    leaves.visible = false;
    sky.visible = false;
    try {
      reflect(...args);
    } finally {
      leaves.visible = old;
      sky.visible = oldSky;
    }
  };
  return {
    group,
    sky,
    water,
    skyMaterial,
    waterMaterial: wm,
    boats,
    update(time: number, phase: number, motion: boolean) {
      elapsed = time;
      wm.uniforms.uPhase.value = phase;
      wm.uniforms.uTime.value = motion ? time : 0;
      skyMaterial.uniforms.uPhase.value = phase;
      lampGlass.emissiveIntensity = Math.max(0, phase - 0.65) * 1.25;
      cloudMaterial.color
        .set("#fff5e3")
        .lerp(new T.Color("#f4b9ab"), Math.min(phase, 1))
        .lerp(new T.Color("#274565"), Math.max(phase - 1, 0));
      cloudMaterial.opacity = 0.82 - Math.max(phase - 1, 0) * 0.4;
      for (const boat of boats) {
        const z = motion
          ? T.MathUtils.euclideanModulo(
              boat.offset + time * boat.direction * 1.5 + 450,
              900,
            ) - 450
          : boat.offset;
        const r = riverAt(z);
        boat.root.position.copy(r.point).addScaledVector(r.normal, boat.lane);
        boat.root.position.y = 0.18;
        boat.root.rotation.y =
          Math.atan2(r.tangent.x, r.tangent.z) +
          (boat.direction < 0 ? Math.PI : 0);
        boat.wake.visible = motion;
      }
    },
    resize(width: number, height: number, q: "high" | "low") {
      quality = q;
      water
        .getRenderTarget()
        .setSize(
          Math.floor(width / (q === "high" ? 2 : 4)),
          Math.floor(height / (q === "high" ? 2 : 4)),
        );
      lastReflection = -1;
    },
    invalidate() {
      lastReflection = -1;
    },
    dispose() {
      const geometries = new Set<T.BufferGeometry>(),
        materials = new Set<T.Material>();
      group.traverse((o) => {
        if (o instanceof T.Mesh && !o.userData.libraryOwned) {
          geometries.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            materials.add(m);
        }
        if (o instanceof T.InstancedMesh) o.dispose();
      });
      geometries.add(sky.geometry);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      cloudMaterial.dispose();
      clouds[0]?.geometry.dispose();
      skyMaterial.dispose();
      water.getRenderTarget().dispose();
    },
  };
}
