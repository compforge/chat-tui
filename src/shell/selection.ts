import { displayWidth, wrapLine } from "../terminal/text.ts";

export interface ColumnRange {
  start: number;
  end: number;
}

const TOKEN_PATTERN = /[\p{L}\p{N}\p{M}_./:@%+~#=\\-]+/gu;

/** 双击按终端列定位产品 token；字素宽度与布局交给 OpenTUI。 */
export function tokenColumnRange(line: string, column: number): ColumnRange | null {
  for (const match of line.matchAll(TOKEN_PATTERN)) {
    const start = displayWidth(line.slice(0, match.index));
    const end = start + displayWidth(match[0]);
    if (column >= start && column < end) return { start, end };
  }
  return null;
}

/** 与 transcript 的 word wrap 对齐，将鼠标 y 映射到当前可见文本行。 */
export function visualLineAt(text: string, width: number, row: number): string | undefined {
  return text.split("\n").flatMap((line) => wrapLine(line, width))[row];
}
