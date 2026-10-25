export function clonePath(points) {
  return points.map((p) => ({
    ...p,
    in: p.in ? { ...p.in } : undefined,
    out: p.out ? { ...p.out } : undefined,
  }));
}
export function pathCommands(points, closed = true) {
  if (!points.length) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      c = a.out || a,
      e = b.in || b;
    d += ` C ${c.x} ${c.y} ${e.x} ${e.y} ${b.x} ${b.y}`;
  }
  return d + (closed ? " Z" : "");
}
export function tracePath(ctx, points, closed = true) {
  if (!points.length) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < (closed ? points.length : points.length - 1); i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      c = a.out || a,
      d = b.in || b;
    ctx.bezierCurveTo(c.x, c.y, d.x, d.y, b.x, b.y);
  }
  if (closed) ctx.closePath();
}
export function moveAnchor(p, x, y) {
  const dx = x - p.x,
    dy = y - p.y;
  p.x = x;
  p.y = y;
  for (const k of ["in", "out"])
    if (p[k]) p[k] = { x: p[k].x + dx, y: p[k].y + dy };
}
export function transformPath(points, transform) {
  return points.map((p) => ({
    ...transform(p),
    in: p.in ? transform(p.in) : undefined,
    out: p.out ? transform(p.out) : undefined,
  }));
}
// Exact de Casteljau split preserves the original cubic when an anchor is inserted.
export function splitSegment(points, index, t = 0.5) {
  const out = clonePath(points),
    a = out[index],
    b = out[(index + 1) % out.length],
    lerp = (p, q) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const p = lerp(a, a.out || a),
    q = lerp(a.out || a, b.in || b),
    r = lerp(b.in || b, b),
    u = lerp(p, q),
    v = lerp(q, r),
    mid = lerp(u, v);
  a.out = p;
  b.in = r;
  out.splice(index + 1, 0, { ...mid, in: u, out: v });
  return out;
}
export function validatePath(points) {
  const point = (p) =>
    p &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    Math.abs(p.x) <= 100000 &&
    Math.abs(p.y) <= 100000;
  if (
    !Array.isArray(points) ||
    points.length > 1000 ||
    !points.every(
      (p) => point(p) && (!p.in || point(p.in)) && (!p.out || point(p.out)),
    )
  )
    throw new Error("Invalid Bézier path.");
}
