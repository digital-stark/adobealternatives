import { test, expect } from "@playwright/test";
const fixture = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><path fill="#ff0000" d="M0 0H50V80H0Z"/><path fill="#0000ff" d="M50 0H100V80H50Z"/></svg>',
);
async function menu(page, name, item) {
  await page.getByRole("button", { name, exact: true }).click();
  await page
    .locator("#menu-popover")
    .getByRole("button", { name: item, exact: true })
    .click();
}
async function loadFixture(page) {
  await page.goto("/");
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await page.locator("#file-input").setInputFiles({
    name: "fixture.svg",
    mimeType: "image/svg+xml",
    buffer: fixture,
  });
  await expect(page.locator("#dimensions")).toHaveText("100 × 80 px");
}
async function pixel(page, x, y) {
  return page
    .locator("#canvas")
    .evaluate(
      (c, { x, y }) => [...c.getContext("2d").getImageData(x, y, 1, 1).data],
      { x, y },
    );
}
async function clickAt(page, x, y) {
  const r = await page.locator("#canvas").boundingBox();
  await page.mouse.click(r.x + (x * r.width) / 100, r.y + (y * r.height) / 80);
}

test("foundations: new document, resolution, resampling, placement, clipboard and export", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await menu(page, "File", "New document…");
  await page.locator("[name=width]").fill("160");
  await page.locator("[name=height]").fill("120");
  await page.locator("[name=ppi]").fill("300");
  await page
    .locator("#book-form")
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await expect(page.locator("#dimensions")).toHaveText("160 × 120 px");
  await expect(page.locator(".document-meta b")).toHaveText("300 pixels/inch");
  expect(await pixel(page, 10, 10)).toEqual([255, 255, 255, 255]);
  await menu(page, "File", "Place image as layer…");
  await page.locator("#place-file").setInputFiles({
    name: "placed.svg",
    mimeType: "image/svg+xml",
    buffer: fixture,
  });
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await menu(page, "Edit", "Copy");
  await menu(page, "Edit", "Paste");
  await expect(page.locator(".layer-row")).toHaveCount(3);
  await menu(page, "Image", "Image size…");
  await page.locator("[name=width]").fill("80");
  await page
    .locator("#book-form")
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await expect(page.locator("#dimensions")).toHaveText("80 × 60 px");
  await menu(page, "Image", "Rotate 90° clockwise");
  await expect(page.locator("#dimensions")).toHaveText("60 × 80 px");
  await menu(page, "File", "Export image…");
  await page.locator("[name=format]").selectOption("jpeg");
  const download = page.waitForEvent("download");
  await page
    .locator("#book-form")
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.jpg$/);
  await page.locator("#undo").click();
  await expect(page.locator("#dimensions")).toHaveText("80 × 60 px");
});

test("wand selections, real masks and editable adjustment layers survive project round trips", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await loadFixture(page);
  await page.getByRole("button", { name: "Magic Wand", exact: true }).click();
  await page.locator("#wand-tolerance").fill("0");
  await clickAt(page, 20, 30);
  await expect(page.locator("#selection-dimensions")).toHaveText(
    "50 × 80 px selected",
  );
  await menu(page, "Layer", "Add mask from selection");
  expect((await pixel(page, 75, 40))[3]).toBe(0);
  expect(await pixel(page, 25, 40)).toEqual([255, 0, 0, 255]);
  await menu(page, "Image", "Adjustments & filters…");
  await page.locator("#effect-choice").selectOption("bw");
  await page.locator("#effect-apply").click();
  await expect(page.locator(".layer-row")).toHaveCount(2);
  const gray = await pixel(page, 25, 40);
  expect(gray[0]).toBe(gray[1]);
  expect(gray[1]).toBe(gray[2]);
  expect((await pixel(page, 75, 40))[3]).toBe(0);
  const download = page.waitForEvent("download");
  await menu(page, "File", "Save project…");
  const file = await download;
  const saved = test.info().outputPath("effects.prism");
  await file.saveAs(saved);
  await page.locator("#file-input").setInputFiles(saved);
  await expect(page.locator("#document-name")).toHaveText("effects.prism");
  expect(await pixel(page, 25, 40)).toEqual(gray);
  expect((await pixel(page, 75, 40))[3]).toBe(0);
  await expect(page.locator(".mask-thumb")).toHaveCount(2);
  await page.locator(".layer-row").first().dblclick();
  await expect(page.locator("#effect-choice")).toHaveValue("bw");
  await page.locator("#close-modal").click();
  expect(errors).toEqual([]);
});

