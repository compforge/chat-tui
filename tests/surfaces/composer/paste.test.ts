import { describe, expect, test } from "bun:test";

import {
  createPasteBoard,
  expandPasteTokens,
  foldPaste,
  pasteLineCount,
  pasteTokenAt,
  pasteTokenRanges,
  pasteTokenSelection,
  removePasteChunk,
  shouldFoldPaste,
  visiblePasteTokenText,
} from "../../../src/surfaces/composer/paste.ts";

const multiline = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n");

describe("shouldFoldPaste", () => {
  test("folds at 3+ lines even when short", () => {
    expect(shouldFoldPaste("a\nb\nc")).toBe(true);
    expect(shouldFoldPaste("a\nb")).toBe(false);
  });

  test("folds a single long line over 200 chars", () => {
    expect(shouldFoldPaste("x".repeat(201))).toBe(true);
    expect(shouldFoldPaste("x".repeat(200))).toBe(false);
  });

  test("small pastes keep the default behavior", () => {
    expect(shouldFoldPaste("hello")).toBe(false);
    expect(shouldFoldPaste("two\nlines")).toBe(false);
  });

  test("CRLF counts as line breaks", () => {
    expect(pasteLineCount("a\r\nb\r\nc")).toBe(3);
    expect(shouldFoldPaste("a\r\nb\r\nc")).toBe(true);
  });
});

describe("foldPaste / expandPasteTokens", () => {
  test("multi-line paste folds into a numbered line-count token", () => {
    const board = createPasteBoard();
    const token = foldPaste(board, multiline);
    expect(visiblePasteTokenText(token)).toBe("[Pasted #1 ~12 lines]");
  });

  test("single-line long paste folds into a char-count token", () => {
    const board = createPasteBoard();
    const token = foldPaste(board, "x".repeat(300));
    expect(visiblePasteTokenText(token)).toBe("[Pasted #1 300 chars]");
  });

  test("repeated pastes increment the token id", () => {
    const board = createPasteBoard();
    const first = foldPaste(board, multiline);
    const second = foldPaste(board, multiline);
    expect(visiblePasteTokenText(first)).toBe("[Pasted #1 ~12 lines]");
    expect(visiblePasteTokenText(second)).toBe("[Pasted #2 ~12 lines]");
  });

  test("submit text expands tokens back to the full original", () => {
    const board = createPasteBoard();
    const first = foldPaste(board, multiline);
    const second = foldPaste(board, "x".repeat(300));
    const buffer = `check this ${first}\nand ${second} please`;
    const expanded = expandPasteTokens(buffer, board);
    expect(expanded).toBe(`check this ${multiline}\nand ${"x".repeat(300)} please`);
  });

  test("does not expand token-shaped text inside another pasted chunk", () => {
    const board = createPasteBoard();
    const firstContent = "mentions [Pasted #2 ~3 lines] literally\nline 2\nline 3";
    const first = foldPaste(board, firstContent);
    const secondContent = "other\ncontent\nhere";
    const second = foldPaste(board, secondContent);

    expect(expandPasteTokens(`${first}\n${second}`, board)).toBe(
      `${firstContent}\n${secondContent}`,
    );
  });

  test("look-alike text typed by hand is left untouched", () => {
    const board = createPasteBoard();
    const visible = "[Pasted #1 ~12 lines]";
    const token = foldPaste(board, multiline);
    expect(expandPasteTokens(`${visible} ${token}`, board)).toBe(
      `${visible} ${multiline}`,
    );
  });
});

describe("pasteTokenSelection", () => {
  test("expands a partial selection to the whole token", () => {
    const board = createPasteBoard();
    const token = foldPaste(board, multiline);
    const text = `before ${token} after`;
    const start = "before ".length;
    expect(pasteTokenSelection(text, board, start + 2, start + 5)).toEqual({
      start,
      end: start + token.length,
      tokens: [token],
    });
  });

  test("leaves selections outside tokens alone", () => {
    const board = createPasteBoard();
    const token = foldPaste(board, multiline);
    expect(pasteTokenSelection(`before ${token}`, board, 0, 3)).toBeNull();
  });
});

describe("pasteTokenAt", () => {
  function setup() {
    const board = createPasteBoard();
    const token = foldPaste(board, multiline);
    const text = `ab${token}cd`;
    return { board, token, text, start: 2, end: 2 + token.length };
  }

  test("backspace at the token end hits the whole token", () => {
    const { board, token, text, start, end } = setup();
    expect(pasteTokenAt(text, board, end, "backward")).toEqual({ start, end, token });
    expect(pasteTokenAt(text, board, start, "backward")).toBeNull();
  });

  test("delete at the token start hits the whole token", () => {
    const { board, token, text, start, end } = setup();
    expect(pasteTokenAt(text, board, start, "forward")).toEqual({ start, end, token });
    expect(pasteTokenAt(text, board, end, "forward")).toBeNull();
  });

  test("strictly inside only matches the inside mode", () => {
    const { board, text, start } = setup();
    expect(pasteTokenAt(text, board, start + 3, "inside")).not.toBeNull();
    expect(pasteTokenAt(text, board, start, "inside")).toBeNull();
  });

  test("no registered chunks means no hit", () => {
    const board = createPasteBoard();
    expect(pasteTokenAt("[Pasted #1 ~12 lines]", board, 5, "backward")).toBeNull();
  });
});

describe("pasteTokenRanges / removePasteChunk", () => {
  test("finds every occurrence of registered tokens in order", () => {
    const board = createPasteBoard();
    const first = foldPaste(board, multiline);
    const second = foldPaste(board, "y".repeat(250));
    const text = `${second} ${first}`;
    const ranges = pasteTokenRanges(text, board);
    expect(ranges.map((range) => range.token)).toEqual([second, first]);
  });

  test("removing a chunk stops expansion and hits", () => {
    const board = createPasteBoard();
    const token = foldPaste(board, multiline);
    removePasteChunk(board, token);
    expect(expandPasteTokens(token, board)).toBe(token);
    expect(pasteTokenAt(token, board, token.length, "backward")).toBeNull();
  });
});
