// 大段粘贴折叠（纯逻辑，可单测）：超过阈值的 bracketed paste 在 buffer 里折叠为
// 原子占位 token（如 `[Pasted #1 ~12 lines]`），真实内容存旁表；提交时展开回原文。
// 只处理文本粘贴——图片等二进制粘贴由接入方（或 textarea 默认行为）处理，不经过这里。

/** 折叠阈值：≥3 行或 >200 字符（opencode 量级，字符阈值略放宽） */
export const PASTE_FOLD_MIN_LINES = 3;
export const PASTE_FOLD_MIN_CHARS = 200;

export interface PasteChunk {
  token: string;
  content: string;
  /** OpenTUI extmark identity; the mark tracks this exact token as surrounding text changes. */
  markId?: number;
}

/**
 * 同一 composer 的粘贴旁表：token → 原文。nextId 递增编号保证多次大粘贴的 token
 * 互不重复（等长内容也不撞车）。清空/提交后由持有方重建。
 */
export interface PasteBoard {
  nextId: number;
  chunks: PasteChunk[];
}

export function createPasteBoard(): PasteBoard {
  return { nextId: 1, chunks: [] };
}

export function pasteLineCount(text: string): number {
  return text.replaceAll("\r\n", "\n").split("\n").length;
}

export function shouldFoldPaste(text: string): boolean {
  return (
    pasteLineCount(text) >= PASTE_FOLD_MIN_LINES ||
    text.length > PASTE_FOLD_MIN_CHARS
  );
}

/** 占位 token 文案：多行按行数，单行按字符数；编号随 board.nextId 递增。 */
export function pasteTokenLabel(id: number, content: string): string {
  const lines = pasteLineCount(content);
  return lines > 1
    ? `[Pasted #${id} ~${lines} lines]`
    : `[Pasted #${id} ${content.length} chars]`;
}

/** 折叠一段粘贴内容：登记旁表并返回应插入 buffer 的 token。 */
export function foldPaste(board: PasteBoard, content: string): string {
  const id = board.nextId;
  const token = pasteTokenLabel(id, content);
  board.nextId += 1;
  board.chunks.push({ token, content });
  return token;
}

/** 将刚插入的 token 与 OpenTUI 跟踪其位置的 extmark 绑定。 */
export function bindPasteToken(
  board: PasteBoard,
  token: string,
  markId: number,
): void {
  const chunk = board.chunks.find((candidate) => candidate.token === token);
  if (chunk) chunk.markId = markId;
}

export interface PasteMark {
  id: number;
  start: number;
  end: number;
}

export interface PasteTokenRange {
  start: number;
  end: number;
  token: string;
  content: string;
}

export interface PasteTokenSelection {
  start: number;
  end: number;
  tokens: string[];
}

/**
 * Resolve only extmark-backed tokens. The mark, rather than token-shaped buffer text, identifies
 * a real paste chip so a literal `[Pasted ...]` typed by the user is never expanded accidentally.
 */
export function pasteTokenRanges(
  text: string,
  board: PasteBoard,
  marks: readonly PasteMark[],
): PasteTokenRange[] {
  const marksById = new Map(marks.map((mark) => [mark.id, mark] as const));
  const ranges: PasteTokenRange[] = [];
  for (const chunk of board.chunks) {
    if (chunk.markId === undefined) continue;
    const mark = marksById.get(chunk.markId);
    if (!mark || text.slice(mark.start, mark.end) !== chunk.token) continue;
    ranges.push({
      start: mark.start,
      end: mark.end,
      token: chunk.token,
      content: chunk.content,
    });
  }
  return ranges.sort((a, b) => a.start - b.start);
}

/** 提交时按已跟踪位置把真实 token 展开回原文；手敲的同形文本保持不变。 */
export function expandPasteTokens(
  text: string,
  board: PasteBoard,
  marks: readonly PasteMark[],
): string {
  let expanded = text;
  for (const range of pasteTokenRanges(text, board, marks).toReversed()) {
    expanded =
      expanded.slice(0, range.start) +
      range.content +
      expanded.slice(range.end);
  }
  return expanded;
}

/** 将一段 selection 扩到其接触到的完整 token 边界；未接触 token 时返回 null。 */
export function pasteTokenSelection(
  text: string,
  board: PasteBoard,
  marks: readonly PasteMark[],
  selectionStart: number,
  selectionEnd: number,
): PasteTokenSelection | null {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  if (start === end) return null;
  const touched = pasteTokenRanges(text, board, marks).filter(
    (range) => start < range.end && range.start < end,
  );
  if (touched.length === 0) return null;
  return {
    start: Math.min(start, ...touched.map((range) => range.start)),
    end: Math.max(end, ...touched.map((range) => range.end)),
    tokens: [...new Set(touched.map((range) => range.token))],
  };
}

/**
 * 原子性判定：offset（textarea cursorOffset，code unit 计）落在哪个 token 上。
 * - backward（backspace）：光标在 token 末尾或内部 → 命中；
 * - forward（delete）：光标在 token 开头或内部 → 命中；
 * - inside（光标吸附/其它编辑键）：仅严格内部命中。
 */
export function pasteTokenAt(
  text: string,
  board: PasteBoard,
  marks: readonly PasteMark[],
  offset: number,
  mode: "backward" | "forward" | "inside",
): PasteTokenRange | null {
  for (const range of pasteTokenRanges(text, board, marks)) {
    const inside = range.start < offset && offset < range.end;
    if (mode === "inside" && inside) return range;
    if (mode === "backward" && (inside || offset === range.end)) return range;
    if (mode === "forward" && (inside || offset === range.start)) return range;
  }
  return null;
}

/** 从旁表移除某 token 的登记（整体删除后调用；token 文本已由调用方从 buffer 删除）。 */
export function removePasteChunk(board: PasteBoard, token: string): void {
  board.chunks = board.chunks.filter((chunk) => chunk.token !== token);
}
