/**
 * Graph layout algorithms for the knowledge graph.
 * Ported from basecamp with type order adapted for GDL format types.
 */

interface LayoutNode {
  id: string;
  position: { x: number; y: number };
  data?: { nodeType?: string };
  [key: string]: unknown;
}

interface LayoutEdge {
  source: string;
  target: string;
  [key: string]: unknown;
}

export type LayoutMode = "organized" | "force";

// ─── Type ordering for organized layout ──────────────────────────────────
// Matches our GraphNodeType taxonomy
const TYPE_ORDER = ["schema", "api", "code", "diagram", "memory", "data", "document"];

// ─── Organized layout ────────────────────────────────────────────────────
// Clean rows grouped by type, like a structured dashboard.

function applyOrganizedLayout<N extends LayoutNode>(
  nodes: N[],
  options: { width?: number } = {},
): N[] {
  const { width = 1600 } = options;

  if (nodes.length === 0) return nodes;
  if (nodes.length === 1) {
    return [{ ...nodes[0]!, position: { x: width / 2 - 75, y: 100 } }];
  }

  const groups = new Map<string, N[]>();
  for (const node of nodes) {
    const type = (node.data as { nodeType?: string } | undefined)?.nodeType ?? "unknown";
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type)!.push(node);
  }

  const sortedTypes = [...groups.keys()].sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a);
    const bi = TYPE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const nodeWidth = 180;
  const nodeHeight = 70;
  const colGap = 30;
  const rowGap = 50;
  const groupGap = 40;
  const startX = 80;

  const result = new Map<string, { x: number; y: number }>();
  let currentY = 60;

  for (const type of sortedTypes) {
    const group = groups.get(type)!;
    const maxCols = Math.max(1, Math.floor((width - startX * 2 + colGap) / (nodeWidth + colGap)));
    const cols = Math.min(maxCols, group.length);
    const rowWidth = cols * nodeWidth + (cols - 1) * colGap;
    const offsetX = (width - rowWidth) / 2;

    group.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      result.set(node.id, {
        x: offsetX + col * (nodeWidth + colGap),
        y: currentY + row * (nodeHeight + rowGap),
      });
    });

    const rows = Math.ceil(group.length / cols);
    currentY += rows * (nodeHeight + rowGap) + groupGap;
  }

  return nodes.map((node) => ({
    ...node,
    position: result.get(node.id) ?? { x: 0, y: 0 },
  }));
}

// ─── Force-directed layout ───────────────────────────────────────────────
// Organic layout with type clustering.

