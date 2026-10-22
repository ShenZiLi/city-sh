import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ScalarTransition } from "../transition";
import type { SceneControls, TimeOfDay, Quality, ViewName } from "../types";
import { landmarks } from "../world-data";
import { CityAssets, type CityAsset } from "./assets";
import { City } from "./city";
import { coreIds } from "./layout";
import { createEnvironment } from "./environment";
import { createLighting } from "./lighting";
import { createRenderPipeline } from "./render";
import "../art-lab.css";
import "./style.css";

const el = <E extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as E;
const status = el("art-status"),
  host = el("art-canvas");
const base = import.meta.env.BASE_URL;
async function boot() {
  const renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    "aria-label",
    "纸上浦江完整主画面；拖动环绕，滚轮缩放，方向键调整视角",
  );
  host.append(renderer.domElement);
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(40, 1, 0.3, 5200),
    orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.07;
  orbit.enablePan = false;
  orbit.autoRotate = false;
  orbit.autoRotateSpeed = 0.25;
  orbit.minPolarAngle = T.MathUtils.degToRad(12);
  orbit.maxPolarAngle = T.MathUtils.degToRad(78);
  const lighting = createLighting(scene),
    listeners = new AbortController(),
    reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const clockStart = performance.now();
  let assets: CityAssets | undefined,
    city: City | undefined,
    environment: Awaited<ReturnType<typeof createEnvironment>> | undefined,
    pipeline: ReturnType<typeof createRenderPipeline> | undefined;
  let dead = false,
    lost = false,
    frame = 0,
    elapsed = 0,
    last = performance.now(),
    lastMetric = 0,
    lastShadow = -1,
    lastShadowPhase = -1,
    lod = 0,
    time: TimeOfDay = "day",
    quality: Quality = innerWidth < 680 ? "low" : "high",
    subject = "scene",
    selected: string | null = null,
    labels = false,
    preview: T.Group | undefined;
  let phase = new ScalarTransition(0, reduced.matches ? 0.1 : 2.4),
    motionReduced = reduced.matches;
  let loadingRevision = 0;
  const frames: number[] = [],
    labelElements = new Map<string, HTMLSpanElement>();
  const ray = new T.Raycaster(),
    pointer = new T.Vector2();
  const listen = (target: EventTarget, event: string, fn: EventListener) =>
    target.addEventListener(event, fn, { signal: listeners.signal });
  const reportError = (error: unknown) => {
    status.textContent = "资源异常：" + String(error);
    status.dataset.error = "true";
  };
  const updatePressed = () =>
    document
      .querySelectorAll<HTMLButtonElement>("[data-time]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.time === time)),
      );
  function setAutoRotate(value: boolean) {
    orbit.autoRotate = value && !reduced.matches;
    el("art-rotate").setAttribute("aria-pressed", String(orbit.autoRotate));
  }
  function setLabels(value: boolean) {
    labels = value;
    el("art-labels").setAttribute("aria-pressed", String(value));
  }
  function syncMotion() {
    if (motionReduced !== reduced.matches) {
      const value = phase.value(elapsed);
      motionReduced = reduced.matches;
      phase = new ScalarTransition(value, motionReduced ? 0.1 : 2.4);
      phase.to(["day", "dusk", "night"].indexOf(time), elapsed);
    }
    if (motionReduced) setAutoRotate(false);
  }
  function setTime(value: TimeOfDay) {
    syncMotion();
    time = value;
    phase.to(["day", "dusk", "night"].indexOf(value), elapsed);
    updatePressed();
    lastShadow = -1;
  }
  function look(target: T.Vector3, offset: T.Vector3, min = 90, max = 1000) {
    orbit.target.copy(target);
    camera.position.copy(target).add(offset);
    orbit.minDistance = min;
    orbit.maxDistance = max;
    camera.lookAt(target);
    orbit.update();
    environment?.invalidate();
  }
  const presets: Record<
    ViewName,
    { target: [number, number, number]; offset: [number, number, number] }
  > = {
    overview: { target: [0, 30, -115], offset: [-170, 126, 382] },
    lujiazui: { target: [155, 43, -155], offset: [-25, 95, 260] },
    bund: { target: [-104, 10, 35], offset: [95, 65, 170] },
    river: { target: [0, 5, -25], offset: [65, 83, 270] },
  };
  function setView(name: ViewName) {
    if (subject !== "scene") void setSubject("scene");
    const p = presets[name];
    const offset = new T.Vector3(...p.offset).multiplyScalar(
      Math.max(1, 1.5 / camera.aspect),
    );
    look(
      new T.Vector3(...p.target),
      offset,
      90,
      Math.max(1000, offset.length() * 1.5),
    );
    el<HTMLSelectElement>("art-view").value = name;
    setAutoRotate(false);
  }
  function setAngle(degrees: number) {
    const radius = camera.position.distanceTo(orbit.target),
      phi = orbit.getPolarAngle(),
      theta = T.MathUtils.degToRad(degrees);
    camera.position
      .copy(orbit.target)
      .add(
        new T.Vector3().setFromSpherical(new T.Spherical(radius, phi, theta)),
      );
    orbit.update();
    environment?.invalidate();
  }
  function showSelection(id: string | null) {
    selected = id;
    const definition = landmarks.find((l) => l.id === id),
      info = el("art-selection");
    info.hidden = !definition;
    if (definition) {
      el("art-selected-name").textContent = definition.name;
      el("art-selected-copy").textContent = definition.description.replaceAll(
        "沙盘",
        "风景",
      );
    }
  }
  function focusLandmark(id: string) {
    const root = city?.core.get(id);
    if (!root) return;
    if (subject !== "scene") void setSubject("scene");
    showSelection(id);
    const anchor = root.getObjectByName("focus-anchor")!,
      center = anchor.getWorldPosition(new T.Vector3()),
      height = assets!.definitions.find((a) => a.id === id)!.height;
    look(
      center,
      new T.Vector3(height * 0.8, height * 0.43, height * 1.65),
      height * 0.8,
      height * 4,
    );
    setAutoRotate(false);
  }
  async function setSubject(value: string) {
    const revision = ++loadingRevision;
    subject = value;
    showSelection(null);
    el<HTMLSelectElement>("art-subject").value = value;
    if (preview) {
      scene.remove(preview);
      preview = undefined;
    }
    city!.group.visible = value === "scene";
    environment!.group.visible = environment!.sky.visible = value === "scene";
    if (value === "scene") {
      lastShadow = -1;
      setView("overview");
      return;
    }
    const template = await assets!.model(value, lod);
    if (dead || revision !== loadingRevision) return;
    preview = template.clone(true);
    scene.add(preview);
    preview.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(preview),
      size = bounds.getSize(new T.Vector3()),
      center = bounds.getCenter(new T.Vector3());
    const distance =
      Math.max(size.y, size.x / Math.max(camera.aspect, 0.65), size.z) * 1.8;
    look(
      center,
      new T.Vector3(distance * 0.62, distance * 0.35, distance),
      distance * 0.55,
      distance * 3,
    );
    lastShadow = -1;
  }
  async function setLod(value: number) {
    if (![0, 1, 2].includes(value)) throw Error("Invalid LOD");
    status.textContent = "正在切换建筑细节…";
    const previous = lod;
    try {
      const applied = await city!.load(value);
      if (!applied || dead) return;
      lod = value;
      el<HTMLSelectElement>("art-lod").value = String(lod);
      if (subject !== "scene") {
        const p = camera.position.clone(),
          t = orbit.target.clone();
        await setSubject(subject);
        camera.position.copy(p);
        orbit.target.copy(t);
        orbit.update();
      }
      lastShadow = -1;
      status.textContent = "完整主画面 · 待视觉验收";
    } catch (error) {
      lod = previous;
      el<HTMLSelectElement>("art-lod").value = String(previous);
      reportError(error);
      throw error;
    }
  }
  function resize() {
    const width = Math.max(1, host.clientWidth),
      height = Math.max(1, host.clientHeight),
      ratio = Math.min(
        devicePixelRatio,
        quality === "high" ? 1.75 : 1,
        (quality === "high" ? 1920 : 1536) / width,
        (quality === "high" ? 1080 : 864) / height,
      );
    const w = Math.max(2, Math.round(width * ratio)),
      h = Math.max(2, Math.round(height * ratio));
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    pipeline?.resize(w, h, quality === "high");
    environment?.resize(w, h, quality);
    lighting.sun.shadow.mapSize.setScalar(quality === "high" ? 2048 : 1024);
    lighting.sun.shadow.map?.dispose();
    lighting.sun.shadow.map = null;
    lastShadow = -1;
  }
  function setQuality(value: Quality) {
    quality = value;
    el<HTMLSelectElement>("art-quality").value = value;
    resize();
  }
  function updateLabels() {
    for (const [id, label] of labelElements) {
      const root = city!.core.get(id),
        anchor = root?.getObjectByName("label-anchor");
      if (subject !== "scene" || (!labels && selected !== id) || !anchor) {
        label.hidden = true;
        continue;
      }
      const world = anchor.getWorldPosition(new T.Vector3()),
        ndc = world.clone().project(camera),
        direction = world.clone().sub(camera.position),
        distance = direction.length();
      ray.set(camera.position, direction.normalize());
      const hit = ray.intersectObjects([city!.group], true)[0];
      label.hidden =
        ndc.z < -1 ||
        ndc.z > 1 ||
        Math.abs(ndc.x) > 0.96 ||
        Math.abs(ndc.y) > 0.94 ||
        !!(hit && hit.distance < distance - 0.6);
      label.style.left = `${(ndc.x * 0.5 + 0.5) * host.clientWidth}px`;
      label.style.top = `${(-ndc.y * 0.5 + 0.5) * host.clientHeight}px`;
    }
  }
  function render(dt = 0) {
    const p = phase.value(elapsed);
    lighting.update(p);
    const fog = scene.fog as T.Fog;
    fog.near = Math.max(650, camera.position.distanceTo(orbit.target) + 150);
    fog.far = fog.near + 800;
    environment!.waterMaterial.uniforms.uFogNear.value = fog.near;
    environment!.waterMaterial.uniforms.uFogFar.value = fog.far;
    environment!.skyMaterial.uniforms.uHaze.value.copy(
      (scene.fog as T.Fog).color,
    );
    environment!.waterMaterial.uniforms.uFogColor.value.copy(
      (scene.fog as T.Fog).color,
    );
    assets!.setNight(T.MathUtils.smoothstep(p, 0.55, 2));
    environment!.update(elapsed, p, !motionReduced);
    renderer.toneMappingExposure =
      1.04 - Math.min(p, 1) * 0.08 + Math.max(p - 1, 0) * 0.17;
    if (subject !== "scene")
      scene.background = new T.Color(p > 1 ? "#263849" : "#e9e4d8");
    renderer.shadowMap.autoUpdate = false;
    // Architecture and sun are stationary once the time transition settles.
    // Reuse that map; only lighting/LOD/quality/context changes invalidate it.
    if (
      lastShadow < 0 ||
      (Math.abs(p - lastShadowPhase) > 0.001 && elapsed - lastShadow > 0.12)
    ) {
      renderer.shadowMap.needsUpdate = true;
      lastShadow = elapsed;
      lastShadowPhase = p;
    }
    renderer.info.reset();
    pipeline!.render(dt, p, [environment!.water, environment!.sky]);
    updateLabels();
  }
  function snapshot() {
    const f = [...frames].sort((a, b) => a - b),
      median = f[Math.floor(f.length * 0.5)] ?? 0,
      p95 = f[Math.floor(f.length * 0.95)] ?? 0;
    return {
      version: 2,
      subject,
      time,
      phase: phase.value(elapsed),
      quality,
      level: lod,
      selected,
      labels,
      autoRotate: orbit.autoRotate,
      motionReduced,
      animationTime: motionReduced ? 0 : elapsed,
      camera: camera.position.toArray(),
      target: orbit.target.toArray(),
      drawingBuffer: {
        width: renderer.domElement.width,
        height: renderer.domElement.height,
      },
      medianFPS: median ? 1000 / median : 0,
      p95ms: p95,
      drawCalls: { ...pipeline!.counts },
      totalCalls: renderer.info.render.calls,
      trianglesAllPasses: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      models: assets?.definitions.map((a) => ({
        id: a.id,
        height: a.height,
        category: a.category,
      })),
      landmarks: [...city!.core.keys()],
      instances: city!.layout.length,
      disposed: dead,
      contextLost: lost,
      visualAcceptance: "pending user review",
    };
  }
  async function capture() {
    render();
    const target = document.createElement("canvas");
    target.width = renderer.domElement.width;
    target.height = renderer.domElement.height;
    target.getContext("2d")!.drawImage(renderer.domElement, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      target.toBlob(
        (b) => (b ? resolve(b) : reject(Error("截图失败"))),
        "image/png",
      ),
    );
  }
  function tick(now: number) {
    if (dead) return;
    const raw = (now - last) / 1000;
    last = now;
    if (!lost) {
      const dt = Math.min(raw, 0.05);
      // The camera integrator stays clamped, while the 2.4-second art
      // transition follows wall time even if a cold shader stalls one frame.
      elapsed = (performance.now() - clockStart) / 1000;
      syncMotion();
      orbit.update();
      render(dt);
      if (raw > 0 && document.visibilityState === "visible") {
        frames.push(raw * 1000);
        if (frames.length > 1800) frames.shift();
      }
      if (elapsed - lastMetric > 1) {
        lastMetric = elapsed;
        const s = snapshot();
        el("art-metrics").textContent =
          `绘制 ${s.drawingBuffer.width}×${s.drawingBuffer.height} · ${s.medianFPS.toFixed(1)} FPS · P95 ${s.p95ms.toFixed(1)} ms · 总绘制 ${s.totalCalls} 次`;
      }
    }
    frame = requestAnimationFrame(tick);
  }
  const resizeObserver = new ResizeObserver(resize);
  function dispose() {
    if (dead) return;
    dead = true;
    loadingRevision++;
    cancelAnimationFrame(frame);
    listeners.abort();
    resizeObserver.disconnect();
    orbit.dispose();
    labelElements.forEach((l) => l.remove());
    labelElements.clear();
    city?.dispose();
    environment?.dispose();
    assets?.dispose();
    pipeline?.dispose();
    lighting.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    delete (window as unknown as { artLab?: unknown }).artLab;
  }
  try {
    status.textContent = "载入七处地标与共享绘画资源…";
    const response = await fetch(
      base + "assets/renovation/v2/models/manifest.json",
    );
    if (!response.ok) throw Error("模型清单加载失败：" + response.status);
    const manifest = (await response.json()) as { assets: CityAsset[] };
    assets = new CityAssets(manifest.assets, base);
    city = new City(assets);
    scene.add(city.group);
    await city.load(0);
    status.textContent = "载入江岸、植被、船只与天空…";
    environment = await createEnvironment(assets);
    scene.add(environment.group, environment.sky);
    pipeline = createRenderPipeline(renderer, scene, camera);
    const select = el<HTMLSelectElement>("art-subject");
    for (const def of manifest.assets) {
      const option = document.createElement("option");
      option.value = def.id;
      option.textContent = def.name;
      select.append(option);
    }
    for (const id of coreIds) {
      const label = document.createElement("span");
      label.className = "art-label";
      label.hidden = true;
      label.textContent = landmarks.find((l) => l.id === id)!.name;
      host.append(label);
      labelElements.set(id, label);
    }
    document
      .querySelectorAll<HTMLButtonElement>("[data-time]")
      .forEach((b) =>
        listen(b, "click", () => setTime(b.dataset.time as TimeOfDay)),
      );
    listen(
      select,
      "change",
      () => void setSubject(select.value).catch(reportError),
    );
    listen(el("art-view"), "change", () =>
      setView(el<HTMLSelectElement>("art-view").value as ViewName),
    );
    listen(
      el("art-lod"),
      "change",
      () =>
        void setLod(Number(el<HTMLSelectElement>("art-lod").value)).catch(
          () => {},
        ),
    );
    listen(el("art-quality"), "change", () =>
      setQuality(el<HTMLSelectElement>("art-quality").value as Quality),
    );
    listen(el("art-front"), "click", () => {
      if (subject === "scene") setView("overview");
      else void setSubject(subject);
    });
    listen(el("art-back"), "click", () => setAngle(190));
    listen(el("art-reset"), "click", () => {
      void setSubject("scene");
      setAutoRotate(false);
    });
    listen(el("art-rotate"), "click", () => setAutoRotate(!orbit.autoRotate));
    listen(el("art-labels"), "click", () => setLabels(!labels));
    listen(el("art-focus"), "click", () => {
      if (selected) focusLandmark(selected);
    });
    listen(el("art-close-selection"), "click", () => showSelection(null));
    listen(
      el("art-capture"),
      "click",
      () =>
        void capture()
          .then((blob) => {
            const url = URL.createObjectURL(blob),
              a = document.createElement("a");
            a.href = url;
            a.download = `纸上浦江-${time}.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          })
          .catch(reportError),
    );
    let down: [number, number] = [0, 0];
    listen(renderer.domElement, "pointerdown", ((e: PointerEvent) => {
      down = [e.clientX, e.clientY];
      setAutoRotate(false);
    }) as EventListener);
    listen(renderer.domElement, "pointerup", ((e: PointerEvent) => {
      if (
        Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 ||
        subject !== "scene"
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const first = ray
        .intersectObjects([city!.group, environment!.group], true)
        .find(
          (h) =>
            !(
              h.object instanceof T.Mesh &&
              h.object.material instanceof T.MeshBasicMaterial
            ),
        );
      let object: T.Object3D | null = first?.object ?? null;
      while (object && !object.userData.landmarkId) object = object.parent;
      showSelection(object?.userData.landmarkId ?? null);
    }) as EventListener);
    listen(renderer.domElement, "keydown", ((e: KeyboardEvent) => {
      const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      setAutoRotate(false);
      const s = new T.Spherical().setFromVector3(
        camera.position.clone().sub(orbit.target),
      );
      s.theta +=
        e.key === "ArrowLeft" ? -0.1 : e.key === "ArrowRight" ? 0.1 : 0;
      s.phi = T.MathUtils.clamp(
        s.phi +
          (e.key === "ArrowUp" ? -0.07 : e.key === "ArrowDown" ? 0.07 : 0),
        orbit.minPolarAngle,
        orbit.maxPolarAngle,
      );
      camera.position
        .copy(orbit.target)
        .add(new T.Vector3().setFromSpherical(s));
      orbit.update();
    }) as EventListener);
    listen(document, "keydown", ((e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key.toLowerCase() === "h")
        el("art-app").classList.toggle("hide-ui");
      if (e.key === "Escape") showSelection(null);
    }) as EventListener);
    listen(reduced, "change", () => syncMotion());
    orbit.addEventListener("start", () => setAutoRotate(false));
    listen(renderer.domElement, "webglcontextlost", (e) => {
      e.preventDefault();
      lost = true;
      status.textContent = "图形连接中断，等待恢复…";
    });
    listen(renderer.domElement, "webglcontextrestored", () => {
      pipeline?.dispose();
      pipeline = createRenderPipeline(renderer, scene, camera);
      environment!.invalidate();
      lost = false;
      lastShadow = -1;
      resize();
      status.textContent = "图形连接已恢复 · 待视觉验收";
    });
    resizeObserver.observe(host);
    setQuality(quality);
    setView("overview");
    status.textContent = "完整主画面 · 七处地标与十二类街区 · 待视觉验收";
    const controls: SceneControls = {
      setTime,
      setView,
      setAutoRotate,
      setLabels,
      setQuality,
      focusLandmark,
      reset: () => setView("overview"),
      capture,
      dispose,
    };
    (window as unknown as { artLab: unknown }).artLab = {
      ...controls,
      setLod,
      setSubject,
      setAngle,
      snapshot,
      clearMetrics: () => frames.splice(0),
      renderer,
    };
    last = performance.now();
    frame = requestAnimationFrame(tick);
  } catch (error) {
    dispose();
    reportError(error);
    throw error;
  }
}
void boot().catch((error) => console.error(error));
