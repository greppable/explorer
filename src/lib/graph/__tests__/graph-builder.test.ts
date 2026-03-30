import { describe, it, expect } from "vitest";
import { buildGraphFromIndex } from "../graph-builder";
import type { GdlFormat } from "../../types";

// Minimal fixture that simulates /api/index response shape
function makeOccurrence(entity: string, format: GdlFormat, role: string, file: string) {
  return { entity, file, format, line: 1, context: `@${role} ${entity}`, role };
}

describe("buildGraphFromIndex", () => {
  it("creates entity nodes from occurrences", () => {
    const entities = {
      users: {
        entity: "users",
        occurrences: [
          makeOccurrence("users", "gdls", "table_definition", ".superset/schema.gdls"),
        ],
      },
    };
    const files = [{ path: ".superset/schema.gdls", absolutePath: "/x", format: "gdls" as GdlFormat, name: "schema", size: 100 }];

    const result = buildGraphFromIndex(files, entities);

    expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    const usersNode = result.nodes.find(n => n.label === "users");
    expect(usersNode).toBeDefined();
    expect(usersNode!.type).toBe("schema");
  });

  it("creates file nodes", () => {
    const entities = {};
    const files = [{ path: ".superset/schema.gdls", absolutePath: "/x", format: "gdls" as GdlFormat, name: "schema", size: 100 }];

    const result = buildGraphFromIndex(files, entities);

    const fileNode = result.nodes.find(n => n.id.startsWith("file:"));
    expect(fileNode).toBeDefined();
    expect(fileNode!.type).toBe("document");
  });

  it("creates cross-layer edges for entities in multiple formats", () => {
    const entities = {
      users: {
        entity: "users",
        occurrences: [
          makeOccurrence("users", "gdls", "table_definition", ".superset/schema.gdls"),
          makeOccurrence("users", "gdlc", "module_definition", ".superset/code.gdlc"),
        ],
      },
    };
    const files = [
      { path: ".superset/schema.gdls", absolutePath: "/x", format: "gdls" as GdlFormat, name: "schema", size: 100 },
      { path: ".superset/code.gdlc", absolutePath: "/x", format: "gdlc" as GdlFormat, name: "code", size: 100 },
    ];

    const result = buildGraphFromIndex(files, entities);

    const crossEdge = result.edges.find(e => e.type === "cross-layer");
    expect(crossEdge).toBeDefined();
  });

  it("creates relationship edges from source→target roles", () => {
    const entities = {
      users: {
        entity: "users",
        occurrences: [
          makeOccurrence("users", "gdls", "relationship_source", ".superset/schema.gdls"),
        ],
      },
      orders: {
        entity: "orders",
        occurrences: [
          makeOccurrence("orders", "gdls", "relationship_target", ".superset/schema.gdls"),
        ],
      },
    };
    const files = [{ path: ".superset/schema.gdls", absolutePath: "/x", format: "gdls" as GdlFormat, name: "schema", size: 100 }];

    const result = buildGraphFromIndex(files, entities);

    // Both entities should exist as nodes
    expect(result.nodes.find(n => n.label === "users")).toBeDefined();
    expect(result.nodes.find(n => n.label === "orders")).toBeDefined();

    // A relationship edge should connect them
    const relEdge = result.edges.find(e => e.type === "relationship");
    expect(relEdge).toBeDefined();
    expect(relEdge!.source).toContain("users");
    expect(relEdge!.target).toContain("orders");
  });

  it("returns stats", () => {
    const entities = {};
    const files: never[] = [];

    const result = buildGraphFromIndex(files, entities);

    expect(result.stats).toBeDefined();
    expect(typeof result.stats.entityCount).toBe("number");
  });
});
