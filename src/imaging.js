// Original offline implementations of the techniques, not copies of book assets/code.
const clamp = (v, min = 0, max = 255) => Math.max(min, Math.min(max, v));
export const EFFECTS = {
  levels: {
    name: "Levels",
    section: "Colour & tone",
    fields: [
      ["black", "Black input", 0, 0, 254],
      ["white", "White input", 255, 1, 255],
      ["gamma", "Midtone gamma", 1, 0.1, 5, 0.05],
    ],
  },
  curves: {
    name: "Curves",
    section: "Adjustments",
    fields: [
      ["shadows", "Shadows output", 64, 0, 255],
      ["midtones", "Midtones output", 128, 0, 255],
      ["highlights", "Highlights output", 192, 0, 255],
    ],
  },
  exposure: {
    name: "Exposure / Contrast",
    section: "Adjustments",
    fields: [
      ["exposure", "Exposure (stops)", 0, -4, 4, 0.1],
      ["offset", "Offset", 0, -1, 1, 0.01],
      ["contrast", "Contrast", 0, -100, 100],
      ["gamma", "Gamma", 1, 0.1, 5, 0.05],
    ],
  },
  balance: {
    name: "Colour balance",
    section: "Colour & tone",
    fields: [
      ["red", "Cyan → Red", 0, -100, 100],
      ["green", "Magenta → Green", 0, -100, 100],
      ["blue", "Yellow → Blue", 0, -100, 100],
      ...["shadow", "mid", "highlight"].flatMap((tone) =>
        ["Red", "Green", "Blue"].map((channel) => [
          tone + channel,
          tone[0].toUpperCase() + tone.slice(1) + " " + channel,
          0,
          -100,
          100,
        ]),
      ),
    ],
  },
  hue: {
    name: "Hue / Saturation",
    section: "Adjustments",
    fields: [
      ["hue", "Hue", 0, -180, 180],
      ["saturation", "Saturation", 0, -100, 100],
      ["lightness", "Lightness", 0, -100, 100],
    ],
  },
  bw: {
    name: "Black & White",
    section: "Adjustments",
    fields: [
      ["red", "Red weight", 30, 0, 100],
      ["green", "Green weight", 59, 0, 100],
      ["blue", "Blue weight", 11, 0, 100],
    ],
  },
  mixer: {
    name: "Channel Mixer",
    section: "Adjustments",
    fields: [
      ["red", "Red → output red", 100, -200, 200],
      ["green", "Green → output red", 0, -200, 200],
      ["blue", "Blue → output red", 0, -200, 200],
      ["greenRed", "Red → output green", 0, -200, 200],
      ["greenGreen", "Green → output green", 100, -200, 200],
      ["greenBlue", "Blue → output green", 0, -200, 200],
      ["blueRed", "Red → output blue", 0, -200, 200],
      ["blueGreen", "Green → output blue", 0, -200, 200],
      ["blueBlue", "Blue → output blue", 100, -200, 200],
    ],
  },
  shadows: {
    name: "Shadows / Highlights",
    section: "Retouching",
    fields: [
      ["shadows", "Lift shadows", 0, 0, 100],
      ["highlights", "Recover highlights", 0, 0, 100],
    ],
  },
  vibrance: {
    name: "Vibrance / Sponge",
    section: "Colour & tone",
    fields: [["amount", "Vibrance", 20, -100, 100]],
  },
  auto: {
    name: "Auto levels / colour",
    section: "Basic corrections",
    fields: [["strength", "Strength", 100, 0, 100]],
  },
  blur: {
    name: "Gaussian-style blur",
    section: "Filters",
    fields: [["radius", "Radius", 3, 1, 24]],
  },
  motion: {
    name: "Motion blur",
    section: "Filters",
    fields: [
      ["radius", "Distance", 10, 1, 40],
      ["angle", "Angle", 0, -180, 180],
    ],
  },
  sharpen: {
    name: "Unsharp mask",
    section: "Retouching",
    fields: [
      ["radius", "Radius", 2, 1, 12],
      ["amount", "Amount", 100, 0, 300],
      ["threshold", "Threshold", 2, 0, 40],
    ],
  },
  noise: {
    name: "Reduce noise (median)",
    section: "Filters",
    fields: [["strength", "Strength", 50, 0, 100]],
  },
  cutout: {
    name: "Cutout-style posterization",
    section: "Filters",
    fields: [
      ["levels", "Colour levels", 5, 2, 16],
      ["smooth", "Edge smoothing", 1, 0, 6],
    ],
  },
  lighting: {
    name: "Radial lighting",
    section: "Filters",
    fields: [
      ["x", "Light X (%)", 50, 0, 100],
      ["y", "Light Y (%)", 40, 0, 100],
      ["radius", "Light radius (%)", 65, 5, 150],
      ["intensity", "Intensity", 35, -100, 100],
    ],
  },
  tilt: {
    name: "Tilt-shift-style blur",
    section: "Filters",
    fields: [
      ["radius", "Blur radius", 8, 1, 24],
      ["focus", "Focus Y (%)", 50, 0, 100],
      ["band", "Sharp band (%)", 25, 0, 70],
    ],
  },
  spin: {
    name: "Spin blur",
    section: "Filters",
    fields: [
      ["amount", "Angle spread", 12, 1, 45],
      ["x", "Centre X (%)", 50, 0, 100],
      ["y", "Centre Y (%)", 50, 0, 100],
    ],
  },
  paint: {
    name: "Painterly photo effect",
    section: "Brushes",
    fields: [
      ["radius", "Softening", 2, 0, 8],
      ["levels", "Colour levels", 10, 3, 24],
    ],
  },
  invert: { name: "Invert", section: "Colour & tone", fields: [] },
};
export function defaults(type) {
  if (!EFFECTS[type]) throw new Error("Unknown effect");
  return Object.fromEntries(
    EFFECTS[type].fields.map(([key, , value]) => [key, value]),
  );
}
export function validateEffect(effect) {
  if (!effect || !EFFECTS[effect.type]) throw new Error("Unknown image effect");
  const result = { type: effect.type, ...defaults(effect.type) };
  for (const [key, , value, min, max] of EFFECTS[effect.type].fields) {
    const v = effect[key] ?? value;
    if (!Number.isFinite(v) || v < min || v > max)
      throw new Error(`Invalid ${key} setting`);
    result[key] = v;
  }
  if (result.type === "levels" && result.black >= result.white)
    throw new Error("Black input must be lower than white input");
  return result;
}
function boxBlur(src, w, h, radius) {
  const r = Math.max(0, Math.round(radius));
  if (!r) return new Uint8ClampedArray(src);
  const a = new Float32Array(src.length),
    out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++)
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let dx = -r; dx <= r; dx++)
        sum += src[(y * w + clamp(dx, 0, w - 1)) * 4 + c];
      for (let x = 0; x < w; x++) {
        a[(y * w + x) * 4 + c] = sum / (2 * r + 1);
        sum +=
          src[(y * w + clamp(x + r + 1, 0, w - 1)) * 4 + c] -
          src[(y * w + clamp(x - r, 0, w - 1)) * 4 + c];
      }
    }
  for (let x = 0; x < w; x++)
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let dy = -r; dy <= r; dy++)
        sum += a[(clamp(dy, 0, h - 1) * w + x) * 4 + c];
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + c] = sum / (2 * r + 1);
        sum +=
          a[(clamp(y + r + 1, 0, h - 1) * w + x) * 4 + c] -
          a[(clamp(y - r, 0, h - 1) * w + x) * 4 + c];
      }
    }
  return out;
}
function gaussian(src, w, h, r) {
  let out = src;
  for (let i = 0; i < 3; i++)
    out = boxBlur(out, w, h, Math.max(1, Math.round(r / 1.7)));
  return out;
}
export function processPixels(source, w, h, settings) {
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < 1 ||
    h < 1 ||
    source.length !== w * h * 4
  )
    throw new Error("Invalid image dimensions");
  const s = validateEffect(settings),
    out = new Uint8ClampedArray(source),
    type = s.type;
  if (["blur", "sharpen", "tilt", "cutout", "paint"].includes(type)) {
    const blurred =
      type === "cutout" || type === "paint"
        ? boxBlur(source, w, h, s.smooth ?? s.radius)
        : gaussian(source, w, h, s.radius);
    for (let i = 0; i < out.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let v = blurred[i + c];
        if (type === "sharpen") {
          const diff = source[i + c] - v;
          v =
            source[i + c] +
            (Math.abs(diff) >= s.threshold ? (diff * s.amount) / 100 : 0);
        }
        if (type === "tilt") {
          const y = Math.floor(i / 4 / w) / h,
            dist = Math.abs(y - s.focus / 100),
            mix = clamp((dist - s.band / 200) / 0.25, 0, 1);
          v = source[i + c] * (1 - mix) + v * mix;
        }
        if (type === "cutout" || type === "paint")
          v = Math.round(v / (255 / (s.levels - 1))) * (255 / (s.levels - 1));
        out[i + c] = v;
      }
      out[i + 3] = source[i + 3];
    }
    return out;
  }
  if (type === "noise") {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        for (let c = 0; c < 3; c++) {
          const samples = [];
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++)
              samples.push(
                source[
                  (clamp(y + dy, 0, h - 1) * w + clamp(x + dx, 0, w - 1)) * 4 +
                    c
                ],
              );
          samples.sort((a, b) => a - b);
          const i = (y * w + x) * 4 + c;
          out[i] =
            source[i] * (1 - s.strength / 100) +
            (samples[4] * s.strength) / 100;
        }
    return out;
  }
  if (type === "motion" || type === "spin") {
    const count =
      type === "motion" ? Math.min(41, Math.round(s.radius) * 2 + 1) : 13;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const sums = [0, 0, 0];
        for (let k = 0; k < count; k++) {
          const f = k / (count - 1) - 0.5;
          let xx, yy;
          if (type === "motion") {
            xx = x + Math.cos((s.angle * Math.PI) / 180) * s.radius * 2 * f;
            yy = y + Math.sin((s.angle * Math.PI) / 180) * s.radius * 2 * f;
          } else {
            const cx = (w * s.x) / 100,
              cy = (h * s.y) / 100,
              angle = (f * s.amount * Math.PI) / 180;
            xx = cx + (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle);
            yy = cy + (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle);
          }
          const p =
            (clamp(Math.round(yy), 0, h - 1) * w +
              clamp(Math.round(xx), 0, w - 1)) *
            4;
          for (let c = 0; c < 3; c++) sums[c] += source[p + c];
        }
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) out[i + c] = sums[c] / count;
      }
    return out;
  }
  let endpoints;
  if (type === "auto") {
    endpoints = [];
    for (let c = 0; c < 3; c++) {
      const hist = new Uint32Array(256);
      let total = 0;
      for (let i = c; i < source.length; i += 4)
        if (source[i - c + 3]) {
          hist[source[i]]++;
          total++;
        }
      let lo = 0,
        hi = 255,
        n = 0;
      while (lo < 254 && n + hist[lo] < total * 0.005) n += hist[lo++];
      n = 0;
      while (hi > lo + 1 && n + hist[hi] < total * 0.005) n += hist[hi--];
      endpoints[c] = [lo, hi];
    }
  }
  const curves = [0, s.shadows, s.midtones, s.highlights, 255];
  for (let i = 0; i < source.length; i += 4) {
    let r = source[i],
      g = source[i + 1],
      b = source[i + 2];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (type === "hue") {
      const angle = (s.hue * Math.PI) / 180,
        cos = Math.cos(angle),
        sin = Math.sin(angle);
      const rr =
        (0.213 + 0.787 * cos - 0.213 * sin) * r +
        (0.715 - 0.715 * cos - 0.715 * sin) * g +
        (0.072 - 0.072 * cos + 0.928 * sin) * b;
      const gg =
        (0.213 - 0.213 * cos + 0.143 * sin) * r +
        (0.715 + 0.285 * cos + 0.14 * sin) * g +
        (0.072 - 0.072 * cos - 0.283 * sin) * b;
      const bb =
        (0.213 - 0.213 * cos - 0.787 * sin) * r +
        (0.715 - 0.715 * cos + 0.715 * sin) * g +
        (0.072 + 0.928 * cos + 0.072 * sin) * b;
      const gray = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb,
        sat = 1 + s.saturation / 100;
      r = gray + (rr - gray) * sat;
      g = gray + (gg - gray) * sat;
      b = gray + (bb - gray) * sat;
      const light = s.lightness / 100;
      [r, g, b] = [r, g, b].map((v) =>
        light > 0 ? v + (255 - v) * light : v * (1 + light),
      );
    } else if (type === "bw") {
      const total = s.red + s.green + s.blue || 1;
      r = g = b = (r * s.red + g * s.green + b * s.blue) / total;
    } else if (type === "mixer") {
      [r, g, b] = [
        (r * s.red + g * s.green + b * s.blue) / 100,
        (r * s.greenRed + g * s.greenGreen + b * s.greenBlue) / 100,
        (r * s.blueRed + g * s.blueGreen + b * s.blueBlue) / 100,
      ];
    } else if (type === "balance") {
      const light = luminance / 255,
        weights = {
          shadow: (1 - light) ** 2,
          mid: 2 * light * (1 - light),
          highlight: light ** 2,
        };
      r +=
        s.red +
        Object.entries(weights).reduce(
          (n, [tone, weight]) => n + s[tone + "Red"] * weight,
          0,
        );
      g +=
        s.green +
        Object.entries(weights).reduce(
          (n, [tone, weight]) => n + s[tone + "Green"] * weight,
          0,
        );
      b +=
        s.blue +
        Object.entries(weights).reduce(
          (n, [tone, weight]) => n + s[tone + "Blue"] * weight,
          0,
        );
    } else if (type === "shadows") {
      const shadow = (1 - luminance / 255) ** 3,
        highlight = (luminance / 255) ** 3,
        delta = s.shadows * shadow - s.highlights * highlight;
      r += delta;
      g += delta;
      b += delta;
    } else if (type === "vibrance") {
      const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255,
        amount = (s.amount / 100) * (s.amount > 0 ? 1 - saturation : 1);
      r += (r - luminance) * amount;
      g += (g - luminance) * amount;
      b += (b - luminance) * amount;
    } else if (type === "lighting") {
      const x = (i / 4) % w,
        y = Math.floor(i / 4 / w),
        distance = Math.hypot(x / w - s.x / 100, y / h - s.y / 100),
        light =
          (Math.max(0, 1 - distance / (s.radius / 100)) * s.intensity) / 100;
      r *= 1 + light;
      g *= 1 + light;
      b *= 1 + light;
    }
    let values = [r, g, b];
    if (type === "levels")
      values = values.map(
        (v) =>
          255 *
          Math.pow(
            clamp((v - s.black) / (s.white - s.black), 0, 1),
            1 / s.gamma,
          ),
      );
    if (type === "curves")
      values = values.map((v) => {
        const pos = (v / 255) * 4,
          a = Math.min(3, Math.floor(pos)),
          f = pos - a;
        return curves[a] * (1 - f) + curves[a + 1] * f;
      });
    if (type === "exposure")
      values = values.map((v) => {
        const exposed =
            255 *
            Math.pow(
              clamp((v * Math.pow(2, s.exposure)) / 255 + s.offset, 0, 1),
              1 / s.gamma,
            ),
          factor = (259 * (s.contrast + 255)) / (255 * (259 - s.contrast));
        return factor * (exposed - 128) + 128;
      });
    if (type === "invert") values = values.map((v) => 255 - v);
    if (type === "auto")
      values = values.map((v, c) => {
        const [lo, hi] = endpoints[c];
        return (
          v * (1 - s.strength / 100) +
          (clamp(((v - lo) * 255) / (hi - lo)) * s.strength) / 100
        );
      });
    for (let c = 0; c < 3; c++) out[i + c] = values[c];
  }
  return out;
}
export function wandMask(data, w, h, x, y, tolerance = 30, contiguous = true) {
  x = clamp(Math.floor(x), 0, w - 1);
  y = clamp(Math.floor(y), 0, h - 1);
  const start = y * w + x,
    target = data.slice(start * 4, start * 4 + 4),
    mask = new Uint8ClampedArray(w * h);
  const matches = (index) => {
    const p = index * 4;
    return (
      Math.max(...[0, 1, 2, 3].map((c) => Math.abs(data[p + c] - target[c]))) <=
      tolerance
    );
  };
  if (!contiguous) {
    for (let i = 0; i < mask.length; i++) if (matches(i)) mask[i] = 255;
    return mask;
  }
  const visited = new Uint8Array(w * h),
    queue = new Int32Array(w * h);
  let read = 0,
    write = 1;
  queue[0] = start;
  visited[start] = 1;
  while (read < write) {
    const n = queue[read++];
    if (!matches(n)) continue;
    mask[n] = 255;
    const xx = n % w,
      yy = Math.floor(n / w);
    for (const a of [
      xx > 0 ? n - 1 : -1,
      xx < w - 1 ? n + 1 : -1,
      yy > 0 ? n - w : -1,
      yy < h - 1 ? n + w : -1,
    ])
      if (a >= 0 && !visited[a]) {
        visited[a] = 1;
        queue[write++] = a;
      }
  }
  return mask;
}
export function featherMask(alpha, w, h, radius) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < alpha.length; i++) rgba[i * 4 + 3] = alpha[i];
  const out = boxBlur(rgba, w, h, radius);
  return new Uint8ClampedArray(alpha.map((_, i) => out[i * 4 + 3]));
}
export function creativeRemap(src, w, h, type, segments = 8) {
  const out = new Uint8ClampedArray(src.length),
    cx = (w - 1) / 2,
    cy = (h - 1) / 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let xx, yy;
      const dx = x - cx,
        dy = y - cy,
        angle = Math.atan2(dy, dx),
        radius = Math.hypot(dx, dy);
      if (type === "panosphere") {
        xx = ((angle / (Math.PI * 2) + 1) % 1) * (w - 1);
        yy = clamp(
          (1 - radius / Math.max(1, Math.min(w, h) / 2)) * (h - 1),
          0,
          h - 1,
        );
      } else {
        const wedge = (2 * Math.PI) / segments;
        let theta = ((angle % wedge) + wedge) % wedge;
        if (theta > wedge / 2) theta = wedge - theta;
        xx = cx + radius * Math.cos(theta);
        yy = cy + radius * Math.sin(theta);
      }
      const p =
          (clamp(Math.round(yy), 0, h - 1) * w +
            clamp(Math.round(xx), 0, w - 1)) *
          4,
        q = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out[q + c] = src[p + c];
    }
  return out;
}

