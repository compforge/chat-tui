import { wrapLine } from "../../../terminal/text.ts";
import { clipDetail, overlayCardHeight, overlayCardWidth } from "./overlay.ts";

export interface QuestionCardLayout {
  width: number;
  height: number;
  /** 选项 description 的显示宽度：列表行内 ellipsize 与焦点详情 wrap 共用同一预算。 */
  descWidth: number;
  /** 焦点项详情展开后的可见行。 */
  detailLines: string[];
  /** 详情被截掉的行数；>0 时渲染 "… +N more lines" 留痕行。 */
  detailHidden: number;
}

interface QuestionCardLayoutInput {
  terminalWidth: number;
  terminalHeight: number;
  /** 列表总条目数（含 Other… / Continue 等追加项）。 */
  choiceCount: number;
  /** 焦点项的完整 description（详情区展开它）。 */
  focusedDescription?: string;
  hasPreview: boolean;
}

/** 问题卡对统一浮层预算的实例化：选项行优先，焦点详情限行且截断留痕。 */
export function questionCardLayout(input: QuestionCardLayoutInput): QuestionCardLayout {
  const width = overlayCardWidth({ terminalWidth: input.terminalWidth, minWidth: 24, maxWidth: 76 });
  const descWidth = Math.max(8, width - 6); // 减边框与选择指示符缩进
  const detailAll = input.focusedDescription ? wrapLine(input.focusedDescription, descWidth) : [];
  const detail = clipDetail(detailAll, DETAIL_MAX_ROWS);
  const budget = overlayCardHeight({
    terminalHeight: input.terminalHeight,
    reservedRows: 6, // 固定给输入区/状态行留出的空间（不随 anchorBottom 走）
    chromeRows: 3 + (input.hasPreview ? 2 : 0), // 上下边框 + 问题行；preview 计 2 行
    actionRowsWanted: input.choiceCount * 2, // opentui Select 每项占 2 行（label + description）
    detailRowsWanted: detail.rows,
    minDetailRows: 0, // 详情可完全让位——列表行内已有 ellipsize 留痕
    minHeight: 8,
  });

  return {
    width,
    height: budget.height,
    descWidth,
    detailLines: detail.lines,
    detailHidden: detail.hiddenCount,
  };
}

/** 焦点项详情的行数上限：再长也不该把卡片顶穿；超出部分明说剩余行数，不静默吞。 */
const DETAIL_MAX_ROWS = 6;
