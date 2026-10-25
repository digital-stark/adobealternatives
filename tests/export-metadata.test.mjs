import test from "node:test";
import assert from "node:assert/strict";
import { setDensity, imageDensityDataURL } from "../src/export-metadata.js";
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    "base64",
  ),
);
test("PNG density stores 300 ppi as pixels/metre without changing IDAT", () => {
  const changed = setDensity(png, "png", 300);
  const text = Buffer.from(changed).toString("latin1"),
    offset = text.indexOf("pHYs");
  assert.ok(offset > 0);
  const view = new DataView(changed.buffer);
  assert.equal(view.getUint32(offset + 4), 11811);
  assert.equal(view.getUint32(offset + 8), 11811);
  assert.equal(changed[offset + 12], 1);
  assert.deepEqual(changed.slice(0, 33), png.slice(0, 33));
  const twice = setDensity(changed, "png", 72);
  assert.equal(
    Buffer.from(twice).toString("latin1").split("pHYs").length - 1,
    1,
  );
});
test("JPEG creates or updates JFIF inch units and preserves scan bytes", () => {
  const jpeg = new Uint8Array([255, 216, 255, 218, 0, 2, 1, 2, 3, 255, 217]);
  const changed = setDensity(jpeg, "jpeg", 300);
  assert.equal(changed[13], 1);
  assert.equal(changed[14] * 256 + changed[15], 300);
  assert.deepEqual(changed.slice(20), jpeg.slice(2));
  const updated = setDensity(changed, "jpeg", 150);
  assert.equal(updated.length, changed.length);
  assert.equal(updated[14] * 256 + updated[15], 150);
});
test("data URL density export preserves MIME and rejects invalid images", () => {
  assert.match(
    imageDensityDataURL(
      "data:image/png;base64," + Buffer.from(png).toString("base64"),
      "png",
      300,
    ),
    /^data:image\/png;base64,/,
  );
  assert.throws(() => setDensity(new Uint8Array([1, 2]), "png", 300));
  assert.throws(() => setDensity(png, "png", 0));
});

test("density reader accepts its PNG/JPEG exports and declines unknown metadata", async () => {
  const { readDensity } = await import("../src/export-metadata.js");
  assert.equal(readDensity(setDensity(png, "png", 300)), 300);
  assert.equal(
    readDensity(
      setDensity(
        new Uint8Array([255, 216, 255, 218, 0, 2, 255, 217]),
        "jpeg",
        150,
      ),
    ),
    150,
  );
  assert.equal(readDensity(new Uint8Array([0, 1, 2, 3])), null);
});