function applyForceDirectedLayout<N extends LayoutNode, E extends LayoutEdge>(
  nodes: N[],
  edges: E[],
  options: { width?: number; height?: number; iterations?: number } = {},
): N[] {
  const { width = 1200, height = 800, iterations = 100 } = options;
  const repulsionForce = 6000;
  const attractionForce = 0.008;
  const damping = 0.88;

  if (nodes.length === 0) return nodes;
  if (nodes.length === 1) {
    return [{ ...nodes[0]!, position: { x: width / 2 - 75, y: height / 2 - 25 } }];
  }

  const typeGroups = new Map<string, N[]>();
  for (const node of nodes) {
    const type = (node.data as { nodeType?: string } | undefined)?.nodeType ?? "unknown";
    if (!typeGroups.has(type)) typeGroups.set(type, []);
    typeGroups.get(type)!.push(node);
  }

  const sortedTypes = [...typeGroups.keys()].sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a);
    const bi = TYPE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const positions = new Map<string, { x: number; y: number }>();
  const velocities = new Map<string, { x: number; y: number }>();
  const centerX = width / 2;
  const centerY = height / 2;

  // Deterministic hash for consistent jitter (avoids Math.random)
  function hashJitter(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return ((h & 0x7fffffff) / 0x7fffffff - 0.5) * 60;
  }

  sortedTypes.forEach((type, typeIdx) => {
    const group = typeGroups.get(type)!;
    const sectorAngle = (2 * Math.PI * typeIdx) / Math.max(sortedTypes.length, 1);
    const isHighPriority = TYPE_ORDER.indexOf(type) < 3;
    const baseRadius = isHighPriority
      ? Math.min(width, height) * 0.2
      : Math.min(width, height) * 0.35;

    group.forEach((node, i) => {
      const spreadAngle = sectorAngle + ((i - group.length / 2) * 0.15);
      const jitter = hashJitter(node.id);
      positions.set(node.id, {
        x: centerX + (baseRadius + jitter) * Math.cos(spreadAngle),
        y: centerY + (baseRadius + jitter) * Math.sin(spreadAngle),
      });
      velocities.set(node.id, { x: 0, y: 0 });
    });
  });

  const nodeType = new Map<string, string>();
  for (const node of nodes) {
    nodeType.set(node.id, (node.data as { nodeType?: string } | undefined)?.nodeType ?? "unknown");
  }

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - (iter / iterations) * 0.5;

    for (let i = 0; i < nodes.length; i++) {
      const nodeA = nodes[i]!;
      const posA = positions.get(nodeA.id)!;
      const velA = velocities.get(nodeA.id)!;

      for (let j = i + 1; j < nodes.length; j++) {
        const nodeB = nodes[j]!;
        const posB = positions.get(nodeB.id)!;
        const velB = velocities.get(nodeB.id)!;

        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const distSq = Math.max(dx * dx + dy * dy, 1);
        const dist = Math.sqrt(distSq);

        const sameType = nodeType.get(nodeA.id) === nodeType.get(nodeB.id);
        const force = (repulsionForce * (sameType ? 0.6 : 1.0) * cooling) / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        velA.x += fx; velA.y += fy;
        velB.x -= fx; velB.y -= fy;
      }
    }

    for (const edge of edges) {
      const posA = positions.get(edge.source);
      const posB = positions.get(edge.target);
      if (!posA || !posB) continue;

      const velA = velocities.get(edge.source)!;
      const velB = velocities.get(edge.target)!;

      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);

      const force = dist * attractionForce * cooling;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      velA.x += fx; velA.y += fy;
      velB.x -= fx; velB.y -= fy;
    }

    for (const node of nodes) {
      const pos = positions.get(node.id)!;
      const vel = velocities.get(node.id)!;

      vel.x += (centerX - pos.x) * 0.0003 * cooling;
      vel.y += (centerY - pos.y) * 0.0003 * cooling;

      vel.x *= damping; vel.y *= damping;
      pos.x += vel.x; pos.y += vel.y;

      pos.x = Math.max(80, Math.min(width - 220, pos.x));
      pos.y = Math.max(60, Math.min(height - 100, pos.y));
    }
  }

  // Collision resolution pass
  const NODE_W = 180;
  const NODE_H = 60;
  const PAD = 20;

  for (let pass = 0; pass < 10; pass++) {
    let anyOverlap = false;
    for (let i = 0; i < nodes.length; i++) {
      const posA = positions.get(nodes[i]!.id)!;
      for (let j = i + 1; j < nodes.length; j++) {
        const posB = positions.get(nodes[j]!.id)!;
        const overlapX = (NODE_W + PAD) - Math.abs(posA.x - posB.x);
        const overlapY = (NODE_H + PAD) - Math.abs(posA.y - posB.y);
        if (overlapX > 0 && overlapY > 0) {
          anyOverlap = true;
          if (overlapX < overlapY) {
            const pushX = overlapX / 2 + 1;
            if (posA.x < posB.x) { posA.x -= pushX; posB.x += pushX; }
            else { posA.x += pushX; posB.x -= pushX; }
          } else {
            const pushY = overlapY / 2 + 1;
            if (posA.y < posB.y) { posA.y -= pushY; posB.y += pushY; }
            else { posA.y += pushY; posB.y -= pushY; }
          }
        }
      }
    }
    if (!anyOverlap) break;
  }

  // Re-clamp positions after collision resolution
  for (const node of nodes) {
    const pos = positions.get(node.id)!;
    pos.x = Math.max(80, Math.min(width - 220, pos.x));
    pos.y = Math.max(60, Math.min(height - 100, pos.y));
  }

  return nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? { x: 0, y: 0 },
  }));
}

// ─── Public API ──────────────────────────────────────────────────────────

export function applyLayout<N extends LayoutNode, E extends LayoutEdge>(
  mode: LayoutMode,
  nodes: N[],
  edges: E[],
  options: { width?: number; height?: number; iterations?: number } = {},
): N[] {
  if (mode === "organized") return applyOrganizedLayout(nodes, options);
  return applyForceDirectedLayout(nodes, edges, options);
}
