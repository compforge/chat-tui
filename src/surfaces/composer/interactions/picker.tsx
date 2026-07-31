import { useTerminalDimensions } from "@opentui/react";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  INPUT_LAYER_PRIORITY,
  useInputBindings,
} from "../../../input/keyboard.tsx";
import type { PickerView } from "../../../state/composer.ts";
import {
  MARQUEE_INTERVAL_MS,
  marqueeContent,
  marqueeFrame,
  nextMarqueeOffset,
} from "../../../terminal/marquee.tsx";
import { displayWidth } from "../../../terminal/text.ts";
import { defaultTheme, type Theme } from "../../../theme.ts";

const PICKER_WIDTH = 84;
const PICKER_HORIZONTAL_MARGIN = 4;
// Picker border (2) + Select's left padding (1) + selection indicator (2).
const PICKER_NAME_INSET = 5;

interface SelectOption {
  name: string;
  description: string;
  value?: unknown;
}

export interface PickerProps {
  picker: PickerView;
  query?: string;
  selectedIndex?: number;
  anchorBottom: number;
  theme?: Theme;
  onQueryChange?: (query: string) => void;
  onSelectionChange?: (index: number) => void;
  onSelect: (value: string) => void;
  onCancel: () => void;
}

export function visiblePickerOptions(
  picker: PickerView,
  query: string,
): PickerView["options"] {
  const needle = query.trim().toLocaleLowerCase();
  if (picker.search?.mode !== "local" || !needle) return picker.options;
  return picker.options.filter((option) =>
    `${option.name}\n${option.description}`
      .toLocaleLowerCase()
      .includes(needle)
  );
}

export function Picker(props: PickerProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const terminal = useTerminalDimensions();
  const width = Math.min(
    PICKER_WIDTH,
    Math.max(20, terminal.width - PICKER_HORIZONTAL_MARGIN),
  );
  const query = props.query ?? props.picker.search?.query ?? "";
  const options = visiblePickerOptions(props.picker, query);
  const selectedIndex = options.length > 0
    ? Math.min(props.selectedIndex ?? 0, options.length - 1)
    : 0;
  const selected = options[selectedIndex];
  const nameWidth = width - PICKER_NAME_INSET;
  const selectedOverflows = selected
    ? displayWidth(selected.name) > nameWidth
    : false;
  const [marqueeOffset, setMarqueeOffset] = useState(0);
  useEffect(() => {
    setMarqueeOffset(0);
    if (!selected || !selectedOverflows) return;
    const cycleWidth = marqueeContent(selected.name).cycleWidth;
    const timer = setInterval(
      () => setMarqueeOffset((offset) => nextMarqueeOffset(offset, cycleWidth)),
      MARQUEE_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [selected?.name, selectedIndex, selectedOverflows]);
  const selectOptions = selectedOverflows
    ? options.map((option, index) =>
      index === selectedIndex
        ? { ...option, name: marqueeFrame(option.name, marqueeOffset) }
        : option
    )
    : options;
  const status = props.picker.search?.loading
    ? "Searching…"
    : options.length === 0
      ? "No matches"
      : undefined;
  const searchRows = props.picker.search ? 3 : 0;
  const statusRows = status ? 1 : 0;
  useInputBindings(() => ({
    priority: INPUT_LAYER_PRIORITY.popup,
    commands: [
      {
        name: "picker.cancel",
        run: () => {
          if (props.picker.search && query) {
            props.onQueryChange?.("");
          } else {
            props.onCancel();
          }
        },
      },
      {
        name: "picker.previous",
        run: () => {
          if (!props.picker.search || options.length === 0) return false;
          props.onSelectionChange?.(
            (selectedIndex - 1 + options.length) % options.length,
          );
        },
      },
      {
        name: "picker.next",
        run: () => {
          if (!props.picker.search || options.length === 0) return false;
          props.onSelectionChange?.((selectedIndex + 1) % options.length);
        },
      },
      {
        name: "picker.confirm",
        run: () => {
          if (!props.picker.search) return false;
          const selected = options[selectedIndex];
          if (!selected) return false;
          props.onSelect(selected.value);
        },
      },
    ],
    bindings: [
      {
        key: "escape",
        desc: "Clear picker query or close picker",
        group: "Picker",
        cmd: "picker.cancel",
      },
      {
        key: "up",
        desc: "Previous picker option",
        group: "Picker",
        cmd: "picker.previous",
      },
      {
        key: "down",
        desc: "Next picker option",
        group: "Picker",
        cmd: "picker.next",
      },
      {
        key: "return",
        desc: "Choose picker option",
        group: "Picker",
        cmd: "picker.confirm",
      },
      {
        key: "kpenter",
        desc: "Choose picker option",
        group: "Picker",
        cmd: "picker.confirm",
      },
    ],
  }));
  return (
    <box
      title={props.picker.title}
      border
      borderColor={theme.accent}
      style={{
        position: "absolute",
        left: 2,
        bottom: props.anchorBottom,
        width,
        height: Math.min(
          20,
          Math.max(
            4 + searchRows,
            options.length * 2 + 2 + searchRows + statusRows,
          ),
        ),
        backgroundColor:
          theme.overlayBackground ?? defaultTheme.overlayBackground,
        zIndex: 190,
        flexDirection: "column",
      }}
    >
      {props.picker.search ? (
        <box
          border
          borderColor={theme.border}
          style={{ height: 3, flexShrink: 0 }}
        >
          <input
            focused
            width="100%"
            value={query}
            placeholder={props.picker.search.placeholder ?? "Search"}
            onInput={(value) => props.onQueryChange?.(value)}
          />
        </box>
      ) : null}
      {status ? <text fg={theme.dim}>{status}</text> : null}
      {options.length > 0 ? (
        <select
          focused={!props.picker.search}
          style={{ flexGrow: 1 }}
          options={selectOptions}
          selectedIndex={selectedIndex}
          onChange={(index: number) => props.onSelectionChange?.(index)}
          onSelect={(_i: number, option: SelectOption | null) => {
            if (option) props.onSelect(String(option.value));
          }}
        />
      ) : null}
    </box>
  );
}
