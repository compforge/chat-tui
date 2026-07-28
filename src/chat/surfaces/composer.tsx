// ComposerSurface：持有 draft、焦点和输入交互，只订阅 composer Surface。

import { useKeyboard } from "@opentui/react";
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
} from "../../components/composer.tsx";
import { parseSlashCommand } from "../../components/commands.ts";
import {
  acceptCompletion,
  buildCandidates,
  triggerAt,
  type Candidate,
} from "../../components/completion.ts";
import { InteractionDock } from "../../components/interaction-dock.tsx";
import {
  Picker,
  Suggestions,
  visiblePickerOptions,
} from "../../components/interaction-widgets.tsx";
import { CTRL_C_CONFIRM_WINDOW_MS, ctrlCAction, escapeAction } from "../../components/keys.ts";
import { InputArea } from "../../components/queued.tsx";
import type { SidecarLayout } from "../../components/sidecar.tsx";
import type { ChatProtocol } from "../../protocol/index.ts";
import type { ChatSurfaces } from "../../protocol/surfaces.ts";
import { useSurface } from "../../surface.ts";
import {
  type CommandSpec,
  type InteractionView,
  type Theme,
  type ToastMessage,
} from "../../types/index.ts";
import { ActivitySurface } from "./activity.tsx";

const CTRL_C_EXIT_HINT = "Press Ctrl+C again to exit";
const CTRL_C_CLEARED_HINT = "Draft cleared; press Ctrl+C again to exit";

export interface ComposerSurfaceProps {
  protocol: ChatProtocol;
  surfaces: ChatSurfaces;
  commands: readonly CommandSpec[];
  mentions?: (prefix: string) => Candidate[];
  theme: Theme;
  sidecarLayout: SidecarLayout;
  setLocalToast: Dispatch<SetStateAction<ToastMessage | null>>;
}

