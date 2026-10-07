import { describe, expect, it } from "vitest";
import { parseFormSchema } from "../../worker/schema";
import { newRule, rulesForType, ruleSummary } from "./schema-rules";

describe("validation editor catalog", () => {
  for (const type of ["string", "number", "boolean"] as const) {
    it(`offers valid backend configurations for every ${type} check`, () => {
      for (const definition of rulesForType(type)) {
        const rule = newRule(definition);
        expect(
          () => parseFormSchema([{ name: "value", type, rules: [rule] }]),
          definition.check,
        ).not.toThrow();
        for (const option of definition.options ?? []) {
          for (const value of option.choices ??
            (option.type === "boolean"
              ? [true, false]
              : option.type === "number"
                ? [0]
                : [option.key === "flags" ? "im" : "HS256"])) {
            expect(
              () =>
                parseFormSchema([
                  {
                    name: "value",
                    type,
                    rules: [{ ...rule, options: { [option.key]: value } }],
                  },
                ]),
              `${definition.check}.${option.key}=${value}`,
            ).not.toThrow();
          }
        }
      }
    });
  }
  it("keeps false and zero visible in collapsed summaries", () => {
    expect(ruleSummary("boolean", { check: "equals", value: false })).toBe(
      "Must equal: false",
    );
    expect(ruleSummary("number", { check: "min", value: 0 })).toBe(
      "Minimum (inclusive): 0",
    );
    expect(rulesForType("enum")).toEqual([]);
    expect(rulesForType("scalar")).toEqual([]);
  });
});
