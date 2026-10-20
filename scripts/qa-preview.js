await page.setViewportSize({width:1600,height:1000});
await page.evaluate(()=>{const p=window.paperCity;p.controls.setAutoRotate(false);p.controls.setLabels(false);p.camera.position.set(-110,108,165);p.orbit.target.set(0,14,0);p.orbit.update();});
await page.waitForTimeout(300);
return {errors:globalThis.qaErrors,stats:await page.evaluate(()=>window.paperCity.stats()),viewport:await page.evaluate(()=>({w:innerWidth,h:innerHeight,dpr:devicePixelRatio})),fps:await page.locator('[data-action="quality"]').getAttribute('title'),screenshot:await page.screenshot({fullPage:false})};
