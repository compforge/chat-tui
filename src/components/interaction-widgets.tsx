// Interaction Dock 的展示组件：补全候选、命令 picker、审批与结构化问题。
// 都紧贴输入框上方（对齐 claude code 习惯：视线不用离开输入区），
// anchorBottom 由消费方从 composerHeightFor(draft) + Toast/Footer 高度算出。

import type { InputRenderable } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  defaultTheme,
  type ApprovalView,
  type PickerView,
  type QuestionAnswers,
  type QuestionView,
  type Theme,
} from "../types/index.ts";
import type { Candidate } from "./completion.ts";
import { approvalCardLayout } from "./approval.ts";
import { questionCardLayout } from "./question.ts";
import { ellipsize } from "../utils/text.ts";

interface SelectOption {
  name: string;
  description: string;
  value?: unknown;
}

export interface SuggestionsProps {
  candidates: Candidate[];
  selectedIndex: number;
  /** 距屏幕底部的行数（输入框高度 + footer + 可选 toast 行） */
  anchorBottom: number;
  theme?: Theme;
}

/** 补全候选。↑↓/Tab/Esc 的按键处理归消费方（选中态从 selectedIndex 传入）。 */
export function Suggestions(props: SuggestionsProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  if (props.candidates.length === 0) return null;
  return (
    <box
      border
      borderColor={theme.border}
      title="Suggestions (Tab/Enter accept · ↑↓ select · Esc close)"
      style={{
        position: "absolute",
        left: 2,
        bottom: props.anchorBottom,
        width: 60,
        height: props.candidates.length + 2,
        backgroundColor: theme.overlayBackground ?? defaultTheme.overlayBackground,
        zIndex: 150,
        flexDirection: "column",
      }}
    >
      {props.candidates.map((candidate, index) => (
        <text key={candidate.insert} fg={index === props.selectedIndex ? theme.accent : undefined}>
          {`${index === props.selectedIndex ? "▸ " : "  "}${candidate.label}  ${candidate.detail}`}
        </text>
      ))}
    </box>
  );
}

export interface PickerProps {
  picker: PickerView;
  anchorBottom: number;
  theme?: Theme;
  onSelect: (value: string) => void;
}

/** 命令 picker（选 provider / model / session 等）。Esc 关闭由消费方的键盘层处理。 */
export function Picker(props: PickerProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  return (
    <box
      title={props.picker.title}
      border
      borderColor={theme.accent}
      style={{
        position: "absolute",
        left: 2,
        bottom: props.anchorBottom,
        width: 72,
        height: Math.min(18, props.picker.options.length * 2 + 2),
        backgroundColor: theme.overlayBackground ?? defaultTheme.overlayBackground,
        zIndex: 190,
        flexDirection: "column",
      }}
    >
      <select
        focused
        style={{ flexGrow: 1 }}
        options={props.picker.options}
        onSelect={(_i: number, opt: SelectOption | null) => {
          if (opt) props.onSelect(String(opt.value));
        }}
      />
    </box>
  );
}

export interface ApprovalCardProps {
  approval: ApprovalView;
  frameTitle?: string;
  requester?: string;
  anchorBottom: number;
  theme?: Theme;
  onSelect: (optionId: string) => void;
}

/** 审批卡片。比 Picker 的 zIndex 更高——审批永远占据 Interaction Dock。 */
export function ApprovalCard(props: ApprovalCardProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const terminal = useTerminalDimensions();
  const detail = props.approval.description
    ? `${props.approval.title}\n${props.approval.description}`
    : props.approval.title;
  const layout = approvalCardLayout({
    terminalWidth: terminal.width,
    terminalHeight: terminal.height,
    anchorBottom: props.anchorBottom,
    detail,
    optionCount: props.approval.options.length,
  });
  return (
    <box
      title={props.frameTitle ?? "Approval required"}
      border
      borderColor={theme.borderActive}
      style={{
        position: "absolute",
        left: 2,
        bottom: props.anchorBottom,
        width: layout.width,
        height: layout.height,
        backgroundColor: theme.overlayBackground ?? defaultTheme.overlayBackground,
        zIndex: 200,
        flexDirection: "column",
      }}
    >
      <scrollbox style={{ height: layout.detailRows, flexShrink: 0 }} focused={false}>
        <text selectable>
          <strong>{props.approval.title}</strong>
          {props.requester ? ` · ${props.requester}` : null}
          {props.approval.description ? `\n${props.approval.description}` : null}
        </text>
      </scrollbox>
      {props.approval.options.length > 0 ? (
        <select
          focused
          showDescription={false}
          showScrollIndicator={props.approval.options.length > layout.actionRows}
          style={{ height: layout.actionRows, flexShrink: 0 }}
          options={props.approval.options.map((o) => ({ name: o.name, description: o.kind, value: o.optionId }))}
          onSelect={(_i: number, opt: SelectOption | null) => {
            if (opt) props.onSelect(String(opt.value));
          }}
        />
      ) : (
        <text fg={theme.error} style={{ height: layout.actionRows, flexShrink: 0 }}>
          No approval actions available · Esc interrupts turn
        </text>
      )}
    </box>
  );
}

