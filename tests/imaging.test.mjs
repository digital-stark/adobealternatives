import test from "node:test";
import assert from "node:assert/strict";
import {
  processPixels,
  wandMask,
  featherMask,
  creativeRemap,
  defaults,
  validateEffect,
  EFFECTS,
} from "../src/imaging.js";
import { validateProject } from "../src/projects.js";
const rgba = (values) =>
  new Uint8ClampedArray(
    values.flatMap((v) => (Array.isArray(v) ? v : [v, v, v, 255])),
  );
test("levels, curves and exposure map known tones without changing alpha", () => {
  const src = rgba([
    [10, 100, 240, 128],
    [0, 128, 255, 255],
  ]);
  const levels = processPixels(src, 2, 1, {
    type: "levels",
    black: 10,
    white: 240,
    gamma: 1,
  });
  assert.equal(levels[0], 0);
  assert.equal(levels[2], 255);
  assert.equal(levels[3], 128);
  assert.equal(src[0], 10);
  const curves = processPixels(rgba([0, 64, 128, 192, 255]), 5, 1, {
    type: "curves",
    shadows: 40,
    midtones: 170,
    highlights: 220,
  });
  assert.equal(curves[8], 170);
  assert.equal(curves[0], 0);
  assert.equal(curves[16], 255);
  const exposure = processPixels(rgba([50]), 1, 1, {
    type: "exposure",
    exposure: 1,
    contrast: 0,
    gamma: 1,
  });
  assert.equal(exposure[0], 100);
});
test("black-white, channel mixer and saturation use RGB values as intended", () => {
  const src = rgba([[200, 100, 50, 255]]);
  const bw = processPixels(src, 1, 1, {
    type: "bw",
    red: 100,
    green: 0,
    blue: 0,
  });
  assert.deepEqual([...bw], [200, 200, 200, 255]);
  const mixer = processPixels(src, 1, 1, {
    type: "mixer",
    red: 0,
    green: 100,
    blue: 0,
  });
  assert.deepEqual([...mixer], [100, 100, 50, 255]);
  const gray = processPixels(src, 1, 1, {
    type: "hue",
    hue: 0,
    saturation: -100,
    lightness: 0,
  });
  assert.equal(gray[0], gray[1]);
  assert.equal(gray[1], gray[2]);
  assert.throws(() =>
    validateEffect({ type: "levels", black: 200, white: 100, gamma: 1 }),
  );
});
test("blur conserves a constant image; sharpening and noise reduction act on real pixels", () => {
  const constant = rgba(Array(25).fill(80));
  assert.deepEqual(
    processPixels(constant, 5, 5, { type: "blur", radius: 3 }),
    constant,
  );
  const noisy = rgba(Array(25).fill(80));
  noisy[12 * 4] = noisy[12 * 4 + 1] = noisy[12 * 4 + 2] = 255;
  const denoised = processPixels(noisy, 5, 5, { type: "noise", strength: 100 });
  assert.equal(denoised[12 * 4], 80);
  const sharpened = processPixels(noisy, 5, 5, {
    type: "sharpen",
    radius: 1,
    amount: 100,
    threshold: 0,
  });
  assert.ok(sharpened[11 * 4] < 80);
});
test("wand distinguishes contiguous islands, honours tolerance, and feather creates partial coverage", () => {
  const data = rgba([10, 200, 10, 10]);
  assert.deepEqual([...wandMask(data, 4, 1, 0, 0, 0, true)], [255, 0, 0, 0]);
  assert.deepEqual(
    [...wandMask(data, 4, 1, 0, 0, 0, false)],
    [255, 0, 255, 255],
  );
  assert.deepEqual(
    [...wandMask(data, 4, 1, 0, 0, 255, true)],
    [255, 255, 255, 255],
  );
  const soft = featherMask(new Uint8ClampedArray([0, 0, 255, 0, 0]), 5, 1, 1);
  assert.ok(soft[1] > 0 && soft[1] < 255);
  assert.ok(soft[2] < 255);
});
test("every exposed effect runs with finite results; remaps preserve uniform images", () => {
  const source = rgba(Array.from({ length: 25 }, (_, i) => i * 10));
  for (const type of Object.keys(EFFECTS)) {
    const out = processPixels(source, 5, 5, { type, ...defaults(type) });
    assert.equal(out.length, 100);
    assert.ok([...out].every(Number.isFinite), type);
  }
  const uniform = rgba(Array(25).fill(90));
  assert.deepEqual(creativeRemap(uniform, 5, 5, "panosphere"), uniform);
  assert.deepEqual(creativeRemap(uniform, 5, 5, "kaleidoscope", 8), uniform);
});
test("project v2 validates adjustments, masks, groups and paths while accepting v1", () => {
  const image = "data:image/png;base64,aGVsbG8=";
  const p = {
    format: "prism-project",
    version: 2,
    width: 10,
    height: 10,
    ppi: 300,
    activeIndex: 0,
    adjustments: { brightness: 100, contrast: 100, saturation: 100 },
    layers: [
      {
        name: "Curves",
        image,
        mask: image,
        kind: "adjustment",
        effect: { type: "curves", shadows: 64, midtones: 160, highlights: 192 },
        group: "Corrections",
        path: [{ x: 1, y: 2 }],
        x: 0,
        y: 0,
        opacity: 1,
        visible: true,
        locked: false,
        blend: "color",
      },
    ],
  };
  assert.equal(validateProject(p), p);
  assert.throws(() => validateProject({ ...p, ppi: 0 }));
  assert.throws(() =>
    validateProject({
      ...p,
      layers: [{ ...p.layers[0], effect: { type: "arbitrary" } }],
    }),
  );
  assert.throws(() =>
    validateProject({
      ...p,
      layers: [{ ...p.layers[0], path: [{ x: "<script>", y: 2 }] }],
    }),
  );
});

test("edge refinement expands/contracts mask geometry and softens boundaries", async () => {
  const { refineMask } = await import("../src/imaging.js");
  const alpha = new Uint8ClampedArray(25);
  alpha[12] = 255;
  const grown = refineMask(alpha, 5, 5, { shift: 1, radius: 0, contrast: 0 });
  assert.equal([...grown].filter(Boolean).length, 9);
  const shrunk = refineMask(grown, 5, 5, { shift: -1, radius: 0, contrast: 0 });
  assert.equal([...shrunk].filter(Boolean).length, 1);
  assert.equal(shrunk[12], 255);
  const soft = refineMask(alpha, 5, 5, { shift: 0, radius: 1, contrast: 0 });
  assert.ok(soft[11] > 0 && soft[11] < 255);
  assert.throws(() => refineMask(alpha, 5, 5, { shift: 99 }));
});

test("channel mixing supports the red/blue swap and green gain used in the book; balance can target tonal ranges", () => {
  const data = rgba([[200, 100, 50, 255]]);
  assert.deepEqual(
    [
      ...processPixels(data, 1, 1, {
        type: "mixer",
        red: 0,
        green: 0,
        blue: 100,
        greenRed: 0,
        greenGreen: 90,
        greenBlue: 0,
        blueRed: 100,
        blueGreen: 0,
        blueBlue: 0,
      }),
    ],
    [50, 90, 200, 255],
  );
  const gray = rgba([20, 128, 220]);
  const balanced = processPixels(gray, 3, 1, {
    type: "balance",
    shadowRed: 50,
  });
  assert.ok(balanced[0] - 20 > balanced[8] - 220);
  assert.equal(balanced[1], 20);
});
