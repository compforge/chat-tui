import type { ReactNode } from "react";

import type { PlanEntry } from "../../state/timeline.ts";
import { defaultTheme, type Theme } from "../../theme.ts";

/** 单条 plan 的展示行；标记与 transcript plan 块保持同一套符号 */
function planMark(status: PlanEntry["status"]): string {
  return status === "completed" ? "[✓]" : status === "in_progress" ? "[•]" : "[ ]";
}

export interface PlanWindow {
  items: PlanEntry[];
  /** 窗口外被折叠的条数（在窗口之前 / 之后） */
  before: number;
  after: number;
}

/**
 * 超长 plan 的窗口截断：窗口尽量覆盖第一个未完成项（并带上它前一项作上下文），
 * 保证"现在进行到哪一步"始终可见——pin 区存在的意义就是这一行。
 */
export function planWindow(entries: PlanEntry[], max = 8): PlanWindow {
  if (entries.length <= max) return { items: entries, before: 0, after: 0 };
  const current = entries.findIndex((entry) => entry.status !== "completed");
  const anchor = current === -1 ? entries.length - 1 : current;
  const start = Math.max(0, Math.min(anchor - 1, entries.length - max));
  return {
    items: entries.slice(start, start + max),
    before: start,
    after: entries.length - start - max,
  };
}

export interface PlanPinnedProps {
  entries: PlanEntry[];
  theme?: Theme;
}

/**
 * pin 在 composer 上方的 plan（不随历史滚动）。
 * 显隐语义归接入方：仅在有未完成项时下发 entries，全部完成后停发即消失；
 * 这里只按"非空即渲染"处理，不理解 plan 生命周期。
 */
export function PlanPinned(props: PlanPinnedProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  if (props.entries.length === 0) return null;
  const done = props.entries.filter((entry) => entry.status === "completed").length;
  const window = planWindow(props.entries);
  return (
    <box style={{ flexDirection: "column", flexShrink: 0, paddingLeft: 1, paddingRight: 1, marginTop: 1 }}>
      <text fg={theme.plan}>{`• Plan (${done}/${props.entries.length})`}</text>
      {window.before > 0 ? <text fg={theme.dim}>{`    … ${window.before} earlier`}</text> : null}
      {window.items.map((entry, index) => (
        <text key={index} fg={entry.status === "in_progress" ? theme.plan : theme.dim}>
          {`  ${planMark(entry.status)} ${entry.content}`}
        </text>
      ))}
      {window.after > 0 ? <text fg={theme.dim}>{`    … ${window.after} more`}</text> : null}
    </box>
  );
}
