import { describe, it, expect } from "vitest";
import { findLogMatches, matchKey } from "../lib/logSearch";

const lines = [
  { id: 1, text: "Error: connection refused" },
  { id: 2, text: "retrying" },
  { id: 3, text: "error error ERROR" },
];

describe("findLogMatches", () => {
  it("returns nothing for an empty query", () => {
    expect(findLogMatches(lines, "", false)).toEqual([]);
  });

  it("matches case-insensitively by default, in display order", () => {
    const found = findLogMatches(lines, "error", false);
    expect(found.map(matchKey)).toEqual(["1:0", "3:0", "3:6", "3:12"]);
    expect(found[0].end).toBe(5);
  });

  it("respects case sensitivity", () => {
    expect(findLogMatches(lines, "ERROR", true).map(matchKey)).toEqual(["3:12"]);
  });

  it("treats the query literally and does not overlap matches", () => {
    expect(findLogMatches([{ id: 0, text: "a.b axb" }], ".", false)).toHaveLength(1);
    expect(findLogMatches([{ id: 0, text: "aaaa" }], "aa", false).map(matchKey)).toEqual([
      "0:0",
      "0:2",
    ]);
  });
});
