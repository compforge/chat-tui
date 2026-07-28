import type { Theme } from "../../theme.ts";

/** 已知 outcome → icon。不在表内即"未知"，走独立待遇（见 blockStatus）。 */
const OUTCOME_ICON: Record<string, string> = {
  failed: "✗",
  declined: "⊘",
  completed: "✓",
  pending: "○",
  in_progress: "•",
};

/** 显示待遇：icon + color；`note` 只在 status 无法识别时给出，供排查（正常块无此字段）。 */
export interface BlockStatusDisplay {
  icon: string;
  color: string;
  /** 未知 status 的排查线索（含原始值）；渲染层弱化显示在标题后 */
  note?: string;
}

/** 无固有色的 outcome（pending / in_progress / 未知）跟 kind 走：思考是氛围信息故弱化，计划有自己的色。 */
function kindColor(kind: string, theme: Theme): string {
  const byKind: Record<string, string> = { thought: theme.dim, plan: theme.plan };
  return byKind[kind] ?? theme.tool;
}

/** outcome → color：有结局的三态各有其色；pending / in_progress 无固有色，交给 kind 决定。 */
function outcomeColor(status: string, kind: string, theme: Theme): string {
  const byOutcome: Record<string, string> = {
    failed: theme.error,
    declined: theme.warning,
    completed: theme.success,
  };
  return byOutcome[status] ?? kindColor(kind, theme);
}

/**
 * activity block 的两根正交展示轴合成一次显示待遇（icon + color）：
 * - **outcome**（`status`）：块的结果/生命周期，恒决定 **icon**（✓ 完成 / ✗ 失败 / ⊘ 拒批 / ○ 待定 / • 进行中）。
 * - **tone**（`tone`）：正交的"注意/留痕"轴，只覆盖 **color**——`warning` 用警示色。
 *
 * 关键：tone 只改颜色、不改 icon。所以 completed+warning = ✓（结果仍是完成，不被遮成 ⚠）+ 警示色，
 * 而不是把结果丢成一个 warning——outcome 与 tone 各说各的，互不吞没。
 *
 * **未知 status 不静默**：`status` 是开放 string（容忍 wire 漂移），但认不出来时**不能**伪装成
 * 进行中——那会和真 in_progress 长得一模一样，问题永远浮不出来。改为独立待遇（? + 警示色）并把
 * 原始值放进 `note` 供排查：能识别才画成它本来的样子，认不出就明说认不出。
 *
 * 两根轴都用**查表 + 兜底**而非条件链：新增一个 outcome 只是加一行，也免得嵌套三元把"谁决定 icon、
 * 谁决定 color"这条合成规则糊成一坨。
 */
export function blockStatus(
  status: string,
  tone: string | undefined,
  kind: string,
  theme: Theme,
): BlockStatusDisplay {
  const icon = OUTCOME_ICON[status];
  if (icon === undefined) {
    return { icon: "?", color: theme.warning, note: `unknown status: ${status}` };
  }
  return {
    icon,
    color: tone === "warning" ? theme.warning : outcomeColor(status, kind, theme),
  };
}
