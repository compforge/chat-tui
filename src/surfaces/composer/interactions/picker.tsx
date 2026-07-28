import { useTerminalDimensions } from "@opentui/react";
import type { ReactNode } from "react";

import type { PickerView } from "../../../state/composer.ts";
import { defaultTheme, type Theme } from "../../../theme.ts";

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
  const query = props.query ?? props.picker.search?.query ?? "";
  const options = visiblePickerOptions(props.picker, query);
  const selectedIndex = options.length > 0
    ? Math.min(props.selectedIndex ?? 0, options.length - 1)
    : 0;
  const status = props.picker.search?.loading
    ? "Searching…"
    : options.length === 0
      ? "No matches"
      : undefined;
  const searchRows = props.picker.search ? 3 : 0;
  const statusRows = status ? 1 : 0;
  return (
    <box
      title={props.picker.title}
      border
      borderColor={theme.accent}
      style={{
        position: "absolute",
        left: 2,
        bottom: props.anchorBottom,
        width: Math.min(84, Math.max(20, terminal.width - 4)),
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
          options={options}
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
