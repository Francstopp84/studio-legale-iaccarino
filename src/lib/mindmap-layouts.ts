/**
 * Layout engines for mind map, concept map, and linear schema.
 * Each function takes raw nodes/edges and returns nodes with x/y positions.
 * All layouts use generous spacing to prevent overlapping.
 */

export type RawNode = {
  id: string;
  label: string;
  level: number;
  parentId?: string;
};

export type RawEdge = {
  source: string;
  target: string;
  label?: string;
};

export type PositionedNode = RawNode & {
  x: number;
  y: number;
};

// Branch colors for mind map style
export const BRANCH_COLORS = [
  "#5b8fb9", // blue
  "#d4a853", // gold
  "#c47d5b", // orange
  "#6b8f71", // green
  "#9b6b9e", // purple
  "#c45c4a", // red
  "#5bb8a9", // teal
  "#b8729d", // pink
];

/** Build adjacency: parentId → children */
function buildTree(nodes: RawNode[], edges: RawEdge[]): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const n of nodes) children.set(n.id, []);
  for (const e of edges) {
    const list = children.get(e.source);
    if (list && !list.includes(e.target)) list.push(e.target);
  }
  return children;
}

/** Assign parentId to each node based on edges */
function assignParents(nodes: RawNode[], edges: RawEdge[]): RawNode[] {
  const parentMap = new Map<string, string>();
  for (const e of edges) parentMap.set(e.target, e.source);
  return nodes.map((n) => ({ ...n, parentId: parentMap.get(n.id) }));
}

/** Find root node */
function findRoot(nodes: RawNode[]): RawNode | undefined {
  return nodes.find((n) => n.level === 0) || nodes[0];
}

// ─── MIND MAP (Radial) ─────────────────────────────────────────────

export function layoutMindMap(
  rawNodes: RawNode[],
  edges: RawEdge[]
): PositionedNode[] {
  const nodes = assignParents(rawNodes, edges);
  const children = buildTree(nodes, edges);
  const root = findRoot(nodes);
  if (!root) return [];

  const positioned = new Map<string, PositionedNode>();

  // Place root at center
  positioned.set(root.id, { ...root, x: 0, y: 0 });

  // Count total leaf descendants for proportional angle allocation
  function countLeaves(id: string): number {
    const kids = children.get(id) || [];
    if (kids.length === 0) return 1;
    return kids.reduce((sum, k) => sum + countLeaves(k), 0);
  }

  // Calculate subtree depth for dynamic radius
  function subtreeDepth(id: string): number {
    const kids = children.get(id) || [];
    if (kids.length === 0) return 0;
    return 1 + Math.max(...kids.map(subtreeDepth));
  }

  const totalLeafCount = countLeaves(root.id);
  // Base radius scales with number of nodes to prevent crowding
  const BASE_RADIUS = Math.max(400, totalLeafCount * 45);

  function placeChildren(
    parentId: string,
    startAngle: number,
    endAngle: number,
    radius: number,
    depth: number
  ) {
    const kids = children.get(parentId) || [];
    if (kids.length === 0) return;

    const totalLeaves = kids.reduce((s, k) => s + countLeaves(k), 0);
    const parent = positioned.get(parentId)!;
    let currentAngle = startAngle;

    // Add minimum gap between children to prevent overlap
    const minAngleGap = 0.15; // ~8.5 degrees minimum
    const availableAngle = endAngle - startAngle - (kids.length - 1) * minAngleGap;

    for (const kidId of kids) {
      const kidNode = nodes.find((n) => n.id === kidId);
      if (!kidNode) continue;

      const leafWeight = countLeaves(kidId);
      const angleSpan = Math.max(
        minAngleGap,
        (availableAngle * leafWeight) / totalLeaves
      );
      const midAngle = currentAngle + angleSpan / 2;

      const x = parent.x + Math.cos(midAngle) * radius;
      const y = parent.y + Math.sin(midAngle) * radius;

      positioned.set(kidId, { ...kidNode, x, y });

      // Reduce radius less aggressively for deeper levels
      const childRadius = radius * 0.7;
      placeChildren(kidId, currentAngle, currentAngle + angleSpan, childRadius, depth + 1);
      currentAngle += angleSpan + minAngleGap;
    }
  }

  placeChildren(root.id, 0, Math.PI * 2, BASE_RADIUS, 1);
  return Array.from(positioned.values());
}

// ─── CONCEPT MAP (Top-down hierarchical) ────────────────────────────

