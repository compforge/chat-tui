import type { TextareaOptions, TextareaRenderable } from "@opentui/core";
import { memo, useImperativeHandle, useRef, type ReactNode, type Ref } from "react";

import { defaultTheme, type RunStatusItem, type Theme } from "../types/index.ts";
import { RunStatus } from "./run-status.tsx";

// 对齐 chat CLI 习惯：Enter 发送；Shift+Enter / Option+Enter 换行。
// Shift+Enter 需要终端支持 kitty keyboard 协议才能与 Enter 区分；
// Ctrl+J 是任何终端都可用的换行兜底（走 textarea 默认的 linefeed→newline 绑定）。
export const COMPOSER_KEY_BINDINGS: NonNullable<TextareaOptions["keyBindings"]> = [
  { name: "return", action: "submit" },
  { name: "kpenter", action: "submit" },
  { name: "return", shift: true, action: "newline" },
  { name: "kpenter", shift: true, action: "newline" },
  { name: "return", meta: true, action: "newline" },
  { name: "kpenter", meta: true, action: "newline" },
];

export interface ComposerHandle {
  /** 覆写输入内容并把光标移到末尾（用于队列召回、补全等） */
  setText(text: string): void;
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

export interface ComposerProps extends ComposerEditorProps {
  /**
   * 兼容入口：把运行状态贴在输入框顶部。
   * ChatShell 使用独立 ActivitySurface，真正持有 textarea buffer 的 ComposerEditor 独立 memo。
   */
  status?: RunStatusItem[];
}

/** 输入区高度估算：显式换行时随内容长高，上限 maxLines 行（+2 是边框） */
export function composerHeightFor(draft: string, maxLines = 6): number {
  return Math.min(maxLines, draft.split("\n").length) + 2;
}

/**
 * 多行输入框。textarea 自持内部 buffer，消费方的 draft state 只是镜像
 * （供候选推导/按键分层用）——清空/覆写必须走 ComposerHandle，两边才能一致。
 */
export const ComposerEditor = memo(function ComposerEditor(
  props: ComposerEditorProps,
): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const textarea = useRef<TextareaRenderable | null>(null);

  useImperativeHandle(props.ref, () => ({
    setText(text: string) {
      textarea.current?.setText(text);
      textarea.current?.gotoBufferEnd();
    },
    clear() {
      textarea.current?.setText("");
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
        keyBindings={props.keyBindings ?? COMPOSER_KEY_BINDINGS}
        onContentChange={() => props.onChange(textarea.current?.plainText ?? "")}
        onSubmit={() => {
          // textarea 的 submit 事件不带值，从内部 buffer 读
          props.onSubmit(textarea.current?.plainText ?? "");
        }}
      />
    </box>
  );
});

/** 兼容的一站式输入区；状态变化只重渲染外壳，不进入 ComposerEditor。 */
export const Composer = memo(function Composer(props: ComposerProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const { status, ...editor } = props;
  return (
    // marginTop 归分组容器：Activity 行与输入框之间不留空行，视觉上"贴"在边框顶部
    <box style={{ width: "100%", flexShrink: 0, marginTop: 1, flexDirection: "column" }}>
      <RunStatus items={status ?? []} theme={theme} />
      <ComposerEditor {...editor} />
    </box>
  );
});