test("worker filters, mirrored art, gradient paths and the learning checklist are usable offline", async ({
  page,
  context,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await loadFixture(page);
  await expect(page.locator("body")).toHaveAttribute(
    "data-processing-ready",
    "true",
  );
  await context.setOffline(true);
  await menu(page, "Filter", "Gaussian-style blur…");
  await page.locator("#effect-apply").click();
  await expect(page.locator(".layer-row")).toHaveCount(2);
  const middle = await pixel(page, 49, 40);
  expect(middle[0]).toBeGreaterThan(0);
  expect(middle[2]).toBeGreaterThan(0);
  await menu(page, "Filter", "Kaleidoscope…");
  await page
    .locator("#book-form")
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await expect(page.locator(".layer-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Pen path", exact: true }).click();
  await clickAt(page, 10, 10);
  await clickAt(page, 80, 20);
  await clickAt(page, 30, 70);
  await page.locator("#commit-path").click();
  await expect(page.locator(".layer-row")).toHaveCount(4);
  await page.locator("#paths-tab").click();
  await expect(page.locator(".path-entry")).toHaveCount(1);
  await menu(page, "Help", "Beginner workshop checklist");
  await expect(page.locator(".lesson-row")).toHaveCount(11);
  await expect(page.locator("#lesson-list")).toContainText("Camera RAW");
  expect(errors).toEqual([]);
});

test("layer-mask painting, retouch brushes and Quick Mask change actual pixels", async ({
  page,
}) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Magic Wand", exact: true }).click();
  await page.locator("#wand-tolerance").fill("0");
  await clickAt(page, 20, 40);
  await menu(page, "Layer", "Add mask from selection");
  await page.locator("#deselect").click();
  await page.locator("#brush-size").fill("20");
  await clickAt(page, 75, 40);
  expect(await pixel(page, 75, 40)).toEqual([0, 0, 255, 255]);
  await page.locator("#foreground-hex").fill("808080");
  await page.locator("#foreground-hex").press("Tab");
  await clickAt(page, 75, 40);
  expect((await pixel(page, 75, 40))[3]).toBe(128);
  await page.locator("#foreground-hex").fill("000000");
  await page.locator("#foreground-hex").press("Tab");
  await clickAt(page, 25, 40);
  expect((await pixel(page, 25, 40))[3]).toBe(0);
  await page.locator("#undo").click();
  expect((await pixel(page, 25, 40))[3]).toBe(255);
  await menu(page, "Layer", "Remove layer mask");
  await menu(page, "Edit", "Set History brush source");
  await page.getByRole("button", { name: "Dodge", exact: true }).click();
  await clickAt(page, 25, 40);
  expect((await pixel(page, 25, 40))[1]).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Burn", exact: true }).click();
  await clickAt(page, 25, 40);
  expect((await pixel(page, 25, 40))[0]).toBeLessThan(255);
  await page
    .getByRole("button", { name: "History brush", exact: true })
    .click();
  const before = await pixel(page, 25, 40);
  await clickAt(page, 25, 40);
  expect((await pixel(page, 25, 40))[0]).toBeGreaterThan(before[0]);
  await menu(page, "Select", "Quick Mask (Q)");
  await clickAt(page, 25, 40);
  await expect(page.locator("#quick-mask-overlay")).toBeVisible();
  await menu(page, "Select", "Quick Mask (Q)");
  await expect(page.locator("#quick-mask-overlay")).toHaveCount(0);
  await expect(page.locator("#selection")).toBeVisible();
});

test("local image browser and manual edge-refinement workflows work", async ({
  page,
}) => {
  await loadFixture(page);
  await menu(page, "File", "Local image browser…");
  await page.locator("#gallery-files").setInputFiles({
    name: "local-example.svg",
    mimeType: "image/svg+xml",
    buffer: fixture,
  });
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await page.locator(".gallery-card input").fill("landscape");
  await page.locator(".gallery-card input").press("Tab");
  await page.locator("#gallery-search").fill("landscape");
  await expect(page.locator(".gallery-card")).toHaveCount(1);
  await page
    .locator(".gallery-card")
    .getByRole("button", { name: "Rate", exact: true })
    .click();
  await expect(page.locator(".gallery-card")).toContainText("★");
  await page
    .locator(".gallery-card")
    .getByRole("button", { name: "Place as layer", exact: true })
    .click();
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Quick selection", exact: true })
    .click();
  await clickAt(page, 20, 40);
  await expect(page.locator("#selection-dimensions")).toHaveText(
    "50 × 80 px selected",
  );
  await menu(page, "Select", "Refine selection edges…");
  await page.locator("[name=shift]").fill("2");
  await page
    .locator("#book-form")
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await expect(page.locator("#selection-dimensions")).toHaveText(
    "52 × 80 px selected",
  );
});

test("content-aware move prepares a masked local request and preserves original layers", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.prismDesktop = {
      offline: true,
      onCommand: () => {},
      setDirty: () => {},
      generate: async (payload) => {
        window.__movePayload = payload;
        return { image: payload.image };
      },
    };
  });
  await loadFixture(page);
  await page.getByRole("button", { name: "Magic Wand", exact: true }).click();
  await page.locator("#wand-tolerance").fill("0");
  await clickAt(page, 20, 40);
  await menu(page, "Filter", "Content-aware move (local AI)…");
  await page.locator("[name=x]").fill("10");
  await page
    .locator("#book-form")
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await expect(page.locator(".layer-row")).toHaveCount(3);
  await expect(page.locator(".layer-row").first()).toContainText(
    "Moved object",
  );
  const result = await page.evaluate(async () => {
    const p = window.__movePayload,
      img = new Image();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = p.mask;
    });
    const c = document.createElement("canvas");
    c.width = 100;
    c.height = 80;
    c.getContext("2d").drawImage(img, 0, 0);
    return {
      endpoint: p.endpoint,
      width: p.width,
      left: [...c.getContext("2d").getImageData(20, 40, 1, 1).data],
      right: [...c.getContext("2d").getImageData(75, 40, 1, 1).data],
    };
  });
  expect(result).toEqual({
    endpoint: "http://127.0.0.1:7860",
    width: 100,
    left: [255, 255, 255, 255],
    right: [0, 0, 0, 255],
  });
});

