// transcript 的高度预算层（纯函数核心）：把"协议给的全量内容"按视觉行裁剪成"预算内的展示形状"。
//
// 设计取舍（对齐 Codex / pi / OpenCode 的调研结论）：
// - 预算以**视觉行**（按终端宽度 wrap 之后的行）计，不是原始行数/字符数——否则一条超长
//   logical line 在窄窗口下仍能占满整个视口（Codex render.rs 的 "wrap first" 原则）。
// - 被裁剪的内容 wrap 由本模块负责而不是交给 opentui：产出的行都不超过 wrap 宽度，渲染层
//   不会二次 wrap，"所见行数 == 预算行数"由构造保证；宽度估算偏差只导致行提前/延后折断，
//   不破坏高度预算的量级。
// - 裁剪只发生在展示层：协议照传全量，harness 的 session 存储与完整历史不受影响。

import type {
  TranscriptBlockContent,
  TranscriptBlockStatus,
} from "../../state/timeline.ts";
import { sanitizeLine, wrapLine } from "../../terminal/text.ts";

/** 保留方向：head=看开头（命令/diff 场景），tail=跟尾部（运行中日志），head-tail=头尾各留（上下文在头、错误在尾） */
export type ClipKeep = "head" | "tail" | "head-tail";

export interface ClipBudget {
  /** 该段内容最终占用的视觉行数硬上限（含省略提示行） */
  maxRows: number;
  keep: ClipKeep;
}

/** 裁剪结果：head 与 tail 之间由渲染层插入省略提示行；hiddenRows === 0 时全部内容在 head 中 */
export interface ClipResult {
  head: string[];
  tail: string[];
  /** 被隐藏的视觉行数（提示行文案用；随终端宽度变化是预期行为，pi 同款） */
  hiddenRows: number;
}

/**
 * 裁剪策略：按 (block 形态, content 类型) 给出预算；返回 null 表示该段内容永不裁剪。
 * 走注入而不是内置（与 theme / commands 同风格）：chat-tui 只提供 defaultClipPolicy，
 * 接入方可整体替换，或包装它覆盖个别 case。展开态（Ctrl+O）由渲染层处理，策略无需感知。
 */
export type ClipPolicy = (
  item: { kind: string; status: TranscriptBlockStatus },
  content: TranscriptBlockContent,
) => ClipBudget | null;

/**
 * 默认预算，取三家产品的收敛值：
 * - 输出类 5 行（Codex TOOL_CALL_MAX_LINES=5 / pi BASH_PREVIEW_LINES=5）；
 *   运行中跟尾部（持续追最新日志），结束后头尾各留（命令上下文在头、错误在尾，
 *   Codex truncate_lines_middle 同款）。
 * - command/code 3 行看头（Codex 命令续行 2 行 + 标题行的量级）。
 * - diff 永不裁剪：文件改动本身就是工具结果，完整展开与 Codex 原生体验一致；
 *   transcript 的滚动区负责承接高度，不把关键改动藏到额外交互后。
 * - plan 永不裁剪：计划就是要一眼看全的东西。
 * - thought 3 行：氛围信息，密度优先。
 */
export const defaultClipPolicy: ClipPolicy = (item, content) => {
  if (content.type === "plan") return null;
  if (content.type === "code" || content.type === "command") return { maxRows: 3, keep: "head" };
  if (content.type === "diff") return null;
  if (item.kind === "thought") {
    return { maxRows: 3, keep: item.status === "in_progress" ? "tail" : "head" };
  }
  const running = item.status === "in_progress" || item.status === "pending";
  return { maxRows: 5, keep: running ? "tail" : "head-tail" };
};

/** 省略提示行文案；渲染层负责配色（dim）与缩进。unit 用 lines：对用户"行"比"视觉行"更直觉 */
export function hiddenHint(hiddenRows: number): string {
  return `… +${hiddenRows} lines (ctrl+o to expand)`;
}

/**
 * 核心入口：logical lines → 清洗 + wrap 成视觉行 → 按预算裁剪。
 * 超预算时预留 1 行给省略提示，所以 maxRows 是该段占用视觉行数的硬上限。
 */
export function clipLines(lines: string[], width: number, budget: ClipBudget): ClipResult {
  const visual = lines.flatMap((line) => wrapLine(sanitizeLine(line), width));
  if (visual.length <= budget.maxRows) return { head: visual, tail: [], hiddenRows: 0 };
  const avail = Math.max(0, budget.maxRows - 1); // 预留提示行
  let head: string[] = [];
  let tail: string[] = [];
  if (budget.keep === "head") {
    head = visual.slice(0, avail);
  } else if (budget.keep === "tail") {
    tail = avail > 0 ? visual.slice(-avail) : [];
  } else {
    // 头略多于尾：头部是"这是什么"（命令/标题），比尾部多一行更值
    const headRows = Math.ceil(avail / 2);
    const tailRows = avail - headRows;
    head = visual.slice(0, headRows);
    tail = tailRows > 0 ? visual.slice(-tailRows) : [];
  }
  return { head, tail, hiddenRows: visual.length - head.length - tail.length };
}
