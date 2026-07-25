#!/usr/bin/env bun
// 最小接入示例：一个假 harness 实现 ChatProtocol，演示 chat-tui 的全部交互。
//   bun examples/echo.tsx
// 试试：输入任意文字（流式回显 + 假工具调用；输出超预算时自动折叠，Ctrl+O 展开/收起）、
//   /model（picker）、/approve（审批卡片）、/question（结构化提问）、Shift+Enter 或 Ctrl+J 换行、
//   跑着时 Esc 打断、Ctrl+C 分层语义、/exit 退出。

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import {
  ChatShell,
  type ChatProtocol,
  type ChatViewState,
  type CommandSpec,
  type InteractionResponse,
  type TranscriptItem,
} from "../src/index.ts";

const COMMANDS: readonly CommandSpec[] = [
  { name: "model", description: "Pick a model (demo picker)" },
  { name: "approve", description: "Trigger a demo approval card" },
  { name: "question", description: "Trigger a demo structured question" },
  { name: "diff", description: "Show diff rendering for all file ops" },
  { name: "plan", description: "Demo the pinned plan (steps auto-complete)" },
  { name: "exit", description: "Exit" },
];

/** 演示用 harness：submit 后流式回显输入，并伴随一个假工具调用。 */
class EchoHarness implements ChatProtocol {
  private model = "demo";

  /** Provider Status 主行：输入目标常驻，运行相位仅 busy 时附加（对齐 runStatus 语义） */
  private agentStatus(phase?: string) {
    return [
      phase
        ? { id: "agent", author: "echo", label: `${this.model} · ${phase}`, startedAt: Date.now(), hint: "Esc to interrupt" }
        : { id: "agent", author: "echo", label: this.model },
    ];
  }

  private view: ChatViewState = {
    transcript: [],
    header: "chat-tui demo · type to chat · /model picker · /approve approval · /exit quit",
    runStatus: [{ id: "agent", author: "echo", label: "demo" }],
    composerPlaceholder: "Message (/ commands, Ctrl+J newline)",
    footer: "chat-tui echo example",
    showThoughts: true,
  };
  private listeners = new Set<() => void>();
  private items: TranscriptItem[] = [];
  private nextId = 1;
  private streaming: ReturnType<typeof setInterval> | null = null;

  getView(): ChatViewState {
    return this.view;
  }

  subscribe(onChange: () => void): () => void {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  }

  /** 快照式更新：整体替换 view 对象再通知（getView 的引用稳定性要求） */
  private patch(patch: Partial<ChatViewState>): void {
    this.view = { ...this.view, transcript: [...this.items], ...patch };
    for (const listener of this.listeners) listener();
  }

  submit(text: string): void {
    const id = () => `m_${this.nextId++}`;
    this.items.push({ type: "message", id: id(), role: "user", author: "you", text });
    const thoughtId = id();
    this.items.push({
      type: "block",
      id: thoughtId,
      kind: "thought",
      status: "in_progress",
      author: "echo",
      title: "Echoing what you said…",
    });
    const toolId = id();
    this.items.push({
      type: "block",
      id: toolId,
      kind: "tool",
      author: "echo",
      title: "Running echo --stream",
      status: "in_progress",
      content: { type: "output", lines: [] },
    });
    const replyId = id();
    this.items.push({
      type: "message",
      id: replyId,
      role: "agent",
      author: "echo",
      text: "",
      format: "markdown",
      streaming: true,
    });
    this.patch({
      busy: true,
      runStatus: this.agentStatus("thinking…"),
    });

    // 逐字符流式回显，模拟 agent 输出；工具输出逐行累积——
    // 运行中演示"跟尾部"折叠，完成后演示"头尾各留"折叠（Ctrl+O 展开全部）
    let cursor = 0;
    const toolLines: string[] = [];
    this.streaming = setInterval(() => {
      cursor++;
      const reply = this.items.find((item): item is TranscriptItem & { type: "message" } => item.id === replyId && item.type === "message");
      const thought = this.items.find((item): item is TranscriptItem & { type: "block" } => item.id === thoughtId && item.type === "block");
      const tool = this.items.find((item): item is TranscriptItem & { type: "block" } => item.id === toolId && item.type === "block");
      if (reply) reply.text = text.slice(0, cursor);
      toolLines.push(`echoed ${cursor}/${text.length} chars`);
      if (tool) tool.content = { type: "output", lines: [...toolLines] };
      if (cursor >= text.length) {
        this.stopStreaming();
        if (reply) reply.streaming = false;
        if (thought) thought.status = "completed";
        if (tool) {
          tool.status = "completed";
          tool.title = "Ran echo --stream";
        }
        this.patch({ busy: false, runStatus: this.agentStatus() });
        return;
      }
      this.patch({});
    }, 60);
  }

