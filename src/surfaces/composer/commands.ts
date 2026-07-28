// slash 命令识别（纯逻辑，可单测）。语义执行归接入方，TUI 只做识别与分发。

import type { CommandSpec } from "../../protocol/command.ts";

export interface CommandInvocation {
  name: string;
  argument: string;
}

/** 识别完整命令或唯一前缀；未知或有歧义的 `/path` 等输入仍作为普通 prompt。 */
export function parseSlashCommand(
  input: string,
  commands: readonly CommandSpec[],
): CommandInvocation | null {
  const match = /^\/([a-z-]+)(?:\s+(.*))?$/i.exec(input.trim());
  if (!match) return null;
  const name = match[1]?.toLowerCase() ?? "";
  const exact = commands.find((command) => command.name === name);
  const prefixMatches = exact ? [] : commands.filter((command) => command.name.startsWith(name));
  const definition = exact ?? (prefixMatches.length === 1 ? prefixMatches[0] : undefined);
  if (!definition) return null;
  return { name: definition.name, argument: match[2]?.trim() ?? "" };
}
