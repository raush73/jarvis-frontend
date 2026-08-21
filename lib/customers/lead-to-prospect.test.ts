import { describe, expect, it } from "vitest";
import {
  isPromoteToProspectActionVisible,
  parseJarvisApiError,
} from "./lead-to-prospect";

describe("Promote to Prospect action visibility", () => {
  it("shows only for LEAD lifecycle", () => {
    expect(isPromoteToProspectActionVisible("LEAD")).toBe(true);
    expect(isPromoteToProspectActionVisible("PROSPECT")).toBe(false);
    expect(isPromoteToProspectActionVisible("CUSTOMER")).toBe(false);
    expect(isPromoteToProspectActionVisible(null)).toBe(false);
  });
});

describe("parseJarvisApiError", () => {
  it("extracts Nest message JSON from apiFetch errors", () => {
    const err = new Error(
      'API 403 Forbidden: {"statusCode":403,"message":"This Lead is assigned to another salesperson and cannot be promoted by you. Ask a manager to reassign it if needed.","error":"Forbidden"}',
    );
    expect(parseJarvisApiError(err, "fallback")).toContain(
      "assigned to another salesperson",
    );
  });
});
