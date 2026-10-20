await page.reload({waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.paperCity);
await page.getByRole('button',{name:'入夜',exact:true}).click();
await page.evaluate(()=>{window.paperCity.controls.setAutoRotate(false);window.paperCity.controls.setLabels(false);});
await page.waitForTimeout(3100);
return {fps:await page.locator('[data-action="quality"]').getAttribute('title'),stats:await page.evaluate(()=>window.paperCity.stats()),errors:globalThis.qaErrors,screenshot:await page.screenshot({fullPage:false})};
