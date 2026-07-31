// ComposerSurface：持有 draft、焦点和输入交互；订阅 composer State 与 sidecar 布局。

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  ComposerEditor,
  composerHeightFor,
  type ComposerHandle,
} from "./editor.tsx";
import { parseSlashCommand } from "./commands.ts";
import {
  acceptCompletion,
  buildCandidates,
  triggerAt,
  type Candidate,
} from "./completion.ts";
import { InteractionDock } from "./interactions/dock.tsx";
import { Picker } from "./interactions/picker.tsx";
import { Suggestions } from "./interactions/suggestions.tsx";
import { useExitConfirmation } from "./exit-confirmation.ts";
import { usePickerController } from "./picker-controller.ts";
import { InputArea } from "./queued.tsx";
import {
  INPUT_LAYER_PRIORITY,
  useInputBindings,
} from "../../input/keyboard.tsx";
import type { ChatProtocol } from "../../protocol/chat-protocol.ts";
import type { CommandSpec } from "../../protocol/command.ts";
import type { InteractionView } from "../../state/composer.ts";
import type { ToastMessage } from "../../state/footer.ts";
import type { ChatStore } from "../../store/chat-store.ts";
import { useStoreState } from "../../store/react.ts";
import { type Theme } from "../../theme.ts";
import { ActivitySurface } from "../activity/surface.tsx";

const CTRL_C_EXIT_HINT = "Press Ctrl+C again to exit";
const CTRL_C_CLEARED_HINT = "Draft cleared; press Ctrl+C again to exit";

export interface ComposerSurfaceProps {
  protocol: ChatProtocol;
  store: ChatStore;
  commands: readonly CommandSpec[];
  mentions?: (prefix: string) => Candidate[];
  theme: Theme;
  setLocalToast: Dispatch<SetStateAction<ToastMessage | null>>;
}

