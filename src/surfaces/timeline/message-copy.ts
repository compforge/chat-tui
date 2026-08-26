// 复制最近一条 agent 消息（纯逻辑，可单测）：整条消息只有一个 code fence 时
// 复制纯代码（对齐 codex Ctrl+O 的行为），否则复制消息正文。

import type { TranscriptItem, TranscriptMessageItem } from "../../state/timeline.ts";

/** 时间线里最近一条 role 为 agent 的消息；没有则 null。 */
export function lastAgentMessage(
  items: readonly TranscriptItem[],
): TranscriptMessageItem | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.type === "message" && item.role === "agent") return item;
  }
  return null;
}

/**
 * 整条消息恰好是一个 code fence 时返回其中的纯代码，否则 null。
 * 内部再出现 ``` 视为多个代码块，不算"只有一个"。
 */
export function singleFenceCode(text: string): string | null {
  const match = /^```[^\n]*\n([\s\S]*?)```\s*$/.exec(text.trim());
  if (!match) return null;
  const code = match[1] ?? "";
  if (code.includes("```")) return null;
  if (code.trim() === "") return null;
  return code.replace(/\n$/, "");
}

/** 复制文本：单代码块消息取纯代码，其余取正文原文。 */
export function messageCopyText(item: TranscriptMessageItem): string {
  return singleFenceCode(item.text) ?? item.text;
}
