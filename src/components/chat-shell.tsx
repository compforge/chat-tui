// ChatShell：把 ChatProtocol 接到全套组件上的一站式壳。
// 接入方只需实现 ChatProtocol + 注入命令表/引用源，即得到完整 chat TUI：
// 多行输入、slash/@ 补全、分层 Ctrl+C、队列召回、picker/审批浮层。

import { useKeyboard, useRenderer, useSelectionHandler } from "@opentui/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import type { ChatProtocol } from "../protocol/index.ts";
import {
  defaultTheme,
  type CommandSpec,
  type InteractionView,
  type StatusMessage,
  type Theme,
} from "../types/index.ts";
import type { ClipPolicy } from "./clip.ts";
import { parseSlashCommand } from "./commands.ts";
import { acceptCompletion, buildCandidates, triggerAt, type Candidate } from "./completion.ts";
import { CTRL_C_CONFIRM_WINDOW_MS, ctrlCAction, escapeAction } from "./keys.ts";
import { Composer, composerHeightFor, type ComposerHandle } from "./composer.tsx";
import { InteractionDock } from "./interaction-dock.tsx";
import { Picker, Suggestions } from "./overlays.tsx";
import { PlanPinned } from "./plan-pinned.tsx";
import { InputArea } from "./queued.tsx";
import { StatusLine } from "./status-line.tsx";
import { useTokenSelectionOnDoubleClick } from "./token-selection.ts";
import { Transcript } from "./transcript.tsx";

const CTRL_C_EXIT_HINT = "Press Ctrl+C again to exit";
const CTRL_C_CLEARED_HINT = "Draft cleared; press Ctrl+C again to exit";

export interface ChatShellProps {
  protocol: ChatProtocol;
  /** slash 命令表（补全 + 识别）；语义执行走 protocol.command() */
  commands: readonly CommandSpec[];
  /** @ 引用候选源；不传则 @ 不触发补全 */
  mentions?: (prefix: string) => Candidate[];
  theme?: Theme;
  /** transcript 高度预算策略；缺省 defaultClipPolicy（Ctrl+O 展开/收起） */
  clipPolicy?: ClipPolicy;
}

