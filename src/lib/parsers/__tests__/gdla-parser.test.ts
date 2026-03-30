import { describe, it, expect } from "vitest";
import { parseGdla } from "../gdla-parser";
import fs from "fs";
import path from "path";

const FIXTURES = path.resolve(__dirname, "../../../../tests/fixtures");

describe("parseGdla", () => {
  const content = fs.readFileSync(path.join(FIXTURES, "sample-api.gdla"), "utf-8");

  it("parses @D domain records with 4 positional fields", () => {
    const result = parseGdla(content);
    expect(result.domains.length).toBe(1);
    expect(result.domains[0].name).toBe("petstore-api");
    expect(result.domains[0].description).toBe("Pet store management API");
    expect(result.domains[0].version).toBe("3.0.1");
    expect(result.domains[0].baseUrl).toBe("https://api.petstore.io/v1");
  });

  it("parses @S schema records", () => {
    const result = parseGdla(content);
    expect(result.schemas.length).toBe(6);
    expect(result.schemas[0].name).toBe("Pet");
    expect(result.schemas[0].description).toBe("A pet in the store");
  });

  it("parses indented schema fields and assigns to correct parent", () => {
    const result = parseGdla(content);
    const pet = result.schemas.find((s) => s.name === "Pet");
    expect(pet?.fields.length).toBe(5);
    expect(pet?.fields[0].name).toBe("id");
    expect(pet?.fields[0].type).toBe("integer");
    expect(pet?.fields[0].required).toBe("required");
    expect(pet?.fields[0].format).toBe("int64");
    expect(pet?.fields[0].description).toBe("Unique pet identifier");
  });

  it("parses schema fields with empty optional fields", () => {
    const result = parseGdla(content);
    const pet = result.schemas.find((s) => s.name === "Pet");
    const nameField = pet?.fields.find((f) => f.name === "name");
    expect(nameField?.format).toBe("");
    expect(nameField?.required).toBe("required");
  });

  it("parses @EP with method extraction", () => {
    const result = parseGdla(content);
    expect(result.endpoints.length).toBeGreaterThanOrEqual(10);
    const getEndpoint = result.endpoints.find(
      (e) => e.method === "GET" && e.path === "/pets"
    );
    expect(getEndpoint).toBeDefined();
    expect(getEndpoint?.description).toBe("List all pets");
    expect(getEndpoint?.responses).toBe("200:Pet[],400:Error");
    expect(getEndpoint?.auth).toBe("api_key");
  });

  it("parses @EP POST endpoints", () => {
    const result = parseGdla(content);
    const postEndpoint = result.endpoints.find(
      (e) => e.method === "POST" && e.path === "/pets"
    );
    expect(postEndpoint?.description).toBe("Create a new pet");
    expect(postEndpoint?.auth).toBe("bearer");
  });

  it("parses @P parameters and assigns to correct endpoint", () => {
    const result = parseGdla(content);
    const getEndpoint = result.endpoints.find(
      (e) => e.method === "GET" && e.path === "/pets"
    );
    expect(getEndpoint?.params.length).toBe(3);
    expect(getEndpoint?.params[0].name).toBe("limit");
    expect(getEndpoint?.params[0].location).toBe("query");
    expect(getEndpoint?.params[0].type).toBe("integer");
  });

  it("parses required @P parameters", () => {
    const result = parseGdla(content);
    const getById = result.endpoints.find(
      (e) => e.method === "GET" && e.path === "/pets/{petId}"
    );
    expect(getById?.params.length).toBe(1);
    expect(getById?.params[0].name).toBe("petId");
    expect(getById?.params[0].required).toBe("required");
  });

  it("parses @AUTH records", () => {
    const result = parseGdla(content);
    expect(result.auth.length).toBe(3);
    expect(result.auth[0].scheme).toBe("api_key");
    expect(result.auth[0].description).toBe("API key authentication");
    expect(result.auth[0].header).toBe("X-API-Key");
  });

  it("parses @ENUM records", () => {
    const result = parseGdla(content);
    expect(result.enums.length).toBe(2);
    const petStatus = result.enums.find((e) => e.name === "PetStatus");
    expect(petStatus?.values).toEqual(["available", "pending", "sold"]);
  });

  it("parses @R relationship records", () => {
    const result = parseGdla(content);
    expect(result.relationships.length).toBe(3);
    const petTag = result.relationships.find(
      (r) => r.source === "Pet" && r.target === "Tag"
    );
    expect(petTag?.relType).toBe("references");
    expect(petTag?.via).toBe("via tags");
  });

  it("parses @PATH records", () => {
    const result = parseGdla(content);
    expect(result.paths.length).toBe(2);
    expect(result.paths[0].entities).toEqual(["User", "Order", "Pet"]);
    expect(result.paths[0].via).toBe("via /users/{id}/orders/{orderId}/pet");
  });

  it("parses GraphQL QUERY endpoints", () => {
    const result = parseGdla(content);
    const query = result.endpoints.find(
      (e) => e.method === "QUERY" && e.path === "pets"
    );
    expect(query).toBeDefined();
    expect(query?.description).toBe("Fetch pet list via GraphQL");
  });

  it("parses GraphQL MUTATION endpoints", () => {
    const result = parseGdla(content);
    const mutation = result.endpoints.find(
      (e) => e.method === "MUTATION" && e.path === "createPet"
    );
    expect(mutation).toBeDefined();
  });

  it("parses GraphQL SUBSCRIPTION endpoints", () => {
    const result = parseGdla(content);
    const sub = result.endpoints.find(
      (e) => e.method === "SUBSCRIPTION" && e.path === "petUpdates"
    );
    expect(sub).toBeDefined();
  });

  it("parses PATCH, HEAD, OPTIONS HTTP verbs", () => {
    const result = parseGdla(content);
    expect(result.endpoints.find((e) => e.method === "PATCH")).toBeDefined();
    expect(result.endpoints.find((e) => e.method === "HEAD")).toBeDefined();
    expect(result.endpoints.find((e) => e.method === "OPTIONS")).toBeDefined();
  });

  it("handles escaped pipes in descriptions", () => {
    const result = parseGdla(content);
    const searchEndpoint = result.endpoints.find(
      (e) => e.method === "GET" && e.path === "/pets/search"
    );
    expect(searchEndpoint?.description).toBe(
      "Search pets with filters | pagination"
    );
  });

  it("parses @VERSION header", () => {
    const result = parseGdla(content);
    expect(result.version).toBeDefined();
    expect(result.version!.spec).toBe("gdla");
    expect(result.version!.version).toBe("0.1.0");
  });

  it("skips comments and blank lines", () => {
    const result = parseGdla(content);
    // Should not have any records with names starting with # or //
    const allSchemaNames = result.schemas.map((s) => s.name);
    expect(allSchemaNames.every((n) => !n.startsWith("#") && !n.startsWith("//"))).toBe(true);
  });

  it("handles empty schema (no fields)", () => {
    const input = [
      "@D test-api|Test|1.0|/",
      "@S EmptySchema|Schema with no fields",
      "@S NextSchema|Has fields",
      " field1|string|||A field",
    ].join("\n");
    const result = parseGdla(input);
    const empty = result.schemas.find((s) => s.name === "EmptySchema");
    expect(empty?.fields.length).toBe(0);
    const next = result.schemas.find((s) => s.name === "NextSchema");
    expect(next?.fields.length).toBe(1);
  });

  it("handles endpoint with no parameters", () => {
    const input = [
      "@D test-api|Test|1.0|/",
      "@EP GET /health|Health check|200:ok|",
      "@EP GET /ready|Readiness check|200:ok|",
    ].join("\n");
    const result = parseGdla(input);
    const health = result.endpoints.find((e) => e.path === "/health");
    expect(health?.params.length).toBe(0);
  });

  it("handles @D with missing optional fields", () => {
    const input = "@D minimal-api|Just a description";
    const result = parseGdla(input);
    expect(result.domains[0].name).toBe("minimal-api");
    expect(result.domains[0].description).toBe("Just a description");
    expect(result.domains[0].version).toBe("");
    expect(result.domains[0].baseUrl).toBe("");
  });

  it("handles escaped pipe in @D description", () => {
    const input = "@D test-api|API with \\| pipe|1.0|/";
    const result = parseGdla(input);
    expect(result.domains[0].description).toBe("API with | pipe");
  });

  it("handles escaped pipe in @R via field", () => {
    const input = "@R A -> B|references|via field \\| other";
    const result = parseGdla(input);
    expect(result.relationships[0].via).toBe("via field | other");
  });

  it("returns undefined version when no @VERSION header", () => {
    const input = "@D test-api|Test|1.0|/";
    const result = parseGdla(input);
    expect(result.version).toBeUndefined();
  });

  it("handles @EP with empty auth field", () => {
    const result = parseGdla(content);
    const getUserEndpoint = result.endpoints.find(
      (e) => e.method === "GET" && e.path === "/users/{username}"
    );
    expect(getUserEndpoint?.auth).toBe("");
  });

  it("handles @EP with empty responses field", () => {
    const input = "@D test-api|Test|1.0|/\n@EP HEAD /ping||200:|";
    const result = parseGdla(input);
    expect(result.endpoints[0].description).toBe("");
  });
});
