import { describe, expect, test } from "bun:test";

import { composerHeightFor } from "../../../src/index.ts";

describe("composerHeightFor", () => {
  test("defaults to one content row plus the border", () => {
    expect(composerHeightFor("")).toBe(3);
  });

  test("grows with explicit lines up to the maximum", () => {
    expect(composerHeightFor("1\n2\n3\n4")).toBe(6);
    expect(composerHeightFor("1\n2\n3\n4\n5\n6\n7")).toBe(8);
  });
});
