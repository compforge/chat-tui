import { describe, expect, test } from "bun:test";

import {
  acceptCompletion,
  applyCompletion,
  buildCandidates,
  triggerAt,
  type Candidate,
} from "../src/components/completion.ts";
import type { CommandSpec } from "../src/types/index.ts";

const commands: CommandSpec[] = [
  { name: "provider", description: "switch provider" },
  { name: "model", description: "set model" },
  { name: "exit", description: "quit" },
];

const mentions = (prefix: string): Candidate[] =>
  [
    { insert: "@bs_01AAAA", label: "@bs_01AAAA", detail: "design session" },
    { insert: "@bs_01BBBB", label: "@bs_01BBBB", detail: "impl session" },
  ].filter((candidate) => candidate.insert.slice(1).toLowerCase().startsWith(prefix.toLowerCase()));

describe("triggerAt", () => {
  test("slash only at line start", () => {
    expect(triggerAt("/")).toEqual({ kind: "slash", start: 0, prefix: "" });
    expect(triggerAt("/pr")).toEqual({ kind: "slash", start: 0, prefix: "pr" });
    expect(triggerAt("hello /pr")).toBeNull(); // 行中的 / 是内容
    expect(triggerAt("/provider x")).toBeNull(); // 已经带参数，不再补全
  });

  test("at anywhere at tail", () => {
    expect(triggerAt("@")).toEqual({ kind: "at", start: 0, prefix: "" });
    expect(triggerAt("see @bs_01")).toEqual({ kind: "at", start: 4, prefix: "bs_01" });
    expect(triggerAt("处理 @需求")).toEqual({ kind: "at", start: 3, prefix: "需求" });
    expect(triggerAt("a@b then")).toBeNull();
  });
});

describe("buildCandidates", () => {
  test("slash lists injected commands filtered by prefix", () => {
    const all = buildCandidates({ kind: "slash", start: 0, prefix: "" }, { commands });
    expect(all.map((c) => c.insert)).toEqual(["/provider", "/model", "/exit"]);
    const pr = buildCandidates({ kind: "slash", start: 0, prefix: "pr" }, { commands });
    expect(pr.map((c) => c.insert)).toEqual(["/provider"]);
  });

  test("at delegates to injected mention source", () => {
    const all = buildCandidates({ kind: "at", start: 0, prefix: "bs_01B" }, { commands, mentions });
    expect(all.map((c) => c.insert)).toEqual(["@bs_01BBBB"]);
  });

  test("preserves groups supplied by a mention source", () => {
    const grouped = buildCandidates(
      { kind: "at", start: 0, prefix: "" },
      {
        commands,
        mentions: () => [{
          insert: "@req_1",
          label: "REQ-1",
          detail: "ship it",
          group: "reqloop@requirement",
        }],
      },
    );
    expect(grouped[0]?.group).toBe("reqloop@requirement");
  });

  test("at without mention source yields nothing", () => {
    expect(buildCandidates({ kind: "at", start: 0, prefix: "" }, { commands })).toEqual([]);
  });

  test("limit caps results", () => {
    const capped = buildCandidates({ kind: "at", start: 0, prefix: "" }, { commands, mentions }, { limit: 1 });
    expect(capped).toHaveLength(1);
  });
});

describe("applyCompletion", () => {
  test("replaces trailing token, keeps preceding text", () => {
    const trigger = triggerAt("see @bs_01A");
    const done = applyCompletion("see @bs_01A", trigger!, { insert: "@bs_01AAAA", label: "", detail: "" });
    expect(done).toBe("see @bs_01AAAA ");
  });

  test("slash completion replaces whole line head", () => {
    const trigger = triggerAt("/pr");
    expect(applyCompletion("/pr", trigger!, { insert: "/provider", label: "", detail: "" })).toBe("/provider ");
  });
});

describe("acceptCompletion", () => {
  test("Enter runs the selected slash candidate instead of submitting the raw prefix", () => {
    const trigger = triggerAt("/");
    expect(
      acceptCompletion("/", trigger!, { insert: "/provider", label: "", detail: "" }, "enter"),
    ).toEqual({ text: "/provider ", submit: true });
  });

  test("Tab completes slash commands without running them", () => {
    const trigger = triggerAt("/pr");
    expect(
      acceptCompletion("/pr", trigger!, { insert: "/provider", label: "", detail: "" }, "tab"),
    ).toEqual({ text: "/provider ", submit: false });
  });

  test("Enter inserts mention candidates without submitting the surrounding prompt", () => {
    const trigger = triggerAt("see @bs_");
    expect(
      acceptCompletion(
        "see @bs_",
        trigger!,
        { insert: "@bs_01AAAA", label: "", detail: "" },
        "enter",
      ),
    ).toEqual({ text: "see @bs_01AAAA ", submit: false });
  });
});
