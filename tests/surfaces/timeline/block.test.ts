import { describe, expect, test } from "bun:test";

import { blockStatus } from "../../../src/index.ts";
import { defaultTheme as t } from "../../../src/index.ts";

describe("blockStatus dual axis (outcome × tone)", () => {
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

  test("warning tone overrides color but keeps the outcome icon (not masked to ⚠)", () => {
    const done = blockStatus("completed", "warning", "tool", t);
    expect(done.icon).toBe("✓"); // 结果仍是完成，不被遮成 ⚠
    expect(done.color).toBe(t.warning); // tone 只改颜色
    // pending + warning：icon 仍是 outcome 的 ○，颜色被 tone 覆盖
    expect(blockStatus("pending", "warning", "tool", t)).toEqual({ icon: "○", color: t.warning });
  });

  test("pending/in_progress have no inherent color — it follows kind", () => {
    expect(blockStatus("pending", undefined, "thought", t).color).toBe(t.dim);
    expect(blockStatus("pending", undefined, "plan", t).color).toBe(t.plan);
    expect(blockStatus("in_progress", undefined, "tool", t).color).toBe(t.tool);
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
