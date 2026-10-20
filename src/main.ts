import "./style.css";
import { mountUI } from "./ui";
import { createScene } from "./scene";
const ui = mountUI(document.querySelector<HTMLElement>("#app")!);
createScene(ui.host, ui.events)
  .then((controls) => {
    ui.bind(controls);
    if (import.meta.hot)
      import.meta.hot.dispose(() => {
        controls.dispose();
        ui.dispose();
      });
  })
  .catch((error) => {
    console.error(error);
    ui.events.onError(
      "三维画面未能启动。请使用支持 WebGL 2 的浏览器，并开启硬件加速后重试。",
    );
  });
