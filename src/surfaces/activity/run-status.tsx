import { useEffect, useState, type ReactNode } from "react";

import type { RunStatusItem } from "../../state/activity.ts";
import { formatElapsed } from "../../terminal/time.ts";
import { defaultTheme, type Theme } from "../../theme.ts";

const BRAILLE_SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const SPINNER_FRAME_MS = 80;

export interface RunStatusProps {
  items: RunStatusItem[];
  theme?: Theme;
}

/**
 * ActivitySurface 的状态行："现在时"信息，视觉上贴 composer 顶部但独立订阅。
 * author 着色沿用 theme.agentColorFor，与 transcript 的作者名同源同色；空列表不占高度。
 * 外层间距归 Composer 的分组容器，这里不带 margin。
 */
export function RunStatus(props: RunStatusProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const ticking = props.items.some((item) => item.startedAt !== undefined);
  // 动画和 elapsed 都是纯展示状态，自持在组件里——消费方只在状态变化时发快照。
  // 只在有运行项时逐帧刷新；idle 不挂定时器，也不会让 harness/store 为动画发状态。
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), SPINNER_FRAME_MS);
    return () => clearInterval(timer);
  }, [ticking]);
  if (props.items.length === 0) return null;
  return (
    // 终端没有稳定的半行间距；连续字符行已有自然行高，rowGap: 1 会额外插入一整行空白。
    <box style={{ flexDirection: "column", flexShrink: 0, paddingLeft: 1, paddingRight: 1 }}>
      {props.items.map((item) => {
        const [label, ...details] = runStatusParts(item, now);
        const marker = item.startedAt === undefined ? "•" : runStatusSpinner(now);
        return (
          <box key={item.id} style={{ flexDirection: "row" }}>
            {item.author ? (
              <text fg={theme.agentColorFor?.(item.author) ?? theme.agent} style={{ flexShrink: 0 }}>
                {`${marker} ${item.author} `}
              </text>
            ) : null}
            <text fg={theme.dim}>{item.author ? "· " : `${marker} `}</text>
            <text fg={theme.runStatus ?? theme.accent}>{label}</text>
            {details.length > 0 ? <text fg={theme.dim}>{` · ${details.join(" · ")}`}</text> : null}
          </box>
        );
      })}
    </box>
  );
}

/** 当前时间 → braille spinner 帧；纯函数便于测试，也让多个运行项保持同一节奏。 */
export function runStatusSpinner(now: number): string {
  const index = Math.floor(Math.max(0, now) / SPINNER_FRAME_MS) % BRAILLE_SPINNER.length;
  return BRAILLE_SPINNER[index] as string;
}

/** RunStatusItem → 状态词、耗时、操作提示；拆段后状态词可独立着色。 */
export function runStatusParts(item: { label: string; startedAt?: number; hint?: string }, now: number): string[] {
  const parts = [item.label];
  if (item.startedAt !== undefined) parts.push(formatElapsed(now - item.startedAt));
  if (item.hint) parts.push(item.hint);
  return parts;
}

/** RunStatusItem → author 之后的完整单行文案；纯函数便于单测。 */
export function runStatusTail(item: { label: string; startedAt?: number; hint?: string }, now: number): string {
  return runStatusParts(item, now).join(" · ");
}
