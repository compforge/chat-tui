import { useEffect, useState, type ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";

import type { RunStatusItem } from "../../state/activity.ts";
import { displayWidth, ellipsize } from "../../terminal/text.ts";
import { formatElapsed } from "../../terminal/time.ts";
import { defaultTheme, type Theme } from "../../theme.ts";

const BRAILLE_SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const SPINNER_FRAME_MS = 80;

/** tips 轮换节奏（对齐 kimi-code：10s 一条） */
export const TIP_ROTATE_MS = 10_000;

export interface RunStatusProps {
  items: RunStatusItem[];
  /** 轮换提示语料（接入方注入）；仅在有运行项时渲染与轮换 */
  tips?: string[];
  theme?: Theme;
}

/**
 * ActivitySurface 的状态行："现在时"信息，视觉上贴 composer 顶部但独立订阅。
 * author 着色沿用 theme.agentColorFor，与 transcript 的作者名同源同色；空列表不占高度。
 * 非空时在上方保留一行，避免 Plan 和 Queue 都缺席时贴住 transcript。
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
  // tips 轮换同理：只有 running（有运行项）且有语料时才挂 10s 定时器
  const tipsActive = props.items.length > 0 && (props.tips?.length ?? 0) > 0;
  const [tipRotation, setTipRotation] = useState(0);
  useEffect(() => {
    if (!tipsActive) return;
    const timer = setInterval(
      () => setTipRotation((rotation) => rotation + 1),
      TIP_ROTATE_MS,
    );
    return () => clearInterval(timer);
  }, [tipsActive]);
  const { width: termWidth } = useTerminalDimensions();
  if (props.items.length === 0) return null;
  const tip = tipsActive ? activityTipFor(props.tips ?? [], tipRotation) : null;
  return (
    // 终端没有稳定的半行间距；连续字符行已有自然行高，rowGap: 1 会额外插入一整行空白。
    <box
      style={{
        flexDirection: "column",
        flexShrink: 0,
        marginTop: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {props.items.map((item, index) => {
        const [label, ...details] = runStatusParts(item, now);
        const marker = item.startedAt === undefined ? "•" : runStatusSpinner(now);
        // tip 缀在最后一行（最新活动）尾部；宽度预算放不下正文时整体不渲染
        const isLast = index === props.items.length - 1;
        const rowText = item.author
          ? `${marker} ${item.author} · ${label}`
          : `${marker} ${label}`;
        const tail =
          isLast && tip !== null
            ? activityTipTail(
                tip,
                termWidth - 2 - displayWidth(rowText) -
                  (details.length > 0 ? displayWidth(` · ${details.join(" · ")}`) : 0),
              )
            : null;
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
            {tail !== null ? <text fg={theme.dim}>{tail}</text> : null}
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

/** 轮换序号 → 当前 tip；无语料时 null。 */
export function activityTipFor(tips: readonly string[], rotation: number): string | null {
  if (tips.length === 0) return null;
  return tips[((rotation % tips.length) + tips.length) % tips.length] ?? null;
}

/**
 * tip 尾部文案（` · Tip: ...`），budget 是可用于该尾部的列数。
 * 超宽按显示宽度截断并留省略号；连最短正文都放不下时返回 null（整段不渲染，
 * 避免挤爆状态行）。
 */
export function activityTipTail(tip: string, budget: number): string | null {
  const prefix = " · Tip: ";
  const available = budget - displayWidth(prefix);
  // 至少放得下 4 列正文（含可能的省略号）才值得渲染
  if (available < 4) return null;
  return prefix + ellipsize(tip, available);
}