export function layoutConceptMap(
  rawNodes: RawNode[],
  edges: RawEdge[]
): PositionedNode[] {
  const nodes = assignParents(rawNodes, edges);
  const children = buildTree(nodes, edges);
  const root = findRoot(nodes);
  if (!root) return [];

  const positioned = new Map<string, PositionedNode>();
  const LEVEL_HEIGHT = 200;
  const MIN_NODE_WIDTH = 280;

  // BFS to group by level
  const levels: string[][] = [];
  const queue: { id: string; level: number }[] = [{ id: root.id, level: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    if (!levels[level]) levels[level] = [];
    levels[level].push(id);

    for (const kid of children.get(id) || []) {
      queue.push({ id: kid, level: level + 1 });
    }
  }

  // Calculate subtree width for each node (bottom-up)
  const subtreeWidth = new Map<string, number>();

  function calcWidth(id: string): number {
    const kids = children.get(id) || [];
    if (kids.length === 0) {
      subtreeWidth.set(id, MIN_NODE_WIDTH);
      return MIN_NODE_WIDTH;
    }
    const w = kids.reduce((sum, k) => sum + calcWidth(k), 0) + (kids.length - 1) * 40;
    const finalW = Math.max(MIN_NODE_WIDTH, w);
    subtreeWidth.set(id, finalW);
    return finalW;
  }
  calcWidth(root.id);

  // Position using subtree widths for proper spacing
  function positionNode(id: string, centerX: number, levelY: number) {
    const node = nodes.find((n) => n.id === id)!;
    positioned.set(id, { ...node, x: centerX, y: levelY });

    const kids = children.get(id) || [];
    if (kids.length === 0) return;

    const totalChildWidth = kids.reduce((s, k) => s + (subtreeWidth.get(k) || MIN_NODE_WIDTH), 0) + (kids.length - 1) * 40;
    let startX = centerX - totalChildWidth / 2;

    for (const kid of kids) {
      const w = subtreeWidth.get(kid) || MIN_NODE_WIDTH;
      const kidCenterX = startX + w / 2;
      positionNode(kid, kidCenterX, levelY + LEVEL_HEIGHT);
      startX += w + 40;
    }
  }

  positionNode(root.id, 0, 0);
  return Array.from(positioned.values());
}

// ─── LINEAR SCHEMA (Left-to-right tree) ─────────────────────────────

export function layoutLinear(
  rawNodes: RawNode[],
  edges: RawEdge[]
): PositionedNode[] {
  const nodes = assignParents(rawNodes, edges);
  const children = buildTree(nodes, edges);
  const root = findRoot(nodes);
  if (!root) return [];

  const positioned = new Map<string, PositionedNode>();
  const INDENT = 320;
  const ROW_HEIGHT = 100;
  let currentY = 0;

  function traverse(id: string, depth: number, prefix: string, index: number) {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    const num = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;

    positioned.set(id, {
      ...node,
      x: depth * INDENT,
      y: currentY,
      label: `${num}. ${node.label}`,
    });
    currentY += ROW_HEIGHT;

    const kids = children.get(id) || [];
    kids.forEach((kid, i) => traverse(kid, depth + 1, num, i));
  }

  traverse(root.id, 0, "", 0);

  // Root keeps clean label
  const rootPos = positioned.get(root.id);
  if (rootPos) {
    rootPos.label = root.label;
    positioned.set(root.id, rootPos);
  }

  return Array.from(positioned.values());
}

/** Assign a branch color index to each node based on which level-1 ancestor it belongs to */
export function assignBranchColors(
  nodes: RawNode[],
  edges: RawEdge[]
): Map<string, number> {
  const parentMap = new Map<string, string>();
  for (const e of edges) parentMap.set(e.target, e.source);

  const root = findRoot(nodes);
  const colorMap = new Map<string, number>();
  if (!root) return colorMap;

  colorMap.set(root.id, -1); // root uses accent color

  // Find level-1 ancestors
  const level1 = nodes.filter((n) => n.level === 1);
  level1.forEach((n, i) => colorMap.set(n.id, i % BRANCH_COLORS.length));

  // For deeper nodes, find their level-1 ancestor
  for (const node of nodes) {
    if (colorMap.has(node.id)) continue;
    let current = node.id;
    while (parentMap.has(current)) {
      const parent = parentMap.get(current)!;
      if (colorMap.has(parent) && colorMap.get(parent) !== -1) {
        colorMap.set(node.id, colorMap.get(parent)!);
        break;
      }
      if (parent === root.id) {
        colorMap.set(node.id, 0);
        break;
      }
      current = parent;
    }
    if (!colorMap.has(node.id)) colorMap.set(node.id, 0);
  }

  return colorMap;
}