export function refineMask(
  alpha,
  width,
  height,
  { radius = 0, contrast = 0, shift = 0 } = {},
) {
  if (
    alpha.length !== width * height ||
    ![radius, contrast, shift].every(Number.isFinite) ||
    radius < 0 ||
    radius > 30 ||
    contrast < 0 ||
    contrast > 100 ||
    Math.abs(shift) > 30
  )
    throw new Error("Invalid edge refinement settings");
  let out = new Uint8ClampedArray(alpha);
  const r = Math.abs(Math.round(shift));
  if (r) {
    const temporary = new Uint8ClampedArray(out.length),
      result = new Uint8ClampedArray(out.length),
      grow = shift > 0;
    function pass(input, output, lines, length, horizontal) {
      const indices = new Int32Array(length + 2 * r + 1);
      for (let line = 0; line < lines; line++) {
        let first = 0,
          last = 0;
        const read = (k) =>
          k < 0 || k >= length
            ? 0
            : input[horizontal ? line * width + k : k * width + line];
        for (let k = -r; k < length + r; k++) {
          const v = read(k);
          while (
            last > first &&
            (grow ? read(indices[last - 1]) <= v : read(indices[last - 1]) >= v)
          )
            last--;
          indices[last++] = k;
          while (last > first && indices[first] < k - 2 * r) first++;
          if (k >= r)
            output[horizontal ? line * width + k - r : (k - r) * width + line] =
              read(indices[first]);
        }
      }
    }
    pass(out, temporary, height, width, true);
    pass(temporary, result, width, height, false);
    out = result;
  }
  if (radius) out = featherMask(out, width, height, radius);
  const factor = 1 / (1 - contrast * 0.009);
  for (let i = 0; i < out.length; i++)
    out[i] = clamp((out[i] - 127.5) * factor + 127.5);
  return out;
}
