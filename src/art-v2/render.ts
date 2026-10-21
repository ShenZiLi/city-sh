import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export function createRenderPipeline(
  renderer: T.WebGLRenderer,
  scene: T.Scene,
  camera: T.PerspectiveCamera,
) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const normalTarget = new T.WebGLRenderTarget(960, 540, {
      depthTexture: new T.DepthTexture(960, 540),
    }),
    normalMaterial = new T.MeshNormalMaterial();
  const paint = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      tNormal: { value: normalTarget.texture },
      tDepth: { value: normalTarget.depthTexture },
      pixel: { value: new T.Vector2(1 / 960, 1 / 540) },
      strength: { value: 0.055 },
    },
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `
    uniform sampler2D tDiffuse,tNormal,tDepth;uniform vec2 pixel;uniform float strength;varying vec2 vUv;
    void main(){vec3 c=texture2D(tDiffuse,vUv).rgb,n=texture2D(tNormal,vUv).rgb;float depth=texture2D(tDepth,vUv).r;
      float edge=length(n-texture2D(tNormal,vUv+vec2(pixel.x,0.)).rgb)+length(n-texture2D(tNormal,vUv+vec2(0.,pixel.y)).rgb);
      c*=1.-smoothstep(.45,1.3,edge)*strength*step(depth,.99999);
      float grain=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)-.5;
      gl_FragColor=vec4(max(c+grain*.0018,vec3(0.)),1.);
    }`,
  });
  composer.addPass(paint);
  const bloom = new UnrealBloomPass(new T.Vector2(960, 540), 0.04, 0.4, 1.2);
  composer.addPass(bloom);
  const aa = new SMAAPass();
  composer.addPass(aa);
  composer.addPass(new OutputPass());
  let high = true;
  const instrumented = new Map<
    T.Object3D,
    { before: T.Object3D["onBeforeRender"]; shadow?: T.Mesh["onBeforeShadow"] }
  >();
  const counts = { main: 0, normal: 0, reflection: 0, shadow: 0, total: 0 };
  function restore(
    object: T.Object3D,
    saved: {
      before: T.Object3D["onBeforeRender"];
      shadow?: T.Mesh["onBeforeShadow"];
    },
  ) {
    object.onBeforeRender = saved.before;
    if (object instanceof T.Mesh && saved.shadow)
      object.onBeforeShadow = saved.shadow;
  }
  function instrument() {
    const alive = new Set<T.Object3D>();
    scene.traverse((o) => alive.add(o));
    for (const [object, saved] of instrumented)
      if (!alive.has(object)) {
        restore(object, saved);
        instrumented.delete(object);
      }
    scene.traverse((object) => {
      if (
        (!(object instanceof T.Mesh) && !(object instanceof T.Sprite)) ||
        instrumented.has(object)
      )
        return;
      const before = object.onBeforeRender;
      instrumented.set(object, {
        before,
        shadow: object instanceof T.Mesh ? object.onBeforeShadow : undefined,
      });
      object.onBeforeRender = function (...args) {
        if (args[2] === camera) {
          if (scene.overrideMaterial === normalMaterial) counts.normal++;
          else counts.main++;
        } else counts.reflection++;
        before.apply(this, args);
      };
      if (object instanceof T.Mesh) {
        const shadow = object.onBeforeShadow;
        object.onBeforeShadow = function (...args) {
          counts.shadow++;
          shadow.apply(this, args);
        };
      }
    });
  }
  return {
    composer,
    resize(w: number, h: number, isHigh: boolean) {
      high = isHigh;
      composer.setSize(w, h);
      normalTarget.setSize(Math.floor(w / 2), Math.floor(h / 2));
      paint.uniforms.pixel.value.set(2 / w, 2 / h);
      paint.enabled = high;
      aa.enabled = true;
    },
    render(dt: number, phase: number, hidden: T.Object3D[]) {
      Object.keys(counts).forEach(
        (key) => (counts[key as keyof typeof counts] = 0),
      );
      instrument();
      if (high) {
        const visible = hidden.map((o) => o.visible);
        hidden.forEach((o) => (o.visible = false));
        const override = scene.overrideMaterial;
        scene.overrideMaterial = normalMaterial;
        renderer.setRenderTarget(normalTarget);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        scene.overrideMaterial = override;
        hidden.forEach((o, i) => (o.visible = visible[i]));
      }
      bloom.strength =
        0.015 + Math.min(phase, 1) * 0.018 + Math.max(phase - 1, 0) * 0.13;
      composer.render(dt);
      counts.total = renderer.info.render.calls;
    },
    counts,
    dispose() {
      instrumented.forEach((saved, object) => restore(object, saved));
      instrumented.clear();
      normalTarget.dispose();
      normalMaterial.dispose();
      composer.passes.forEach((p) => p.dispose());
      composer.dispose();
    },
  };
}
