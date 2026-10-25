import test from "node:test";
import assert from "node:assert/strict";
import {
  splitSegment,
  pathCommands,
  moveAnchor,
  transformPath,
  validatePath,
} from "../src/bezier.js";
import {
  groupTree,
  setGroupPath,
  updateGroup,
  validateGroups,
} from "../src/layer-groups.js";
import { stampPositions } from "../src/brush-engine.js";
test("Bézier subdivision preserves a cubic and transforms both handles", () => {
  const p = [
      { x: 0, y: 0, out: { x: 0, y: 100 } },
      { x: 100, y: 0, in: { x: 100, y: 100 } },
    ],
    r = splitSegment(p, 0);
  assert.equal(r[1].x, 50);
  assert.equal(r[1].y, 75);
  assert.deepEqual(p[0].out, { x: 0, y: 100 });
  moveAnchor(r[1], 60, 85);
  assert.deepEqual(r[1].in, { x: 35, y: 85 });
  const scaled = transformPath(r, (p) => ({ x: p.x * 2, y: p.y * 3 }));
  assert.equal(scaled[1].in.y, 255);
  assert.match(pathCommands(r), / C /);
  assert.throws(() => validatePath([{ x: 0, y: 0, out: { x: NaN, y: 0 } }]));
});
test("nested groups preserve hierarchy and share visibility without modifying member visibility", () => {
  const layers = [
    { id: 1, visible: true },
    { id: 2, visible: true },
    { id: 3, visible: true },
  ];
  setGroupPath(layers, layers[0], "Portrait/Hair");
  setGroupPath(layers, layers[1], "Portrait/Face");
  const tree = groupTree(layers);
  assert.equal(tree.length, 2);
  assert.equal(tree[0].children.length, 2);
  updateGroup(layers, "Portrait", { opacity: 0.5, visible: false });
  assert.equal(layers[1].groups[0].visible, false);
  assert.equal(layers[1].visible, true);
  validateGroups(layers[0].groups);
  assert.throws(() => validateGroups([{ ...layers[0].groups[0], opacity: 2 }]));
});
test("brush spacing continues across input events without event-dependent density", () => {
  const whole = stampPositions({ x: 0, y: 0 }, { x: 100, y: 0 }, 7),
    a = stampPositions({ x: 0, y: 0 }, { x: 33, y: 0 }, 7),
    b = stampPositions({ x: 33, y: 0 }, { x: 100, y: 0 }, 7, a.carry);
  assert.deepEqual(
    [...a.points, ...b.points].map((p) => Math.round(p.x)),
    whole.points.map((p) => Math.round(p.x)),
  );
});
