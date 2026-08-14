import type { Theme } from "../../theme.ts";

/** 已知 outcome → icon。不在表内即"未知"，走独立待遇（见 blockStatus）。 */
const OUTCOME_ICON: Record<string, string> = {
  failed: "✗",
  declined: "⊘",
  completed: "✓",
  pending: "○",
  in_progress: "•",
};

/** 显示待遇：outcome icon + color + 可选 tone icon；未知 status 额外带排查 note。 */
export interface BlockStatusDisplay {
  icon: string;
  color: string;
  /** tone 的独立图标，不覆盖 outcome 图标或 author 颜色 */
  toneIcon?: string;
  /** 未知 status 的排查线索（含原始值）；渲染层弱化显示在标题后 */
  note?: string;
}

/** 无固有色的 outcome 跟 kind 走：思考有 author 时用 harness 认色，否则弱化；计划有自己的色。 */
function kindColor(kind: string, author: string | undefined, theme: Theme): string {
  if (kind === "thought" && author !== undefined) {
    return theme.agentColorFor?.(author) ?? theme.agent;
  }
  const byKind: Record<string, string> = { thought: theme.dim, plan: theme.plan };
  return byKind[kind] ?? theme.tool;
}

/** outcome → color：有 author 的 thought 始终用 harness 认色，其余块保留状态/kind 配色。 */
function outcomeColor(status: string, kind: string, author: string | undefined, theme: Theme): string {
  if (kind === "thought" && author !== undefined) {
    return kindColor(kind, author, theme);
  }
  const byOutcome: Record<string, string> = {
    failed: theme.error,
    declined: theme.warning,
    completed: theme.success,
  };
  return byOutcome[status] ?? kindColor(kind, author, theme);
}

/**
 * activity block 的展示轴合成一次显示待遇（icon + color）：
 * - **outcome**（`status`）：块的结果/生命周期，恒决定 **icon**（✓ 完成 / ✗ 失败 / ⊘ 拒批 / ○ 待定 / • 进行中）。
 * - **tone**（`tone`）：正交的"注意/留痕"轴，用独立的 warning 色 `!` 表达。
 * - **author**（`author`）：为 thought 块提供 harness 认色，不再被 outcome 或 tone 抢占。
 *
 * 关键：completed+warning = `✓ !`，结果、归属与警示各说各的，互不吞没。
 *
 * **未知 status 不静默**：`status` 是开放 string（容忍 wire 漂移），但认不出来时**不能**伪装成
 * 进行中——那会和真 in_progress 长得一模一样，问题永远浮不出来。改为独立的 `?`（无 author 时用警示色）并把
 * 原始值放进 `note` 供排查：能识别才画成它本来的样子，认不出就明说认不出。
 *
 * 各轴都用**查表 + 兜底**而非条件链：新增一个 outcome 只是加一行，也免得嵌套三元把"谁决定 icon、
 * 谁决定 color"这条合成规则糊成一坨。
 */
export function blockStatus(
  status: string,
  tone: string | undefined,
  kind: string,
  theme: Theme,
  author?: string,
): BlockStatusDisplay {
  const icon = OUTCOME_ICON[status];
  if (icon === undefined) {
    return {
      icon: "?",
      color: kind === "thought" && author !== undefined
        ? kindColor(kind, author, theme)
        : theme.warning,
      toneIcon: tone === "warning" ? "!" : undefined,
      note: `unknown status: ${status}`,
    };
  }
  return {
    icon,
    color: outcomeColor(status, kind, author, theme),
    toneIcon: tone === "warning" ? "!" : undefined,
  };
}
