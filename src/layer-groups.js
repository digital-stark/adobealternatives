export function groupPath(layer) {
  if (layer.groups) return layer.groups;
  if (!layer.group) return [];
  return layer.group
    .split("/")
    .filter(Boolean)
    .map((name, i, a) => ({
      id: a.slice(0, i + 1).join("/"),
      name,
      visible: true,
      opacity: 1,
      blend: "source-over",
      collapsed: false,
    }));
}
export function setGroupPath(layers, layer, text) {
  const names = text
    .split("/")
    .map((n) => n.trim())
    .filter(Boolean);
  if (names.length > 12 || names.some((n) => n.length > 80))
    throw new Error("Use at most 12 groups with names up to 80 characters.");
  const known = new Map(
    layers.flatMap((l) => groupPath(l).map((g) => [g.id, g])),
  );
  layer.groups = names.map((name, i) => {
    const id = names.slice(0, i + 1).join("/");
    return {
      ...(known.get(id) || {
        id,
        name,
        visible: true,
        opacity: 1,
        blend: "source-over",
        collapsed: false,
      }),
    };
  });
  delete layer.group;
}
export function updateGroup(layers, id, patch) {
  for (const l of layers)
    l.groups = groupPath(l).map((g) =>
      g.id === id ? { ...g, ...patch } : { ...g },
    );
}
// Each group is an isolated compositing surface, with one opacity/blend operation
// at its parent. Member opacity therefore never gets applied twice.
export function groupTree(layers, depth = 0) {
  const result = [],
    groups = new Map();
  for (const layer of layers) {
    const path = groupPath(layer),
      g = path[depth];
    if (!g) {
      result.push({ layer });
      continue;
    }
    if (!groups.has(g.id)) {
      const node = { group: g, layers: [] };
      groups.set(g.id, node);
      result.push(node);
    }
    groups.get(g.id).layers.push(layer);
  }
  return result.map((n) =>
    n.group ? { group: n.group, children: groupTree(n.layers, depth + 1) } : n,
  );
}
export function validateGroups(groups) {
  if (!Array.isArray(groups) || groups.length > 12)
    throw new Error("Invalid nested groups.");
  const ids = new Set();
  for (const g of groups) {
    if (
      !g ||
      typeof g.id !== "string" ||
      g.id.length > 1000 ||
      ids.has(g.id) ||
      typeof g.name !== "string" ||
      g.name.length > 80 ||
      typeof g.visible !== "boolean" ||
      typeof g.collapsed !== "boolean" ||
      !Number.isFinite(g.opacity) ||
      g.opacity < 0 ||
      g.opacity > 1 ||
      ![
        "source-over",
        "multiply",
        "screen",
        "overlay",
        "darken",
        "lighten",
        "difference",
        "exclusion",
      ].includes(g.blend)
    )
      throw new Error("Invalid group settings.");
    ids.add(g.id);
  }
}
