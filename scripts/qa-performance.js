const results=[];
for(const [quality,labels] of [['high',false],['high',true],['low',false]]){
 await page.evaluate(({quality,labels})=>{const c=window.paperCity.controls;c.setQuality(quality);c.setLabels(labels);c.setAutoRotate(false);},{quality,labels});
 const sample=await page.evaluate(()=>new Promise(resolve=>{let n=0,start=0;const times=[];let last=0;const tick=t=>{if(!start)start=t;if(last)times.push(t-last);last=t;if(++n===91){times.sort((a,b)=>a-b);const r=window.paperCity.renderer;resolve({fps:90000/(t-start),p95ms:times[Math.floor(times.length*.95)],width:r.domElement.width,height:r.domElement.height,calls:r.info.render.calls});}else requestAnimationFrame(tick);};requestAnimationFrame(tick);}));results.push({quality,labels,...sample});
}
await page.evaluate(()=>{window.paperCity.controls.setQuality('high');window.paperCity.controls.setLabels(true);});
return results;
