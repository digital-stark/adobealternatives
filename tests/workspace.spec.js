import {test,expect} from '@playwright/test';

test('reference workspace keeps grouped panels and contextual controls usable',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('.layer-row')).toHaveCount(2);
 await expect(page.locator('#color-panel')).toBeVisible();await expect(page.locator('#properties-panel')).toBeVisible();
 await expect(page.locator('#flyout-generate')).toBeHidden();
 await page.getByRole('button',{name:'Brush',exact:true}).click();await expect(page.locator('#paint-options')).toBeVisible();await expect(page.locator('#move-options')).toBeHidden();
 await page.locator('#brush-size').fill('80');await page.locator('#brush-opacity').fill('100');await page.locator('#foreground-hex').fill('00ff00');await page.locator('#foreground-hex').press('Tab');
 await expect(page.locator('#color')).toHaveValue('#00ff00');
 const box=await page.locator('#canvas').boundingBox();const scale=box.width/1800;
 await page.mouse.move(box.x+300*scale,box.y+300*scale);await page.mouse.down();await page.mouse.move(box.x+350*scale,box.y+300*scale,{steps:5});await page.mouse.up();
 const painted=await page.locator('#canvas').evaluate(c=>[...c.getContext('2d').getImageData(325,330,1,1).data]);expect(painted).toEqual([0,255,0,255]);
 await page.getByRole('button',{name:'Text',exact:true}).click();await expect(page.locator('#text-options')).toBeVisible();await expect(page.locator('#paint-options')).toBeHidden();
 await page.getByRole('button',{name:'History panel',exact:true}).click();await expect(page.locator('#history-list')).toContainText('Before edit 1');
 await page.getByRole('button',{name:'Navigator panel',exact:true}).click();await expect(page.locator('#flyout-history')).toBeHidden();await page.locator('#navigator-zoom').fill('100');await expect(page.locator('.doc-percent .zoom-text')).toHaveText('100');
 await page.getByRole('button',{name:'Close Navigator',exact:true}).click();
 await page.locator('#channels-tab').click();await expect(page.locator('#channels-content')).toBeVisible();await expect(page.locator('#layer-list')).toBeHidden();
 await page.locator('#paths-tab').click();await expect(page.locator('#paths-content')).toContainText('No saved paths');
 await page.locator('#layers-tab').click();await page.locator('#layer-filter').fill('coastal');await expect(page.locator('.layer-row:visible')).toHaveCount(1);await page.locator('#layer-filter').fill('');
 await page.getByRole('button',{name:'Switch toolbar columns',exact:true}).click();await expect(page.locator('body')).toHaveClass(/two-column-tools/);
 await page.setViewportSize({width:1280,height:720});
 const footer=await page.locator('.layer-footer').boundingBox();expect(footer.y+footer.height).toBeLessThanOrEqual(720);
 expect(errors).toEqual([]);
});

test('workspace presets, resize persistence, panel collapse, and reset work',async({page})=>{
 await page.goto('/');await expect(page.locator('.layer-row')).toHaveCount(2);
 const separator=page.getByRole('separator',{name:'Resize panels'});await separator.focus();await page.keyboard.press('ArrowLeft');
 await expect.poll(()=>page.locator('.inspector').evaluate(e=>Math.round(e.getBoundingClientRect().width))).toBe(302);
 await page.reload();await expect(page.locator('.layer-row')).toHaveCount(2);expect(await page.locator('.inspector').evaluate(e=>Math.round(e.getBoundingClientRect().width))).toBe(302);
 await page.getByRole('combobox',{name:'Workspace',exact:true}).selectOption('painting');await expect(page.locator('#properties-panel')).toBeHidden();await expect(page.locator('#paint-options')).toBeVisible();
 await page.reload();await expect(page.locator('.layer-row')).toHaveCount(2);await expect(page.locator('#paint-options')).toBeVisible();await expect(page.locator('#properties-panel')).toBeHidden();
 await page.getByRole('button',{name:'Image',exact:true}).click();await page.getByRole('button',{name:'Image adjustments',exact:true}).click();await expect(page.locator('#properties-panel')).toBeVisible();await expect(page.locator('.adjustments-section')).toBeVisible();
 await page.getByRole('combobox',{name:'Workspace',exact:true}).selectOption('photography');await expect(page.locator('#color-panel')).toBeHidden();await expect(page.locator('.adjustments-section')).toBeVisible();
 await page.getByRole('button',{name:'Window',exact:true}).click();await page.getByRole('button',{name:'Reset Essentials',exact:true}).click();await expect(page.locator('#color-panel')).toBeVisible();await expect(page.locator('#properties-panel')).toBeVisible();await expect(page.getByRole('combobox',{name:'Workspace',exact:true})).toHaveValue('essentials');
 await page.getByRole('button',{name:'Collapse Color panel',exact:true}).click();await expect(page.locator('#color-panel')).toHaveClass(/collapsed/);await page.locator('#collapse-color').click();
 await page.getByRole('button',{name:'Find a tool',exact:true}).click();await page.getByRole('textbox',{name:'Search tools',exact:true}).fill('eraser');await page.locator('#command-results button').click();await expect(page.getByRole('button',{name:'Eraser',exact:true})).toHaveAttribute('aria-pressed','true');
});
