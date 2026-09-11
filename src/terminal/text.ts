import { stripAnsiSequences, TextBuffer, TextBufferView } from "@opentui/core";

/** 展示前清洗终端控制序列，并按产品约定将 tab 展开为 4 空格。 */
export function sanitizeLine(line: string): string {
  return stripAnsiSequences(line).replaceAll("\t", "    ");
}

/**
 * OpenTUI owns Unicode measurement and line breaking. Keep both native handles
 * scoped to the calculation; the view must be destroyed before its buffer.
 */
function withTextLayout<T>(
  text: string,
  read: (buffer: TextBuffer, view: TextBufferView) => T,
): T {
  const buffer = TextBuffer.create("unicode");
  let view: TextBufferView | undefined;
  try {
    buffer.setText(text);
    view = TextBufferView.create(buffer);
    return read(buffer, view);
  } finally {
    view?.destroy();
    buffer.destroy();
  }
}

/** 单行文本的原生 Unicode 显示宽度；多行返回最宽一行。 */
export function displayWidth(text: string): number {
  return withTextLayout(text, (_buffer, view) => view.lineInfo.lineWidthColsMax);
}

/** 使用 OpenTUI word wrap 的视觉行，包括原生保留的行尾空格。 */
export function wrapLine(line: string, width: number): string[] {
  if (width <= 0) return [line];
  return withTextLayout(line, (buffer, view) => {
    view.setWrapMode("word");
    view.setWrapWidth(width);
    const { lineStartCols, lineWidthCols } = view.lineInfo;
    return lineStartCols.map((start, index) =>
      buffer.getTextRange(start, start + lineWidthCols[index]!),
    );
  });
}

/** 按显示宽度截断并保留省略提示；字素边界由 OpenTUI 决定。 */
export function ellipsize(text: string, width: number): string {
  if (width <= 0) return "";
  return withTextLayout(text, (buffer, view) => {
    if (view.lineInfo.lineWidthColsMax <= width) return text;
    const budget = width - 1; // … occupies one display cell in Unicode mode.
    if (budget <= 0) return "…";
    view.setWrapMode("char");
    view.setWrapWidth(budget);
    const firstLineWidth = view.lineInfo.lineWidthCols[0]!;
    // A glyph wider than the entire viewport cannot share the row with the hint.
    return (firstLineWidth <= budget ? buffer.getTextRange(0, firstLineWidth) : "") + "…";
  });
}

/** 横向滚动的文本后缀；被视口左边缘切开的宽字素保留为空白显示列。 */
export function textFromColumn(text: string, column: number): string {
  return withTextLayout(text, (buffer, view) => {
    const width = view.lineInfo.lineWidthColsMax;
    // Native ranges include the complete grapheme intersecting the end column.
    const throughColumn = displayWidth(buffer.getTextRange(0, column));
    return " ".repeat(throughColumn - column) + buffer.getTextRange(throughColumn, width);
  });
}
