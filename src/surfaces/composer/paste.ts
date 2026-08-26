// 大段粘贴折叠（纯逻辑，可单测）：超过阈值的 bracketed paste 在 buffer 里折叠为
// 原子占位 token（如 `[Pasted #1 ~12 lines]`），真实内容存旁表；提交时展开回原文。
// 只处理文本粘贴——图片等二进制粘贴由接入方（或 textarea 默认行为）处理，不经过这里。

/** 折叠阈值：≥3 行或 >200 字符（opencode 量级，字符阈值略放宽） */
export const PASTE_FOLD_MIN_LINES = 3;
export const PASTE_FOLD_MIN_CHARS = 200;

export interface PasteChunk {
  token: string;
  content: string;
}

/**
 * 同一 composer 的粘贴旁表：token → 原文。nextId 递增编号保证多次大粘贴的 token
 * 互不重复（等长内容也不撞车）。清空/提交后由持有方重建。
 */
export interface PasteBoard {
  /** 每个 composer 实例独有；编码进不可见 token identity，避免同形可见文本被误展开。 */
  id: string;
  nextId: number;
  chunks: PasteChunk[];
}

export function createPasteBoard(): PasteBoard {
  const id = globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  return { id, nextId: 1, chunks: [] };
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

const UNICODE_TAG_OFFSET = 0xe0000;
const UNICODE_CANCEL_TAG = 0xe007f;
const UNICODE_TAGS = /[\u{e0000}-\u{e007f}]/gu;

/**
 * Unicode tag characters are not rendered by OpenTUI, but remain part of the editable buffer.
 * Encoding the board identity behind the visible label makes the replacement key opaque without
 * changing the chip text the user sees.
 */
function pasteTokenIdentity(value: string): string {
  return Array.from(value, (character) =>
    String.fromCodePoint(UNICODE_TAG_OFFSET + (character.codePointAt(0) ?? 0))
  ).join("") + String.fromCodePoint(UNICODE_CANCEL_TAG);
}

/** Buffer/text assertions that need the user-visible token text can strip its opaque identity. */
export function visiblePasteTokenText(text: string): string {
  return text.replaceAll(UNICODE_TAGS, "");
}

/** 折叠一段粘贴内容：登记旁表并返回应插入 buffer 的 token。 */
export function foldPaste(board: PasteBoard, content: string): string {
  const id = board.nextId;
  const token = pasteTokenLabel(id, content) + pasteTokenIdentity(board.id);
  board.nextId += 1;
  board.chunks.push({ token, content });
  return token;
}

// token 中不含 regex 特殊字符（数字/空格/波浪线/方括号），逐字匹配即可
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 提交时把 buffer 里的 token 展开回完整原文；未知 token（如手敲的同形文本）保持原样。 */
export function expandPasteTokens(text: string, board: PasteBoard): string {
  if (board.chunks.length === 0) return text;
  const contents = new Map(
    board.chunks.map((chunk) => [chunk.token, chunk.content] as const),
  );
  const tokens = new RegExp(
    board.chunks.map((chunk) => escapeRegExp(chunk.token)).join("|"),
    "g",
  );
  // 单次扫描只替换 buffer 原有 token，不能再次扫描刚展开的粘贴内容。
  return text.replace(tokens, (token) => contents.get(token) ?? token);
}

export interface PasteTokenRange {
  start: number;
  end: number;
  token: string;
}

export interface PasteTokenSelection {
  start: number;
  end: number;
  tokens: string[];
}

/** buffer 中所有已登记 token 的位置（按出现顺序）。 */
export function pasteTokenRanges(
  text: string,
  board: PasteBoard,
): PasteTokenRange[] {
  const ranges: PasteTokenRange[] = [];
  for (const chunk of board.chunks) {
    const pattern = new RegExp(escapeRegExp(chunk.token), "g");
    for (const match of text.matchAll(pattern)) {
      ranges.push({
        start: match.index,
        end: match.index + chunk.token.length,
        token: chunk.token,
      });
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}

/** 将一段 selection 扩到其接触到的完整 token 边界；未接触 token 时返回 null。 */
export function pasteTokenSelection(
  text: string,
  board: PasteBoard,
  selectionStart: number,
  selectionEnd: number,
): PasteTokenSelection | null {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  if (start === end) return null;
  const touched = pasteTokenRanges(text, board).filter(
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
  offset: number,
  mode: "backward" | "forward" | "inside",
): PasteTokenRange | null {
  for (const range of pasteTokenRanges(text, board)) {
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
