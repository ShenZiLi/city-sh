await page.setViewportSize({width:1600,height:1000});await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.paperCity);
await page.evaluate(()=>{const c=window.paperCity.controls;c.setAutoRotate(false);c.reset();c.setLabels(false);});await page.waitForTimeout(1700);
const captures=[];for(const time of ['day','dusk','night']){await page.evaluate(t=>window.paperCity.controls.setTime(t),time);await page.waitForTimeout(2800);const shot=await page.screenshot({fullPage:false});captures.push({time,path:shot.path||shot.nextAction?.path});}
const fs=await import('node:fs/promises');const reportPath=artifactPath('hero-captures.json');await fs.writeFile(reportPath,JSON.stringify(captures,null,2));return {reportPath,count:captures.length};
