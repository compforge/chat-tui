# chat-tui

Chat/agent UI components for the terminal, built on [opentui](https://github.com/anomalyco/opentui).

Building a Claude Code / Codex style CLI means rebuilding the same chat surface every time: a multi-line composer with slash-command and mention completion, streaming transcript with thinking and tool-call rendering, approval prompts, layered Ctrl+C semantics. chat-tui packages that surface as reusable components behind one small protocol, and keeps everything agent-specific out.

**View models in, intents out.** chat-tui deliberately knows nothing about sessions, providers, LLM APIs, or wire protocols. Your harness (local agent loop, or a thin client for a remote one) implements `ChatProtocol`; chat-tui renders and interacts.

## Install

```bash
bun add chat-tui @opentui/core @opentui/react react
```

## Quick start

Implement `ChatProtocol` and hand it to `ChatShell`:

```tsx
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { ChatShell, type ChatProtocol, type ChatViewState } from "chat-tui";

class MyHarness implements ChatProtocol {
  // outputs: harness → TUI (snapshot + change notification)
  getView(): ChatViewState { /* transcript, busy, queued, approval, … */ }
  subscribe(onChange: () => void): () => void { /* notify on change */ }

  // inputs: TUI → harness
  submit(text: string) { /* send to local or remote agent */ }
  command(name: string, argument: string) { /* /model, /exit, … */ }
  cancel() { /* interrupt the running turn */ }
  exit() { /* graceful shutdown */ }
  resolvePicker(id: string, value: string | null) { /* … */ }
  resolveApproval(id: string, optionId: string) { /* … */ }
  resolveQuestion(id: string, answers: Record<string, string[]>) { /* … */ }
}

const renderer = await createCliRenderer({ exitOnCtrlC: false, autoFocus: false });
createRoot(renderer).render(
  <ChatShell protocol={new MyHarness()} commands={[{ name: "exit", description: "Exit" }]} />,
);
```

Run the full demo (fake streaming harness, no agent required):

```bash
bun install
bun examples/echo.tsx
```

## What you get

- **Composer** — multi-line input: Enter submits, Shift+Enter / Option+Enter / Ctrl+J insert a newline; grows with content; bracketed-paste-safe (via opentui textarea)
- **Completion** — `/` command and `@` mention candidates (Tab complete, ↑↓ select, Esc dismiss); command list and mention sources are injected
- **Transcript** — sticky-bottom scroll; plain/Markdown messages plus unified activity blocks (`status + kind + author? + title + content`) for thoughts, tools, plans, and custom activity; Markdown supports streaming updates, code fences, tables, and links; per-item render override remains available
- **Height budget** — long text, output, command, and code content is clipped to a visual-row budget (wrap-aware, so one long line can't flood the viewport), while diffs stay fully visible like Codex; `… +N lines (ctrl+o to expand)` hints and Ctrl+O toggles clipped content; the clip policy is injectable (`clipPolicy`) and data is never truncated
- **Steering queue** — queued follow-up inputs rendered with previews; ↑ recalls the latest queued message for editing (the queue itself lives in your harness)
- **Interaction Dock** — completion, picker, approval, structured-question, and suggested-input surfaces anchored to the composer; request identity and lifecycle remain in the harness
- **Optional sidecar** — generic section/item snapshots render as a 42-column right rail on wide terminals or an explicit overlay on narrow terminals; empty data consumes no space
- **Keys** — Ctrl+C clears the full draft and exits on a second press, Ctrl+D exits on EOF, Esc interrupts, Ctrl+O expands/collapses clipped blocks
- **Theme** — one theme object (tokyo-night defaults), overridable per consumer

All interaction logic that can be pure is pure (`triggerAt`, `applyCompletion`, `parseSlashCommand`, `ctrlCAction`) and unit-tested; components stay thin. Use `ChatShell` for the whole surface, or compose `Transcript` / `Composer` / `Suggestions` / `Picker` / `InteractionDock` / `ApprovalCard` / `QuestionCard` / `QueuedList` / `ToastLine` yourself.

## Capability matrix

chat-tui describes UI capabilities, not provider capabilities. A check here means the UI can collect or render the shape; the harness still decides whether an agent provider supports the operation and how to map it.

### User → harness

| Interaction | UI surface | Support | Boundary |
|---|---|---|---|
| Text message | Composer → `submit(text)` | Yes | Text only; attachments and structured content are not modeled |
| Suggested input | `InteractionView(kind: "suggested_input")` → InteractionDock → editable Composer | Yes | `Ctrl+Y` loads it only into an empty composer; Enter or Ctrl+C resolves it with its stable identity |
| Model switch | `picker` + `resolvePicker()`, or a command | UI only | There is no model concept in chat-tui; discovery, current selection, and application belong to the harness |
| Harness/product slash command | Completion → `command(name, argument)` | Yes | The command registry and semantics are injected by the harness |
| Provider-compatible slash command | Same `command()` intent | UI only | chat-tui does not distinguish ownership; the harness must discover and route provider commands explicitly |
| Interrupt | Esc → `cancel()` | Yes | The harness maps it to the provider's cancel/interrupt operation; Ctrl+C is reserved for clearing the composer / confirming exit |
| Queued follow-up | `queued` + `recallQueued()` | Yes | Display and recall only; the harness owns the queue |
| Input recall / history | ↑/↓ → `recallQueued()` / `historyPrev()` / `historyNext()` | Yes | ↑ recalls a queued input first (empty draft), then walks input history when the cursor is at a buffer boundary; ↓ walks forward and restores the stashed draft. The harness owns the history list and decides continuation |
| Same-turn steer | No distinct intent | No | A queued follow-up is not the same as steering an active provider turn |
| Generic single choice | `picker` → `resolvePicker()` | Yes | One question, one option, or dismiss; suitable for model/session selection |
| Permission decision | `InteractionView(kind: "approval")` → `resolveInteraction()` | Yes | One request with provider-defined options; intentionally not dismissible |
| Structured agent question | `InteractionView(kind: "question")` → `resolveInteraction()` | Partial | Multiple questions, multi-select, free text/“Other”, and previews are supported; `secret` is carried in the view contract but the default terminal input is not masked |
| Structured elicitation/form | — | No | Arbitrary MCP/provider forms are outside the current protocol |

### Harness → user

| Output | View shape | Support | Boundary |
|---|---|---|---|
| User/agent text | `TranscriptItem.message` | Yes | Explicit plain/Markdown format; plain is the backward-compatible default, and streaming Markdown uses `streaming: true` until complete |
| Streaming updates | Repeated immutable `ChatViewState` snapshots | Yes | The harness reduces provider deltas before publishing a snapshot |
| Thought/tool/plan/custom activity | `TranscriptItem.block` | Yes | `kind` is open; optional `author` labels attribution in multi-agent timelines; chat-tui does not interpret provider events |
| Block content | `text` / `lines` / `plan` / `code` / `command` / `output` / `diff` | Yes | Code uses Tree-sitter syntax highlighting; diff uses a Codex-style, line-numbered unified view with file headers and colored add/remove statistics |
| Long content | Text/output/code/command are clipped to a visual-row budget; diffs stay expanded | Yes | Pass full content; clipping is display-only, Ctrl+O expands clipped blocks, and the policy (`clipPolicy`) is injectable |
| Provider status and usage | `runStatus` / `toast` / `footer` | Yes | `runStatus` renders as present-tense status lines attached to the composer top (first item = current input target + run phase, extra items = other active agents; author colored via `agentColorFor`, elapsed ticks locally from `startedAt`); labels are preformatted — semantics stay in the harness |
| Auxiliary sidecar | `sidecar` | Yes | Display-ready sections/items only; empty data hides completely, wide terminals render inline, and narrow terminals require `mode: "open"` |
| Pinned plan | `plan` | Yes | Pins the active plan above the queued list; long plans window around the first unfinished entry; visibility policy belongs to the harness (send entries only while unfinished) |
| Human interaction | `interactions: InteractionView[]` | Yes | InteractionDock presents the first ordered request and shows queue position; blocking policy and durable lifecycle remain in the harness |
| Provider request for action | `picker` / `interactions` | Partial | Simple choice, permission, structured questions, and suggested inputs are covered; arbitrary provider dialogs/forms are not |

## Protocol at a glance

| Direction | Surface | Meaning |
|---|---|---|
| harness → TUI | `getView(): ChatViewState` | full view snapshot: transcript items, busy, queued, ordered interactions, picker, optional sidecar, toast, footer |
| harness → TUI | `subscribe(cb)` | change notification; `getView()` must return a stable reference between changes |
| TUI → harness | `submit(text)` | user message; recognized slash commands go to `command()` instead |
| TUI → harness | `command(name, argument)` | registered slash command invocation |
| TUI → harness | `cancel()` / `exit()` | interrupt turn / graceful shutdown |
| TUI → harness | `resolvePicker(...)` / `resolveInteraction(...)` | answers to picker or InteractionDock requests |
| TUI → harness | `dismissSidecar()` | optional intent emitted when Esc closes a narrow-screen sidecar overlay |
| TUI → harness | `recallQueued()` | ↑ recall of the latest queued input |
| TUI → harness | `historyPrev(current)` / `historyNext(current)` | ↑/↓ input-history recall at a buffer boundary; the harness owns the history and decides whether to navigate |

Transcript items are display-shaped (`message` / `block`): your harness reduces its own event stream (Claude SDK, codex app-server, SSE from a remote server, …) into them. A block carries a status, open-ended kind, title, optional author (attribution in multi-agent timelines, colored via the same `agentColorFor` used for message authors), and optional display-ready content; provider-specific event and content-block semantics stay in the harness.

## Development

```bash
bun install
bun run check   # typecheck + tests
```

Runtime target is [Bun](https://bun.sh); the package exports TypeScript source directly (no build step), same as consuming opentui from Bun.

## License

Apache-2.0
