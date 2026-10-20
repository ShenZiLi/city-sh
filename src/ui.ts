import type {
  LandmarkDefinition,
  SceneControls,
  SceneEvents,
  TimeOfDay,
  ViewName,
} from "./types";

const icon = (name: string) => {
  const paths: Record<string, string> = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    sunset:
      '<path d="M3 17h18M5 21h14M6 13a6 6 0 0 1 12 0M12 2v3M3 6l2 2m14-2-2 2M1 13h3m16 0h3"/>',
    moon: '<path d="M20.4 14A8.5 8.5 0 0 1 10 3.6 8.5 8.5 0 1 0 20.4 14Z"/>',
    orbit:
      '<ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="2"/><path d="m17 3 3 .5-.5 3"/>',
    label: '<path d="M3 5h18v13H9l-5 3v-3H3Z"/><path d="M7 10h10m-10 4h6"/>',
    expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    camera:
      '<path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="4"/>',
    quality: '<path d="m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 3m0 3v.2"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    reset: '<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
};

export function mountUI(root: HTMLElement): {
  host: HTMLElement;
  events: SceneEvents;
  bind(controls: SceneControls): void;
  dispose(): void;
} {
  root.innerHTML = `
    <main class="paper-city" data-time="day">
      <div class="scene-host" aria-label="上海黄浦江水彩三维微缩景观，可拖动旋转、滚轮缩放"></div>
      <div class="paper-grain" aria-hidden="true"></div>
      <header class="masthead">
        <div class="title-lockup"><span class="seal" aria-hidden="true">沪</span><div><p class="edition">SHANGHAI · A PAPER JOURNEY</p><h1>纸上浦江</h1><p class="title-caption">A CITY IN WATERCOLOUR</p></div></div>
        <div class="folio-meta"><div class="coordinates">31°14′ N &nbsp; / &nbsp; 121°30′ E</div><div class="local-clock"><span class="clock-dot"></span>上海 <time id="local-time"></time><span class="clock-zone">CST</span></div><p>十三处城市地标 · 三种光影时刻</p></div>
      </header>
      <aside class="intro-note"><span class="small-overline">沿江，拾一城风景</span><p>一江水，两岸城。<br>在纸与水色之间，<br>重新遇见上海。</p><span class="intro-rule"></span><p class="intro-hint">拖动以漫游 · 滚动以靠近<br>点选地标，读一段城市记忆</p></aside>
      <nav class="utility-rail" aria-label="景观工具">
        <button class="tool-button is-active" data-action="orbit" aria-label="暂停自动环游" aria-pressed="true" data-tip="自动环游">${icon("orbit")}</button>
        <button class="tool-button is-active" data-action="labels" aria-label="隐藏地标名称" aria-pressed="true" data-tip="地标名称">${icon("label")}</button>
        <span class="rail-rule"></span>
        <button class="tool-button" data-action="fullscreen" aria-label="全屏浏览" data-tip="全屏浏览">${icon("expand")}</button>
        <button class="tool-button" data-action="capture" aria-label="保存此刻截图" data-tip="保存此刻">${icon("camera")}</button>
        <button class="tool-button" data-action="quality" aria-label="开启流畅画质" aria-pressed="false" data-tip="流畅模式">${icon("quality")}</button>
        <span class="rail-rule"></span>
        <button class="tool-button" data-action="help" aria-label="查看漫游指南" data-tip="漫游指南">${icon("help")}</button>
      </nav>
      <section class="landmark-detail" aria-label="地标详情" hidden><button class="detail-close" data-action="close-detail" aria-label="关闭地标详情">${icon("close")}</button><span class="small-overline">CITY NOTES <span class="detail-number">/ 城市手记</span></span><h2 class="detail-name"></h2><p class="detail-en"></p><p class="detail-description"></p><button class="focus-button" data-action="focus">靠近这处风景 ${icon("arrow")}</button></section>
      <footer class="scene-footer"><div class="folio-index"><span class="folio-line"></span><span>一页上海</span><span class="folio-number">01 / 13</span></div><div class="interaction-note">在水色里，看见城市的另一面<span>EXPLORE AT YOUR OWN PACE</span></div></footer>
      <div class="view-dock"><div class="time-controls" role="group" aria-label="选择光影时刻"><button data-time="day" aria-pressed="true" class="is-active">${icon("sun")}<span>白昼</span></button><button data-time="dusk" aria-pressed="false">${icon("sunset")}<span>暮色</span></button><button data-time="night" aria-pressed="false">${icon("moon")}<span>入夜</span></button></div><div class="view-controls" role="group" aria-label="选择观景视角"><span class="view-label">视角</span><button data-view="overview" class="is-active" aria-pressed="true">全景</button><button data-view="lujiazui" aria-pressed="false">陆家嘴</button><button data-view="bund" aria-pressed="false">外滩</button><button data-view="river" aria-pressed="false">江面</button><button class="reset-button" data-action="reset" aria-label="重置视角" title="重置视角">${icon("reset")}</button></div></div>
      <div class="toast" role="status" aria-live="polite" hidden></div>
      <div class="loading-curtain"><div class="loading-mark">沪</div><p class="loading-title">一座城，正在纸上苏醒</p><p class="loading-caption">UNFOLDING SHANGHAI</p><div class="loading-track"><span></span></div><span class="loading-progress">0%</span></div>
      <dialog class="guide-dialog"><div class="guide-heading"><span class="small-overline">A LITTLE FIELD GUIDE</span><button class="detail-close" data-action="close-help" aria-label="关闭漫游指南">${icon("close")}</button></div><h2>慢慢看，慢慢逛。</h2><p class="guide-lead">把这座纸上城市，转到你喜欢的角度。</p><dl><div><dt>拖动鼠标 / 单指拖动</dt><dd>环绕城市，寻找新的风景</dd></div><div><dt>鼠标滚轮 / 双指缩放</dt><dd>靠近建筑，或退后看全景</dd></div><div><dt>1 / 2 / 3 · R</dt><dd>切换白昼、暮色、入夜；按 R 重置视角</dd></div><div><dt>点选地标</dt><dd>打开城市手记，靠近观看</dd></div></dl><p class="guide-foot">用下方按钮切换光影与视角；右侧工具可暂停环游、隐藏名称或保存此刻。</p><button class="guide-done" data-action="close-help">开始漫游 ${icon("arrow")}</button></dialog>
    </main>`;

  const page = root.querySelector<HTMLElement>(".paper-city")!;
  const host = page.querySelector<HTMLElement>(".scene-host")!;
  const select = <T extends HTMLElement>(query: string) =>
    page.querySelector<T>(query)!;
  let controls: SceneControls | undefined;
  let selected: LandmarkDefinition | null = null;
  let orbit = true;
  let labels = true;
  let lowQuality = false;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const toast = (message: string, persistent = false) => {
    const box = select<HTMLElement>(".toast");
    clearTimeout(toastTimer);
    box.replaceChildren(document.createTextNode(message));
    box.hidden = !message.trim();
    box.classList.toggle("is-persistent", persistent);
    if (box.hidden) return;
    if (persistent) {
      const retry = document.createElement("button");
      retry.dataset.action = "reload";
      retry.className = "reload-button";
      retry.textContent = "重新加载";
      box.append(retry);
    } else
      toastTimer = setTimeout(() => {
        box.hidden = true;
      }, 4500);
  };
  const pressed = (button: HTMLElement, active: boolean) => {
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  };
  const syncTime = (time: TimeOfDay) => {
    page.dataset.time = time;
    page
      .querySelectorAll<HTMLButtonElement>(".time-controls button")
      .forEach((item) => pressed(item, item.dataset.time === time));
  };
  const onTime = (event: Event) => {
    const time: unknown = (event as CustomEvent).detail;
    if (time === "day" || time === "dusk" || time === "night") syncTime(time);
  };
  const syncView = (view: ViewName | null) => {
    page
      .querySelectorAll<HTMLButtonElement>("[data-view]")
      .forEach((item) => pressed(item, item.dataset.view === view));
  };
  const onView = (event: Event) => {
    const view: unknown = (event as CustomEvent).detail;
    if (
      view === null ||
      view === "overview" ||
      view === "lujiazui" ||
      view === "bund" ||
      view === "river"
    )
      syncView(view);
  };
  window.addEventListener("paper-time", onTime);
  window.addEventListener("paper-view", onView);
  const setOrbit = (value: boolean) => {
    orbit = value;
    const button = select<HTMLButtonElement>('[data-action="orbit"]');
    pressed(button, value);
    button.setAttribute("aria-label", value ? "暂停自动环游" : "开始自动环游");
  };
  const showDetail = (landmark: LandmarkDefinition | null) => {
    selected = landmark;
    select<HTMLElement>(".landmark-detail").hidden = !landmark;
    if (!landmark) return;
    select<HTMLElement>(".detail-name").textContent = landmark.name;
    select<HTMLElement>(".detail-en").textContent = landmark.en;
    select<HTMLElement>(".detail-description").textContent =
      landmark.description;
  };
  page.addEventListener("click", async (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!button) return;
    const time = button.dataset.time as TimeOfDay | undefined;
    const view = button.dataset.view as ViewName | undefined;
    if (time) {
      syncTime(time);
      controls?.setTime(time);
    }
    if (view) {
      syncView(view);
      controls?.setView(view);
    }
    switch (button.dataset.action) {
      case "reload":
        location.reload();
        break;
      case "orbit":
        setOrbit(!orbit);
        controls?.setAutoRotate(orbit);
        break;
      case "labels":
        labels = !labels;
        pressed(button, labels);
        button.setAttribute(
          "aria-label",
          labels ? "隐藏地标名称" : "显示地标名称",
        );
        controls?.setLabels(labels);
        break;
      case "quality":
        lowQuality = !lowQuality;
        pressed(button, lowQuality);
        button.setAttribute(
          "aria-label",
          lowQuality ? "恢复精细画质" : "开启流畅画质",
        );
        controls?.setQuality(lowQuality ? "low" : "high");
        toast(lowQuality ? "已切换流畅画质" : "已恢复精细画质");
        break;
      case "capture":
        controls?.capture().catch(() => toast("截图未能保存，请重试。"));
        break;
      case "fullscreen":
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await page.requestFullscreen();
        } catch {
          toast("当前浏览器暂不支持全屏浏览");
        }
        break;
      case "help":
        select<HTMLDialogElement>(".guide-dialog").showModal();
        break;
      case "close-help":
        select<HTMLDialogElement>(".guide-dialog").close();
        break;
      case "close-detail":
        showDetail(null);
        break;
      case "focus":
        if (selected) controls?.focusLandmark(selected.id);
        break;
      case "reset":
        controls?.reset();
        showDetail(null);
        syncView("overview");
        break;
    }
  });
  const dialog = select<HTMLDialogElement>(".guide-dialog");
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close();
  });
  const updateClock = () => {
    select<HTMLTimeElement>("#local-time").textContent =
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Shanghai",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());
  };
  updateClock();
  const clockTimer = setInterval(updateClock, 30000);
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;
  return {
    host,
    bind(next) {
      controls = next;
    },
    dispose() {
      clearInterval(clockTimer);
      clearTimeout(toastTimer);
      clearTimeout(loadingTimer);
      window.removeEventListener("paper-time", onTime);
      window.removeEventListener("paper-view", onView);
      dialog.close();
    },
    events: {
      onProgress(value) {
        const progress = Math.round(Math.max(0, Math.min(1, value)) * 100);
        select<HTMLElement>(".loading-track span").style.width = `${progress}%`;
        select<HTMLElement>(".loading-progress").textContent = `${progress}%`;
      },
      onReady() {
        select<HTMLElement>(".loading-track span").style.width = "100%";
        select<HTMLElement>(".loading-progress").textContent = "100%";
        page.classList.add("is-ready");
        loadingTimer = setTimeout(() => {
          select<HTMLElement>(".loading-curtain").hidden = true;
        }, 750);
      },
      onSelect: showDetail,
      onAutoRotate: setOrbit,
      onError(message) {
        if (!message.trim()) {
          toast("");
          return;
        }
        select<HTMLElement>(".loading-curtain").hidden = true;
        toast(message, !page.classList.contains("is-ready"));
      },
      onStats(fps) {
        select<HTMLButtonElement>('[data-action="quality"]').title =
          `${lowQuality ? "流畅" : "精细"}画质 · ${Math.round(fps)} FPS`;
      },
    },
  };
}
