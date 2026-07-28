import { wrapLine } from "../../../terminal/text.ts";
import { overlayCardHeight, overlayCardWidth } from "./overlay.ts";

export interface ApprovalCardLayout {
  width: number;
  height: number;
  detailRows: number;
  actionRows: number;
}

interface ApprovalCardLayoutInput {
  terminalWidth: number;
  terminalHeight: number;
  anchorBottom: number;
  detail: string;
  optionCount: number;
}

/** 审批卡对统一浮层预算的实例化：动作必须先占到可交互空间，详情只能用剩余高度。 */
export function approvalCardLayout(input: ApprovalCardLayoutInput): ApprovalCardLayout {
  const width = overlayCardWidth({ terminalWidth: input.terminalWidth, minWidth: 20, maxWidth: 96 });
  const contentWidth = Math.max(1, width - 2); // 减两侧边框
  const neededDetailRows = input.detail
    .split("\n")
    .flatMap((line) => wrapLine(line, contentWidth)).length;
  const budget = overlayCardHeight({
    terminalHeight: input.terminalHeight,
    reservedRows: input.anchorBottom + 1, // 锚定偏移 + 顶部 1 行留白
    chromeRows: 2, // 上下边框
    actionRowsWanted: input.optionCount,
    detailRowsWanted: neededDetailRows,
    minDetailRows: 1, // 详情至少露 1 行，scrollbox 内可滚动看全量
    minHeight: 4,
  });

  return {
    width,
    height: budget.height,
    detailRows: budget.detailRows,
    actionRows: budget.actionRows,
  };
}
