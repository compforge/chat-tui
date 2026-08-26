import type { PasteEvent, TextareaOptions, TextareaRenderable } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import {
  memo,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
  type Ref,
} from "react";

import { useKeybindOverrides } from "../../input/keyboard.tsx";
import { editorKeyBindings } from "../../input/keybinds.ts";
import { defaultTheme, type Theme } from "../../theme.ts";
import {
  createPasteBoard,
  expandPasteTokens,
  foldPaste,
  pasteTokenAt,
  pasteTokenSelection,
  removePasteChunk,
  shouldFoldPaste,
  type PasteBoard,
} from "./paste.ts";

// 对齐 chat CLI 习惯：Enter 发送；Shift+Enter / Option+Enter 换行。
// Shift+Enter 需要终端支持 kitty keyboard 协议才能与 Enter 区分；
// Ctrl+J 是任何终端都可用的换行兜底（走 textarea 默认的 linefeed→newline 绑定）。
// 默认键位由 input/keybinds.ts 的定义表给出（composer.submit / composer.newline）。
export const COMPOSER_KEY_BINDINGS: NonNullable<TextareaOptions["keyBindings"]> =
  editorKeyBindings();

export interface ComposerHandle {
  /** 用独立文本替换输入内容并清除旧粘贴 token（用于队列召回、历史等） */
  setText(text: string): void;
  /** 应用基于当前输入计算出的编辑，同时保留仍在文本中的粘贴 token（用于补全） */
  editText(text: string): void;
  clear(): void;
  focus(): void;
  /**
   * 光标是否在缓冲区边界（最开头或最末尾）。历史回溯的门槛：仅当光标在边界时
   * 才允许 ↑/↓ 触发历史导航，否则放行为多行内的普通光标移动（对齐 codex）。
   * 空输入恒为 true。
   */
  cursorAtBoundary(): boolean;
}

export interface ComposerEditorProps {
  ref?: Ref<ComposerHandle>;
  /** 边框标题；ActivitySurface 已承载输入目标信息时通常不再需要 */
  title?: string;
  placeholder?: string;
  focused: boolean;
  /** 高亮边框表达"正在跑"（borderActive） */
  busy?: boolean;
  theme?: Theme;
  keyBindings?: NonNullable<TextareaOptions["keyBindings"]>;
  onChange: (text: string) => void;
  onSubmit: (text: string) => void;
}

/** 输入区高度估算：显式换行时随内容长高，上限 maxLines 行（+2 是边框） */
export function composerHeightFor(draft: string, maxLines = 6): number {
  return Math.min(maxLines, draft.split("\n").length) + 2;
}

/** 删除整个粘贴 token：不走 selection，直接重写 buffer 并复位光标。 */
function deleteTokenRange(
  textarea: TextareaRenderable,
  range: { start: number; end: number },
): void {
  const text = textarea.plainText;
  textarea.setText(text.slice(0, range.start) + text.slice(range.end));
  textarea.cursorOffset = range.start;
}

function protectSelectedPasteTokens(
  textarea: TextareaRenderable,
  board: PasteBoard,
): void {
  const selection = textarea.getSelection();
  if (!selection) return;
  const protectedSelection = pasteTokenSelection(
    textarea.plainText,
    board,
    selection.start,
    selection.end,
  );
  if (!protectedSelection) return;
  textarea.setSelection(protectedSelection.start, protectedSelection.end);
  for (const token of protectedSelection.tokens) removePasteChunk(board, token);
}

/** 普通字符会替换 selection；导航、提交和带控制修饰符的命令不会。 */
function replacesSelection(event: KeyEvent): boolean {
  if (event.name === "backspace" || event.name === "delete") return true;
  if (event.ctrl || event.meta || event.option || event.super || event.hyper) return false;
  return event.name.length === 1 || event.name === "space";
}

/**
 * 多行输入框。textarea 自持内部 buffer，消费方的 draft state 只是镜像
 * （供候选推导/按键分层用）——清空/覆写必须走 ComposerHandle，两边才能一致。
 *
 * 大段 bracketed paste 折叠为原子 token（见 paste.ts）：buffer 里只有占位文本，
 * 原文在本组件的 PasteBoard；onSubmit 展开后才交给消费方，因此 submit 恒为完整原文。
 */