  command(name: string, argument: string): void {
    if (name === "exit") {
      void this.exit();
      return;
    }
    if (name === "diff") {
      // 四种文件操作语义各来一块：全部按 Codex 式 unified diff 完整展示，
      // move 在文件标题中额外展示旧路径。
      const modifyPatch = [
        "--- src/render.ts",
        "+++ src/render.ts",
        "@@ -10,7 +10,8 @@",
        " export function render(items: Item[]): string {",
        "   const out: string[] = [];",
        "   for (const item of items) {",
        "-    out.push(item.title);",
        "+    // include status so finished items are visually distinct",
        "+    out.push(`${item.status} ${item.title}`);",
        "   }",
        "   return out.join(\"\\n\");",
        " }",
      ].join("\n");
      const addPatch = [
        "--- /dev/null",
        "+++ src/utils/format.ts",
        "@@ -0,0 +1,5 @@",
        "+export function formatSize(bytes: number): string {",
        "+  if (bytes < 1024) return `${bytes}B`;",
        "+  const kb = bytes / 1024;",
        "+  return kb < 1024 ? `${kb.toFixed(1)}KB` : `${(kb / 1024).toFixed(1)}MB`;",
        "+}",
      ].join("\n");
      const deletePatch = [
        "--- src/legacy.ts",
        "+++ /dev/null",
        "@@ -1,4 +0,0 @@",
        "-// superseded by utils/format.ts",
        "-export function legacyFormat(n: number): string {",
        "-  return String(n);",
        "-}",
      ].join("\n");
      this.items.push({
        type: "block",
        id: `m_${this.nextId++}`,
        kind: "tool",
        title: "ApplyPatch: 4 file operations",
        // 演示 outcome × tone 双轴：结果 completed（✓），tone=warning 提示需留痕（如自动审批批准）——
        // ✓ 不被遮成 ⚠，只着警示色。
        status: "completed",
        tone: "warning",
        content: [
          { type: "diff", op: "modify", path: "src/render.ts", patch: modifyPatch },
          { type: "diff", op: "add", path: "src/utils/format.ts", patch: addPatch },
          { type: "diff", op: "delete", path: "src/legacy.ts", patch: deletePatch },
          { type: "diff", op: "move", path: "src/utils/id.ts", oldPath: "src/id.ts" },
        ],
      });
      this.patch({});
      return;
    }
    if (name === "model") {
      this.patch({
        picker: {
          id: "picker_model",
          title: "Select model (demo)",
          options: [
            { name: "fast", description: "low latency", value: "fast" },
            { name: "smart", description: "high quality", value: "smart" },
          ],
        },
      });
      return;
    }
    if (name === "approve") {
      this.patch({
        interactions: [{
          id: "approval_demo",
          kind: "approval",
          blocking: true,
          requester: "echo",
          approval: {
            title: `Run "rm -rf ${argument || "/tmp/demo"}"?`,
            options: [
              { optionId: "yes", name: "Allow", kind: "allow_once" },
              { optionId: "no", name: "Deny", kind: "reject_once" },
            ],
          },
        }],
      });
      return;
    }
    if (name === "plan") {
      // 演示 pinned plan：4 步计划每秒推进一步；全部完成后停发 plan，pin 区随之消失
      const steps = ["collect inputs", "draft outline", "write sections", "final review"];
      let done = 0;
      const tick = () => {
        this.patch({
          plan:
            done >= steps.length
              ? undefined
              : steps.map((content, index) => ({
                  content,
                  status: index < done ? ("completed" as const) : index === done ? ("in_progress" as const) : ("pending" as const),
                })),
        });
        if (done++ < steps.length) setTimeout(tick, 1000);
      };
      tick();
      return;
    }
    if (name === "question") {
      this.patch({
        interactions: [{
          id: "question_demo",
          kind: "question",
          blocking: true,
          requester: "echo",
          question: {
            questions: [
              {
                id: "approach",
                header: "Approach",
                question: "How should the demo proceed?",
                options: [
                  { label: "Fast", description: "Prefer the shortest path" },
                  { label: "Careful", description: "Add more verification" },
                ],
                allowOther: true,
              },
            ],
          },
        }],
      });
    }
  }

  cancel(): void {
    if (!this.view.busy) return;
    this.stopStreaming();
    for (const item of this.items) {
      if (item.type === "block" && item.status === "in_progress") item.status = "failed";
    }
    this.patch({ busy: false, runStatus: this.agentStatus(), status: { text: "Interrupted", tone: "info" } });
  }

  exit(): void {
    this.stopStreaming();
    process.exit(0);
  }

  resolvePicker(_id: string, value: string | null): void {
    if (value) this.model = value;
    this.patch({
      picker: null,
      runStatus: this.view.busy ? this.view.runStatus : this.agentStatus(),
      status: value ? { text: `Model set to ${value}`, tone: "info" } : null,
    });
  }

  resolveInteraction(_id: string, response: InteractionResponse): void {
    this.patch({
      interactions: [],
      status: { text: `Interaction answered: ${JSON.stringify(response)}`, tone: "info" },
    });
  }

  private stopStreaming(): void {
    if (this.streaming) clearInterval(this.streaming);
    this.streaming = null;
  }
}

if (!process.stdout.isTTY) {
  console.error("chat-tui example requires a real terminal (TTY)");
  process.exit(1);
}
// Ctrl+C 由 ChatShell 接管（分层语义）；autoFocus=false 防止鼠标点击把焦点从输入框抢走
const renderer = await createCliRenderer({ exitOnCtrlC: false, targetFps: 30, autoFocus: false });
createRoot(renderer).render(<ChatShell protocol={new EchoHarness()} commands={COMMANDS} />);
