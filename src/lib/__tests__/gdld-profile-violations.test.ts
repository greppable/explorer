import { describe, it, expect } from "vitest";
import { parseGdld } from "../parsers/gdld-parser";
import { getProfileViolations } from "../gdld-profile-violations";

describe("getProfileViolations", () => {
  it("returns empty for no profile", () => {
    const model = parseGdld("@diagram|id:test|type:flow|purpose:test\n@node|id:A|label:A");
    expect(getProfileViolations(model)).toEqual([]);
  });

  it("returns empty for unknown profile", () => {
    const model = parseGdld("@diagram|id:test|type:flow|profile:custom|purpose:test\n@node|id:A|label:A");
    expect(getProfileViolations(model)).toEqual([]);
  });

  it("detects @participant in flow profile", () => {
    const content = [
      "@diagram|id:test|type:flow|profile:flow|purpose:test",
      "@node|id:A|label:A",
      "@participant|id:user|label:User|role:actor",
    ].join("\n");
    const violations = getProfileViolations(parseGdld(content));
    expect(violations).toContain("1 @participant");
  });

  it("detects @node in sequence profile", () => {
    const content = [
      "@diagram|id:test|type:sequence|profile:sequence|purpose:test",
      "@participant|id:user|label:User|role:actor",
      "@node|id:A|label:A",
    ].join("\n");
    const violations = getProfileViolations(parseGdld(content));
    expect(violations).toContain("1 @node");
  });

  it("detects @deploy-env in flow profile", () => {
    const content = [
      "@diagram|id:test|type:flow|profile:flow|purpose:test",
      "@node|id:A|label:A",
      "@deploy-env|id:prod|label:Production",
    ].join("\n");
    const violations = getProfileViolations(parseGdld(content));
    expect(violations).toContain("1 @deploy-env");
  });

  it("no violations for correct flow profile", () => {
    const content = [
      "@diagram|id:test|type:flow|profile:flow|purpose:test",
      "@node|id:A|label:A",
      "@edge|from:A|to:B|label:link",
      "@gotcha|issue:watch out|detail:careful",
    ].join("\n");
    expect(getProfileViolations(parseGdld(content))).toEqual([]);
  });

  it("no violations for correct deployment profile", () => {
    const content = [
      "@diagram|id:test|type:deployment|profile:deployment|purpose:test",
      "@deploy-env|id:prod|label:Production",
      "@deploy-node|id:web|label:Web|env:prod",
      "@infra-node|id:lb|label:LB|node:web",
    ].join("\n");
    expect(getProfileViolations(parseGdld(content))).toEqual([]);
  });

  it("no violations for correct knowledge profile", () => {
    const content = [
      "@diagram|id:test|type:knowledge|profile:knowledge|purpose:test",
      "@node|id:A|label:A",
      "@edge|from:A|to:B|label:link",
      "@gotcha|issue:watch out|detail:careful",
    ].join("\n");
    expect(getProfileViolations(parseGdld(content))).toEqual([]);
  });

  it("detects @participant in knowledge profile", () => {
    const content = [
      "@diagram|id:test|type:knowledge|profile:knowledge|purpose:test",
      "@node|id:A|label:A",
      "@participant|id:user|label:User|role:actor",
    ].join("\n");
    const violations = getProfileViolations(parseGdld(content));
    expect(violations).toContain("1 @participant");
  });

  it("reports multiple violations at once", () => {
    const content = [
      "@diagram|id:test|type:flow|profile:flow|purpose:test",
      "@node|id:A|label:A",
      "@participant|id:user|label:User|role:actor",
      "@deploy-env|id:prod|label:Production",
    ].join("\n");
    const violations = getProfileViolations(parseGdld(content));
    expect(violations).toHaveLength(2);
    expect(violations).toContain("1 @participant");
    expect(violations).toContain("1 @deploy-env");
  });

  it("detects @msg in flow profile", () => {
    const content = [
      "@diagram|id:test|type:flow|profile:flow|purpose:test",
      "@node|id:A|label:A",
      "@msg|from:A|to:B|label:call",
    ].join("\n");
    const violations = getProfileViolations(parseGdld(content));
    expect(violations).toContain("1 @msg/@block");
  });

  it("detects @component in sequence profile", () => {
    const content = [
      "@diagram|id:test|type:sequence|profile:sequence|purpose:test",
      "@participant|id:user|label:User|role:actor",
      "@component|name:AuthModule|does:handles auth",
    ].join("\n");
    const violations = getProfileViolations(parseGdld(content));
    expect(violations).toContain("1 @component");
  });
});
