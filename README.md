# chat-tui

Chat/agent UI components for the terminal, built on [opentui](https://github.com/anomalyco/opentui).

Building a Claude Code / Codex style CLI means rebuilding the same chat surface every time: a multi-line composer with slash-command and mention completion, streaming transcript with thinking and tool-call rendering, approval prompts, layered Ctrl+C semantics. chat-tui packages that surface as reusable components behind one small protocol, and keeps everything agent-specific out.

**State snapshots in, intents out.** chat-tui deliberately knows nothing about sessions, providers, LLM APIs, or wire protocols. Your harness (local agent loop, or a thin client for a remote one) implements `ChatProtocol`; chat-tui renders and interacts.

## Install

```bash
bun add chat-tui @opentui/core @opentui/keymap @opentui/react react
```

## Quick start

Implement `ChatProtocol` and hand it to `ChatShell`:

```tsx
import {
  createCliRenderer,
  createClipboard,
  createHostClipboard,
  createRendererClipboardAdapter,
} from "@opentui/core";
import { createRoot } from "@opentui/react";
import {
  ChatShell,
  createChatStore,
  type ChatProtocol,
  type InteractionResponse,
} from "chat-tui";

class MyHarness implements ChatProtocol {
  // outputs: harness → TUI
  readonly stateStore = createChatStore({
    timeline: { items: [] },
    composer: {},
    activity: {},
    footer: {},
    sidecar: undefined,
  });

  // inputs: TUI → harness
  submit(text: string) { /* send to local or remote agent */ }
  command(name: string, argument: string) { /* /model, /exit, … */ }
  cancel() { /* interrupt the running turn */ }
  exit() { /* graceful shutdown */ }
  searchPicker(id: string, query: string) { /* refresh a remote-search picker */ }
  resolvePicker(id: string, value: string | null) { /* … */ }
  resolveInteraction(id: string, response: InteractionResponse) { /* … */ }
}

const renderer = await createCliRenderer({ exitOnCtrlC: false, autoFocus: false });
const clipboard = createClipboard({
  host: createHostClipboard(),
  terminal: createRendererClipboardAdapter(renderer),
});
createRoot(renderer).render(
  <ChatShell
    protocol={new MyHarness()}
    commands={[{ name: "exit", description: "Exit" }]}
    clipboard={clipboard}
  />,
);

// During graceful shutdown: await clipboard.dispose(), then renderer.destroy().
```

Run the full demo (fake streaming harness, no agent required):

```bash
bun install
bun examples/echo.tsx
```

## What you get

- **Persistent composer** — multi-line editing, slash commands, mentions, input history, queued follow-ups, and layered terminal key behavior; large pastes fold into atomic tokens and expand back to the full original on submit
- **Streaming timeline** — plain or Markdown messages, stable render groups, activity blocks, plans, code, commands, output, and diffs with display-only clipping; global Ctrl+O expansion plus per-block expand/collapse via clip hints, and Ctrl+Shift+Y to copy the latest agent message
- **Activity with rotating tips** — running status rows can carry harness-injected `tips`, rotated every 10s, rendered only while active
- **Optional Parallel region** — current parallel work stays in compact items below the footer, outside the historical timeline
- **Human interaction** — searchable pickers, permission decisions, structured questions, and suggested inputs anchored near the composer
- **Independent Surfaces** — Timeline, Composer, Activity, Footer, optional Parallel, and Sidecar subscribe only to the State they consume
- **Optional sidecar** — generic auxiliary State renders beside the main chat when space allows, or as an explicit overlay
- **Composable UI** — use `ChatShell` for the complete interface or compose exported Surfaces and focused building blocks with an injectable theme
- **Native clipboard and selection** — OpenTUI owns host/terminal clipboard fallback plus click-repeat semantics; chat-tui only adds product token boundaries for paths, URLs, and IDs
- **Layered input routing** — components declare semantic behaviors in focus-aware layers; one matched behavior consumes a contested key. All default keys live in one exported definitions table (`defaultKeybinds`), with per-action user overrides via the `keybinds` prop

## Support and limits

chat-tui describes UI capabilities, not provider capabilities. Your harness decides what an agent
provider supports and how each operation maps to it.

### User → harness

| Interaction | Boundary |
|---|---|
| Text and commands | `submit()` handles text; registered slash commands use `command()`. Attachments and arbitrary structured input are not modeled |
| Interrupt and exit | `cancel()` and `exit()` express intent; the harness owns provider interruption and process shutdown |
| Mode cycling | Optional `cycleMode()` maps `Shift+Tab` to the harness-defined next mode |
| Queue and history | Compact preview plus an optional item manager emit recall, discard, reorder, and dispatch-now intents; queue ownership and same-turn steering remain in the harness |
| Generic choice | Picker supports static options, local filtering, and harness-owned remote search |
| Human interaction | Permission, structured question, and suggested-input variants share `resolveInteraction()`; each active item declares its exact `cancelResponse`, while chat-tui maps Esc to that semantic cancel intent |

### Harness → user

| Output | Boundary |
|---|---|
| Messages and activity | Plain/Markdown messages and open-ended activity blocks are display shapes, not provider events |
| Streaming updates | Publish complete State snapshots; Store notifies only consumers of changed State |
| Long content | Clipping is display-only. The harness always supplies complete content |
| Status and plan | Activity, optional Parallel items, toast, footer, and plan labels are display-ready; lifecycle and visibility policy remain in the harness |
| Auxiliary information | Sidecar accepts generic sections and items without understanding Board, context, or diagnostic semantics |

## Architecture at a glance

```text
provider events → harness → State snapshots → Store → Surface
user input      → Surface → ChatProtocol intent → harness
```

State organizes display data, Store publishes and subscribes, and Surface renders independently.
They correspond naturally but are not required to be one-to-one. `ChatShell` composes the default
Surfaces without subscribing to their State.

## Design docs

- [`docs/kernel.md`](docs/kernel.md) — core model, bidirectional flow, dependency boundaries, and verification constraints
- [`docs/surfaces.md`](docs/surfaces.md) — visual hierarchy, Surface responsibilities, and interaction invariants
- [`docs/input-routing.md`](docs/input-routing.md) — keyboard layers, behavior ownership, propagation, and protocol boundary

## Development

```bash
bun install
bun run check   # typecheck + tests
```

Runtime target is [Bun](https://bun.sh); the package exports TypeScript source directly (no build step), same as consuming opentui from Bun.

## License

Apache-2.0
