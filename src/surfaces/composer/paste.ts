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
  const token = pasteTokenLabel(board.nextId, content);
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
  let expanded = text;
  for (const chunk of board.chunks) {
    expanded = expanded.replaceAll(chunk.token, () => chunk.content);
  }
  return expanded;
}

export interface PasteTokenRange {
  start: number;
  end: number;
  token: string;
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
