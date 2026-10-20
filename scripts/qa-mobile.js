const results=[];
for(const [name,width,height] of [['portrait',260,560],['landscape',560,260]]){
 await page.setViewportSize({width,height});await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.paperCity);await page.evaluate(()=>window.paperCity.controls.setAutoRotate(false));await page.waitForTimeout(400);
 await page.getByRole('button',{name:'暮色',exact:true}).click();await page.waitForTimeout(2700);
 results.push({name,metrics:await page.evaluate(()=>({w:innerWidth,h:innerHeight,main:document.querySelector('main').getBoundingClientRect().toJSON(),dock:document.querySelector('.view-dock').getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth})),screenshot:await page.screenshot({fullPage:false})});
}
return results;
