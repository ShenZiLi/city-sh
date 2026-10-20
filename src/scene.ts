import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { loadPalette } from "./materials";
import { createCity } from "./city";
import { landmarks } from "./world-data";
import { ScalarTransition } from "./transition";
import { TapGesture } from "./tap-gesture";
import type {
  SceneControls,
  SceneEvents,
  TimeOfDay,
  ViewName,
  Quality,
} from "./types";
const times = { day: 0, dusk: 1, night: 2 };
const presets = {
  day: {
    background: "#f2eee4",
    ambient: "#fff4db",
    sun: "#fff2d8",
    intensity: 3.0,
    ambientPower: 2.8,
  },
  dusk: {
    background: "#e4cbc0",
    ambient: "#d8c1dc",
    sun: "#ffbe7f",
    intensity: 2.7,
    ambientPower: 2.3,
  },
  night: {
    background: "#162f41",
    ambient: "#87a4c4",
    sun: "#94b8d0",
    intensity: 1.25,
    ambientPower: 1.9,
  },
};
export async function createScene(
  host: HTMLElement,
  events: SceneEvents,
): Promise<SceneControls> {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.info.autoReset = false;
  renderer.domElement.setAttribute(
    "aria-label",
    "可拖动环绕观看的上海手绘三维沙盘",
  );
  renderer.domElement.tabIndex = 0;
  host.append(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color(presets.day.background);
  scene.fog = new T.Fog(presets.day.background, 280, 650);
  const camera = new T.PerspectiveCamera(35, 1, 0.2, 1200);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.065;
  orbit.enablePan = false;
  orbit.minPolarAngle = (Math.PI * 15) / 180;
  orbit.maxPolarAngle = (Math.PI * 73) / 180;
  orbit.minDistance = 40;
  orbit.maxDistance = 540;
  orbit.autoRotate = !reduced;
  orbit.autoRotateSpeed = 0.5;
  const sun = new T.DirectionalLight("#fff2d8", 3);
  sun.position.set(-45, 85, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -88,
    right: 88,
    top: 88,
    bottom: -88,
    near: 1,
    far: 220,
  });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.15;
  scene.add(sun, sun.target);
  const ambient = new T.HemisphereLight("#fff4db", "#adbdc0", 2.8);
  scene.add(ambient);
  const fill = new T.DirectionalLight("#c9e2e5", 0.7);
  fill.position.set(40, 30, -30);
  scene.add(fill);
  const palette = await loadPalette((p) => events.onProgress(p * 0.85));
  const city = createCity(palette);
  scene.add(city.group);
  events.onProgress(0.92);
  const facadeLights = [-18, 4, 25].map((z) => {
    const light = new T.PointLight("#ffc477", 0, 25, 1.5);
    light.position.set(-13, 5, z);
    scene.add(light);
    return light;
  });
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new T.Vector2(1, 1), 0.35, 0.4, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const floor = new T.Mesh(
    new T.PlaneGeometry(1500, 1500),
    new T.MeshBasicMaterial({
      color: presets.day.background,
      toneMapped: false,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.9;
  floor.receiveShadow = true;
  scene.add(floor);
  const groundShadow = new T.Mesh(
    floor.geometry,
    new T.ShadowMaterial({
      color: "#243735",
      opacity: 0.16,
      toneMapped: false,
    }),
  );
  groundShadow.rotation.copy(floor.rotation);
  groundShadow.position.y = -3.88;
  groundShadow.receiveShadow = true;
  scene.add(groundShadow);
  const sky = new T.Mesh(
    new T.SphereGeometry(650, 32, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: {
        uDay: { value: palette.textures.S01 },
        uDusk: { value: palette.textures.S02 },
        uNight: { value: palette.textures.S03 },
        uPhase: { value: 0 },
        uGround: { value: new T.Color(presets.day.background) },
      },
      vertexShader:
        "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "varying vec2 vUv;uniform sampler2D uDay,uDusk,uNight;uniform float uPhase;uniform vec3 uGround;void main(){vec2 uv=vec2(vUv.x,clamp((vUv.y-.45)*1.8,0.,1.));vec3 a=texture2D(uDay,uv).rgb,b=texture2D(uDusk,uv).rgb,c=texture2D(uNight,uv).rgb;vec3 color=mix(mix(a,b,min(uPhase,1.)),c,max(uPhase-1.,0.));gl_FragColor=vec4(mix(uGround,color,smoothstep(.53,.8,vUv.y)*.6),1.);\n#include <colorspace_fragment>\n}",
    }),
  );
  sky.visible = !!(
    palette.textures.S01 &&
    palette.textures.S02 &&
    palette.textures.S03
  );
  scene.add(sky);
  const starsGeo = new T.BufferGeometry(),
    starPoints: number[] = [];
  for (let i = 0; i < 50; i++) {
    const a = i * 2.39996,
      z = 0.15 + i / 65,
      r = Math.sqrt(1 - z * z);
    starPoints.push(Math.cos(a) * r * 400, z * 400, Math.sin(a) * r * 400);
  }
  starsGeo.setAttribute(
    "position",
    new T.Float32BufferAttribute(starPoints, 3),
  );
  const starMat = new T.PointsMaterial({
    color: "#f6e9ce",
    size: 1.4,
    transparent: true,
    opacity: 0,
    sizeAttenuation: true,
    depthWrite: false,
  });
  scene.add(new T.Points(starsGeo, starMat));
  const labelLayer = document.createElement("div");
  labelLayer.className = "label-layer";
  labelLayer.style.cssText =
    "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
  host.append(labelLayer);
  const labels = landmarks.map((l) => {
    const el = document.createElement("button");
    el.className = "landmark-label";
    el.textContent = l.name;
    el.setAttribute("aria-label", `了解${l.name}`);
    el.style.pointerEvents = "auto";
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    el.addEventListener("click", () => {
      events.onSelect(l);
    });
    labelLayer.append(el);
    return {
      l,
      el,
      point: new T.Vector3(l.position[0], l.height + 2, l.position[2]),
    };
  });
  const ray = new T.Raycaster(),
    pointer = new T.Vector2();
  const tapGesture = new TapGesture();
  let labelsEnabled = true,
    disposed = false,
    quality: Quality = "high",
    time: TimeOfDay = "day";
  const phase = new ScalarTransition(0, reduced ? 0.1 : 2.4);
  const clock = new T.Clock();
  let elapsed = 0,
    frames = 0,
    lastStats = 0,
    statFrames = 0,
    frame = 0;
  let tween: null | {
    start: number;
    from: T.Vector3;
    to: T.Vector3;
    targetFrom: T.Vector3;
    targetTo: T.Vector3;
  } = null;
  function overview() {
    const width = host.clientWidth,
      height = host.clientHeight;
    const mobile = width / height < 0.8;
    return {
      position: new T.Vector3(
        mobile ? -35 : -25,
        mobile ? 190 : 110,
        mobile ? 340 : 190,
      ),
      target: new T.Vector3(0, 12, 0),
    };
  }
  function setView(view: ViewName) {
    window.dispatchEvent(new CustomEvent("paper-view", { detail: view }));
    let to: T.Vector3, target: T.Vector3;
    const v = overview();
    if (view === "overview") {
      to = v.position;
      target = v.target;
    } else if (view === "lujiazui") {
      to = new T.Vector3(86, 63, 81);
      target = new T.Vector3(29, 20, 1);
    } else if (view === "bund") {
      to = new T.Vector3(35, 39, 58);
      target = new T.Vector3(-22, 5, 3);
    } else {
      to = new T.Vector3(38, 27, 88);
      target = new T.Vector3(-1, 7, -8);
    }
    tween = {
      start: elapsed,
      from: camera.position.clone(),
      to,
      targetFrom: orbit.target.clone(),
      targetTo: target,
    };
    setAutoRotate(false);
  }
  const initial = overview();
  camera.position.copy(initial.position);
  orbit.target.copy(initial.target);
  orbit.update();
  orbit.saveState();
  function setAutoRotate(v: boolean) {
    orbit.autoRotate = v;
    if (!v) {
      // Clear residual automatic angular velocity without shifting the visible pose.
      const position = camera.position.clone();
      const target = orbit.target.clone();
      const damping = orbit.enableDamping;
      orbit.enableDamping = false;
      orbit.update();
      camera.position.copy(position);
      orbit.target.copy(target);
      orbit.update();
      orbit.enableDamping = damping;
    }
    events.onAutoRotate(v);
  }
  const onStart = () => {
    tween = null;
    setAutoRotate(false);
  };
  orbit.addEventListener("start", onStart);
  const onDown = (e: PointerEvent) => {
    tapGesture.down(e.pointerId, e.clientX, e.clientY);
  };
  const onMove = (e: PointerEvent) =>
    tapGesture.move(e.pointerId, e.clientX, e.clientY);
  const onCancel = (e: PointerEvent) => tapGesture.cancel(e.pointerId);
  const onUp = (e: PointerEvent) => {
    if (!tapGesture.up(e.pointerId, e.clientX, e.clientY)) return;
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    const hits = ray.intersectObjects(city.picks, true);
    const id = hits[0]?.object.userData.landmark;
    events.onSelect(landmarks.find((l) => l.id === id) ?? null);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("pointercancel", onCancel);
  renderer.domElement.addEventListener("pointerup", onUp);
  const resize = () => {
    const w = Math.max(1, host.clientWidth),
      h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 42 : 35;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const error = (e: Event) => {
    e.preventDefault();
    events.onError("画面连接暂时中断，正在等待显卡恢复。");
  };
  const restored = () => {
    events.onError("");
  };
  renderer.domElement.addEventListener("webglcontextlost", error);
  renderer.domElement.addEventListener("webglcontextrestored", restored);
  const colors = {
    background: new T.Color(),
    ambient: new T.Color(),
    sun: new T.Color(),
  };
  function renderFrame(dt: number) {
    renderer.info.reset();
    bloom.enabled = quality === "high" && phase.value(elapsed) > 1.01;
    composer.render(dt);
  }
  function tick() {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.06);
    if (document.hidden) return;
    elapsed += dt;
    frames++;
    statFrames++;
    const val = phase.value(elapsed),
      a = val <= 1 ? presets.day : presets.dusk,
      b = val <= 1 ? presets.dusk : presets.night,
      f = val <= 1 ? val : val - 1,
      night = Math.max(0, Math.min(1, val - 1)),
      warm = Math.max(0, 1 - Math.abs(val - 1));
    for (const key of ["background", "ambient", "sun"] as const)
      colors[key].set(a[key]).lerp(new T.Color(b[key]), f);
    (scene.background as T.Color).copy(colors.background);
    sun.color.copy(colors.sun);
    sun.intensity = T.MathUtils.lerp(a.intensity, b.intensity, f);
    ambient.color.copy(colors.ambient);
    ambient.intensity = T.MathUtils.lerp(a.ambientPower, b.ambientPower, f);
    (floor.material as T.MeshBasicMaterial).color.copy(colors.background);
    (sky.material as T.ShaderMaterial).uniforms.uGround.value.copy(
      colors.background,
    );
    (scene.fog as T.Fog).color.copy(colors.background);
    (sky.material as T.ShaderMaterial).uniforms.uPhase.value = val;
    starMat.opacity = night * 0.75;
    palette.light.opacity = Math.max(0, val * 0.5) * 0.95;
    palette.light.color.set("#ffd68a").multiplyScalar(1 + night * 1.4);
    palette.window.color.set("#56767b").lerp(new T.Color("#192f46"), night);
    palette.rose.emissive.set("#c13b85");
    palette.rose.emissiveIntensity = night * 0.5;
    palette.gold.emissive.set("#d48828");
    palette.gold.emissiveIntensity = night * 0.25;
    palette.stone.emissive.set("#c58c4c");
    palette.stone.emissiveIntensity = night * 0.24;
    palette.trim.emissive.set("#b57e3a");
    palette.trim.emissiveIntensity = night * 0.2;
    palette.base.color.set("#f0e4cb").multiplyScalar(1 - night * 0.22);
    facadeLights.forEach((l) => (l.intensity = night * 23));
    bloom.strength = night * 0.32;
    city.water.uniforms.uWarm.value = warm * 0.8;
    city.update(reduced ? 0 : elapsed, dt, night);
    city.mirror.visible = quality === "high";
    if (tween) {
      const t = Math.min(1, (elapsed - tween.start) / (reduced ? 0.1 : 1.5)),
        e = t * t * (3 - 2 * t);
      camera.position.lerpVectors(tween.from, tween.to, e);
      orbit.target.lerpVectors(tween.targetFrom, tween.targetTo, e);
      if (t === 1) tween = null;
    }
    orbit.update(dt);
    renderFrame(dt);
    if (frames % 8 === 0) {
      camera.updateMatrixWorld();
      const occupied: { x: number; y: number; w: number; h: number }[] = [];
      for (const label of [...labels].sort((a, b) => b.l.height - a.l.height)) {
        const v = label.point.clone().project(camera);
        let hidden =
          !labelsEnabled || v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
        const dist = camera.position.distanceTo(label.point);
        if (!hidden) {
          ray.set(
            camera.position,
            label.point.clone().sub(camera.position).normalize(),
          );
          const hitPoint = new T.Vector3();
          hidden = city.occlusionBounds.some(
            ({ box, id }) =>
              id !== label.l.id &&
              ray.ray.intersectBox(box, hitPoint) !== null &&
              camera.position.distanceTo(hitPoint) < dist - 3,
          );
        }
        const x = (v.x * 0.5 + 0.5) * host.clientWidth,
          y = (-v.y * 0.5 + 0.5) * host.clientHeight,
          w = label.el.offsetWidth,
          h = label.el.offsetHeight;
        const rect = { x: x - w / 2 - 4, y: y - h - 4, w: w + 8, h: h + 8 };
        if (
          occupied.some(
            (r) =>
              rect.x < r.x + r.w &&
              rect.x + rect.w > r.x &&
              rect.y < r.y + r.h &&
              rect.y + rect.h > r.y,
          )
        )
          hidden = true;
        if (!hidden) occupied.push(rect);
        label.el.classList.toggle("hidden", hidden);
        label.el.tabIndex = hidden ? -1 : 0;
        label.el.setAttribute("aria-hidden", String(hidden));
        label.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * host.clientWidth}px,${(-v.y * 0.5 + 0.5) * host.clientHeight}px) translate(-50%,-100%)`;
      }
    }
    if (elapsed - lastStats > 1) {
      events.onStats(Math.round(statFrames / (elapsed - lastStats)));
      lastStats = elapsed;
      statFrames = 0;
    }
  }
  const controls: SceneControls = {
    setTime(t) {
      time = t;
      phase.to(times[t], elapsed);
      document.documentElement.dataset.time = t;
      window.dispatchEvent(new CustomEvent("paper-time", { detail: t }));
    },
    setView,
    setAutoRotate,
    setLabels(v) {
      labelsEnabled = v;
      labelLayer.style.visibility = v ? "visible" : "hidden";
    },
    setQuality(v) {
      quality = v;
      city.details.visible = v === "high";
      renderer.setPixelRatio(
        v === "high"
          ? Math.min(devicePixelRatio, 1.75)
          : Math.min(devicePixelRatio * 0.8, 1),
      );
      sun.shadow.mapSize.set(
        v === "high" ? 2048 : 1024,
        v === "high" ? 2048 : 1024,
      );
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      resize();
    },
    focusLandmark(id) {
      window.dispatchEvent(new CustomEvent("paper-view", { detail: null }));
      const l = landmarks.find((l) => l.id === id);
      if (!l) return;
      const target = new T.Vector3(
        l.position[0],
        l.height * 0.45,
        l.position[2],
      );
      tween = {
        start: elapsed,
        from: camera.position.clone(),
        to: target
          .clone()
          .add(new T.Vector3(22, Math.max(17, l.height * 0.5), 35)),
        targetFrom: orbit.target.clone(),
        targetTo: target,
      };
      setAutoRotate(false);
    },
    reset() {
      setView("overview");
      events.onSelect(null);
    },
    capture() {
      renderFrame(0);
      const c = document.createElement("canvas");
      c.width = renderer.domElement.width;
      c.height = renderer.domElement.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(renderer.domElement, 0, 0);
      const scale = c.width / 1600;
      ctx.fillStyle = time === "night" ? "#e9e1d0" : "#344a48";
      ctx.font = `${Math.round(24 * scale)}px serif`;
      ctx.fillText(
        `纸上浦江 · ${time === "day" ? "白昼" : time === "dusk" ? "暮色" : "入夜"}`,
        32 * scale,
        c.height - 30 * scale,
      );
      return new Promise<Blob>((resolve, reject) =>
        c.toBlob((blob) => {
          if (!blob) {
            reject(new Error("无法生成截图"));
            return;
          }
          const url = URL.createObjectURL(blob),
            a = document.createElement("a");
          a.href = url;
          a.download = `纸上浦江-${time}.png`;
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          resolve(blob);
        }),
      );
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      orbit.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointercancel", onCancel);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("webglcontextlost", error);
      renderer.domElement.removeEventListener("webglcontextrestored", restored);
      document.removeEventListener("keydown", onKey);
      scene.traverse((o) => {
        if (
          o instanceof T.Mesh ||
          o instanceof T.Line ||
          o instanceof T.Points
        ) {
          o.geometry.dispose();
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material];
          materials.forEach((m) => m.dispose());
        }
      });
      Object.values(palette.textures).forEach((t) => t.dispose());
      palette.stone.gradientMap?.dispose();
      scene.traverse((o) => {
        if (o instanceof T.Sprite) (o.material as T.Material).dispose();
      });
      composer.passes.forEach((pass) => pass.dispose());
      composer.dispose();
      city.mirror.getRenderTarget().dispose();
      renderer.dispose();
      delete (window as unknown as { paperCity?: unknown }).paperCity;
      host.replaceChildren();
    },
  };
  const onKey = (e: KeyboardEvent) => {
    if (
      (e.target as HTMLElement).matches("input,textarea,select") ||
      document.querySelector("dialog[open]")
    )
      return;
    if (e.key === "1") controls.setTime("day");
    if (e.key === "2") controls.setTime("dusk");
    if (e.key === "3") controls.setTime("night");
    if (e.key.toLowerCase() === "r") controls.reset();
  };
  document.addEventListener("keydown", onKey);
  // Bounded diagnostics for local acceptance and reproducible 24-angle captures.
  Object.assign(window, {
    paperCity: {
      controls,
      scene,
      camera,
      orbit,
      renderer,
      landmarks,
      stats: () => ({
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        buildings: city.group.userData.buildingCount,
        time,
        quality,
      }),
      angle: (r: number) => {
        setAutoRotate(false);
        const target = orbit.target.clone(),
          v = camera.position.clone().sub(target),
          radius = Math.hypot(v.x, v.z);
        camera.position.set(
          target.x + Math.sin(r) * radius,
          camera.position.y,
          target.z + Math.cos(r) * radius,
        );
        orbit.update();
      },
    },
  });
  events.onProgress(1);
  events.onReady();
  if (palette.missing.length)
    events.onError(
      "部分手绘素材未能载入（" +
        palette.missing.join("、") +
        "）。已使用基础材质，请刷新重试。",
    );
  events.onAutoRotate(orbit.autoRotate);
  tick();
  return controls;
}
