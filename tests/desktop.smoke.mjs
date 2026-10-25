// Native Electron smoke test. Requires a graphical session (DISPLAY on Linux).
import { _electron, expect } from "@playwright/test";
import electron from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
const directory = await mkdtemp(path.join(os.tmpdir(), "prism-desktop-test-"));
const root =
  process.env.PRISM_TEST_APP ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = [root];
if (process.platform === "linux") args.unshift("--no-sandbox", "--disable-gpu");
const app = await _electron.launch({
  executablePath: electron,
  args,
  timeout: 60000,
  env: {
    ...process.env,
    XDG_CONFIG_HOME: directory,
    XDG_CACHE_HOME: path.join(directory, "cache"),
  },
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".saved span")).toHaveText("Offline desktop");
  await page.context().setOffline(true);
  const output = path.join(directory, "project.prism");
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, output);
  await page.getByTitle("New layer", { exact: true }).click();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send("prism:command", "save"),
  );
  await expect(page.locator("#toast")).toHaveText("Editable project saved");
  const project = JSON.parse(await readFile(output, "utf8"));
  expect(project.layers.length).toBe(3);
  await page.getByTitle("Delete selected layer", { exact: true }).click();
  await expect(page.locator(".layer-row")).toHaveCount(2);
  await page.locator("#file-input").setInputFiles(output);
  await expect(page.locator(".layer-row")).toHaveCount(3);
  const png = path.join(directory, "export.png");
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, png);
  await page.locator(".export").click();
  await expect(page.locator("#toast")).toHaveText("PNG saved to your computer");
  expect((await readFile(png)).subarray(0, 8).toString("hex")).toBe(
    "89504e470d0a1a0a",
  );
  // Electron does not implement window.prompt: exercise the replacement text dialog.
  await page.getByRole("button", { name: "Text", exact: true }).click();
  const box = await page.locator("#canvas").boundingBox();
  await page.mouse.click(box.x + 80, box.y + 100);
  await page.locator("#text-entry").fill("Offline creativity");
  await page.locator("#text-confirm").click();
  await expect(page.locator(".layer-row")).toHaveCount(4);
  await page.locator('[data-flyout="generate"]').click();
  await page.locator("#ai-settings").click();
  await page.locator("#ai-address").fill("https://api.openai.com");
  await page.locator("#connect-local-ai").click();
  await expect(page.locator("#ai-settings-status")).toContainText(
    "local HTTP address",
  );

  await page.locator("#close-modal").click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-processing-ready",
    "true",
  );
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page
    .locator("#menu-popover")
    .getByRole("button", { name: "Gaussian-style blur…", exact: true })
    .click();
  await page.locator("#effect-apply").click();
  await expect(page.locator(".layer-row")).toHaveCount(5);
  for (const format of ["jpeg", "webp", "pdf"]) {
    const target = path.join(
      directory,
      "native-export." + (format === "jpeg" ? "jpg" : format),
    );
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, target);
    await page.getByRole("button", { name: "File", exact: true }).click();
    await page
      .locator("#menu-popover")
      .getByRole("button", { name: "Export image…", exact: true })
      .click();
    await page.locator("[name=format]").selectOption(format);
    await page
      .locator("#book-form")
      .getByRole("button", { name: "Apply", exact: true })
      .click();
    await expect(page.locator("#modal")).not.toBeVisible();
    const bytes = await readFile(target);
    if (format === "jpeg")
      expect(bytes.subarray(0, 2).toString("hex")).toBe("ffd8");
    if (format === "webp")
      expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
    if (format === "pdf") expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  }
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .locator("#menu-popover")
    .getByRole("button", { name: "Copy", exact: true })
    .click();
  expect(
    await page.evaluate(async () =>
      Boolean(
        (await window.prismDesktop.pasteImage())?.startsWith(
          "data:image/png;base64,",
        ),
      ),
    ),
  ).toBe(true);
  // Exercise the real bundled RAW/WASM decoder and neural models under the desktop CSP.
  await page
    .locator("#file-input")
    .setInputFiles(path.resolve("tests/fixtures/synthetic-cfa.dng"));
  await page.locator("#book-form button[type=submit]").click();
  await expect(page.locator("#dimensions")).toHaveText("128 × 96 px", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page
    .locator("#menu-popover")
    .getByRole("button", { name: "Select subject (local model)", exact: true })
    .click();
  await expect(page.locator("#toast")).toHaveText(
    "Subject selected by the local model",
    { timeout: 45000 },
  );
  await page
    .getByRole("button", { name: "Marquee select", exact: true })
    .click();
  const modelBox = await page.locator("#canvas").boundingBox();
  await page.mouse.move(
    modelBox.x + modelBox.width * 0.4,
    modelBox.y + modelBox.height * 0.4,
  );
  await page.mouse.down();
  await page.mouse.move(
    modelBox.x + modelBox.width * 0.6,
    modelBox.y + modelBox.height * 0.6,
  );
  await page.mouse.up();
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page
    .locator("#menu-popover")
    .getByRole("button", {
      name: "Content-aware removal (offline model)",
      exact: true,
    })
    .click();
  await expect(page.locator("#toast")).toHaveText(
    "Local neural inpainting complete",
    { timeout: 75000 },
  );
  expect(errors).toEqual([]);
  console.log(
    "Native Electron smoke passed (real RAW decoding, neural subject selection/inpainting, worker filters, clipboard, JPEG/WebP/PDF included): packaged assets, offline editing, native project save/open, PNG save, raster text, local-only AI settings.",
  );
} finally {
  await app.evaluate(({ app }) => app.exit(0));
}
