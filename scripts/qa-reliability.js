const checks=[];const check=(name,pass)=>{assert(pass,name);checks.push({name,pass});};
await page.route('**/assets/S01.webp',route=>route.abort());
await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.paperCity);
check('missing asset names are reported',(await page.locator('.toast').textContent()).includes('S01'));
check('partial sky uses complete fallback',await page.evaluate(()=>{const s=window.paperCity.scene.children.find(o=>o.material?.uniforms?.uDay);return s&&!s.visible;}));
await page.unroute('**/assets/S01.webp');await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.paperCity);
const contextLossSupported=await page.evaluate(()=>{const ext=window.paperCity.renderer.getContext().getExtension('WEBGL_lose_context');window.__qaExt=ext;return !!ext;});
if(contextLossSupported){await page.evaluate(()=>window.__qaExt.loseContext());await page.waitForFunction(()=>document.querySelector('.toast').textContent.includes('连接暂时中断'));check('context loss feedback',true);await page.waitForTimeout(250);await page.evaluate(()=>window.__qaExt.restoreContext());await page.waitForFunction(()=>!window.paperCity.renderer.getContext().isContextLost());await page.waitForTimeout(900);check('context restored',await page.evaluate(()=>!window.paperCity.renderer.getContext().isContextLost()));}
await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.paperCity);
check('reduced motion disables auto orbit',await page.evaluate(()=>!window.paperCity.orbit.autoRotate));
await page.getByRole('button',{name:'暮色',exact:true}).click();await page.waitForTimeout(300);
check('reduced motion shortens transition',await page.evaluate(()=>{const s=window.paperCity.scene.children.find(o=>o.material?.uniforms?.uPhase);return Math.abs(s.material.uniforms.uPhase.value-1)<.001;}));
check('reduced motion freezes environment',await page.evaluate(()=>{const g=window.paperCity.scene.children.find(o=>o.userData.buildingCount);const w=g.children.find(o=>o.material?.uniforms?.uTime);return w.material.uniforms.uTime.value===0;}));
await page.evaluate(()=>window.paperCity.controls.dispose());check('dispose removes canvas and diagnostics',await page.evaluate(()=>!window.paperCity&&!document.querySelector('.scene-host canvas')));
await page.emulateMedia({reducedMotion:'no-preference'});await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.paperCity);
const fs=await import('node:fs/promises');const path=artifactPath('reliability-report.json');await fs.writeFile(path,JSON.stringify({checks,contextLossSupported},null,2));return {path,checks,contextLossSupported};
