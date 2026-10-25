import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
async function menu(page, name, item) {
  await page.getByRole("button", { name, exact: true }).click();
  await page
    .locator("#menu-popover")
    .getByRole("button", { name: item, exact: true })
    .click();
}
test("real LibRaw develops a Bayer sensor DNG without a network service", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await page
    .locator("#file-input")
    .setInputFiles("tests/fixtures/synthetic-cfa.dng");
  await page.locator("#book-form button[type=submit]").click();
  await expect(page.locator("#dimensions")).toHaveText("128 × 96 px", {
    timeout: 30000,
  });
  const pixels = await page.locator("#canvas").evaluate((c) => {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    return {
      opaque: d.filter((_, i) => i % 4 === 3 && d[i] === 255).length,
      range: Math.max(...d.slice(0, 400)) - Math.min(...d.slice(0, 400)),
    };
  });
  expect(pixels.opaque).toBe(128 * 96);
  expect(pixels.range).toBeGreaterThan(20);
});
test("bundled neural network produces a nonconstant soft subject matte", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await page
    .locator("#file-input")
    .setInputFiles("tests/fixtures/astronaut.png");
  await expect(page.locator("#dimensions")).toHaveText("512 × 512 px");
  const remote = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:3010") &&
      !r.url().startsWith("data:") &&
      !r.url().startsWith("blob:")
    )
      remote.push(r.url());
  });
  await menu(page, "Select", "Select subject and refine hair");
  await expect(page.locator("#toast")).toContainText(
    "Subject selected with edge-aware",
    { timeout: 45000 },
  );
  await expect(page.locator("#selection-label")).toHaveText("Deselect");
  expect(remote).toEqual([]);
  // Save selection into a real layer mask, then inspect the exported project pixels.
  await menu(page, "Layer", "Add mask from selection");
  const image = page.locator(".mask-thumb canvas").first();
  await expect(image).toBeVisible();
  const stats = await image.evaluate((c) => {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let min = 255,
      max = 0,
      soft = 0;
    for (let i = 0; i < d.length; i += 4) {
      min = Math.min(min, d[i]);
      max = Math.max(max, d[i]);
      if (d[i] > 0 && d[i] < 255) soft++;
    }
    return { min, max, soft };
  });
  expect(stats.max - stats.min).toBeGreaterThan(50);
  expect(stats.soft).toBeGreaterThan(0);
});
test("brush dynamics, cubic paths and nested isolated groups survive editing", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Brush", exact: true }).click();
  await page.locator("#brush-dynamics").click();
  await page.locator("#advanced-preset").selectOption({ label: "Foliage" });
  expect(await page.locator("[name=tip]").inputValue()).toBe("leaf");
  await page.locator("#book-form button[type=submit]").click();
  await menu(page, "Layer", "Group selected layer…");
  await page.locator("#text-entry").fill("Art/Ink");
  await page.locator("#text-confirm").click();
  await expect(page.locator(".layer-group-header")).toHaveCount(2);
  await page.getByRole("button", { name: "Pen path", exact: true }).click();
  const r = await page.locator("#canvas").boundingBox();
  await page.mouse.move(r.x + 100, r.y + 100);
  await page.mouse.down();
  await page.mouse.move(r.x + 140, r.y + 70, { steps: 5 });
  await page.mouse.up();
  await page.mouse.click(r.x + 240, r.y + 180);
  await page.mouse.click(r.x + 80, r.y + 230);
  await expect(page.locator("#path-overlay path")).toHaveAttribute("d", / C /);
  await page.locator("#commit-path").click();
  await expect(page.locator(".layer-row")).toHaveCount(3);
  const pending = page.waitForEvent("download");
  await menu(page, "File", "Save project…");
  const download = await pending;
  const file = await download.path();
  const bytes = await readFile(file),
    saved = JSON.parse(bytes.toString());
  expect(saved.version).toBe(3);
  expect(saved.layers.some((l) => l.path?.some((p) => p.out))).toBe(true);
  await page.getByTitle("Delete selected layer", { exact: true }).click();
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await page.locator("#file-input").setInputFiles({
    name: "roundtrip.prism",
    mimeType: "application/json",
    buffer: bytes,
  });
  await expect(page.locator(".layer-row")).toHaveCount(3);
  await expect(page.locator(".layer-group-header")).toHaveCount(2);
});
test("bundled MI-GAN reconstructs a selected hole and preserves unselected pixels", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await page.locator("#file-input").setInputFiles({
    name: "inpaint.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><path fill="#cf271f" d="M0 0H64V64H0Z"/><path fill="white" d="M24 24H40V40H24Z"/></svg>',
    ),
  });
  await expect(page.locator("#dimensions")).toHaveText("64 × 64 px");
  await page
    .getByRole("button", { name: "Marquee select", exact: true })
    .click();
  const r = await page.locator("#canvas").boundingBox();
  await page.mouse.move(r.x + (r.width * 24) / 64, r.y + (r.height * 24) / 64);
  await page.mouse.down();
  await page.mouse.move(r.x + (r.width * 40) / 64, r.y + (r.height * 40) / 64);
  await page.mouse.up();
  await menu(page, "Filter", "Content-aware removal (offline model)");
  await expect(page.locator("#toast")).toHaveText(
    "Local neural inpainting complete",
    { timeout: 75000 },
  );
  await expect(page.locator(".layer-row")).toHaveCount(2);
  const pixels = await page.locator("#canvas").evaluate((c) => {
    const ctx = c.getContext("2d");
    return {
      outside: [...ctx.getImageData(2, 2, 1, 1).data],
      inside: [...ctx.getImageData(32, 32, 1, 1).data],
    };
  });
  expect(pixels.outside).toEqual([207, 39, 31, 255]);
  expect(pixels.inside[0]).toBeGreaterThan(pixels.inside[2] + 50);
  expect(pixels.inside[1]).toBeLessThan(130);
});
test("nested group opacity applies to isolated composites, and collapse preserves member state", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".layer-row")).toHaveCount(2);
  const project = await page.evaluate(() => {
    const image = (color) => {
      const c = document.createElement("canvas");
      c.width = c.height = 8;
      c.getContext("2d").fillStyle = color;
      c.getContext("2d").fillRect(0, 0, 8, 8);
      return c.toDataURL();
    };
    const groups = [
      {
        id: "root",
        name: "Root",
        visible: true,
        opacity: 0.5,
        blend: "source-over",
        collapsed: false,
      },
      {
        id: "child",
        name: "Child",
        visible: true,
        opacity: 0.5,
        blend: "source-over",
        collapsed: false,
      },
    ];
    return JSON.stringify({
      format: "prism-project",
      version: 3,
      width: 8,
      height: 8,
      activeIndex: 0,
      adjustments: { brightness: 100, contrast: 100, saturation: 100 },
      layers: ["red", "blue"].map((name) => ({
        name,
        x: 0,
        y: 0,
        visible: true,
        locked: false,
        opacity: 1,
        blend: "source-over",
        image: image(name),
        groups,
      })),
    });
  });
  await page.locator("#file-input").setInputFiles({
    name: "nested.prism",
    mimeType: "application/json",
    buffer: Buffer.from(project),
  });
  await expect(page.locator(".layer-group-header")).toHaveCount(2);
  const rgba = await page
    .locator("#canvas")
    .evaluate((c) => [...c.getContext("2d").getImageData(2, 2, 1, 1).data]);
  expect(rgba).toEqual([255, 0, 0, 64]);
  await page
    .locator(".layer-group-header")
    .first()
    .getByTitle("Collapse or expand group")
    .click();
  await expect(page.locator(".layer-row:visible")).toHaveCount(0);
  await page
    .locator(".layer-group-header")
    .first()
    .getByTitle("Collapse or expand group")
    .click();
  await expect(page.locator(".layer-row:visible")).toHaveCount(2);
  await menu(page, "Layer", "Merge down");
  await expect(page.locator(".layer-row")).toHaveCount(1);
  const merged = await page
    .locator("#canvas")
    .evaluate((c) => [...c.getContext("2d").getImageData(2, 2, 1, 1).data]);
  expect(merged).toEqual(rgba);
});
