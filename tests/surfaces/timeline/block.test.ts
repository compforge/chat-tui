import { describe, expect, test } from "bun:test";

import { blockStatus } from "../../../src/index.ts";
import { defaultTheme as t } from "../../../src/index.ts";

describe("blockStatus display axes (outcome × tone × author)", () => {
  test("icon comes from outcome (status)", () => {
    expect(blockStatus("failed", undefined, "tool", t).icon).toBe("✗");
    expect(blockStatus("declined", undefined, "tool", t).icon).toBe("⊘");
    expect(blockStatus("completed", undefined, "tool", t).icon).toBe("✓");
    expect(blockStatus("pending", undefined, "tool", t).icon).toBe("○");
    expect(blockStatus("in_progress", undefined, "tool", t).icon).toBe("•");
  });

  test("outcome color: failed→error, declined→warning, completed→success", () => {
    expect(blockStatus("failed", undefined, "tool", t).color).toBe(t.error);
    expect(blockStatus("declined", undefined, "tool", t).color).toBe(t.warning);
    expect(blockStatus("completed", undefined, "tool", t).color).toBe(t.success);
  });

  test("warning tone adds its own icon without overriding outcome color", () => {
    const done = blockStatus("completed", "warning", "tool", t);
    expect(done).toEqual({ icon: "✓", color: t.success, toneIcon: "!" });
    expect(blockStatus("pending", "warning", "tool", t)).toEqual({
      icon: "○",
      color: t.tool,
      toneIcon: "!",
    });
  });

  test("pending/in_progress have no inherent color — it follows kind", () => {
    expect(blockStatus("pending", undefined, "thought", t).color).toBe(t.dim);
    expect(blockStatus("pending", undefined, "plan", t).color).toBe(t.plan);
    expect(blockStatus("in_progress", undefined, "tool", t).color).toBe(t.tool);
  });

  test("thought status follows its author color", () => {
    const theme = {
      ...t,
      agentColorFor: (author: string) => author === "claude" ? "#claude" : undefined,
    };
    expect(blockStatus("completed", undefined, "thought", theme, "claude").color).toBe("#claude");
    expect(blockStatus("in_progress", undefined, "thought", theme, "claude").color).toBe("#claude");
    expect(blockStatus("completed", undefined, "thought", theme, "unknown").color).toBe(t.agent);
  });

  test("thought author color remains stable across outcomes and warning tone", () => {
    const theme = { ...t, agentColorFor: () => "#author" };
    expect(blockStatus("failed", undefined, "thought", theme, "claude").color).toBe("#author");
    expect(blockStatus("declined", undefined, "thought", theme, "claude").color).toBe("#author");
    expect(blockStatus("completed", "warning", "thought", theme, "claude")).toEqual({
      icon: "✓",
      color: "#author",
      toneIcon: "!",
    });
  });

  test("unknown status is surfaced, never silently disguised as in_progress", () => {
    // 静默落成 • 会和真 in_progress 长得一模一样，问题永远浮不出来 → 独立待遇 + 带出原始值
    const unknown = blockStatus("some_future_status", undefined, "tool", t);
    expect(unknown.icon).toBe("?");
    expect(unknown.icon).not.toBe(blockStatus("in_progress", undefined, "tool", t).icon);
    expect(unknown.color).toBe(t.warning);
    expect(unknown.note).toBe("unknown status: some_future_status");
    // 已知 status 不带 note，正常块不受打扰
    expect(blockStatus("completed", undefined, "tool", t).note).toBeUndefined();
  });
});
