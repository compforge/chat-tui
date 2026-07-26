// 输入补全的纯逻辑（渲染无关，可单测）。按终端 coding agent 的通用习惯：
//   /  行首触发 slash 命令候选（命令表由消费方注入）
//   @  任意位置触发引用候选（引用源由消费方注入）

import type { CommandSpec } from "../types/index.ts";

export interface Candidate {
  /** 插入文本，如 "/provider"、"@bs_01…" */
  insert: string;
  label: string;
  detail: string;
  /** Optional section heading; adjacent candidates with the same group share one heading. */
  group?: string;
}

export interface Trigger {
  kind: "slash" | "at";
  /** token 在原文中的起始下标（/ 或 @ 处） */
  start: number;
  prefix: string;
}

export function triggerAt(text: string): Trigger | null {
  // 斜杠命令只在行首（TUI 惯例：/ 开头是命令，不是内容）
  const slash = /^\/([A-Za-z]*)$/.exec(text);
  if (slash) return { kind: "slash", start: 0, prefix: slash[1] as string };
  const at = /(^|\s)@([^\s@]*)$/u.exec(text);
  if (at) return { kind: "at", start: (at.index ?? 0) + (at[1] as string).length, prefix: at[2] as string };
  return null;
}

export interface CompletionSources {
  commands: readonly CommandSpec[];
  /** @ 触发时的候选提供方；prefix 已去掉 @，小写匹配由提供方自行决定 */
  mentions?: (prefix: string) => Candidate[];
}

export function buildCandidates(
  trigger: Trigger,
  sources: CompletionSources,
  opts: { limit?: number } = {},
): Candidate[] {
  const limit = opts.limit ?? 6;
  const p = trigger.prefix.toLowerCase();
  if (trigger.kind === "slash") {
    return sources.commands
      .filter((command) => command.name.startsWith(p))
      .map((command) => ({ insert: `/${command.name}`, label: `/${command.name}`, detail: command.description }))
      .slice(0, limit);
  }
  return (sources.mentions?.(trigger.prefix) ?? []).slice(0, limit);
}

/** 用选中的候选替换触发 token，返回新输入（尾随空格便于继续打字） */
export function applyCompletion(text: string, trigger: Trigger, candidate: Candidate): string {
  return `${text.slice(0, trigger.start)}${candidate.insert} `;
}

export interface AcceptedCompletion {
  text: string;
  /** Enter on a slash candidate runs the command; references remain editable prompt content. */
  submit: boolean;
}

/** Tab only completes; Enter also runs a selected slash command. */
export function acceptCompletion(
  text: string,
  trigger: Trigger,
  candidate: Candidate,
  key: "tab" | "enter",
): AcceptedCompletion {
  return {
    text: applyCompletion(text, trigger, candidate),
    submit: key === "enter" && trigger.kind === "slash",
  };
}
