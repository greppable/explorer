import { describe, it, expect } from "vitest";
import { parseGdld } from "../gdld-parser";
import fs from "fs";
import path from "path";

const FIXTURES = path.resolve(__dirname, "../../../../tests/fixtures");

describe("parseGdld", () => {
  describe("flow diagrams", () => {
    it("parses minimal flowchart", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "minimal-flowchart.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.diagram.type).toBe("flow");
      expect(model.diagram.id).toBe("minimal-test");
      expect(model.diagram.purpose).toBe("Minimal test diagram");
      expect(model.diagram.direction).toBe("TD");
      expect(model.nodes).toHaveLength(3);
      expect(model.edges).toHaveLength(2);
    });

    it("extracts node properties", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "styled-nodes.gdld"), "utf-8");
      const model = parseGdld(content);
      const shapes = model.nodes.map((n) => n.shape);
      expect(shapes).toContain("diamond");
      expect(shapes).toContain("database");
    });

    it("extracts edge properties", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "minimal-flowchart.gdld"), "utf-8");
      const model = parseGdld(content);
      const labeled = model.edges.find((e) => e.label === "complete");
      expect(labeled).toBeDefined();
      expect(labeled!.from).toBe("B");
      expect(labeled!.to).toBe("C");
    });

    it("parses groups with nesting", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "nested-groups.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.groups).toHaveLength(3);
      expect(model.nodes).toHaveLength(4);
      expect(model.edges).toHaveLength(3);
      const nested = model.groups.find((g) => g.parent === "outer");
      expect(nested).toBeDefined();
      expect(nested!.id).toBe("inner");
      const deepest = model.groups.find((g) => g.parent === "inner");
      expect(deepest).toBeDefined();
      expect(deepest!.id).toBe("deepest");
    });

    it("parses grouped flowchart", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "grouped-flowchart.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.groups).toHaveLength(2);
      expect(model.nodes).toHaveLength(4);
      const groupedNodes = model.nodes.filter((n) => n.group);
      expect(groupedNodes).toHaveLength(4);
    });
  });

  describe("sequence diagrams", () => {
    it("parses participants and messages", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "sequence-diagram.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.diagram.type).toBe("sequence");
      expect(model.diagram.id).toBe("sequence-test");
      expect(model.participants).toHaveLength(3);
      expect(model.participants[0].id).toBe("user");
      expect(model.participants[0].role).toBe("user");
      // 4 messages + 1 block + 1 message inside block + 1 endblock + 1 seq-note = 8 elements
      expect(model.sequenceElements).toHaveLength(8);
      const messages = model.sequenceElements.filter((e) => e.type === "msg");
      expect(messages).toHaveLength(5);
    });

    it("parses seq-note content", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "sequence-diagram.gdld"), "utf-8");
      const model = parseGdld(content);
      const note = model.sequenceElements.find((e) => e.type === "seq-note");
      expect(note).toBeDefined();
      expect(note!.over).toBe("api");
      expect(note!.text).toBe("Handles auth internally");
    });

    it("parses blocks (opt/alt/loop/par)", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "sequence-alt-par.gdld"), "utf-8");
      const model = parseGdld(content);
      const blocks = model.sequenceElements.filter((e) => e.type === "block");
      expect(blocks).toHaveLength(2);
      expect(blocks[0].blockType).toBe("alt");
      expect(blocks[0].blockId).toBe("cache-check");
      expect(blocks[1].blockType).toBe("par");
      expect(blocks[1].blockId).toBe("parallel-ops");
    });

    it("parses else/and with block association", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "sequence-alt-par.gdld"), "utf-8");
      const model = parseGdld(content);
      const elseEl = model.sequenceElements.find((e) => e.type === "else");
      expect(elseEl).toBeDefined();
      expect(elseEl!.blockId).toBe("cache-check");
      expect(elseEl!.label).toBe("Cache miss");
      const andEl = model.sequenceElements.find((e) => e.type === "and");
      expect(andEl).toBeDefined();
      expect(andEl!.blockId).toBe("parallel-ops");
      expect(andEl!.label).toBe("Also");
    });
  });

  describe("context records", () => {
    it("parses all context types with correct counts", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "full-context.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.context.useWhen).toHaveLength(2);
      expect(model.context.useNot).toHaveLength(1);
      expect(model.context.components).toHaveLength(2);
      expect(model.context.config).toHaveLength(2);
      expect(model.context.gotchas).toHaveLength(1);
      expect(model.context.recovery).toHaveLength(1);
      expect(model.context.entries).toHaveLength(2);
      expect(model.context.decisions).toHaveLength(1);
      expect(model.context.notes).toHaveLength(1);
      expect(model.context.patterns).toHaveLength(1);
    });

    it("extracts correct field values from context records", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "full-context.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.context.useWhen[0].condition).toBe("testing context sections");
      expect(model.context.useWhen[1].threshold).toBe("all sections");
      expect(model.context.useNot[0].reason).toBe("too much overhead");
      expect(model.context.gotchas[0].issue).toBe("Memory limits");
      expect(model.context.gotchas[0].fix).toBe("Use streaming");
      expect(model.context.decisions[0].id).toBe("ADR-001");
      expect(model.context.decisions[0].status).toBe("accepted");
      expect(model.context.notes[0].context).toBe("caveat");
      expect(model.context.patterns[0].name).toBe("Pipeline Pattern");
    });
  });

  describe("scenarios and views", () => {
    it("parses scenarios with overrides and excludes", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "scenario-diagram.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.scenarios).toHaveLength(3);
      expect(model.scenarios[1].id).toBe("prod");
      expect(model.scenarios[1].inherits).toBe("base");
      expect(model.scenarios[2].id).toBe("prod-eu");
      expect(model.scenarios[2].inherits).toBe("prod");
      expect(model.overrides).toHaveLength(2);
      expect(model.excludes).toHaveLength(1);
      expect(model.excludes[0].target).toBe("Analytics");
    });

    it("parses views with filters", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "view-diagram.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.views).toHaveLength(4);
      const securityView = model.views.find((v) => v.id === "security");
      expect(securityView).toBeDefined();
      expect(securityView!.filter).toBe("tags:security");
      const backendView = model.views.find((v) => v.id === "backend-only");
      expect(backendView).toBeDefined();
      expect(backendView!.includes).toBe("backend");
    });
  });

  describe("deployment diagrams", () => {
    it("parses deployment environments", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "deployment-diagram.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.diagram.type).toBe("deployment");
      expect(model.deployEnvs).toHaveLength(2);
      expect(model.deployEnvs[0].id).toBe("prod");
      expect(model.deployEnvs[0].label).toBe("Production Environment");
      expect(model.deployEnvs[1].id).toBe("staging");
    });

    it("parses deployment nodes with env reference", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "deployment-diagram.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.deployNodes).toHaveLength(3);
      expect(model.deployNodes[0].id).toBe("web-cluster");
      expect(model.deployNodes[0].env).toBe("prod");
      expect(model.deployNodes[2].env).toBe("staging");
    });

    it("parses deploy instances with component and node", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "deployment-diagram.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.deployInstances).toHaveLength(2);
      expect(model.deployInstances[0].component).toBe("API Service");
      expect(model.deployInstances[0].node).toBe("web-cluster");
      expect(model.deployInstances[0].instances).toBe("3");
    });

    it("parses infra nodes", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "deployment-diagram.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.infraNodes).toHaveLength(2);
      expect(model.infraNodes[0].id).toBe("lb");
      expect(model.infraNodes[0].label).toBe("Load Balancer");
      expect(model.infraNodes[0].node).toBe("web-cluster");
    });

    it("still parses edges in deployment diagrams", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "deployment-diagram.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.edges).toHaveLength(2);
    });
  });

  describe("include records", () => {
    it("parses @include with prefix", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "include-main.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.includes).toHaveLength(1);
      expect(model.includes[0].file).toBe("include-auth.gdld");
      expect(model.includes[0].prefix).toBe("auth_");
      expect(model.includes[0].records).toBeNull();
    });

    it("parses @include with records filter", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "include-records-filter.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.includes).toHaveLength(1);
      expect(model.includes[0].file).toBe("include-auth.gdld");
      expect(model.includes[0].prefix).toBe("auth_");
      expect(model.includes[0].records).toBe("node");
    });
  });

  describe("escaping", () => {
    it("handles escaped characters in fields", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "escaped-chars.gdld"), "utf-8");
      const model = parseGdld(content);
      expect(model.nodes).toHaveLength(5);
      expect(model.edges).toHaveLength(4);
    });
  });

  describe("Tranche 3 features", () => {
    it("parses profile and version from @diagram record", () => {
      const content = [
        '@diagram|id:auth-flow|type:pattern|purpose:Auth pattern|direction:LR|profile:security|version:2.0',
        '@node|id:A|label:Login',
      ].join("\n");
      const model = parseGdld(content);
      expect(model.diagram.type).toBe("pattern");
      expect(model.diagram.profile).toBe("security");
      expect(model.diagram.version).toBe("2.0");
    });

    it("accepts expanded diagram types (pattern, concept, state, decision)", () => {
      for (const type of ["pattern", "concept", "state", "decision"]) {
        const content = `@diagram|id:test|type:${type}|purpose:test\n@node|id:A|label:X`;
        const model = parseGdld(content);
        expect(model.diagram.type).toBe(type);
      }
    });

    it("parses role and pattern on nodes", () => {
      const content = [
        '@diagram|id:test|type:flow|purpose:test',
        '@node|id:A|label:Service|role:backend|pattern:singleton',
      ].join("\n");
      const model = parseGdld(content);
      expect(model.nodes[0].role).toBe("backend");
      expect(model.nodes[0].pattern).toBe("singleton");
    });

    it("parses type and tags on edges", () => {
      const content = [
        '@diagram|id:test|type:flow|purpose:test',
        '@node|id:A|label:A',
        '@node|id:B|label:B',
        '@edge|from:A|to:B|label:calls|type:sync|tags:critical,monitored',
      ].join("\n");
      const model = parseGdld(content);
      expect(model.edges[0].type).toBe("sync");
      expect(model.edges[0].tags).toEqual(["critical", "monitored"]);
    });

    it("parses severity on gotcha records", () => {
      const content = [
        '@diagram|id:test|type:flow|purpose:test',
        '@gotcha|issue:Memory leak|severity:high|fix:Use pooling',
      ].join("\n");
      const model = parseGdld(content);
      expect(model.context.gotchas[0].severity).toBe("high");
    });

    it("parses severity on recovery records", () => {
      const content = [
        '@diagram|id:test|type:flow|purpose:test',
        '@recovery|issue:DB timeout|severity:medium|means:retry|fix:Increase timeout',
      ].join("\n");
      const model = parseGdld(content);
      expect(model.context.recovery[0].severity).toBe("medium");
    });

    it("parses provider on deploy-env", () => {
      const content = [
        '@diagram|id:test|type:deployment|purpose:test',
        '@deploy-env|id:prod|label:Production|provider:aws',
      ].join("\n");
      const model = parseGdld(content);
      expect(model.deployEnvs[0].provider).toBe("aws");
    });

    it("parses technology and tags on deploy-node", () => {
      const content = [
        '@diagram|id:test|type:deployment|purpose:test',
        '@deploy-env|id:prod|label:Prod',
        '@deploy-node|id:k8s|label:K8s Cluster|env:prod|technology:kubernetes|tags:container,orchestration',
      ].join("\n");
      const model = parseGdld(content);
      expect(model.deployNodes[0].technology).toBe("kubernetes");
      expect(model.deployNodes[0].tags).toEqual(["container", "orchestration"]);
    });

    it("parses config on deploy-instance", () => {
      const content = [
        '@diagram|id:test|type:deployment|purpose:test',
        '@deploy-instance|component:API|node:web|instances:3|config:4cpu-8gb',
      ].join("\n");
      const model = parseGdld(content);
      expect(model.deployInstances[0].config).toBe("4cpu-8gb");
    });

    it("parses technology and tags on infra-node", () => {
      const content = [
        '@diagram|id:test|type:deployment|purpose:test',
        '@deploy-env|id:prod|label:Prod',
        '@deploy-node|id:web|label:Web|env:prod',
        '@infra-node|id:lb|label:Load Balancer|node:web|technology:nginx|tags:networking',
      ].join("\n");
      const model = parseGdld(content);
      expect(model.infraNodes[0].technology).toBe("nginx");
      expect(model.infraNodes[0].tags).toEqual(["networking"]);
    });

    it("parses @VERSION header", () => {
      const content = [
        '# @VERSION spec:gdld v:0.1.0 generated:2026-02-15 source:agent',
        '@diagram|id:test|type:flow|purpose:test',
        '@node|id:A|label:A',
      ].join("\n");
      const model = parseGdld(content);
      expect(model.version).toBeDefined();
      expect(model.version!.spec).toBe("gdld");
      expect(model.version!.source).toBe("agent");
    });

    it("profile/version are undefined when not present", () => {
      const content = [
        '@diagram|id:test|type:flow|purpose:test',
        '@node|id:A|label:A',
      ].join("\n");
      const model = parseGdld(content);
      expect(model.diagram.profile).toBeUndefined();
      expect(model.diagram.version).toBeUndefined();
      expect(model.version).toBeUndefined();
    });
  });
});
