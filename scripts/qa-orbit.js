await page.setViewportSize({width:1280,height:800});await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.paperCity);
await page.evaluate(()=>{const c=window.paperCity.controls;c.setAutoRotate(false);c.setLabels(false);c.reset();});await page.waitForTimeout(1700);
const captures=[];
for(const time of ['day','dusk','night']){
 await page.evaluate(t=>window.paperCity.controls.setTime(t),time);await page.waitForTimeout(2800);
 for(let angle=0;angle<360;angle+=45){await page.evaluate(a=>window.paperCity.angle(a*Math.PI/180),angle);await page.waitForTimeout(100);const shot=await page.screenshot({fullPage:false});captures.push({time,angle,path:shot.path||shot.nextAction?.path});}
}
const fs=await import('node:fs/promises');const reportPath=artifactPath('orbit-captures.json');await fs.writeFile(reportPath,JSON.stringify(captures,null,2));
return {reportPath,count:captures.length,first:captures[0]};
