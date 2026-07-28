import { displayWidth, wrapLine } from "../terminal/text.ts";

export interface ColumnRange {
  start: number;
  end: number;
}

const TOKEN_CHAR = /[\p{L}\p{N}_./:@%+~#=\\-]/u;

/** 双击按终端列定位 token；路径、URL、session id 等连续字符串保持为一个选区。 */
export function tokenColumnRange(line: string, column: number): ColumnRange | null {
  const chars = [...line];
  const columns: number[] = [];
  let cursor = 0;
  for (const char of chars) {
    columns.push(cursor);
    cursor += displayWidth(char);
  }

  const index = chars.findIndex((char, i) => column >= columns[i]! && column < (columns[i + 1] ?? cursor));
  if (index < 0 || !TOKEN_CHAR.test(chars[index]!)) return null;

  let start = index;
  let end = index + 1;
  while (start > 0 && TOKEN_CHAR.test(chars[start - 1]!)) start -= 1;
  while (end < chars.length && TOKEN_CHAR.test(chars[end]!)) end += 1;
  return { start: columns[start]!, end: end < columns.length ? columns[end]! : cursor };
}

/** 与 transcript 的 word wrap 对齐，将鼠标 y 映射到当前可见文本行。 */
export function visualLineAt(text: string, width: number, row: number): string | undefined {
  return text.split("\n").flatMap((line) => wrapLine(line, width))[row];
}