export function ChatShell(props: ChatShellProps): ReactNode {
  const { protocol } = props;
  const theme = props.theme ?? defaultTheme;
  const renderer = useRenderer();
  useSelectionHandler((selection) => {
    const selectedText = selection.getSelectedText();
    if (selectedText) renderer.copyToClipboardOSC52(selectedText);
  });
  // 双击选词是壳内一切可见文本的通性，只在根容器挂这一处：鼠标事件带着命中
  // target 沿 parent 链冒泡，所有后代文本（含未来新增的组件）天然被覆盖，
  // 不再 per-widget 挂载——那条路每加一种文本 renderable 就漏一次。
  const selectTokenOnDoubleClick = useTokenSelectionOnDoubleClick();
  const view = useSyncExternalStore(
    useCallback((onChange) => protocol.subscribe(onChange), [protocol]),
    () => protocol.getView(),
  );

  const [draft, setDraft] = useState("");
  const composer = useRef<ComposerHandle | null>(null);
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  // 本地瞬时提示（Ctrl+C 二次确认等）；接入方的 view.status 优先级更高
  const [localStatus, setLocalStatus] = useState<StatusMessage | null>(null);
  const [suggIdx, setSuggIdx] = useState(0);
  const [suggDismissed, setSuggDismissed] = useState(false);
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
    setLocalStatus({ text, tone: "info" });
    ctrlCExitTimer.current = setTimeout(() => {
      ctrlCArmedAt.current = 0;
      ctrlCStatus.current = null;
      ctrlCExitTimer.current = null;
      setLocalStatus((current) => (current?.text === text ? null : current));
    }, CTRL_C_CONFIRM_WINDOW_MS + 100);
  }, []);

  const disarmCtrlCExit = useCallback(() => {
    if (!ctrlCArmedAt.current && !ctrlCStatus.current && !ctrlCExitTimer.current) return;
    ctrlCArmedAt.current = 0;
    const status = ctrlCStatus.current;
    ctrlCStatus.current = null;
    if (ctrlCExitTimer.current) clearTimeout(ctrlCExitTimer.current);
    ctrlCExitTimer.current = null;
    if (status) setLocalStatus((current) => (current?.text === status ? null : current));
  }, []);

  useEffect(
    () => () => {
      if (ctrlCExitTimer.current) clearTimeout(ctrlCExitTimer.current);
    },
    [],
  );

  // 候选由输入实时推导（/ 行首=命令，@ =引用），无独立状态需要同步
  const trigger = triggerAt(draft);
  const interactions = view.interactions ?? [];
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
  const picker = view.picker ?? null;
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
    if (editingSuggestionId && !editingSuggestion) setEditingSuggestionId(null);
  }, [editingSuggestion, editingSuggestionId]);

  const releaseEditingSuggestion = useCallback(() => {
    setEditingSuggestionId(null);
  }, []);

  const useSuggestedInput = useCallback(
    (interaction: Extract<InteractionView, { kind: "suggested_input" }>) => {
      if (draft) {
        setLocalStatus({ text: "Clear the composer before using this suggestion", tone: "info" });
        return;
      }
      setEditingSuggestionId(interaction.id);
      setDraft(interaction.text);
      composer.current?.setText(interaction.text);
      composer.current?.focus();
      setLocalStatus(null);
    },
    [draft],
  );

  const send = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const sourceSuggestion = editingSuggestion;
      resetComposer();
      setLocalStatus(null);
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
        setLocalStatus({ text: error instanceof Error ? error.message : String(error), tone: "error" });
      }
    },
    [editingSuggestion, props.commands, protocol, resetComposer],
  );

  const busy = view.busy ?? false;

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
        setLocalStatus({ text: "Suggestion dismissed", tone: "info" });
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
          setLocalStatus({ text: "Recalled queued message; edit and resend", tone: "info" });
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

  const visibleStatus = localStatus ?? view.status ?? null;
  // 输入区随内容长高；footer 常驻一行，瞬时 status 存在时再占一行。
  const overlayBottom = composerHeightFor(draft) + 1 + (visibleStatus ? 1 : 0);

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }} onMouseDown={selectTokenOnDoubleClick}>
      <Transcript
        header={view.header}
        items={view.transcript}
        showThoughts={view.showThoughts}
        theme={theme}
        clipPolicy={props.clipPolicy}
      />

      {/* scrollbox 外都是"非过去时"：plan pin（进行中）→ 队列（将来时）→ composer（现在时，Provider Status 挂其顶部） */}
      <PlanPinned entries={view.plan ?? []} theme={theme} />

      <InputArea items={view.queued ?? []} theme={theme}>
        <Composer
          ref={composer}
          status={view.runStatus}
          placeholder={view.composerPlaceholder}
          focused={!blockingInteraction && !picker}
          busy={busy}
          theme={theme}
          onChange={(text) => {
            if (text) disarmCtrlCExit();
            setDraft(text);
            setSuggDismissed(false);
            setSuggIdx(0);
          }}
          onSubmit={(text) => void send(text)}
        />
      </InputArea>

      <Suggestions candidates={candidates} selectedIndex={sel} anchorBottom={overlayBottom} theme={theme} />

      <StatusLine status={visibleStatus} fallback={view.footer ?? ""} theme={theme} />

      {picker && !blockingInteraction && !activeInteraction && (
        <Picker
          picker={picker}
          anchorBottom={overlayBottom}
          theme={theme}
          onSelect={(value) => protocol.resolvePicker(picker.id, value)}
        />
      )}

      <InteractionDock
        interactions={visibleInteractions}
        anchorBottom={overlayBottom}
        canUseSuggestedInput={!draft}
        theme={theme}
        onResolve={(id, response) => void protocol.resolveInteraction(id, response)}
      />
    </box>
  );
}