export interface QuestionCardProps {
  requestId: string;
  question: QuestionView;
  frameTitle?: string;
  requester?: string;
  anchorBottom: number;
  theme?: Theme;
  onSubmit: (answers: QuestionAnswers) => void;
}

/** 多问题按顺序回答；单选立即前进，多选通过 Continue 收束，Other 切到自由文本。 */
export function QuestionCard(props: QuestionCardProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  // 卡片尺寸跟终端走（原先宽度硬编码 76：窄终端会溢出，宽终端白白浪费）
  const { width: termWidth, height: termHeight } = useTerminalDimensions();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuestionAnswers>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [otherMode, setOtherMode] = useState(false);
  const [focusedOption, setFocusedOption] = useState(0);
  const input = useRef<InputRenderable | null>(null);

  useEffect(() => {
    setQuestionIndex(0);
    setAnswers({});
    setSelected([]);
    setOtherMode(false);
    setFocusedOption(0);
  }, [props.requestId]);

  const current = props.question.questions[questionIndex];
  if (!current) return null;

  const finishAnswer = (values: string[]) => {
    const next = { ...answers, [current.id]: values };
    if (questionIndex + 1 >= props.question.questions.length) {
      props.onSubmit(next);
      return;
    }
    setAnswers(next);
    setQuestionIndex((index) => index + 1);
    setSelected([]);
    setOtherMode(false);
    setFocusedOption(0);
  };

  const options = current.options ?? [];
  const focusedItem = options[focusedOption];
  const preview = focusedItem?.preview;
  // 布局预算（卡片尺寸、desc 宽度、焦点详情截断）统一走 questionCardLayout 纯函数
  const layout = questionCardLayout({
    terminalWidth: termWidth,
    terminalHeight: termHeight,
    choiceCount: options.length + (current.allowOther ? 1 : 0) + (current.multiSelect ? 1 : 0),
    focusedDescription: focusedItem?.description,
    hasPreview: Boolean(preview),
  });
  // opentui 的 Select 给每个 option 的 description 只有**一行且不 wrap**（Select.ts: linesPerItem =
  // fontHeight + 1，drawText 单行绘制）——长 desc 会被 framebuffer 横向硬切且毫无提示。所以这里
  // 自己按显示宽度 ellipsize：列表里保证"被切了看得出来"，完整内容留给下方的焦点详情区。
  const choices = options.map((option) => ({
    name: `${current.multiSelect && selected.includes(option.label) ? "✓ " : ""}${option.label}`,
    description: ellipsize(option.description, layout.descWidth),
    value: option.label,
  }));
  if (current.allowOther) choices.push({ name: "Other…", description: "Type a custom answer", value: "__other__" });
  if (current.multiSelect) choices.push({ name: "Continue", description: "Submit selected answers", value: "__continue__" });

  return (
    <box
      title={
        props.frameTitle ??
        `Question ${questionIndex + 1}/${props.question.questions.length} · ${current.header}`
      }
      border
      borderColor={theme.borderActive}
      style={{
        position: "absolute",
        left: 2,
        bottom: props.anchorBottom,
        width: layout.width,
        height: layout.height,
        backgroundColor: theme.overlayBackground ?? defaultTheme.overlayBackground,
        zIndex: 210,
        flexDirection: "column",
      }}
    >
      <text>
        {props.requester ? `${props.requester} · ` : null}
        {current.question}
      </text>
      {otherMode || choices.length === 0 ? (
        <box border borderColor={theme.border} style={{ height: 3, marginTop: 1 }}>
          <input
            ref={input}
            focused
            width="100%"
            placeholder={current.secret ? "Enter answer (not masked)" : "Type your answer"}
            onSubmit={() => {
              const value = input.current?.value.trim() ?? "";
              if (value) finishAnswer(current.multiSelect ? [...selected, value] : [value]);
            }}
          />
        </box>
      ) : (
        <select
          focused
          style={{ flexGrow: 1 }}
          options={choices}
          selectedIndex={focusedOption}
          onChange={(index: number) => setFocusedOption(index)}
          onSelect={(_i: number, opt: SelectOption | null) => {
            if (!opt) return;
            const value = String(opt.value);
            if (value === "__other__") {
              setOtherMode(true);
            } else if (value === "__continue__") {
              if (selected.length > 0) finishAnswer(selected);
            } else if (current.multiSelect) {
              setSelected((values) =>
                values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value],
              );
            } else {
              finishAnswer([value]);
            }
          }}
        />
      )}
      {!otherMode && layout.detailLines.length > 0 && (
        <text fg={theme.dim}>
          {layout.detailLines.join("\n") +
            (layout.detailHidden > 0 ? `\n… +${layout.detailHidden} more lines` : "")}
        </text>
      )}
      {preview && !otherMode && <text fg={theme.dim}>{preview}</text>}
    </box>
  );
}
