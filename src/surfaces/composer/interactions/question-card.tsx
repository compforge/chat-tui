import type { InputRenderable } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { QuestionAnswers } from "../../../protocol/interaction.ts";
import type { QuestionView } from "../../../state/composer.ts";
import { ellipsize } from "../../../terminal/text.ts";
import { defaultTheme, type Theme } from "../../../theme.ts";
import { questionCardLayout } from "./question.ts";

interface SelectOption {
  name: string;
  description: string;
  value?: unknown;
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

/** Multi-question input owns only its local navigation and draft answers. */
export function QuestionCard(props: QuestionCardProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const terminal = useTerminalDimensions();
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
  const layout = questionCardLayout({
    terminalWidth: terminal.width,
    terminalHeight: terminal.height,
    choiceCount:
      options.length +
      (current.allowOther ? 1 : 0) +
      (current.multiSelect ? 1 : 0),
    focusedDescription: focusedItem?.description,
    hasPreview: Boolean(preview),
  });
  const choices = options.map((option) => ({
    name: `${current.multiSelect && selected.includes(option.label) ? "✓ " : ""}${option.label}`,
    description: ellipsize(option.description, layout.descWidth),
    value: option.label,
  }));
  if (current.allowOther) {
    choices.push({
      name: "Other…",
      description: "Type a custom answer",
      value: "__other__",
    });
  }
  if (current.multiSelect) {
    choices.push({
      name: "Continue",
      description: "Submit selected answers",
      value: "__continue__",
    });
  }

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
        backgroundColor:
          theme.overlayBackground ?? defaultTheme.overlayBackground,
        zIndex: 210,
        flexDirection: "column",
      }}
    >
      <text>
        {props.requester ? `${props.requester} · ` : null}
        {current.question}
      </text>
      {otherMode || choices.length === 0 ? (
        <box
          border
          borderColor={theme.border}
          style={{ height: 3, marginTop: 1 }}
        >
          <input
            ref={input}
            focused
            width="100%"
            placeholder={
              current.secret ? "Enter answer (not masked)" : "Type your answer"
            }
            onSubmit={() => {
              const value = input.current?.value.trim() ?? "";
              if (value) {
                finishAnswer(
                  current.multiSelect ? [...selected, value] : [value],
                );
              }
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
          onSelect={(_i: number, option: SelectOption | null) => {
            if (!option) return;
            const value = String(option.value);
            if (value === "__other__") {
              setOtherMode(true);
            } else if (value === "__continue__") {
              if (selected.length > 0) finishAnswer(selected);
            } else if (current.multiSelect) {
              setSelected((values) =>
                values.includes(value)
                  ? values.filter((candidate) => candidate !== value)
                  : [...values, value]
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
            (layout.detailHidden > 0
              ? `\n… +${layout.detailHidden} more lines`
              : "")}
        </text>
      )}
      {preview && !otherMode && <text fg={theme.dim}>{preview}</text>}
    </box>
  );
}
