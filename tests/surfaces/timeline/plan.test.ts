import { describe, expect, test } from "bun:test";

import { planWindow } from "../../../src/index.ts";
import type { PlanEntry } from "../../../src/index.ts";

function entries(statuses: Array<PlanEntry["status"]>): PlanEntry[] {
  return statuses.map((status, index) => ({ content: `step ${index}`, status }));
}

describe("planWindow", () => {
  test("short plan passes through untouched", () => {
    const plan = entries(["completed", "in_progress", "pending"]);
    expect(planWindow(plan, 8)).toEqual({ items: plan, before: 0, after: 0 });
  });

  test("long plan windows around the first unfinished entry with one line of context", () => {
    const plan = entries([
      ...Array(6).fill("completed"),
      "in_progress",
      ...Array(5).fill("pending"),
    ] as Array<PlanEntry["status"]>);
    const window = planWindow(plan, 4);
    // 第一个未完成项是 index 6，窗口从它前一项（index 5）开始
    expect(window.before).toBe(5);
    expect(window.items[0]?.content).toBe("step 5");
    expect(window.items[1]?.status).toBe("in_progress");
    expect(window.after).toBe(3);
  });

  test("all-completed long plan keeps the tail visible", () => {
    const plan = entries(Array(10).fill("completed") as Array<PlanEntry["status"]>);
    const window = planWindow(plan, 4);
    expect(window.items[window.items.length - 1]?.content).toBe("step 9");
    expect(window.before).toBe(6);
    expect(window.after).toBe(0);
  });
});
