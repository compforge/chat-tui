import { describe, expect, test } from "bun:test";

import { clipLines, defaultClipPolicy, hiddenHint } from "../../../src/index.ts";
import { displayWidth, ellipsize, sanitizeLine, wrapLine } from "../../../src/index.ts";

describe("displayWidth", () => {
  test("ascii counts 1 per char", () => {
    expect(displayWidth("hello")).toBe(5);
  });
  test("cjk counts 2 per char", () => {
    expect(displayWidth("你好")).toBe(4);
    expect(displayWidth("a你b")).toBe(4);
  });
  test("combining marks count 0", () => {
    expect(displayWidth("é")).toBe(1);
  });
});

describe("sanitizeLine", () => {
  test("strips ansi color codes", () => {
    expect(sanitizeLine("[31mred[0m")).toBe("red");
  });
  test("expands tabs", () => {
    expect(sanitizeLine("a\tb")).toBe("a    b");
  });
});

describe("wrapLine", () => {
  test("returns line as-is when it fits", () => {
    expect(wrapLine("short", 10)).toEqual(["short"]);
  });
  test("breaks at word boundary", () => {
    expect(wrapLine("aaa bbb ccc", 7)).toEqual(["aaa bbb", "ccc"]);
  });
  test("hard-breaks a word longer than width", () => {
    expect(wrapLine("abcdefgh", 3)).toEqual(["abc", "def", "gh"]);
  });
  test("wraps by display width for cjk", () => {
    expect(wrapLine("你好你好", 4)).toEqual(["你好", "你好"]);
  });
  test("width <= 0 disables wrapping", () => {
    expect(wrapLine("whatever long line", 0)).toEqual(["whatever long line"]);
  });
});

describe("clipLines", () => {
  const lines = Array.from({ length: 10 }, (_, index) => `line-${index}`);

  test("no clip when within budget", () => {
    const result = clipLines(lines.slice(0, 3), 80, { maxRows: 5, keep: "tail" });
    expect(result.head).toEqual(["line-0", "line-1", "line-2"]);
    expect(result.tail).toEqual([]);
    expect(result.hiddenRows).toBe(0);
  });

  test("tail keep reserves one row for the hint", () => {
    const result = clipLines(lines, 80, { maxRows: 5, keep: "tail" });
    expect(result.head).toEqual([]);
    expect(result.tail).toEqual(["line-6", "line-7", "line-8", "line-9"]);
    expect(result.hiddenRows).toBe(6);
  });

  test("head keep", () => {
    const result = clipLines(lines, 80, { maxRows: 5, keep: "head" });
    expect(result.head).toEqual(["line-0", "line-1", "line-2", "line-3"]);
    expect(result.tail).toEqual([]);
    expect(result.hiddenRows).toBe(6);
  });

  test("head-tail keeps more head than tail on odd budget", () => {
    const result = clipLines(lines, 80, { maxRows: 6, keep: "head-tail" });
    expect(result.head).toEqual(["line-0", "line-1", "line-2"]);
    expect(result.tail).toEqual(["line-8", "line-9"]);
    expect(result.hiddenRows).toBe(5);
  });

  test("budget counts visual rows after wrapping, not logical lines", () => {
    // 一条 100 列的 logical line 在 width=10 下占 10 个视觉行
    const long = ["x".repeat(100)];
    const result = clipLines(long, 10, { maxRows: 5, keep: "tail" });
    expect(result.tail).toHaveLength(4);
    expect(result.hiddenRows).toBe(6);
  });

  test("maxRows 1 shows hint only", () => {
    const result = clipLines(lines, 80, { maxRows: 1, keep: "tail" });
    expect(result.head).toEqual([]);
    expect(result.tail).toEqual([]);
    expect(result.hiddenRows).toBe(10);
  });
});

describe("defaultClipPolicy", () => {
  const tool = { kind: "tool", status: "completed" as const };

  test("plan is never clipped", () => {
    expect(defaultClipPolicy({ ...tool, kind: "plan" }, { type: "plan", entries: [] })).toBeNull();
  });
  test("diff is never clipped", () => {
    expect(defaultClipPolicy(tool, { type: "diff", op: "modify", path: "src/a.ts" })).toBeNull();
  });
  test("command and code keep head", () => {
    expect(defaultClipPolicy(tool, { type: "command", command: "ls" })).toEqual({ maxRows: 3, keep: "head" });
    expect(defaultClipPolicy(tool, { type: "code", code: "x", language: "ts" })).toEqual({ maxRows: 3, keep: "head" });
  });
  test("running output follows tail, completed keeps head-tail", () => {
    const running = { kind: "tool", status: "in_progress" as const };
    expect(defaultClipPolicy(running, { type: "output", lines: [] })).toEqual({ maxRows: 5, keep: "tail" });
    expect(defaultClipPolicy(tool, { type: "output", lines: [] })).toEqual({ maxRows: 5, keep: "head-tail" });
  });
  test("thought gets a tighter budget", () => {
    const thought = { kind: "thought", status: "in_progress" as const };
    expect(defaultClipPolicy(thought, { type: "text", text: "" })).toEqual({ maxRows: 3, keep: "tail" });
  });
});

describe("hiddenHint", () => {
  test("mentions count and expand key", () => {
    expect(hiddenHint(42)).toBe("… +42 lines (ctrl+o to expand)");
  });
});

describe("ellipsize", () => {
  test("fits: returned as-is", () => {
    expect(ellipsize("hello", 10)).toBe("hello");
    expect(ellipsize("hello", 5)).toBe("hello");
  });

  test("too long: truncates and always leaves the … so the cut is visible", () => {
    expect(ellipsize("hello world", 8)).toBe("hello w…");
    expect(displayWidth(ellipsize("hello world", 8))).toBeLessThanOrEqual(8);
  });

  test("counts display width, not chars (CJK is 2 wide)", () => {
    // "你好世界" = 8 列；截到 5 列 → 只放得下 2 个汉字 + …
    expect(ellipsize("你好世界", 5)).toBe("你好…");
    expect(displayWidth(ellipsize("你好世界", 5))).toBeLessThanOrEqual(5);
  });

  test("degenerate widths", () => {
    expect(ellipsize("abc", 0)).toBe("");
    expect(ellipsize("abc", 1)).toBe("…");
  });
});