export const ComposerSurface = memo(function ComposerSurface(
  props: ComposerSurfaceProps,
): ReactNode {
  const { protocol } = props;
  const theme = props.theme;
  const composerView = useStoreState(props.store, "composer");
  const setLocalToast = props.setLocalToast;

  const [draft, setDraft] = useState("");
  const composer = useRef<ComposerHandle | null>(null);
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [suggIdx, setSuggIdx] = useState(0);
  const [suggDismissed, setSuggDismissed] = useState(false);
  const exitConfirmation = useExitConfirmation(setLocalToast);

  const resetComposer = useCallback(() => {
    // textarea 自持内部 buffer，draft 只是镜像（供候选推导/按键分层用），两边都要清
    setDraft("");
    composer.current?.clear();
  }, []);

  // 候选由输入实时推导（/ 行首=命令，@ =引用），无独立状态需要同步
  const trigger = triggerAt(draft);
  const interactions = composerView.interactions ?? [];
  const editingSuggestion = editingSuggestionId
    ? interactions.find(
        (
          interaction,
        ): interaction is Extract<InteractionView, { kind: "suggested_input" }> =>
          interaction.id === editingSuggestionId && interaction.kind === "suggested_input",
      )
    : undefined;
  const visibleInteractions = editingSuggestionId
    ? interactions.filter((interaction) => interaction.id !== editingSuggestionId)
    : interactions;
  const activeInteraction = visibleInteractions[0] ?? null;
  const blockingInteraction =
    activeInteraction?.kind === "approval" || activeInteraction?.kind === "question";
  const choosingSuggestedInput =
    activeInteraction?.kind === "suggested_input" && !draft;
  const picker = composerView.picker ?? null;
  const searchPicker = useCallback(
    (id: string, query: string) => protocol.searchPicker(id, query),
    [protocol],
  );
  const pickerController = usePickerController(picker, searchPicker);
  const candidates =
    trigger && !suggDismissed && !blockingInteraction && !picker
      ? buildCandidates(trigger, { commands: props.commands, mentions: props.mentions })
      : [];
  const sel = candidates.length ? Math.min(suggIdx, candidates.length - 1) : 0;

  // 焦点安全网：浮层都关闭时确保焦点回到输入框。focused prop 只在值变化时生效，
  // 覆盖不到"焦点被别处拿走但 prop 没变"的场景；focus() 对已聚焦者是 no-op，代价可忽略。
  useEffect(() => {
    if (!blockingInteraction && !choosingSuggestedInput && !picker) {
      composer.current?.focus();
    }
  });

  useEffect(() => {
    if (editingSuggestionId && !editingSuggestion) setEditingSuggestionId(null);
  }, [editingSuggestion, editingSuggestionId]);

  const releaseEditingSuggestion = useCallback(() => {
    setEditingSuggestionId(null);
  }, []);

  const useSuggestedInput = useCallback(
    (interaction: Extract<InteractionView, { kind: "suggested_input" }>) => {
      if (draft) {
        setLocalToast({ text: "Clear the composer before using this suggestion", tone: "info" });
        return;
      }
      setEditingSuggestionId(interaction.id);
      setDraft(interaction.text);
      composer.current?.setText(interaction.text);
      composer.current?.focus();
      setLocalToast(null);
    },
    [draft],
  );

  const send = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const sourceSuggestion = editingSuggestion;
      resetComposer();
      setLocalToast(null);
      try {
        if (sourceSuggestion) {
          await protocol.resolveInteraction(sourceSuggestion.id, {
            kind: "suggested_input",
            outcome: "submitted",
            text: trimmed,
          });
          setEditingSuggestionId(null);
        } else {
          const command = parseSlashCommand(trimmed, props.commands);
          if (command) {
            await protocol.command(command.name, command.argument);
          } else {
            await protocol.submit(trimmed);
          }
        }
      } catch (error) {
        setEditingSuggestionId(null);
        setLocalToast({ text: error instanceof Error ? error.message : String(error), tone: "error" });
      }
    },
    [editingSuggestion, props.commands, protocol, resetComposer],
  );

  const busy = composerView.busy ?? false;
  useInputBindings(() => ({
    priority: INPUT_LAYER_PRIORITY.surface,
    commands: [
      {
        name: "composer.clear-or-exit",
        run: () => {
          // Ctrl+C 只管理 composer/退出；当前 turn 的中断统一归 Esc。
          const action = exitConfirmation.nextAction(draft !== "");
          if (action === "clear-draft") {
            releaseEditingSuggestion();
            resetComposer();
            setSuggIdx(0);
            exitConfirmation.arm(CTRL_C_CLEARED_HINT);
          } else if (action === "exit") {
            void protocol.exit();
          } else {
            exitConfirmation.arm(CTRL_C_EXIT_HINT);
          }
        },
      },
      {
        name: "composer.exit-eof",
        run: () => {
          exitConfirmation.disarm();
          if (draft || busy) return false;
          void protocol.exit();
        },
      },
      {
        name: "composer.cycle-mode",
        run: () => {
          exitConfirmation.disarm();
          if (!protocol.cycleMode || blockingInteraction || picker) return false;
          void Promise.resolve()
            .then(() => protocol.cycleMode?.())
            .catch((error) => {
              setLocalToast({
                text:
                  error instanceof Error ? error.message : String(error),
                tone: "error",
              });
            });
        },
      },
      {
        name: "turn.cancel",
        run: () => {
          exitConfirmation.disarm();
          if (!busy) return false;
          protocol.cancel();
        },
      },
      {
        name: "composer.history-previous",
        run: () => {
          exitConfirmation.disarm();
          if (blockingInteraction || picker) return false;
          // ↑：队列召回（仅空输入）→ 历史回溯（光标在边界）→ 光标上移。
          if (!draft) {
            const recalled = protocol.recallQueued?.();
            if (recalled) {
              releaseEditingSuggestion();
              setDraft(recalled.text);
              composer.current?.setText(recalled.text);
              setLocalToast({
                text: "Recalled queued message; edit and resend",
                tone: "info",
              });
              return;
            }
          }
          if (!(composer.current?.cursorAtBoundary() ?? true)) return false;
          const entry = protocol.historyPrev?.(draft);
          if (!entry) return false;
          releaseEditingSuggestion();
          setDraft(entry.text);
          composer.current?.setText(entry.text);
        },
      },
      {
        name: "composer.history-next",
        run: () => {
          exitConfirmation.disarm();
          if (
            blockingInteraction ||
            picker ||
            !(composer.current?.cursorAtBoundary() ?? true)
          ) {
            return false;
          }
          const entry = protocol.historyNext?.(draft);
          if (!entry) return false;
          releaseEditingSuggestion();
          setDraft(entry.text);
          composer.current?.setText(entry.text);
        },
      },
    ],
    bindings: [
      { key: "ctrl+c", cmd: "composer.clear-or-exit" },
      { key: "ctrl+d", cmd: "composer.exit-eof" },
      { key: "shift+tab", cmd: "composer.cycle-mode" },
      { key: "escape", cmd: "turn.cancel" },
      { key: "up", cmd: "composer.history-previous" },
      { key: "down", cmd: "composer.history-next" },
    ],
  }));

  const acceptSuggestion = useCallback(
    (key: "tab" | "enter") => {
      if (!trigger) return;
      const chosen = candidates[sel];
      if (!chosen) return;
      const accepted = acceptCompletion(draft, trigger, chosen, key);
      if (accepted.submit) {
        void send(accepted.text);
      } else {
        setDraft(accepted.text);
        composer.current?.setText(accepted.text);
        setSuggIdx(0);
      }
    },
    [candidates, draft, sel, send, trigger],
  );

  // Overlay 固定为 FooterSurface 预留两行（toast + footer），让 footer 更新
  // 无需反向通知 ComposerSurface 重新计算锚点。
  const dockBottom = composerHeightFor(draft) + 2;
  const handleComposerChange = useCallback(
    (text: string) => {
      if (text) exitConfirmation.disarm();
      setDraft(text);
      setSuggDismissed(false);
      setSuggIdx(0);
    },
    [exitConfirmation.disarm],
  );
  const handleComposerSubmit = useCallback(
    (text: string) => void send(text),
    [send],
  );

  return (
    <>
      <InputArea items={composerView.queued ?? []} theme={theme}>
        <box
          style={{
            width: "100%",
            flexShrink: 0,
            marginTop: 1,
            flexDirection: "column",
          }}
        >
          <ActivitySurface
            store={props.store}
            theme={theme}
          />
          <ComposerEditor
            ref={composer}
            placeholder={composerView.placeholder}
            focused={!blockingInteraction && !choosingSuggestedInput && !picker}
            busy={busy}
            theme={theme}
            onChange={handleComposerChange}
            onSubmit={handleComposerSubmit}
          />
        </box>
      </InputArea>

      <Suggestions
        candidates={candidates}
        selectedIndex={sel}
        anchorBottom={dockBottom}
        theme={theme}
        onPrevious={() =>
          setSuggIdx((index) =>
            (index - 1 + candidates.length) % candidates.length
          )}
        onNext={() =>
          setSuggIdx((index) => (index + 1) % candidates.length)
        }
        onAccept={acceptSuggestion}
        onDismiss={() => setSuggDismissed(true)}
      />

      {picker && !blockingInteraction && !activeInteraction && (
        <Picker
          picker={picker}
          query={pickerController.query}
          selectedIndex={pickerController.selectedIndex}
          anchorBottom={dockBottom}
          theme={theme}
          onQueryChange={pickerController.updateQuery}
          onSelectionChange={pickerController.updateSelectedIndex}
          onSelect={(value) => protocol.resolvePicker(picker.id, value)}
          onCancel={() => protocol.resolvePicker(picker.id, null)}
        />
      )}

      <InteractionDock
        interactions={visibleInteractions}
        anchorBottom={dockBottom}
        canUseSuggestedInput={!draft}
        theme={theme}
        onUseSuggestedInput={useSuggestedInput}
        onResolve={(id, response) => void protocol.resolveInteraction(id, response)}
      />
    </>
  );
});
