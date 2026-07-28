import { describe, expect, test } from "bun:test";

import { parseSlashCommand } from "../../../src/index.ts";
import type { CommandSpec } from "../../../src/index.ts";

const commands: CommandSpec[] = [
  { name: "provider", description: "" },
  { name: "prompt", description: "" },
  { name: "model", description: "" },
];

describe("parseSlashCommand", () => {
  test("exact name with argument", () => {
    expect(parseSlashCommand("/model gpt-5", commands)).toEqual({ name: "model", argument: "gpt-5" });
  });

  test("unique prefix resolves", () => {
    expect(parseSlashCommand("/m", commands)).toEqual({ name: "model", argument: "" });
  });

  test("ambiguous prefix stays a prompt", () => {
    expect(parseSlashCommand("/pro", commands)).toBeNull();
  });

  test("unknown command stays a prompt", () => {
    expect(parseSlashCommand("/etc/hosts", commands)).toBeNull();
    expect(parseSlashCommand("not a command", commands)).toBeNull();
  });
});
