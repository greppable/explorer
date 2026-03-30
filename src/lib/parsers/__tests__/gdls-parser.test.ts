import { describe, it, expect } from "vitest";
import { parseGdls } from "../gdls-parser";
import fs from "fs";
import path from "path";

const FIXTURES = path.resolve(__dirname, "../../../../tests/fixtures");

describe("parseGdls", () => {
  describe("core records", () => {
    it("parses domains and tables from sample schema", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "sample-schema.gdls"), "utf-8");
      const schema = parseGdls(content);
      expect(schema.domains.length).toBeGreaterThan(0);
      expect(schema.tables.length).toBeGreaterThan(0);
      expect(schema.tables[0].columns.length).toBeGreaterThan(0);
    });

    it("parses relationships", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "sample-schema.gdls"), "utf-8");
      const schema = parseGdls(content);
      expect(schema.relationships.length).toBeGreaterThan(0);
      const fk = schema.relationships.find((r) => r.relType === "fk");
      expect(fk).toBeDefined();
      expect(fk!.sourceTable).toBeTruthy();
      expect(fk!.targetTable).toBeTruthy();
    });

    it("parses enums", () => {
      const content = fs.readFileSync(path.join(FIXTURES, "sample-schema.gdls"), "utf-8");
      const schema = parseGdls(content);
      expect(schema.enums.length).toBeGreaterThan(0);
      expect(schema.enums[0].values.length).toBeGreaterThan(0);
    });
  });

  describe("index records (@META, @DOMAIN, @TABLES)", () => {
    const indexContent = [
      "# TPC-DS Schema Index",
      "@META S6|Fortune 500 (8 domains)|2000",
      "@DOMAIN sales|sales/schema.gdls|Store, catalog, and web sales|250",
      "@DOMAIN customer|customer/schema.gdls|Customer identity and demographics|150",
      "@TABLES sales|store_sales,store_returns,catalog_sales",
      "@TABLES customer|customer,customer_address,customer_demographics",
    ].join("\n");

    it("parses @META records", () => {
      const schema = parseGdls(indexContent);
      expect(schema.meta).toHaveLength(1);
      expect(schema.meta[0].tier).toBe("S6");
      expect(schema.meta[0].description).toBe("Fortune 500 (8 domains)");
      expect(schema.meta[0].tableCount).toBe(2000);
    });

    it("parses @DOMAIN records", () => {
      const schema = parseGdls(indexContent);
      expect(schema.domainRefs).toHaveLength(2);
      expect(schema.domainRefs[0].name).toBe("sales");
      expect(schema.domainRefs[0].path).toBe("sales/schema.gdls");
      expect(schema.domainRefs[0].description).toBe("Store, catalog, and web sales");
      expect(schema.domainRefs[0].tableCount).toBe(250);
      expect(schema.domainRefs[1].name).toBe("customer");
    });

    it("parses @TABLES records", () => {
      const schema = parseGdls(indexContent);
      expect(schema.tableLists).toHaveLength(2);
      expect(schema.tableLists[0].domain).toBe("sales");
      expect(schema.tableLists[0].tables).toEqual(["store_sales", "store_returns", "catalog_sales"]);
      expect(schema.tableLists[1].domain).toBe("customer");
      expect(schema.tableLists[1].tables).toHaveLength(3);
    });

    it("handles index file with no core records", () => {
      const schema = parseGdls(indexContent);
      expect(schema.domains).toHaveLength(0);
      expect(schema.tables).toHaveLength(0);
      expect(schema.relationships).toHaveLength(0);
    });
  });

  describe("escaped pipes", () => {
    it("handles escaped pipe in table description", () => {
      const content = [
        "@D ecommerce|Online store",
        "@T orders|Contains invoices \\| payments",
        "order_id|INT|N|PK|Primary key",
      ].join("\n");
      const result = parseGdls(content);
      expect(result.tables[0].description).toBe("Contains invoices | payments");
    });

    it("handles escaped pipe in column description", () => {
      const content = [
        "@D ecommerce|Online store",
        "@T orders|Orders table",
        "status|VARCHAR(20)|N||Active \\| Inactive \\| Pending",
      ].join("\n");
      const result = parseGdls(content);
      expect(result.tables[0].columns[0].description).toBe("Active | Inactive | Pending");
    });

    it("handles escaped pipe in @R description", () => {
      const content = [
        "@D ecommerce|Online store",
        "@T orders|Orders table",
        "order_id|INT|N|PK|Primary key",
        "@T items|Items table",
        "item_id|INT|N|PK|Primary key",
        "@R orders.order_id -> items.order_id|fk|Join \\| link",
      ].join("\n");
      const result = parseGdls(content);
      expect(result.relationships[0].description).toBe("Join | link");
    });
  });

  describe("@VERSION header", () => {
    it("parses @VERSION from GDLS content", () => {
      const content = [
        "# @VERSION spec:gdls v:0.2.0 generated:2026-02-15 source:db-introspect source-hash:abc123",
        "@D sales|Sales domain",
        "@T orders|Order records",
        "id|int|N|PK|Order identifier",
      ].join("\n");
      const schema = parseGdls(content);
      expect(schema.version).toBeDefined();
      expect(schema.version!.spec).toBe("gdls");
      expect(schema.version!.version).toBe("0.2.0");
      expect(schema.version!.source).toBe("db-introspect");
      expect(schema.version!.sourceHash).toBe("abc123");
    });

    it("returns undefined version when no @VERSION header", () => {
      const content = "@D sales|Sales domain\n@T orders|Orders";
      const schema = parseGdls(content);
      expect(schema.version).toBeUndefined();
    });
  });
});
