import type { GdldModel } from "@/lib/parsers/gdld-parser";

const PROFILE_ALLOWED: Record<string, Set<string>> = {
  flow: new Set(["group", "node", "edge", "component", "config", "entry", "gotcha", "recovery", "pattern", "note", "use-when", "use-not", "decision"]),
  sequence: new Set(["participant", "msg", "block", "endblock", "seq-note", "gotcha", "note"]),
  deployment: new Set(["deploy-env", "deploy-node", "deploy-instance", "infra-node", "node", "edge", "note"]),
  knowledge: new Set(["gotcha", "recovery", "decision", "pattern", "use-when", "use-not", "note", "node", "edge"]),
};

export function getProfileViolations(model: GdldModel): string[] {
  const profile = model.diagram.profile;
  if (!profile || !PROFILE_ALLOWED[profile]) return [];
  const allowed = PROFILE_ALLOWED[profile];
  const violations: string[] = [];

  // Structural records
  if (model.nodes.length > 0 && !allowed.has("node"))
    violations.push(`${model.nodes.length} @node`);
  if (model.edges.length > 0 && !allowed.has("edge"))
    violations.push(`${model.edges.length} @edge`);
  if (model.groups.length > 0 && !allowed.has("group"))
    violations.push(`${model.groups.length} @group`);

  // Sequence records
  if (model.participants.length > 0 && !allowed.has("participant"))
    violations.push(`${model.participants.length} @participant`);
  if (model.sequenceElements.length > 0 && !allowed.has("msg"))
    violations.push(`${model.sequenceElements.length} @msg/@block`);

  // Deployment records
  if (model.deployEnvs.length > 0 && !allowed.has("deploy-env"))
    violations.push(`${model.deployEnvs.length} @deploy-env`);
  if (model.deployNodes.length > 0 && !allowed.has("deploy-node"))
    violations.push(`${model.deployNodes.length} @deploy-node`);
  if (model.deployInstances.length > 0 && !allowed.has("deploy-instance"))
    violations.push(`${model.deployInstances.length} @deploy-instance`);
  if (model.infraNodes.length > 0 && !allowed.has("infra-node"))
    violations.push(`${model.infraNodes.length} @infra-node`);

  // Context records (spot-check high-signal ones)
  if (model.context.components.length > 0 && !allowed.has("component"))
    violations.push(`${model.context.components.length} @component`);
  if (model.context.entries.length > 0 && !allowed.has("entry"))
    violations.push(`${model.context.entries.length} @entry`);

  return violations;
}
