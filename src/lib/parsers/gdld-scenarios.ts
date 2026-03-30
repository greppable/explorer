import type { GdldModel } from "./gdld-parser";

/**
 * Apply a scenario to a GDLD model.
 * Returns a new model with overrides applied and excluded elements removed.
 */
export function applyScenario(model: GdldModel, scenarioId: string): GdldModel {
  // Build scenario inheritance chain
  const chain = buildScenarioChain(model, scenarioId);

  // Deep clone to avoid mutating original
  let result: GdldModel = JSON.parse(JSON.stringify(model));

  // Apply overrides from each scenario in chain order (base first)
  for (const sid of chain) {
    const overrides = model.overrides.filter((o) => o.scenario === sid);
    for (const override of overrides) {
      applyOverride(result, override.target, override.field, override.value);
    }

    // Apply excludes
    const excludes = model.excludes.filter((e) => e.scenario === sid);
    for (const exclude of excludes) {
      result = removeTarget(result, exclude.target);
    }
  }

  return result;
}

/**
 * Apply a view filter to a GDLD model.
 * Views filter by tags (via `filter`), group includes/excludes, and level.
 */
export function applyView(model: GdldModel, viewId: string): GdldModel {
  const view = model.views.find((v) => v.id === viewId);
  if (!view) return model;

  // If view specifies a scenario, applyScenario returns a deep clone already.
  // Otherwise, shallow-copy the arrays since .filter() creates new arrays without mutating elements.
  let result: GdldModel = view.scenario
    ? applyScenario(model, view.scenario)
    : { ...model, nodes: [...model.nodes], edges: [...model.edges], groups: [...model.groups] };

  // Filter by tag (filter field contains comma-separated tags, optionally prefixed with "tags:")
  if (view.filter) {
    let filterValue = view.filter;
    if (filterValue.startsWith("tags:")) {
      filterValue = filterValue.substring(5);
    }
    const tags = filterValue.split(",").map((t) => t.trim());
    result.nodes = result.nodes.filter((n) =>
      n.tags.some((t) => tags.includes(t))
    );
    // Keep edges that connect remaining nodes
    const nodeIds = new Set(result.nodes.map((n) => n.id));
    result.edges = result.edges.filter(
      (e) => nodeIds.has(e.from) && nodeIds.has(e.to)
    );
  }

  // Include only specific groups
  if (view.includes) {
    const includes = view.includes.split(",").map((g) => g.trim());
    result.nodes = result.nodes.filter(
      (n) => !n.group || includes.includes(n.group)
    );
    result.groups = result.groups.filter((g) => includes.includes(g.id));
    const nodeIds = new Set(result.nodes.map((n) => n.id));
    result.edges = result.edges.filter(
      (e) => nodeIds.has(e.from) && nodeIds.has(e.to)
    );
  }

  // Exclude specific groups
  if (view.excludes) {
    const excludes = view.excludes.split(",").map((g) => g.trim());
    result.nodes = result.nodes.filter(
      (n) => !n.group || !excludes.includes(n.group)
    );
    result.groups = result.groups.filter((g) => !excludes.includes(g.id));
    const nodeIds = new Set(result.nodes.map((n) => n.id));
    result.edges = result.edges.filter(
      (e) => nodeIds.has(e.from) && nodeIds.has(e.to)
    );
  }

  return result;
}

function buildScenarioChain(model: GdldModel, scenarioId: string): string[] {
  const chain: string[] = [];
  const visited = new Set<string>();
  let current: string | undefined = scenarioId;

  while (current && !visited.has(current)) {
    visited.add(current);
    chain.unshift(current); // prepend so base is first
    const scenario = model.scenarios.find((s) => s.id === current);
    current = scenario?.inherits;
  }

  return chain;
}

function applyOverride(
  model: GdldModel,
  target: string,
  field: string,
  value: string
): void {
  const node = model.nodes.find((n) => n.id === target);
  if (node) {
    if (field in node) {
      Object.assign(node, { [field]: value });
    }
    return;
  }
  const edge = model.edges.find(
    (e) => `${e.from}-${e.to}` === target
  );
  if (edge) {
    if (field in edge) {
      Object.assign(edge, { [field]: value });
    }
  }
}

function removeTarget(model: GdldModel, target: string): GdldModel {
  // Remove node
  model.nodes = model.nodes.filter((n) => n.id !== target);
  // Remove edges connected to removed node
  model.edges = model.edges.filter(
    (e) => e.from !== target && e.to !== target
  );
  // Remove group
  model.groups = model.groups.filter((g) => g.id !== target);
  // Unparent nodes that were in removed group
  for (const node of model.nodes) {
    if (node.group === target) node.group = null;
  }
  return model;
}
