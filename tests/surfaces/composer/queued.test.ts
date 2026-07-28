import { describe, expect, test } from "bun:test";

import { queuedPreview } from "../../../src/index.ts";

describe("queuedPreview", () => {
  test("single line gets arrow prefix", () => {
    expect(queuedPreview("hello")).toBe("  ↳ hello");
  });

  test("multi line indents continuations and folds beyond 3 lines", () => {
    expect(queuedPreview("a\nb\nc\nd")).toBe("  ↳ a\n    b\n    c\n    …");
  });
});
