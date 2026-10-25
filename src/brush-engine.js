export const brushDefaults = {
  spacing: 0.15,
  scatter: 0,
  sizeJitter: 0,
  angle: 0,
  angleJitter: 0,
  roundness: 1,
  pressure: false,
  tilt: false,
  tip: "round",
};
export const brushPresets = {
  Round: { ...brushDefaults },
  Charcoal: {
    ...brushDefaults,
    spacing: 0.2,
    scatter: 0.25,
    sizeJitter: 0.35,
    angleJitter: 180,
    roundness: 0.55,
    tip: "grain",
  },
  Foliage: {
    ...brushDefaults,
    spacing: 0.65,
    scatter: 1,
    sizeJitter: 0.55,
    angleJitter: 180,
    roundness: 0.4,
    tip: "leaf",
  },
  Calligraphy: {
    ...brushDefaults,
    spacing: 0.08,
    angle: -35,
    roundness: 0.2,
    pressure: true,
  },
};
export function stampPositions(a, b, spacing, carry = 0) {
  const distance = Math.hypot(b.x - a.x, b.y - a.y),
    out = [];
  if (!distance) return { points: [], carry };
  let d = spacing - carry;
  for (; d <= distance; d += spacing) {
    const t = d / distance;
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      pressure:
        (a.pressure ?? 0.5) + ((b.pressure ?? 0.5) - (a.pressure ?? 0.5)) * t,
      tiltX: b.tiltX || 0,
      tiltY: b.tiltY || 0,
    });
  }
  return { points: out, carry: (carry + distance) % spacing };
}
export function drawBrushStamp(
  ctx,
  p,
  size,
  color,
  opacity,
  hardness,
  settings,
  customTip,
  random = Math.random,
) {
  const pressure = settings.pressure ? Math.max(0.05, p.pressure ?? 0.5) : 1;
  const radius = Math.max(
    0.25,
    (size / 2) * pressure * (1 - settings.sizeJitter * random()),
  );
  const angle =
    (settings.angle + (random() - 0.5) * 2 * settings.angleJitter) *
      (Math.PI / 180) +
    (settings.tilt ? Math.atan2(p.tiltY || 0, p.tiltX || 0) : 0);
  const scatter = size * settings.scatter;
  ctx.save();
  ctx.translate(
    p.x + (random() - 0.5) * scatter,
    p.y + (random() - 0.5) * scatter,
  );
  ctx.rotate(angle);
  ctx.scale(1, settings.roundness);
  ctx.globalAlpha = opacity * (settings.pressure ? pressure : 1);
  if (settings.tip === "custom" && customTip) {
    ctx.drawImage(customTip, -radius, -radius, radius * 2, radius * 2);
  } else {
    if (hardness < 1) {
      const g = ctx.createRadialGradient(0, 0, radius * hardness, 0, 0, radius);
      g.addColorStop(0, color);
      g.addColorStop(1, color + "00");
      ctx.fillStyle = g;
    } else ctx.fillStyle = color;
    if (settings.tip === "leaf") {
      ctx.beginPath();
      ctx.moveTo(-radius, 0);
      ctx.bezierCurveTo(-radius / 2, -radius, radius / 2, -radius, radius, 0);
      ctx.bezierCurveTo(radius / 2, radius, -radius / 2, radius, -radius, 0);
      ctx.fill();
    } else if (settings.tip === "grain") {
      for (let n = 0; n < 24; n++) {
        const x = (random() * 2 - 1) * radius,
          y = (random() * 2 - 1) * radius;
        if (x * x + y * y < radius * radius) {
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.3, radius * 0.12), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
