// 底部锚定浮层卡片的统一布局预算：终端尺寸进 → 卡片 width/height 与各区行数预算出。
// 概念约束（所有浮层卡片共守）：
//   1. 操作/选项行优先保底——卡片再挤也要留出可交互空间；
//   2. 详情区只能使用剩余高度；
//   3. 截断必须留痕，不允许内容静默消失（clipDetail 的 hiddenCount 由调用方渲染成提示行）。
// approval.ts / question.ts 是本概念在两张卡上的实例化；Picker 是潜在的未来消费方。

export interface OverlayCardWidthInput {
  terminalWidth: number;
  minWidth: number;
  maxWidth: number;
}

/** 卡片宽度：跟终端走（左右各留 2 列锚定边距），再按卡片自身的密度需求夹取上下限。 */
export function overlayCardWidth(input: OverlayCardWidthInput): number {
  return Math.max(input.minWidth, Math.min(input.maxWidth, input.terminalWidth - 4));
}

export interface OverlayCardHeightInput {
  terminalHeight: number;
  /** 卡片外必须让出的行数（锚定偏移 + 顶部留白），available = terminalHeight - reservedRows。 */
  reservedRows: number;
  /** 边框、标题下固定文案等非弹性行数。 */
  chromeRows: number;
  /** 操作/选项区想要的行数（优先保底，最少 1 行——没有可选项也要给失败态文案留位置）。 */
  actionRowsWanted: number;
  /** 详情区想要的行数（含留痕行；只能分到操作区保底后的剩余）。 */
  detailRowsWanted: number;
  /** 详情区保底行数；0 表示详情可完全让位给操作区。 */
  minDetailRows: number;
  /** 卡片高度下限，同时也是 available 的下限（终端矮到极限时卡片宁可越界也保持可用）。 */
  minHeight: number;
}

export interface OverlayCardHeightBudget {
  height: number;
  actionRows: number;
  detailRows: number;
}

/** 高度预算：操作行先占位，详情分剩余，总高不超过锚定后的可用空间。 */
export function overlayCardHeight(input: OverlayCardHeightInput): OverlayCardHeightBudget {
  const available = Math.max(input.minHeight, input.terminalHeight - input.reservedRows);
  const actionRows = Math.min(
    Math.max(1, input.actionRowsWanted),
    Math.max(1, available - input.chromeRows - input.minDetailRows),
  );
  const detailRows = Math.min(
    Math.max(input.minDetailRows, input.detailRowsWanted),
    Math.max(input.minDetailRows, available - actionRows - input.chromeRows),
  );
  return {
    height: Math.min(available, Math.max(input.minHeight, input.chromeRows + actionRows + detailRows)),
    actionRows,
    detailRows,
  };
}

export interface DetailClip {
  /** 展示的详情行。 */
  lines: string[];
  /** 被截掉的行数；>0 时调用方必须渲染留痕行（如 "… +N more lines"），不许静默吞。 */
  hiddenCount: number;
  /** 详情区总行数预算（可见行 + 留痕行），直接喂给 overlayCardHeight.detailRowsWanted。 */
  rows: number;
}

/** 详情行截断（带留痕预算）：超出 maxRows 的部分折叠成一行提示的空间。 */
export function clipDetail(lines: string[], maxRows: number): DetailClip {
  const visible = lines.slice(0, maxRows);
  const hiddenCount = lines.length - visible.length;
  return { lines: visible, hiddenCount, rows: visible.length + (hiddenCount > 0 ? 1 : 0) };
}
