import { describe, expect, test } from "bun:test";

import { diffRows, diffStats } from "../../../src/index.ts";

const MODIFY_PATCH = [
  "--- src/a.ts",
  "+++ src/a.ts",
  "@@ -1,4 +1,4 @@",
  " const a = 1;",
  "-const b = 2;",
  "-const c = 3;",
  "+const b = 20;",
  " const d = 4;",
  "",
].join("\n");

const TWO_HUNK_PATCH = [
  "--- src/a.ts",
  "+++ src/a.ts",
  "@@ -1,2 +1,2 @@",
  "-old",
  "+new",
  "@@ -10,2 +10,3 @@",
  " keep",
  "+added",
  "\\ No newline at end of file",
].join("\n");

describe("diffRows", () => {
  test("unified 只计 hunk 行，不计 ---/+++/@@ 头与尾部空行", () => {
    // 1 context + 2 removed + 1 added + 1 context
    expect(diffRows(MODIFY_PATCH, "unified")).toBe(5);
  });

  test("split 视图连续 -/+ 段并排，取两侧较大者", () => {
    // context(1) + max(2 removed, 1 added)=2 + context(1)
    expect(diffRows(MODIFY_PATCH, "split")).toBe(4);
  });

  test("多 hunk 累加，\\ No newline 标记不占行", () => {
    expect(diffRows(TWO_HUNK_PATCH, "unified")).toBe(4);
    // hunk1: max(1,1)=1；hunk2: context 1 + added 1
    expect(diffRows(TWO_HUNK_PATCH, "split")).toBe(3);
  });

  test("空上下文行（无前导空格）按 context 计", () => {
    const patch = ["--- a", "+++ a", "@@ -1,3 +1,3 @@", " x", "", "-y", "+z"].join("\n");
    expect(diffRows(patch, "unified")).toBe(4);
    expect(diffRows(patch, "split")).toBe(3);
  });

  test("空 patch 至少占 1 行（渲染层高度不为 0）", () => {
    expect(diffRows("", "unified")).toBe(1);
    expect(diffRows("--- a\n+++ a", "split")).toBe(1);
  });
});

describe("diffStats", () => {
  test("统计 hunk 内的增删行", () => {
    expect(diffStats(MODIFY_PATCH)).toEqual({ added: 1, removed: 2 });
    expect(diffStats(TWO_HUNK_PATCH)).toEqual({ added: 2, removed: 1 });
  });

  test("hunk 外的 +/- 头行不计入", () => {
    expect(diffStats("--- a\n+++ a")).toEqual({ added: 0, removed: 0 });
  });
});
