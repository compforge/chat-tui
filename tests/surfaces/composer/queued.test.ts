import { describe, expect, test } from "bun:test";

import { queueActionAvailable, queuedPreview } from "../../../src/index.ts";

describe("queuedPreview", () => {
  test("single line gets arrow prefix", () => {
    expect(queuedPreview("hello")).toBe("  ↳ hello");
  });

  test("multi line indents continuations and folds beyond 3 lines", () => {
    expect(queuedPreview("a\nb\nc\nd")).toBe("  ↳ a\n    b\n    c…");
  });
});

describe("queueActionAvailable", () => {
  test("uses harness-supplied item capabilities", () => {
    const item = {
      id: "m_1",
      text: "follow up",
      actions: ["recall", "move-up"] as const,
    };
    expect(queueActionAvailable(item, "recall")).toBe(true);
    expect(queueActionAvailable({ ...item, actions: ["cancel"] }, "cancel")).toBe(true);
    expect(queueActionAvailable(item, "dispatch-now")).toBe(false);
  });

  test("keeps items without capabilities read-only", () => {
    expect(
      queueActionAvailable({ id: "m_plugin", text: "plugin request" }, "discard"),
    ).toBe(false);
  });
});