test("affine transforms, flat groups, blending, reordering and merge affect the image", async ({
  page,
}) => {
  await loadFixture(page);
  await menu(page, "Edit", "Transform layer…");
  await page.locator("[name=scaleX]").fill("-100");
  await page
    .locator("#book-form")
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  expect(await pixel(page, 25, 40)).toEqual([0, 0, 255, 255]);
  await page.locator("#undo").click();
  expect(await pixel(page, 25, 40)).toEqual([255, 0, 0, 255]);
  await menu(page, "Layer", "Group selected layer…");
  await page.locator("#text-entry").fill("Corrections");
  await page.locator("#text-confirm").click();
  await expect(page.locator(".layer-group-header")).toContainText(
    "Corrections",
  );
  await page.locator("#new-layer").click();
  await page.locator("#foreground-hex").fill("00ff00");
  await page.locator("#foreground-hex").press("Tab");
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  const r = await page.locator("#canvas").boundingBox();
  await page.mouse.move(r.x, r.y);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width, r.y + r.height);
  await page.mouse.up();
  await page.locator("#opacity").fill("50");
  await page.locator("#opacity").press("Tab");
  await page.locator("#blend-mode").selectOption("screen");
  const blended = await pixel(page, 25, 40);
  expect(blended[0]).toBe(255);
  expect(blended[1]).toBeGreaterThan(120);
  await menu(page, "Layer", "Move layer down");
  expect(await pixel(page, 25, 40)).toEqual([255, 0, 0, 255]);
  await menu(page, "Layer", "Move layer up");
  expect(await pixel(page, 25, 40)).toEqual(blended);
  await menu(page, "Layer", "Merge down");
  await expect(page.locator(".layer-row")).toHaveCount(1);
  expect(await pixel(page, 25, 40)).toEqual(blended);
});

test("resampling does not apply a feathered layer mask twice", async ({
  page,
}) => {
  await loadFixture(page);
  await page.getByRole("button", { name: "Magic Wand", exact: true }).click();
  await page.locator("#wand-tolerance").fill("0");
  await clickAt(page, 20, 40);
  await menu(page, "Select", "Feather selection…");
  await page.locator("[name=radius]").fill("1");
  await page
    .locator("#book-form")
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await menu(page, "Layer", "Add mask from selection");
  const before = await pixel(page, 50, 40);
  expect(before[3]).toBeGreaterThan(0);
  expect(before[3]).toBeLessThan(255);
  await menu(page, "Image", "Image size…");
  await page
    .locator("#book-form")
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  expect(await pixel(page, 50, 40)).toEqual(before);
});

test("curve graph edits preview the same result that is committed and invalid levels do not mutate layers", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await page
    .locator("#file-input")
    .setInputFiles({
      name: "gray.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><path fill="#808080" d="M0 0H100V80H0Z"/></svg>',
      ),
    });
  await expect(page.locator("#dimensions")).toHaveText("100 × 80 px");
  await menu(page, "Image", "Adjustments & filters…");
  await page.locator("#effect-choice").selectOption("curves");
  await expect(page.locator("#tone-graph")).toBeVisible();
  await page.locator("[name=midtones]").fill("180");
  await page.locator("#effect-apply").click();
  expect((await pixel(page, 20, 20))[0]).toBe(180);
  await page.locator(".layer-row").first().dblclick();
  await page.locator("[name=midtones]").fill("200");
  const preview = await page
    .locator("#effect-preview")
    .evaluate((c) => c.getContext("2d").getImageData(64, 64, 1, 1).data[0]);
  expect(preview).toBe(200);
  await page.locator("#effect-apply").click();
  expect((await pixel(page, 20, 20))[0]).toBe(preview);
  await page.locator(".layer-row").first().dblclick();
  const graph = await page.locator("#tone-graph").boundingBox();
  await page.mouse.click(
    graph.x + graph.width * 0.5,
    graph.y + graph.height * 0.2,
  );
  expect(
    Number(await page.locator("[name=midtones]").inputValue()),
  ).toBeGreaterThan(200);
  await page.locator("#effect-choice").selectOption("levels");
  await page.locator("[name=black]").fill("200");
  await page.locator("[name=white]").fill("100");
  await page.locator("#effect-apply").click();
  await expect(page.locator("#effect-error")).toContainText(
    "Black input must be lower",
  );
  await expect(page.locator(".layer-row")).toHaveCount(2);
  expect((await pixel(page, 20, 20))[0]).toBe(200);
});
