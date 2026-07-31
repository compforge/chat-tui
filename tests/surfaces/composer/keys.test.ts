import { describe, expect, test } from "bun:test";

import { CTRL_C_CONFIRM_WINDOW_MS, ctrlCAction } from "../../../src/index.ts";

describe("ctrlCAction", () => {
  test("draft present: clear it", () => {
    expect(ctrlCAction({ hasDraft: true, armedAt: 0, now: 1000 })).toBe("clear-draft");
  });

  test("empty composer: arm first, exit within confirm window", () => {
    const now = 10_000;
    expect(ctrlCAction({ hasDraft: false, armedAt: 0, now })).toBe("arm-exit");
    expect(ctrlCAction({ hasDraft: false, armedAt: now, now: now + CTRL_C_CONFIRM_WINDOW_MS - 1 })).toBe("exit");
    expect(ctrlCAction({ hasDraft: false, armedAt: now, now: now + CTRL_C_CONFIRM_WINDOW_MS + 1 })).toBe("arm-exit");
  });

  test("clearing a draft arms the second Ctrl+C to exit", () => {
    const now = 10_000;
    expect(ctrlCAction({ hasDraft: true, armedAt: 0, now })).toBe("clear-draft");
    expect(ctrlCAction({ hasDraft: false, armedAt: now, now: now + 1 })).toBe("exit");
  });
});
