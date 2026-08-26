import { describe, expect, test } from "bun:test";

import { formatElapsed } from "../../../src/index.ts";
import {
  activityTipFor,
  activityTipTail,
  runStatusParts,
  runStatusSpinner,
  runStatusTail,
} from "../../../src/index.ts";

describe("formatElapsed", () => {
  test("mm:ss within the first hour", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(999)).toBe("00:00"); // 向下取整，不四舍五入
    expect(formatElapsed(61_000)).toBe("01:01");
    expect(formatElapsed(59 * 60_000 + 59_000)).toBe("59:59");
  });

  test("h:mm:ss once past an hour", () => {
    expect(formatElapsed(3_600_000)).toBe("1:00:00");
    expect(formatElapsed(3_600_000 + 6 * 60_000 + 33_000)).toBe("1:06:33");
    expect(formatElapsed(10 * 3_600_000)).toBe("10:00:00");
  });

  test("negative clamps to zero (clock skew guard)", () => {
    expect(formatElapsed(-5_000)).toBe("00:00");
  });
});

describe("runStatusTail", () => {
  const now = 1_000_000;

  test("label only", () => {
    expect(runStatusTail({ label: "thinking…" }, now)).toBe("thinking…");
  });

  test("label · elapsed · hint", () => {
    const item = { label: "Compacting context…", startedAt: now - 393_000, hint: "Esc to interrupt" };
    expect(runStatusParts(item, now)).toEqual(["Compacting context…", "06:33", "Esc to interrupt"]);
    expect(runStatusTail(item, now)).toBe("Compacting context… · 06:33 · Esc to interrupt");
  });

  test("hint without startedAt keeps single separator", () => {
    expect(runStatusTail({ label: "thinking…", hint: "Esc to interrupt" }, now)).toBe("thinking… · Esc to interrupt");
  });
});

describe("runStatusSpinner", () => {
  test("advances every 80ms and loops without negative indices", () => {
    expect(runStatusSpinner(0)).toBe("⠋");
    expect(runStatusSpinner(80)).toBe("⠙");
    expect(runStatusSpinner(800)).toBe("⠋");
    expect(runStatusSpinner(-1)).toBe("⠋");
  });
});

describe("activityTipFor", () => {
  test("rotates through the corpus and wraps around", () => {
    const tips = ["one", "two", "three"];
    expect(activityTipFor(tips, 0)).toBe("one");
    expect(activityTipFor(tips, 1)).toBe("two");
    expect(activityTipFor(tips, 3)).toBe("one");
    expect(activityTipFor(tips, 7)).toBe("two");
  });

  test("returns null without a corpus", () => {
    expect(activityTipFor([], 0)).toBeNull();
  });
});

describe("activityTipTail", () => {
  test("prefixes and fits within budget", () => {
    expect(activityTipTail("short", 40)).toBe(" · Tip: short");
  });

  test("truncates with an ellipsis when over budget", () => {
    const tail = activityTipTail("a fairly long tip that will not fit", 20);
    expect(tail).toBe(" · Tip: a fairly lo…");
    expect(tail?.endsWith("…")).toBe(true);
  });

  test("returns null when the budget cannot hold even a stub", () => {
    expect(activityTipTail("anything", 10)).toBeNull();
  });
});
