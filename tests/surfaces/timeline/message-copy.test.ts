import { describe, expect, test } from "bun:test";

import type { TranscriptItem } from "../../../src/index.ts";
import {
  lastAgentMessage,
  messageCopyText,
  singleFenceCode,
} from "../../../src/surfaces/timeline/message-copy.ts";

describe("lastAgentMessage", () => {
  test("returns the most recent agent message", () => {
    const items: TranscriptItem[] = [
      { type: "message", id: "u1", role: "user", text: "hi" },
      { type: "message", id: "a1", role: "agent", text: "first" },
      { type: "message", id: "u2", role: "user", text: "next" },
      { type: "message", id: "a2", role: "agent", text: "second" },
    ];
    expect(lastAgentMessage(items)?.id).toBe("a2");
  });

  test("skips blocks and groups", () => {
    const items: TranscriptItem[] = [
      { type: "message", id: "a1", role: "agent", text: "answer" },
      { type: "block", id: "b1", kind: "tool", status: "completed", title: "Read" },
    ];
    expect(lastAgentMessage(items)?.id).toBe("a1");
  });

  test("returns null without any agent message", () => {
    expect(
      lastAgentMessage([{ type: "message", id: "u1", role: "user", text: "hi" }]),
    ).toBeNull();
    expect(lastAgentMessage([])).toBeNull();
  });
});

describe("singleFenceCode", () => {
  test("extracts code when the whole message is one fence", () => {
    expect(singleFenceCode("```ts\nconst a = 1;\n```")).toBe("const a = 1;");
    expect(singleFenceCode("  ```\ncode\n```  ")).toBe("code");
  });

  test("rejects prose around a fence", () => {
    expect(singleFenceCode("here:\n```\ncode\n```")).toBeNull();
    expect(singleFenceCode("```\ncode\n```\ndone")).toBeNull();
  });

  test("rejects multiple fences and empty code", () => {
    expect(singleFenceCode("```\na\n```\n```\nb\n```")).toBeNull();
    expect(singleFenceCode("```\n\n```")).toBeNull();
  });

  test("rejects messages without a fence", () => {
    expect(singleFenceCode("plain text")).toBeNull();
  });
});

describe("messageCopyText", () => {
  test("copies bare code for a single-fence message", () => {
    const item = {
      type: "message",
      id: "a1",
      role: "agent",
      text: "```python\nprint(1)\n```",
    } as const;
    expect(messageCopyText(item)).toBe("print(1)");
  });

  test("copies the full text otherwise", () => {
    const item = {
      type: "message",
      id: "a1",
      role: "agent",
      text: "Explanation with ```inline``` ticks",
    } as const;
    expect(messageCopyText(item)).toBe(item.text);
  });
});
