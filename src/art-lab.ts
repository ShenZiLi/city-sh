import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import {
  ArtLibrary,
  disposeArtObjects,
  type ArtModelDefinition,
} from "./art-library";
import { ScalarTransition } from "./transition";
import { riverCenter, riverTangent, riverRibbon } from "./art-terrain";
import type { TimeOfDay, Quality } from "./types";
import "./art-lab.css";

const byId = <E extends HTMLElement>(id: string) =>
  document.getElementById(id) as E;
const status = byId("art-status");
const panel = document.querySelector(".art-panel")!;
const formControls = [
  ...panel.querySelectorAll<HTMLInputElement>("button,select"),
];
formControls.forEach((control) => (control.disabled = true));

async function boot() {
  const base = import.meta.env.BASE_URL;
  const host = byId("art-canvas");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const response = await fetch(base + "assets/renovation/models/manifest.json");
  if (!response.ok) throw new Error(`模型清单加载失败（${response.status}）`);
  const manifest = (await response.json()) as { assets: ArtModelDefinition[] };
  const renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    "aria-label",
    "可拖动环绕的浦江三维局部样片；方向键旋转，正反面按钮切换视角",
  );
  host.append(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 1, 0.2, 1500);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.065;
  orbit.enablePan = false;
  orbit.minPolarAngle = T.MathUtils.degToRad(12);
  orbit.maxPolarAngle = T.MathUtils.degToRad(78);
  orbit.autoRotate = false;
  orbit.autoRotateSpeed = 0.35;
  let phase = new ScalarTransition(0, reduced.matches ? 0.1 : 2.4);
  let motionReduced = reduced.matches;
  const night = { value: 0 };
  const accentMaterials = new Map<T.MeshStandardMaterial, number>();
  const templates = new Map<string, T.Group>();
  let elapsed = 0,
    lastTime = performance.now(),
    frame = 0,
    disposed = false;
  let contextLost = false,
    subject = "scene",
    level = 0,
    revision = 0;
  let quality: Quality = innerWidth < 680 ? "low" : "high";
  let time: TimeOfDay = "day",
    reverse = false,
    labelsEnabled = false;
  let mainCalls = 0,
    totalCalls = 0,
    lastReflect = -1,
    lastMetric = 0;
  const frameTimes: number[] = [];
  const ownedTextures = new Set<T.Texture>();
  const listeners = new AbortController();
  const texture = async (id: string, extension = "webp") => {
    const value = await new T.TextureLoader().loadAsync(
      `${base}assets/${id}.${extension}`,
    );
    value.colorSpace = T.SRGBColorSpace;
    value.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    value.wrapS = value.wrapT = T.RepeatWrapping;
    ownedTextures.add(value);
    return value;
  };
  const library = new ArtLibrary(manifest.assets, base, (material) => {
    material.roughness = Math.max(0.55, material.roughness);
    material.metalness = Math.min(0.18, material.metalness);
    if (
      material.name.startsWith("Ivory_Stone") ||
      material.name.startsWith("Pearl_Cream")
    ) {
      material.emissive.set("#e3a56c");
      accentMaterials.set(material, 0.09);
    } else if (material.name.startsWith("Pearl_Rose")) {
      material.emissive.set("#e44e71");
      accentMaterials.set(material, 0.2);
    }
    if (material.map)
      material.map.anisotropy = Math.min(
        8,
        renderer.capabilities.getMaxAnisotropy(),
      );
    if (material.name.includes("Facade") && material.map) {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uArtNight = night;
        shader.uniforms.uArtModern = {
          value: material.name.startsWith("Modern") ? 1 : 0,
        };
        shader.fragmentShader =
          "uniform float uArtNight,uArtModern;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          float windowMask = smoothstep(.015,.075,diffuseColor.b-diffuseColor.r*1.1);
          float selectedWindow = step(.38,fract(sin(dot(floor(vMapUv*vec2(30.,20.)),vec2(12.98,78.23)))*43758.54));
          vec2 paneGrid=(vMapUv-vec2(.006,.506))/.488*vec2(3.,6.);
          vec2 cell=fract(paneGrid);
          float modernMask=smoothstep(.22,.27,cell.x)*(1.-smoothstep(.73,.78,cell.x))*smoothstep(.22,.27,cell.y)*(1.-smoothstep(.7,.75,cell.y));
          modernMask*=step(.85,fract(sin(dot(floor(paneGrid),vec2(12.98,78.23)))*43758.54));
          float litMask=mix(windowMask*selectedWindow,modernMask,uArtModern);
          totalEmissiveRadiance += vec3(1.,.48,.16)*litMask*uArtNight*mix(.65,.28,uArtModern);`,
        );
      };
      material.customProgramCacheKey = () => "art-facade-windows-v2";
    } else if (material.name.startsWith("Pearl_Rose") && material.map) {
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `
          vec2 artUv=vec2(.006,.006)+fract((vMapUv-vec2(.006,.006))/.488*vec2(6.,3.))*.488;
          diffuseColor*=texture2D(map,artUv);`,
        );
      };
      material.customProgramCacheKey = () => "art-pearl-cladding-v1";
    }
  });
  const ambient = new T.HemisphereLight("#c6dfff", "#c2a780", 2.1);
  const sun = new T.DirectionalLight("#fff0cf", 3.0);
  sun.position.set(-80, 120, 65);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -105,
    right: 105,
    top: 125,
    bottom: -125,
    near: 1,
    far: 330,
  });
  sun.shadow.normalBias = 0.12;
  sun.shadow.bias = -0.0002;
  const fill = new T.DirectionalLight("#a1c8ec", 0.45);
  fill.position.set(80, 50, -80);
  scene.add(ambient, sun, sun.target, fill);
  const fog = new T.FogExp2("#b4d0e3", 0.0015);
  scene.fog = fog;

  try {
    for (const [index, definition] of manifest.assets.entries()) {
      status.textContent = `载入建筑 ${index + 1}/${manifest.assets.length}：${definition.name}`;
      templates.set(definition.id, await library.model(definition.id));
    }
    const [foliage, pavement, waterMarks, daySky, duskSky, nightSky, wakeMap] =
      await Promise.all([
        texture("T08"),
        texture("T07"),
        texture("T09"),
        texture("renovation/textures/RT04-day"),
        texture("renovation/textures/RT04-dusk"),
        texture("renovation/textures/RT04-night"),
        texture("D02", "png"),
      ]);
    [daySky, duskSky, nightSky].forEach((map) => {
      map.wrapS = T.MirroredRepeatWrapping;
      map.needsUpdate = true;
    });
    const skyUniforms = {
      uPhase: { value: 0 },
      uHaze: { value: fog.color },
      uDay: { value: daySky },
      uDusk: { value: duskSky },
      uNight: { value: nightSky },
    };
    const sky = new T.Mesh(
      new T.SphereGeometry(900, 48, 24),
      new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        uniforms: skyUniforms,
        vertexShader:
          "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader: `varying vec2 vUv;uniform float uPhase;uniform vec3 uHaze;uniform sampler2D uDay,uDusk,uNight;
        void main(){vec2 uv=vec2(vUv.x*4.,clamp((vUv.y-.48)*6.,0.,1.));vec3 a=texture2D(uDay,uv).rgb;
        vec3 b=texture2D(uDusk,uv).rgb,c=texture2D(uNight,uv).rgb;
        vec3 col=mix(mix(a,b,min(uPhase,1.)),c,max(uPhase-1.,0.));col*=mix(1.,.16,max(uPhase-1.,0.));col=mix(uHaze,col,smoothstep(.48,.54,vUv.y));gl_FragColor=vec4(col,1.);}`,
      }),
    );
    scene.add(sky);
    const landscape = new T.Group();
    const backgroundModels = new T.Group();
    landscape.add(backgroundModels);
    const actors = new T.Group();
    scene.add(landscape, actors);
    const stone = new T.MeshStandardMaterial({
      color: "#d3c19a",
      roughness: 0.95,
      map: pavement,
    });
    pavement.repeat.set(1, 180);
    const ground = new T.MeshStandardMaterial({
      color: "#d2c9b4",
      roughness: 1,
    });
    const addBox = (
      parent: T.Group,
      position: [number, number, number],
      size: [number, number, number],
      material: T.Material,
    ) => {
      const mesh = new T.Mesh(new T.BoxGeometry(...size), material);
      mesh.position.set(...position);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    for (const side of [-1, 1]) {
      const boundaries = side < 0 ? [-700, -20] : [20, 700];
      const land = new T.Mesh(
        riverRibbon(boundaries[0], boundaries[1], -0.12),
        ground,
      );
      const path = new T.Mesh(
        riverRibbon(side < 0 ? -26 : 20, side < 0 ? -20 : 26, 0.13),
        stone,
      );
      const roadside = new T.Mesh(
        riverRibbon(side < 0 ? -49 : 34, side < 0 ? -34 : 49, 0.05),
        stone,
      );
      land.receiveShadow = path.receiveShadow = roadside.receiveShadow = true;
      landscape.add(land, path, roadside);
    }
    const water = new Reflector(riverRibbon(-20, 20, 0).rotateX(Math.PI / 2), {
      textureWidth: 960,
      textureHeight: 540,
      clipBias: 0.003,
      color: "#468eb5",
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.02;
    const waterMaterial = water.material as T.ShaderMaterial;
    waterMaterial.uniforms.uTime = { value: 0 };
    waterMaterial.uniforms.uPhase = { value: 0 };
    waterMaterial.uniforms.uMarks = { value: waterMarks };
    waterMaterial.vertexShader = `uniform mat4 textureMatrix;varying vec4 vUv;varying vec2 vLocal;
      void main(){vLocal=position.xy;vUv=textureMatrix*vec4(position,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
    waterMaterial.fragmentShader = `uniform sampler2D tDiffuse,uMarks;uniform float uTime,uPhase;varying vec4 vUv;varying vec2 vLocal;
      void main(){vec2 uv=vUv.xy/vUv.w;float wave=sin(vLocal.y*.8+uTime*.9)*sin(vLocal.x*.9-uTime*.7);
      vec2 ripple=vec2(wave*.0018,sin(vLocal.y*1.9-uTime*.6)*.0008);
      vec3 reflected=texture2D(tDiffuse,uv+ripple).rgb;
      vec3 marks=texture2D(uMarks,vLocal*vec2(.08,.035)+vec2(uTime*.004,-uTime*.002)).rgb;
      float fleck=smoothstep(.28,.43,dot(marks,vec3(.33))+wave*.045);
      vec3 day=vec3(.015,.16,.34),dusk=vec3(.055,.09,.25),night=vec3(.008,.025,.08);
      vec3 color=mix(mix(day,dusk,min(uPhase,1.)),night,max(uPhase-1.,0.));
      float center=sin(-vLocal.y/105.)*10.+sin(-vLocal.y/230.)*6.;
      float shore=smoothstep(14.,20.,abs(vLocal.x-center));color=mix(color,vec3(.13,.31,.32),shore*.3);
      color=mix(color,reflected,.28)+vec3(.32,.43,.45)*fleck*.19*(1.-.85*max(uPhase-1.,0.));gl_FragColor=vec4(color,1.);}`;
    const reflect = water.onBeforeRender.bind(water);
    water.onBeforeRender = (...args) => {
      if (elapsed - lastReflect < (quality === "high" ? 0.05 : 0.12)) return;
      lastReflect = elapsed;
      reflect(...args);
    };
    landscape.add(water);
    const normalMaterial = new T.MeshNormalMaterial();
    const normalTarget = new T.WebGLRenderTarget(960, 540, {
      depthTexture: new T.DepthTexture(960, 540),
    });
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const paint = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        tNormal: { value: normalTarget.texture },
        tDepth: { value: normalTarget.depthTexture },
        pixel: { value: new T.Vector2(1 / 960, 1 / 540) },
        edgeStrength: { value: 0.1 },
        paperStrength: { value: 0.0035 },
      },
      vertexShader:
        "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `uniform sampler2D tDiffuse,tNormal,tDepth;uniform vec2 pixel;uniform float edgeStrength,paperStrength;varying vec2 vUv;
      void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;vec3 n=texture2D(tNormal,vUv).rgb;
      float e=length(n-texture2D(tNormal,vUv+vec2(pixel.x,0.)).rgb)+length(n-texture2D(tNormal,vUv+vec2(0.,pixel.y)).rgb);
      float depth=texture2D(tDepth,vUv).x;float edge=smoothstep(.3,1.15,e)*step(depth,.9999);
      float grain=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)-.5;
      c*=1.-edge*edgeStrength;c+=grain*paperStrength;gl_FragColor=vec4(max(c,vec3(0.)),1.);}`,
    });
    composer.addPass(paint);
    const bloom = new UnrealBloomPass(
      new T.Vector2(960, 540),
      0.08,
      0.35,
      1.15,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const corePositions: Record<
      string,
      { p: [number, number, number]; rotation: number }
    > = {
      pearl: { p: [39, 0.3, -28], rotation: 0 },
      customs: { p: [-38, 0.3, -9], rotation: Math.PI / 2 },
      hsbc: { p: [-40, 0.3, 27], rotation: Math.PI / 2 },
    };
    const core = new Map<string, T.Group>();
    function populateActors() {
      actors.clear();
      core.clear();
      for (const id of ["pearl", "customs", "hsbc"]) {
        const group = templates.get(id)!.clone(true);
        group.userData.landmarkId = id;
        group.position.set(...corePositions[id].p);
        group.position.x += riverCenter(group.position.z);
        group.rotation.y = corePositions[id].rotation;
        core.set(id, group);
        actors.add(group);
      }
    }
    populateActors();
    const hash = (n: number) =>
      T.MathUtils.euclideanModulo(Math.sin(n * 127.1 + 31.7) * 43758.5453, 1);
    function instances(
      id: string,
      placements: { p: T.Vector3; scale: T.Vector3; rotation: number }[],
    ) {
      const template = templates.get(id)!;
      template.updateMatrixWorld(true);
      template.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;
        const mesh = new T.InstancedMesh(
          object.geometry,
          object.material,
          placements.length,
        );
        const matrix = new T.Matrix4(),
          quaternion = new T.Quaternion();
        placements.forEach((entry, index) => {
          quaternion.setFromAxisAngle(T.Object3D.DEFAULT_UP, entry.rotation);
          matrix
            .compose(
              entry.p.clone().add(new T.Vector3(riverCenter(entry.p.z), 0, 0)),
              quaternion,
              entry.scale,
            )
            .multiply(object.matrixWorld);
          mesh.setMatrixAt(index, matrix);
        });
        mesh.userData.libraryOwned = true;
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        backgroundModels.add(mesh);
      });
    }
    const heritage: { p: T.Vector3; scale: T.Vector3; rotation: number }[] = [];
    const modern: typeof heritage = [];
    for (let row = 0; row < 9; row++)
      for (let col = 0; col < 3; col++) {
        const i = row * 3 + col;
        heritage.push({
          p: new T.Vector3(
            -55 - col * 21 + hash(i + 11) * 4,
            0.25,
            (row - 4) * 24 + hash(i + 87) * 5,
          ),
          scale: new T.Vector3(
            0.8 + hash(i) * 0.45,
            0.65 + hash(i + 200) * 0.9,
            0.8 + hash(i + 30) * 0.4,
          ),
          rotation: Math.PI / 2,
        });
        const z = (row - 4) * 25 + hash(i + 4) * 6;
        modern.push({
          p: new T.Vector3(65 + col * 23 + hash(i + 18) * 6, 0.25, z),
          scale: new T.Vector3(
            0.8 + hash(i + 70) * 0.7,
            (0.6 + hash(i + 99) * 1.1) * (z > 25 ? 0.6 : 1),
            0.9 + hash(i + 20) * 0.6,
          ),
          rotation: -Math.PI / 2,
        });
      }
    for (const z of [-77, -54, 57, 82])
      heritage.push({
        p: new T.Vector3(-39, 0.25, z),
        scale: new T.Vector3(1, 1, 1),
        rotation: Math.PI / 2,
      });
    // Context remains true volumetric geometry. It is intentionally low-detail
    // sample context, not additional approved landmark or city asset families.
    for (let row = 0; row < 20; row++)
      for (let col = 0; col < 7; col++) {
        const i = 100 + row * 7 + col,
          z = (row - 10) * 35 + hash(i) * 12;
        if (Math.abs(z) < 120 && col < 3) continue;
        heritage.push({
          p: new T.Vector3(-55 - col * 24 + hash(i + 3) * 8, 0.2, z),
          scale: new T.Vector3(
            0.75 + hash(i + 6) * 0.5,
            0.7 + hash(i + 8) * 2.1,
            0.8 + hash(i + 9) * 0.5,
          ),
          rotation: Math.PI / 2,
        });
        modern.push({
          p: new T.Vector3(62 + col * 26 + hash(i + 2) * 8, 0.2, z),
          scale: new T.Vector3(
            0.8 + hash(i + 4) * 0.7,
            0.5 + hash(i + 7) * 1.8,
            0.9 + hash(i + 10) * 0.6,
          ),
          rotation: -Math.PI / 2,
        });
      }
    instances("heritage", heritage);
    instances("modern", modern);
    const leaves = new T.MeshStandardMaterial({
      map: foliage,
      color: "#739652",
      roughness: 1,
    });
    const bark = new T.MeshStandardMaterial({ color: "#79694b", roughness: 1 });
    const crowns = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 1),
      leaves,
      2 * 45 * 5,
    );
    const trunks = new T.InstancedMesh(
      new T.CylinderGeometry(0.15, 0.21, 2, 6),
      bark,
      2 * 45,
    );
    const dummy = new T.Object3D();
    let treeIndex = 0,
      crownIndex = 0;
    for (const side of [-1, 1])
      for (let i = 0; i < 45; i++) {
        const z = (i - 22) * 6.4 + hash(i + 70) * 1.1;
        if (side > 0 && Math.abs(z + 28) < 12) continue;
        const x = side * (28.3 + hash(i + 91) * 0.6) + riverCenter(z);
        dummy.position.set(x, 1.5, z);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        trunks.setMatrixAt(treeIndex++, dummy.matrix);
        for (let lobe = 0; lobe < 5; lobe++) {
          const a = (lobe * Math.PI * 2) / 5;
          dummy.position.set(
            x + Math.cos(a) * (0.7 + hash(i) * 0.6),
            3 + hash(i + lobe) * 1.5,
            z + Math.sin(a) * 0.9,
          );
          dummy.scale.set(
            0.9 + hash(i) * 0.9,
            1.0 + hash(i + 20) * 1.1,
            1.05 + hash(i + 30) * 0.6,
          );
          dummy.rotation.y = hash(i + lobe) * 6.28;
          dummy.updateMatrix();
          crowns.setMatrixAt(crownIndex++, dummy.matrix);
        }
      }
    crowns.count = crownIndex;
    trunks.count = treeIndex;
    crowns.castShadow = trunks.castShadow = true;
    landscape.add(crowns, trunks);
    const boats: { group: T.Group; wake: T.Mesh; offset: number }[] = [];
    const white = new T.MeshStandardMaterial({
      color: "#efe6ce",
      roughness: 0.8,
    });
    const blue = new T.MeshStandardMaterial({
      color: "#284e61",
      roughness: 0.65,
    });
    for (let i = 0; i < 2; i++) {
      const group = new T.Group();
      addBox(group, [0, 0.6, 0], [2.1, 1, 5.8], blue);
      addBox(group, [0, 1.3, -0.1], [2.05, 0.35, 5.1], white);
      addBox(group, [0, 1.9, -0.4], [1.7, 0.8, 3.8], white);
      for (const side of [-1, 1])
        addBox(group, [side * 0.865, 1.93, -0.4], [0.03, 0.4, 3.3], blue);
      addBox(group, [0, 2.4, -0.4], [1.9, 0.15, 4.1], white);
      const wake = new T.Mesh(
        new T.PlaneGeometry(5, 14),
        new T.MeshBasicMaterial({
          map: wakeMap,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        }),
      );
      wake.rotation.x = -Math.PI / 2;
      wake.position.set(0, 0.08, 8);
      group.add(wake);
      landscape.add(group);
      boats.push({ group, wake, offset: i * 70 });
    }

    const labels = [...core].map(([id, root]) => {
      const element = document.createElement("span");
      element.className = "art-label";
      element.hidden = true;
      element.textContent = manifest.assets.find((a) => a.id === id)!.name;
      host.append(element);
      return { id, element, root };
    });
    const ray = new T.Raycaster();
    function updateLabels() {
      for (const label of labels) {
        const root = core.get(label.id);
        const anchor = root?.getObjectByName("label-anchor");
        if (!labelsEnabled || !root?.visible || !anchor) {
          label.element.hidden = true;
          continue;
        }
        const position = anchor.getWorldPosition(new T.Vector3()),
          ndc = position.clone().project(camera);
        const direction = position.clone().sub(camera.position),
          distance = direction.length();
        ray.set(camera.position, direction.normalize());
        const hit = ray.intersectObjects([...core.values()], true)[0];
        const visible =
          ndc.z >= -1 &&
          ndc.z <= 1 &&
          Math.abs(ndc.x) < 0.95 &&
          Math.abs(ndc.y) < 0.95 &&
          (!hit || hit.distance >= distance - 0.5);
        label.element.hidden = !visible;
        label.element.style.left = `${(ndc.x * 0.5 + 0.5) * host.clientWidth}px`;
        label.element.style.top = `${(-ndc.y * 0.5 + 0.5) * host.clientHeight}px`;
      }
    }
    function setView(back = false) {
      reverse = back;
      if (subject === "scene") {
        camera.position.set(back ? -14 : 14, 50, back ? -155 : 155);
        orbit.target.set(0, 22, back ? 20 : -20);
        orbit.minDistance = 85;
        orbit.maxDistance = 340;
      } else {
        const root = core.get(subject) ?? actors.children[0];
        const box = new T.Box3().setFromObject(root),
          center = box.getCenter(new T.Vector3()),
          size = box.getSize(new T.Vector3());
        const radius =
          Math.max(size.y, size.x / Math.max(camera.aspect, 0.6), size.z) * 2.1;
        orbit.target.copy(center);
        camera.position
          .copy(center)
          .add(
            new T.Vector3(
              back ? -radius * 0.55 : radius * 0.55,
              radius * 0.33,
              back ? -radius : radius,
            ),
          );
        orbit.minDistance = radius * 0.55;
        orbit.maxDistance = radius * 3;
      }
      camera.lookAt(orbit.target);
      orbit.update();
    }
    function setSubject(value: string) {
      subject = value;
      landscape.visible = value === "scene";
      actors.clear();
      core.clear();
      if (value === "scene") populateActors();
      else {
        const group = templates.get(value)?.clone(true);
        if (!group) throw new Error(`Unknown sample asset: ${value}`);
        core.set(value, group);
        actors.add(group);
      }
      byId<HTMLSelectElement>("art-subject").value = value;
      setView(false);
    }
    async function setLod(value: number) {
      const request = ++revision;
      status.textContent = "正在切换建筑细节…";
      const variants = await Promise.all(
        manifest.assets.map(
          async (a) => [a.id, await library.model(a.id, value)] as const,
        ),
      );
      if (disposed || request !== revision) return;
      variants.forEach(([id, model]) => templates.set(id, model));
      backgroundModels.traverse((object) => {
        if (object instanceof T.InstancedMesh) object.dispose();
      });
      backgroundModels.clear();
      instances("heritage", heritage);
      instances("modern", modern);
      level = value;
      const previous = subject,
        position = camera.position.clone(),
        target = orbit.target.clone(),
        wasReverse = reverse;
      setSubject(previous);
      camera.position.copy(position);
      orbit.target.copy(target);
      reverse = wasReverse;
      orbit.update();
      byId<HTMLSelectElement>("art-lod").value = String(value);
      status.textContent = "独立 GLB 模型已载入 · 画面仍待视觉验收";
    }
    function resize() {
      const width = host.clientWidth,
        height = host.clientHeight;
      const pixelRatio = Math.min(
        devicePixelRatio,
        quality === "high" ? 1.75 : 1,
        (quality === "high" ? 1920 : 1536) / width,
        (quality === "high" ? 1080 : 864) / height,
      );
      const drawWidth = Math.max(1, Math.round(width * pixelRatio)),
        drawHeight = Math.max(1, Math.round(height * pixelRatio));
      renderer.setPixelRatio(1);
      renderer.setSize(drawWidth, drawHeight, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      composer.setPixelRatio(1);
      composer.setSize(drawWidth, drawHeight);
      const buffer = renderer.getDrawingBufferSize(new T.Vector2());
      normalTarget.setSize(
        Math.max(1, Math.floor(buffer.x / 2)),
        Math.max(1, Math.floor(buffer.y / 2)),
      );
      paint.uniforms.pixel.value.set(
        1 / normalTarget.width,
        1 / normalTarget.height,
      );
      water
        .getRenderTarget()
        .setSize(
          Math.max(1, Math.floor(buffer.x / (quality === "high" ? 2 : 4))),
          Math.max(1, Math.floor(buffer.y / (quality === "high" ? 2 : 4))),
        );
      paint.uniforms.edgeStrength.value = quality === "high" ? 0.1 : 0;
      sun.shadow.mapSize.setScalar(quality === "high" ? 2048 : 1024);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();
    setView(false);
    function syncMotionPreference() {
      if (motionReduced !== reduced.matches) {
        const current = phase.value(elapsed);
        motionReduced = reduced.matches;
        phase = new ScalarTransition(current, motionReduced ? 0.1 : 2.4);
        phase.to(["day", "dusk", "night"].indexOf(time), elapsed);
      }
      if (motionReduced && orbit.autoRotate) stopRotation();
    }
    function setTime(value: TimeOfDay) {
      syncMotionPreference();
      time = value;
      phase.to(["day", "dusk", "night"].indexOf(value), elapsed);
      panel
        .querySelectorAll<HTMLButtonElement>("[data-time]")
        .forEach((button) =>
          button.setAttribute(
            "aria-pressed",
            String(button.dataset.time === value),
          ),
        );
    }
    const colors = {
      day: new T.Color("#b6d3e8"),
      dusk: new T.Color("#b8a8b8"),
      night: new T.Color("#18263e"),
    };
    function renderFrame(dt: number) {
      const p = phase.value(elapsed),
        d = Math.min(p, 1),
        n = Math.max(p - 1, 0);
      night.value = T.MathUtils.smoothstep(p, 0.7, 2);
      accentMaterials.forEach((strength, material) => {
        material.emissiveIntensity = night.value * strength;
      });
      fog.color.copy(colors.day).lerp(colors.dusk, d).lerp(colors.night, n);
      fog.density = 0.0018 + n * 0.0004;
      scene.background =
        subject === "scene"
          ? fog.color
          : new T.Color(time === "night" ? "#263442" : "#e8e3d6");
      sky.visible = subject === "scene";
      skyUniforms.uPhase.value = p;
      waterMaterial.uniforms.uPhase.value = p;
      waterMaterial.uniforms.uTime.value = reduced.matches ? 0 : elapsed;
      ambient.intensity = T.MathUtils.lerp(1.0, 0.5, n);
      ambient.color.set("#c8dfff").lerp(new T.Color("#929cc7"), d);
      sun.color
        .set("#fff0d3")
        .lerp(new T.Color("#ffb573"), d)
        .lerp(new T.Color("#849ddb"), n);
      sun.intensity = T.MathUtils.lerp(3, 2.5, d) * (1 - n * 0.92);
      sun.position.set(80, 120 - d * 70, 65);
      bloom.strength = 0.025 + d * 0.03 + n * 0.15;
      renderer.toneMappingExposure = 1.05 - d * 0.05 + n * 0.12;
      boats.forEach((boat, index) => {
        const z = reduced.matches
          ? boat.offset
          : T.MathUtils.euclideanModulo(boat.offset - elapsed * 1.8, 160) - 80;
        boat.group.position.set((index === 0 ? -6 : 8) + riverCenter(z), 0, z);
        boat.group.rotation.y = Math.atan(riverTangent(z));
      });
      renderer.info.reset();
      if (quality === "high") {
        const waterVisible = water.visible,
          skyVisible = sky.visible;
        water.visible = false;
        sky.visible = false;
        scene.overrideMaterial = normalMaterial;
        renderer.setRenderTarget(normalTarget);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        scene.overrideMaterial = null;
        water.visible = waterVisible;
        sky.visible = skyVisible;
      }
      const before = renderer.info.render.calls;
      composer.render(dt);
      totalCalls = renderer.info.render.calls;
      mainCalls = totalCalls - before;
      updateLabels();
    }
    function snapshot() {
      const sorted = [...frameTimes].sort((a, b) => a - b),
        median = sorted[Math.floor(sorted.length * 0.5)] ?? 0,
        p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
      return {
        subject,
        time,
        phase: phase.value(elapsed),
        level,
        quality,
        autoRotate: orbit.autoRotate,
        labels: labelsEnabled,
        camera: camera.position.toArray(),
        target: orbit.target.toArray(),
        drawingBuffer: {
          width: renderer.domElement.width,
          height: renderer.domElement.height,
        },
        medianFPS: median ? 1000 / median : 0,
        p95ms: p95,
        mainAndPostCalls: mainCalls,
        totalCalls,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        models: manifest.assets.map((a) => ({
          id: a.id,
          anchor: a.anchors,
          triangles: a.lods.find((l) => l.level === level)?.triangles,
        })),
        visualAcceptance: "pending",
        disposed,
      };
    }
    function tick(now: number) {
      if (disposed) return;
      const raw = (now - lastTime) / 1000;
      lastTime = now;
      if (!contextLost) {
        const dt = Math.min(raw, 0.05);
        elapsed += dt;
        syncMotionPreference();
        orbit.update();
        renderFrame(dt);
        if (raw > 0 && raw < 0.25) {
          frameTimes.push(raw * 1000);
          if (frameTimes.length > 180) frameTimes.shift();
        }
        if (elapsed - lastMetric > 1) {
          lastMetric = elapsed;
          const s = snapshot();
          byId("art-metrics").textContent =
            `绘制 ${s.drawingBuffer.width} × ${s.drawingBuffer.height} · 近180帧中位 ${s.medianFPS.toFixed(1)} FPS · P95 ${s.p95ms.toFixed(1)} ms · 总绘制 ${s.totalCalls} 次`;
        }
      }
      frame = requestAnimationFrame(tick);
    }
    async function capture() {
      renderFrame(0);
      const canvas = document.createElement("canvas");
      canvas.width = renderer.domElement.width;
      canvas.height = renderer.domElement.height;
      canvas.getContext("2d")!.drawImage(renderer.domElement, 0, 0);
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((blob) =>
          blob ? resolve(blob) : reject(new Error("截图生成失败")),
        ),
      );
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      revision++;
      cancelAnimationFrame(frame);
      listeners.abort();
      resizeObserver.disconnect();
      orbit.removeEventListener("start", stopRotation);
      orbit.dispose();
      labels.forEach((label) => label.element.remove());
      // Instanced geometry/material references belong to the library; release it once.
      const standalone = new T.Group();
      landscape.traverse((object) => {
        if (object instanceof T.InstancedMesh) object.dispose();
        if (object instanceof T.Mesh && !object.userData.libraryOwned)
          standalone.add(object.clone());
      });
      disposeArtObjects([standalone, sky]);
      library.dispose();
      accentMaterials.clear();
      ownedTextures.forEach((t) => t.dispose());
      water.getRenderTarget().dispose();
      normalTarget.dispose();
      normalMaterial.dispose();
      composer.passes.forEach((pass) => pass.dispose());
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      (window as unknown as { artLab?: unknown }).artLab = undefined;
    }
    const listen = (
      element: EventTarget,
      event: string,
      listener: EventListener,
    ) =>
      element.addEventListener(event, listener, { signal: listeners.signal });
    panel
      .querySelectorAll<HTMLButtonElement>("[data-time]")
      .forEach((button) =>
        listen(button, "click", () =>
          setTime(button.dataset.time as TimeOfDay),
        ),
      );
    listen(byId("art-subject"), "change", () =>
      setSubject(byId<HTMLSelectElement>("art-subject").value),
    );
    listen(byId("art-lod"), "change", () => {
      void setLod(Number(byId<HTMLSelectElement>("art-lod").value)).catch(
        (error) => {
          status.textContent = String(error);
        },
      );
    });
    listen(byId("art-quality"), "change", () => {
      quality = byId<HTMLSelectElement>("art-quality").value as Quality;
      resize();
    });
    byId<HTMLSelectElement>("art-quality").value = quality;
    listen(byId("art-front"), "click", () => setView(false));
    listen(byId("art-back"), "click", () => setView(true));
    listen(byId("art-reset"), "click", () => setView(false));
    listen(byId("art-rotate"), "click", () => {
      orbit.autoRotate = !orbit.autoRotate;
      byId("art-rotate").setAttribute("aria-pressed", String(orbit.autoRotate));
    });
    listen(byId("art-labels"), "click", () => {
      labelsEnabled = !labelsEnabled;
      byId("art-labels").setAttribute("aria-pressed", String(labelsEnabled));
    });
    listen(byId("art-capture"), "click", () => {
      void capture()
        .then((blob) => {
          const url = URL.createObjectURL(blob),
            a = document.createElement("a");
          a.href = url;
          a.download = `浦江样片-${subject}-${time}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        })
        .catch((error) => {
          status.textContent = String(error);
        });
    });
    listen(renderer.domElement, "keydown", ((event: KeyboardEvent) => {
      if (
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        return;
      event.preventDefault();
      const offset = camera.position.clone().sub(orbit.target),
        spherical = new T.Spherical().setFromVector3(offset);
      if (event.key === "ArrowLeft") spherical.theta -= 0.12;
      if (event.key === "ArrowRight") spherical.theta += 0.12;
      if (event.key === "ArrowUp") spherical.phi -= 0.08;
      if (event.key === "ArrowDown") spherical.phi += 0.08;
      spherical.phi = T.MathUtils.clamp(
        spherical.phi,
        orbit.minPolarAngle,
        orbit.maxPolarAngle,
      );
      camera.position
        .copy(orbit.target)
        .add(new T.Vector3().setFromSpherical(spherical));
      orbit.update();
    }) as EventListener);
    function stopRotation() {
      orbit.autoRotate = false;
      byId("art-rotate").setAttribute("aria-pressed", "false");
    }
    orbit.addEventListener("start", stopRotation);
    listen(reduced, "change", () => {
      const current = phase.value(elapsed);
      phase = new ScalarTransition(current, reduced.matches ? 0.1 : 2.4);
      phase.to(["day", "dusk", "night"].indexOf(time), elapsed);
      if (reduced.matches) stopRotation();
    });
    listen(renderer.domElement, "webglcontextlost", (event) => {
      event.preventDefault();
      contextLost = true;
      status.textContent = "图形连接中断，等待恢复…";
    });
    listen(renderer.domElement, "webglcontextrestored", () => {
      normalTarget.dispose();
      water.getRenderTarget().dispose();
      lastReflect = -1;
      contextLost = false;
      status.textContent = "图形连接已恢复 · 样片待视觉验收";
      resize();
    });
    listen(window, "pagehide", dispose);
    formControls.forEach((control) => (control.disabled = false));
    status.textContent =
      "独立 GLB 模型与 image 图集已接入 · 局部样片待视觉验收";
    (window as unknown as { artLab: unknown }).artLab = {
      setTime,
      setSubject,
      setLod,
      setView,
      setQuality: (v: Quality) => {
        quality = v;
        byId<HTMLSelectElement>("art-quality").value = v;
        resize();
      },
      snapshot,
      capture,
      dispose,
    };
    frame = requestAnimationFrame(tick);
  } catch (error) {
    library.dispose();
    ownedTextures.forEach((t) => t.dispose());
    orbit.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    throw error;
  }
}

void boot().catch((error) => {
  status.textContent = `样片未能完整加载：${error instanceof Error ? error.message : String(error)}。可刷新重试；不会用替代模型冒充完成。`;
  console.error(error);
});