export const ComposerEditor = memo(function ComposerEditor(
  props: ComposerEditorProps,
): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const textarea = useRef<TextareaRenderable | null>(null);
  const pasteBoard = useRef<PasteBoard>(createPasteBoard());
  const keybinds = useKeybindOverrides();
  const keyBindings = useMemo(
    () => props.keyBindings ?? editorKeyBindings(keybinds),
    [props.keyBindings, keybinds],
  );

  useImperativeHandle(props.ref, () => ({
    setText(text: string) {
      pasteBoard.current = createPasteBoard();
      textarea.current?.setText(text);
      textarea.current?.gotoBufferEnd();
    },
    editText(text: string) {
      textarea.current?.setText(text);
      textarea.current?.gotoBufferEnd();
    },
    clear() {
      textarea.current?.setText("");
      // token 旁表随 buffer 一起清空：提交（onSubmit 已展开）或 Ctrl+C 清 draft 后不留孤儿
      pasteBoard.current = createPasteBoard();
    },
    focus() {
      textarea.current?.focus();
    },
    cursorAtBoundary() {
      const ta = textarea.current;
      if (!ta) return true;
      const offset = ta.cursorOffset;
      return offset === 0 || offset === ta.plainText.length;
    },
  }));

  const handlePaste = (event: PasteEvent): void => {
    // 非文本粘贴（如 image/png）不在这里处理：留给接入方或 textarea 默认行为
    const mime = event.metadata?.mimeType;
    if (mime !== undefined && !mime.startsWith("text/")) return;
    const content = new TextDecoder().decode(event.bytes);
    const ta = textarea.current;
    if (ta?.hasSelection()) protectSelectedPasteTokens(ta, pasteBoard.current);
    if (!shouldFoldPaste(content)) return;
    event.preventDefault();
    const token = foldPaste(pasteBoard.current, content);
    ta?.insertText(token);
  };

  const handleKeyDown = (event: KeyEvent): void => {
    const ta = textarea.current;
    if (!ta) return;
    if (ta.hasSelection()) {
      if (replacesSelection(event)) protectSelectedPasteTokens(ta, pasteBoard.current);
      return;
    }
    const text = ta.plainText;
    const offset = ta.cursorOffset;
    const board = pasteBoard.current;
    if (board.chunks.length === 0) return;

    // backspace / delete 落在 token 上时整体删除，不允许部分编辑
    if (event.name === "backspace" || event.name === "delete") {
      const range = pasteTokenAt(
        text,
        board,
        offset,
        event.name === "backspace" ? "backward" : "forward",
      );
      if (!range) return;
      event.preventDefault();
      deleteTokenRange(ta, range);
      removePasteChunk(board, range.token);
      props.onChange(ta.plainText);
      return;
    }

    // 其余编辑/移动键：光标落在 token 内部时先吸附到边界（左移去头部，其余去尾部），
    // token 因此不可被逐字符进入
    const inside = pasteTokenAt(text, board, offset, "inside");
    if (inside) {
      ta.cursorOffset = event.name === "left" ? inside.start : inside.end;
    }
  };

  return (
    <box
      title={props.title}
      border
      borderColor={props.busy ? theme.borderActive : theme.border}
      style={{ width: "100%", flexShrink: 0 }}
    >
      <textarea
        ref={textarea}
        focused={props.focused}
        placeholder={props.placeholder}
        wrapMode="word"
        minHeight={1}
        maxHeight={6}
        width="100%"
        cursorStyle={{ style: "line", blinking: true }}
        keyBindings={keyBindings}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onContentChange={() => props.onChange(textarea.current?.plainText ?? "")}
        onSubmit={() => {
          // textarea 的 submit 事件不带值，从内部 buffer 读；粘贴 token 在此展开回原文
          const raw = textarea.current?.plainText ?? "";
          props.onSubmit(expandPasteTokens(raw, pasteBoard.current));
        }}
      />
    </box>
  );
});
