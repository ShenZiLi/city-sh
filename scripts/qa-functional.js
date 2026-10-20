globalThis.qaErrors=[];globalThis.failedAssets=[];
page.on('pageerror',e=>globalThis.qaErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')globalThis.qaErrors.push(m.text().slice(0,1500));});
page.on('response',r=>{if(r.status()>=400)globalThis.failedAssets.push({url:r.url(),status:r.status()});});
await page.setViewportSize({width:1280,height:720});
await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.paperCity);
await page.evaluate(()=>window.paperCity.controls.setAutoRotate(false));
await page.waitForTimeout(2000);
const checks=[];
const check=(name,pass)=>{assert(pass,name);checks.push({name,pass});};
check('13 selectable landmarks',await page.evaluate(()=>window.paperCity.landmarks.length===13));
check('80–120 ordinary buildings',await page.evaluate(()=>{const n=window.paperCity.stats().buildings;return n>=80&&n<=120;}));
const position=await page.evaluate(()=>window.paperCity.camera.position.toArray());
for(const name of ['暮色','入夜','白昼']){await page.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(2700);check('time '+name,await page.getByRole('button',{name,exact:true}).getAttribute('aria-pressed')==='true');}
check('time change preserves camera',await page.evaluate(p=>window.paperCity.camera.position.toArray().every((v,i)=>Math.abs(v-p[i])<.01),position));
await page.getByRole('button',{name:'暮色',exact:true}).click();await page.getByRole('button',{name:'入夜',exact:true}).click();await page.getByRole('button',{name:'白昼',exact:true}).click();await page.waitForTimeout(2700);check('rapid switch reaches last choice',await page.evaluate(()=>window.paperCity.stats().time==='day'));
for(const name of ['陆家嘴','外滩','江面','全景']){await page.locator(`[data-view]`).filter({hasText:new RegExp('^'+name+'$')}).click();await page.waitForTimeout(1650);check('view '+name,await page.locator(`[data-view].is-active`).textContent()===name);}
await page.locator('[data-view="bund"]').click();await page.waitForTimeout(100);await page.keyboard.press('r');check('keyboard reset syncs view',await page.locator('[data-view="overview"]').getAttribute('aria-pressed')==='true');await page.waitForTimeout(1650);
await page.keyboard.press('3');check('keyboard time sync',await page.getByRole('button',{name:'入夜',exact:true}).getAttribute('aria-pressed')==='true');await page.keyboard.press('1');
await page.getByRole('button',{name:'隐藏地标名称',exact:true}).click();check('labels off',await page.evaluate(()=>document.querySelector('.label-layer').style.visibility==='hidden'));
await page.getByRole('button',{name:'显示地标名称',exact:true}).click();await page.waitForTimeout(300);
await page.getByRole('button',{name:'了解东方明珠',exact:true}).click();check('landmark info',await page.locator('.detail-name').textContent()==='东方明珠');
await page.getByRole('button',{name:'靠近这处风景'}).click();await page.waitForTimeout(1650);check('focus moves target',await page.evaluate(()=>Math.abs(window.paperCity.orbit.target.x-18)<.01));
await page.getByRole('button',{name:'关闭地标详情'}).click();
await page.getByRole('button',{name:'开启流畅画质'}).click();check('low quality',await page.evaluate(()=>window.paperCity.stats().quality==='low'));
await page.getByRole('button',{name:'恢复精细画质'}).click();check('high quality',await page.evaluate(()=>window.paperCity.stats().quality==='high'));
await page.getByRole('button',{name:'开始自动环游'}).click();await page.mouse.move(640,360);await page.mouse.down();await page.mouse.move(710,390,{steps:8});await page.mouse.up();check('drag pauses auto orbit',await page.getByRole('button',{name:'开始自动环游'}).getAttribute('aria-pressed')==='false');
await page.getByRole('button',{name:'查看漫游指南'}).click();check('help opens',await page.locator('dialog').evaluate(d=>d.open));await page.keyboard.press('Escape');check('help closes',await page.locator('dialog').evaluate(d=>!d.open));
await page.getByRole('button',{name:'全屏浏览'}).click();const fullscreen=await page.evaluate(()=>!!document.fullscreenElement);if(fullscreen){check('fullscreen enter',true);await page.getByRole('button',{name:'全屏浏览'}).click();check('fullscreen exit',await page.evaluate(()=>!document.fullscreenElement));}else{check('fullscreen blocked: graceful feedback',await page.locator('.toast').textContent()==='当前浏览器暂不支持全屏浏览');}
await page.evaluate(()=>{const c=window.paperCity.controls,original=c.capture.bind(c);c.capture=()=>window.__qaCapture=original();});await page.getByRole('button',{name:'保存此刻截图'}).click();const dataURL=await page.evaluate(async()=>{const blob=await window.__qaCapture;return await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});});const fs=await import('node:fs/promises');const downloadPath=artifactPath('paper-city-export.png');const png=Buffer.from(dataURL.split(',')[1],'base64');await fs.writeFile(downloadPath,png);check('PNG export',png.length>10000&&png[0]===137&&png[1]===80);
await page.evaluate(()=>window.paperCity.controls.reset());await page.waitForTimeout(1700);
const performance=await page.evaluate(()=>{const p=window.paperCity,gl=p.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {...p.stats(),width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,cssWidth:innerWidth,cssHeight:innerHeight,dpr:devicePixelRatio,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),ua:navigator.userAgent};});
performance.fps=await page.locator('[data-action="quality"]').getAttribute('title');
performance.measuredFps=await page.evaluate(()=>new Promise(resolve=>{let n=0,start=0;const tick=t=>{if(!start)start=t;if(++n===91)resolve(90000/(t-start));else requestAnimationFrame(tick);};requestAnimationFrame(tick);}));
check('no runtime errors',globalThis.qaErrors.length===0);check('no failed requests',globalThis.failedAssets.length===0);
const report={checks,performance,fullscreenNative:fullscreen,errors:globalThis.qaErrors,failed:globalThis.failedAssets,exportPath:downloadPath};const reportPath=artifactPath('functional-report.json');await fs.writeFile(reportPath,JSON.stringify(report,null,2));return {reportPath,...report};