export const ComposerSurface = memo(function ComposerSurface(
  props: ComposerSurfaceProps,
): ReactNode {
  const { protocol } = props;
  const theme = props.theme;
  const composerView = useSurface(props.surfaces.composer);
  const setLocalToast = props.setLocalToast;

  const [draft, setDraft] = useState("");
  const composer = useRef<ComposerHandle | null>(null);
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [suggIdx, setSuggIdx] = useState(0);
  const [suggDismissed, setSuggDismissed] = useState(false);
  const [pickerInput, setPickerInput] = useState<{
    id: string;
    query: string;
    selectedIndex: number;
  } | null>(null);
  const ctrlCArmedAt = useRef(0);
  const ctrlCStatus = useRef<string | null>(null);
  const ctrlCExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetComposer = useCallback(() => {
    // textarea 自持内部 buffer，draft 只是镜像（供候选推导/按键分层用），两边都要清
    setDraft("");
    composer.current?.clear();
  }, []);

  const armCtrlCExit = useCallback((text: string) => {
    if (ctrlCExitTimer.current) clearTimeout(ctrlCExitTimer.current);
    ctrlCArmedAt.current = Date.now();
    ctrlCStatus.current = text;
    setLocalToast({ text, tone: "info" });
    ctrlCExitTimer.current = setTimeout(() => {
      ctrlCArmedAt.current = 0;
      ctrlCStatus.current = null;
      ctrlCExitTimer.current = null;
      setLocalToast((current) => (current?.text === text ? null : current));
    }, CTRL_C_CONFIRM_WINDOW_MS + 100);
  }, []);

  const disarmCtrlCExit = useCallback(() => {
    if (!ctrlCArmedAt.current && !ctrlCStatus.current && !ctrlCExitTimer.current) return;
    ctrlCArmedAt.current = 0;
    const status = ctrlCStatus.current;
    ctrlCStatus.current = null;
    if (ctrlCExitTimer.current) clearTimeout(ctrlCExitTimer.current);
    ctrlCExitTimer.current = null;
    if (status) setLocalToast((current) => (current?.text === status ? null : current));
  }, []);

  useEffect(
    () => () => {
      if (ctrlCExitTimer.current) clearTimeout(ctrlCExitTimer.current);
    },
    [],
  );

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
  const picker = composerView.picker ?? null;
  const activePickerInput =
    pickerInput && picker && pickerInput.id === picker.id
      ? pickerInput
      : null;
  const pickerQuery = activePickerInput
    ? activePickerInput.query
    : picker?.search?.query ?? "";
  const pickerOptions = picker
    ? visiblePickerOptions(picker, pickerQuery)
    : [];
  const pickerSelectedIndex = pickerOptions.length > 0
    ? Math.min(
      activePickerInput?.selectedIndex ?? 0,
      pickerOptions.length - 1,
    )
    : 0;
  const candidates =
    trigger && !suggDismissed && !blockingInteraction && !picker
      ? buildCandidates(trigger, { commands: props.commands, mentions: props.mentions })
      : [];
  const sel = candidates.length ? Math.min(suggIdx, candidates.length - 1) : 0;

  // 焦点安全网：浮层都关闭时确保焦点回到输入框。focused prop 只在值变化时生效，
  // 覆盖不到"焦点被别处拿走但 prop 没变"的场景；focus() 对已聚焦者是 no-op，代价可忽略。
  useEffect(() => {
    if (!blockingInteraction && !picker) composer.current?.focus();
  });

  useEffect(() => {
    setPickerInput(
      picker
        ? {
          id: picker.id,
          query: picker.search?.query ?? "",
          selectedIndex: 0,
        }
        : null,
    );
  }, [picker?.id]);

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
  const updatePickerQuery = useCallback(
    (query: string) => {
      if (!picker?.search) return;
      setPickerInput({
        id: picker.id,
        query,
        selectedIndex: 0,
      });
      if (picker.search.mode === "remote") {
        void protocol.searchPicker(picker.id, query);
      }
    },
    [picker, protocol],
  );

  useKeyboard((key) => {
    const isCtrlC = key.ctrl && key.name === "c";
    if (!isCtrlC) disarmCtrlCExit();
    if (isCtrlC) {
      // Ctrl+C 只管理 composer/退出；当前 turn 的中断统一归 Esc。
      key.preventDefault();
      if (activeInteraction?.kind === "suggested_input" && !draft) {
        void protocol.resolveInteraction(activeInteraction.id, {
          kind: "suggested_input",
          outcome: "dismissed",
        });
        setLocalToast({ text: "Suggestion dismissed", tone: "info" });
        return;
      }
      const action = ctrlCAction({ hasDraft: draft !== "", armedAt: ctrlCArmedAt.current, now: Date.now() });
      if (action === "clear-draft") {
        releaseEditingSuggestion();
        resetComposer();
        setSuggIdx(0);
        armCtrlCExit(CTRL_C_CLEARED_HINT);
      } else if (action === "exit") void protocol.exit();
      else armCtrlCExit(CTRL_C_EXIT_HINT);
      return;
    }
    if (key.ctrl && key.name === "d") {
      // shell 习惯：空输入时 EOF 即退出
      if (!draft && !busy) void protocol.exit();
      return;
    }
    if (
      key.ctrl &&
      key.name === "y" &&
      activeInteraction?.kind === "suggested_input" &&
      !draft
    ) {
      key.preventDefault();
      useSuggestedInput(activeInteraction);
      return;
    }
    if (key.name === "escape") {
      if (props.sidecarLayout === "overlay" && protocol.dismissSidecar) {
        key.preventDefault();
        protocol.dismissSidecar();
        return;
      }
      if (picker?.search && pickerQuery) {
        key.preventDefault();
        updatePickerQuery("");
        return;
      }
      const action = escapeAction({
        busy,
        hasPicker: Boolean(picker && !blockingInteraction),
        hasCandidates: candidates.length > 0,
      });
      if (action !== "none") key.preventDefault();
      if (action === "cancel-turn") protocol.cancel();
      else if (action === "close-picker" && picker) protocol.resolvePicker(picker.id, null);
      else if (action === "dismiss-suggestions") setSuggDismissed(true);
      if (action !== "none") return;
    }
    if (
      picker?.search &&
      ["down", "up", "return", "kpenter"].includes(key.name)
    ) {
      key.preventDefault();
      if (key.name === "down" && pickerOptions.length > 0) {
        setPickerInput({
          id: picker.id,
          query: pickerQuery,
          selectedIndex: (pickerSelectedIndex + 1) % pickerOptions.length,
        });
      } else if (key.name === "up" && pickerOptions.length > 0) {
        setPickerInput({
          id: picker.id,
          query: pickerQuery,
          selectedIndex:
            (pickerSelectedIndex - 1 + pickerOptions.length) %
            pickerOptions.length,
        });
      } else {
        const selected = pickerOptions[pickerSelectedIndex];
        if (selected) protocol.resolvePicker(picker.id, selected.value);
      }
      return;
    }
    if (candidates.length > 0 && ["down", "up", "tab", "return", "kpenter"].includes(key.name)) {
      // 候选浮层：↑/↓ 选择，Tab 补全，Enter 接受（slash 直接执行，@ 只插入），Esc 关闭。
      // 全局 handler 先于聚焦 renderable 执行；preventDefault 阻止 textarea 同时处理这些编辑键。
      key.preventDefault();
      if (key.name === "down") setSuggIdx((i) => (i + 1) % candidates.length);
      else if (key.name === "up") setSuggIdx((i) => (i - 1 + candidates.length) % candidates.length);
      else if (trigger) {
        const chosen = candidates[sel];
        if (chosen) {
          const accepted = acceptCompletion(
            draft,
            trigger,
            chosen,
            key.name === "tab" ? "tab" : "enter",
          );
          if (accepted.submit) void send(accepted.text);
          else {
            setDraft(accepted.text);
            composer.current?.setText(accepted.text);
            setSuggIdx(0);
          }
        }
      }
      return;
    }
    // ↑：优先级 队列召回（仅空输入，避免覆盖已输入内容）→ 历史回溯（光标在边界）→ 光标上移。
    if (key.name === "up" && !blockingInteraction && !picker) {
      if (!draft) {
        const recalled = protocol.recallQueued?.();
        if (recalled) {
          key.preventDefault();
          releaseEditingSuggestion();
          setDraft(recalled.text);
          composer.current?.setText(recalled.text);
          setLocalToast({ text: "Recalled queued message; edit and resend", tone: "info" });
          return;
        }
      }
      if (composer.current?.cursorAtBoundary() ?? true) {
        const entry = protocol.historyPrev?.(draft);
        if (entry) {
          key.preventDefault();
          releaseEditingSuggestion();
          setDraft(entry.text);
          composer.current?.setText(entry.text);
          return;
        }
      }
    }
    // ↓：历史前进（光标在边界）；未在浏览时接入方返回 null，放行为光标下移。
    if (key.name === "down" && !blockingInteraction && !picker) {
      if (composer.current?.cursorAtBoundary() ?? true) {
        const entry = protocol.historyNext?.(draft);
        if (entry) {
          key.preventDefault();
          releaseEditingSuggestion();
          setDraft(entry.text);
          composer.current?.setText(entry.text);
          return;
        }
      }
    }
  });

  // Overlay 固定为 FooterSurface 预留两行（toast + footer），让 footer 更新
  // 无需反向通知 ComposerSurface 重新计算锚点。
  const dockBottom = composerHeightFor(draft) + 2;
  const handleComposerChange = useCallback(
    (text: string) => {
      if (text) disarmCtrlCExit();
      setDraft(text);
      setSuggDismissed(false);
      setSuggIdx(0);
    },
    [disarmCtrlCExit],
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
            surfaces={props.surfaces}
            theme={theme}
          />
          <ComposerEditor
            ref={composer}
            placeholder={composerView.placeholder}
            focused={!blockingInteraction && !picker}
            busy={busy}
            theme={theme}
            onChange={handleComposerChange}
            onSubmit={handleComposerSubmit}
          />
        </box>
      </InputArea>

      <Suggestions candidates={candidates} selectedIndex={sel} anchorBottom={dockBottom} theme={theme} />

      {picker && !blockingInteraction && !activeInteraction && (
        <Picker
          picker={picker}
          query={pickerQuery}
          selectedIndex={pickerSelectedIndex}
          anchorBottom={dockBottom}
          theme={theme}
          onQueryChange={updatePickerQuery}
          onSelectionChange={(selectedIndex) =>
            setPickerInput({
              id: picker.id,
              query: pickerQuery,
              selectedIndex,
            })}
          onSelect={(value) => protocol.resolvePicker(picker.id, value)}
        />
      )}

      <InteractionDock
        interactions={visibleInteractions}
        anchorBottom={dockBottom}
        canUseSuggestedInput={!draft}
        theme={theme}
        onResolve={(id, response) => void protocol.resolveInteraction(id, response)}
      />
    </>
  );
});
