import * as T from "three";
export function createLighting(scene: T.Scene) {
  const sky = new T.HemisphereLight("#c4dbf1", "#ac8b59", 0.8),
    sun = new T.DirectionalLight("#fff0cf", 3.2),
    fill = new T.DirectionalLight("#9fc3e2", 0.16);
  sun.position.set(-200, 270, 170);
  sun.target.position.set(5, 0, -25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -330,
    right: 330,
    top: 310,
    bottom: -310,
    near: 10,
    far: 750,
  });
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.16;
  sun.shadow.radius = 3;
  fill.position.set(150, 80, -130);
  scene.add(sky, sun, sun.target, fill);
  const fog = new T.Fog("#c9d8dc", 650, 1450);
  scene.fog = fog;
  const day = new T.Color("#c9d8dc"),
    dusk = new T.Color("#bca7a7"),
    night = new T.Color("#172b44");
  return {
    sun,
    update(phase: number) {
      const d = Math.min(phase, 1),
        n = Math.max(phase - 1, 0);
      sky.color
        .set("#c3d9ef")
        .lerp(new T.Color("#aeb6d0"), d)
        .lerp(new T.Color("#6483ad"), n);
      sky.groundColor
        .set("#bc955c")
        .lerp(new T.Color("#665a65"), d)
        .lerp(new T.Color("#263b50"), n);
      sky.intensity = 1.05 - d * 0.27 - n * 0.2;
      sun.color
        .set("#fff0ca")
        .lerp(new T.Color("#ffb775"), d)
        .lerp(new T.Color("#a4bde8"), n);
      sun.intensity = (2.65 - d * 0.3) * (1 - n * 0.94);
      sun.position.set(-200, 270 - d * 130, 170);
      fill.intensity = 0.16 * (1 - n * 0.6);
      fog.color.copy(day).lerp(dusk, d).lerp(night, n);
      scene.background = fog.color;
    },
    dispose() {
      sun.shadow.map?.dispose();
    },
  };
}
