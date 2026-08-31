import {
  getTreeSitterClient,
  pathToFiletype,
  SyntaxStyle,
  treeSitterToStyledText,
  type ClipboardService,
  type MouseEvent,
  type StyledText,
} from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type {
  TranscriptBlockContent,
  TranscriptBlockItem,
  TranscriptGroupItem,
  TranscriptItem,
} from "../../state/timeline.ts";
import type { ToastMessage } from "../../state/footer.ts";
import {
  INPUT_LAYER_PRIORITY,
  useInputBindings,
  useKeybindOverrides,
} from "../../input/keyboard.tsx";
import { layerBindings } from "../../input/keybinds.ts";
import { defaultTheme, type Theme } from "../../theme.ts";
import { clipLines, collapseHint, defaultClipPolicy, hiddenHint, type ClipBudget, type ClipPolicy } from "./clip.ts";
import { diffRows, diffStats, type DiffView } from "./diff.ts";
import { blockStatus } from "./block.ts";
import { lastAgentMessage, messageCopyText } from "./message-copy.ts";

export interface TranscriptProps {
  /** 顶部说明文字（产品名、快捷键提示等），dim 展示 */
  header?: string;
  items: TranscriptItem[];
  /** thought 消息是否渲染（对应 show-thoughts 配置） */
  showThoughts?: boolean;
  theme?: Theme;
  /** 高度预算策略；缺省 defaultClipPolicy。Ctrl+O 展开态由 Transcript 内部管理，策略无需感知 */
  clipPolicy?: ClipPolicy;
  /** OpenTUI 剪贴板服务；未提供时复制最近消息动作不消费按键。 */
  clipboard?: ClipboardService;
  /** 逐条自定义渲染；返回 undefined 时走默认渲染。自定义渲染自行负责高度预算。 */
  renderItem?: (item: TranscriptItem) => ReactNode | undefined;
  /** 操作回执出口（如复制成功 toast）；由壳接到 Footer */
  onToast?: (toast: ToastMessage | null) => void;
}

/** 渲染期的裁剪上下文：策略 + 展开态（全局与按块）+ 宽度，一次算好贯穿所有 item */
interface ClipContext {
  policy: ClipPolicy;
  /** 全局展开（Ctrl+O）：一切内容不裁剪 */
  expanded: boolean;
  /** 按块展开（点击裁剪提示行）：与全局展开正交，全局收起时清空 */
  expandedIds: ReadonlySet<string>;
  wrapWidth: number;
}

function blockExpanded(clip: ClipContext, id: string): boolean {
  return clip.expanded || clip.expandedIds.has(id);
}

/** 仅按块展开（非全局展开）时为 true：此时内容尾部挂 collapseHint，点击收起该块。 */
function perBlockExpanded(clip: ClipContext, id: string): boolean {
  return !clip.expanded && clip.expandedIds.has(id);
}

/**
 * 裁剪提示行的点击处理：down 记录落点，up 在同一点结束才视为点击——
 * 拖拽选择（down 后移动）不会误触发展开（与 shell 的点击惯例一致）。
 * rows 给出该 renderable 内提示行所在的行号；缺省表示整个 renderable 就是提示行。
 */
interface HintClickHandlers {
  down: (id: string) => (event: MouseEvent) => void;
  up: (id: string, rows?: readonly number[]) => (event: MouseEvent) => void;
}

/** 裁剪后的一行展示：hint=省略提示行；dim=弱化色（output 段与命令源码在视觉上区分） */
interface ContentLine {
  text: string;
  hint: boolean;
  dim: boolean;
}

/** 对话时间线：滚动区 + 消息/工具/计划的默认渲染。粘底滚动，流式期间自动跟随；Ctrl+O 全局展开/收起，点击裁剪提示行按块展开/收起。 */
export function Transcript(props: TranscriptProps): ReactNode {
  const theme = props.theme ?? defaultTheme;
  const syntaxStyle = useMemo(() => syntaxStyleFor(theme), [theme]);
  const keybinds = useKeybindOverrides();
  // 折叠是展示层关心的事（不需要理解 agent 在干什么），所以展开态自持在 Transcript，
  // 不进 ChatProtocol；键位也注册在这里，让高度预算特性对 ChatShell 完全透明。
  const [expanded, setExpanded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const hintClick = useRef<{ id: string; x: number; y: number } | null>(null);

  const toggleBlock = (id: string): void => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hintClicks: HintClickHandlers = {
    down: (id) => (event) => {
      if (event.button !== 0) return;
      hintClick.current = { id, x: event.x, y: event.y };
    },
    up: (id, rows) => (event) => {
      const down = hintClick.current;
      hintClick.current = null;
      if (!down || down.id !== id || event.button !== 0) return;
      // 落点不同即拖拽选择，不触发展开
      if (event.x !== down.x || event.y !== down.y) return;
      if (rows !== undefined) {
        const target = event.target as { y?: number } | null;
        const row = event.y - (typeof target?.y === "number" ? target.y : event.y);
        if (!rows.includes(row)) return;
      }
      toggleBlock(id);
    },
  };

  useInputBindings(() => ({
    priority: INPUT_LAYER_PRIORITY.surface,
    commands: [
      {
        name: "transcript.toggle-expanded",
        run: () => {
          // 全局收起时清掉单块展开态，两个维度保持正交且不回弹
          if (expanded) setExpandedIds(new Set());
          setExpanded((value) => !value);
        },
      },
      {
        name: "transcript.copy-last-message",
        run: async () => {
          const message = lastAgentMessage(props.items);
          if (!message || !props.clipboard) return false;
          let copied = false;
          try {
            const result = await props.clipboard.writeText(messageCopyText(message), {
              destination: "best-available",
            });
            copied = result.host.status === "written" || result.terminal.status === "attempted";
          } catch {
            // ClipboardService normally returns a failed result; keep the UI fail-closed if an
            // injected backend violates that contract and rejects instead.
          }
          props.onToast?.(copied
            ? { text: "Copied message to clipboard", tone: "success" }
            : { text: "Clipboard unavailable", tone: "error" });
        },
      },
    ],
    bindings: layerBindings(
      ["transcript.toggle-expanded", "transcript.copy-last-message"],
      keybinds,
    ),
  }), [keybinds]);
  const { width: termWidth } = useTerminalDimensions();
  const clip: ClipContext = {
    policy: props.clipPolicy ?? defaultClipPolicy,
    expanded,
    expandedIds,
    // scrollbox 左右 padding 2 + 内容缩进 4 + 1 列余量（滚动条/宽度度量误差兜底）。
    // 估小只是行提前折断；估大由 opentui 兜底 wrap（多占 1 行），都不破坏预算量级。
    wrapWidth: Math.max(16, termWidth - 7),
  };
  return (
    // focusable={false}：鼠标点击（如裁剪提示行的按块展开）不把焦点抢进滚动区——
    // 焦点落在 scrollbox 上后，surface 层的 Ctrl+O / Ctrl+Shift+Y 会被焦点控件挡住。
    <scrollbox style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1 }} stickyScroll stickyStart="bottom" focused={false} focusable={false}>
      {props.header ? <text fg={theme.dim} selectable>{`${props.header}\n`}</text> : null}
      {props.items.map((item) => {
        const custom = props.renderItem?.(item);
        if (custom !== undefined) return custom;
        return renderDefault(item, theme, syntaxStyle, props.showThoughts ?? true, clip, hintClicks);
      })}
    </scrollbox>
  );
}

function renderDefault(
  item: TranscriptItem,
  theme: Theme,
  syntaxStyle: SyntaxStyle,
  showThoughts: boolean,
  clip: ClipContext,
  hintClicks: HintClickHandlers,
): ReactNode {
  if (item.type === "message") {
    const author = messageAuthor(item);
    const color =
      item.role === "user" ? theme.user : (theme.agentColorFor?.(author) ?? theme.agent);
    return (
      <box key={item.id} style={{ flexDirection: "row", marginTop: 1, width: "100%" }}>
        <text fg={color} style={{ width: 3, flexShrink: 0 }} selectable>
          {item.role === "user" ? "✨ " : "●  "}
        </text>
        {item.format === "markdown" ? (
          <markdown
            content={item.text}
            syntaxStyle={syntaxStyle}
            streaming={item.streaming ?? false}
            style={{ flexGrow: 1, flexShrink: 1 }}
          />
        ) : (
          <text
            fg={item.role === "user" ? theme.user : undefined}
            style={{ flexGrow: 1, flexShrink: 1 }}
            wrapMode="word"
            selectable
          >
            {item.text}
          </text>
        )}
      </box>
    );
  }
  if (item.type === "group") {
    return renderGroup(item, theme, syntaxStyle, showThoughts, clip, hintClicks);
  }
  return renderBlock(item, theme, syntaxStyle, showThoughts, clip, hintClicks);
}

function renderGroup(
  item: TranscriptGroupItem,
  theme: Theme,
  syntaxStyle: SyntaxStyle,
  showThoughts: boolean,
  clip: ClipContext,
  hintClicks: HintClickHandlers,
): ReactNode {
  const summary = item.summary;
  const collapsed = item.collapsedByDefault === true && !clip.expanded;
  if (collapsed && summary) {
    return (
      <box key={item.id} style={{ flexDirection: "column" }}>
        {renderBlock(summary, theme, syntaxStyle, showThoughts, clip, hintClicks)}
      </box>
    );
  }

  // A singleton group is a stable render container, not another visible row.
  // Once multiple members are revealed, keep the summary as their group heading.
  return (
    <box key={item.id} style={{ flexDirection: "column" }}>
      {summary && item.members.length > 1
        ? renderBlock(summary, theme, syntaxStyle, showThoughts, clip, hintClicks)
        : null}
      {item.members.map((member) =>
        renderBlock(member, theme, syntaxStyle, showThoughts, clip, hintClicks)
      )}
    </box>
  );
}

function renderBlock(
  item: TranscriptBlockItem,
  theme: Theme,
  syntaxStyle: SyntaxStyle,
  showThoughts: boolean,
  clip: ClipContext,
  hintClicks: HintClickHandlers,
): ReactNode {
  if (item.kind === "thought" && !showThoughts) return null;
  const { icon, color, toneIcon, note } = blockStatus(
    item.status,
    item.tone,
    item.kind,
    theme,
    item.author,
  );
  const contents = item.content
    ? (Array.isArray(item.content) ? item.content : [item.content])
    : [];
  const rich = contents.some(
    (content) => content.type === "code" || content.type === "command" || content.type === "diff",
  );
  if (rich) {
    return (
      <box key={item.id} style={{ flexDirection: "column", marginTop: 1 }}>
        <text selectable>
          <span fg={color}>{icon}</span>
          {toneIcon ? <span fg={theme.warning}>{` ${toneIcon}`}</span> : null}
          {blockTitle(item)}
          {note ? <span fg={theme.dim}>{` (${note})`}</span> : null}
        </text>
        {contents.map((content, index) =>
          renderRichContent(
            item,
            content,
            `${item.id}:${index}`,
            theme,
            syntaxStyle,
            clip,
            content.type === "diff" && contents.slice(0, index).some((piece) => piece.type === "diff"),
            hintClicks,
          ),
        )}
      </box>
    );
  }
  // 逐行 span：省略提示与 output 段用弱化色，同一 block 内混排不同类型时各保各色
  const content = contents.flatMap((piece) => clippedContentLines(item, piece, clip));
  const baseColor = item.kind === "thought" ? theme.dim : theme.tool;
  // 提示行在 renderable 内的行号：标题占 row 0，内容行从 row 1 开始（裁剪态行已预折行）
  const hintRows = content
    .map((line, index) => (line.hint ? index + 1 : -1))
    .filter((row) => row >= 0);
  // Keep one text renderable mounted while a running block gains output. OpenTUI can
  // otherwise leave cells from the old two-row flex layout behind during reflow.
  return (
    <text
      key={item.id}
      style={{ marginTop: 1 }}
      selectable
      onMouseDown={hintRows.length > 0 ? hintClicks.down(item.id) : undefined}
      onMouseUp={hintRows.length > 0 ? hintClicks.up(item.id, hintRows) : undefined}
    >
      <span fg={color}>{icon}</span>
      {toneIcon ? <span fg={theme.warning}>{` ${toneIcon}`}</span> : null}
      {blockTitle(item)}
      {note ? <span fg={theme.dim}>{` (${note})`}</span> : null}
      {content.map((line, index) => (
        <span key={index} fg={line.hint || line.dim ? theme.dim : baseColor}>
          {`\n${index === 0 ? "  └ " : "    "}${line.text}`}
        </span>
      ))}
    </text>
  );
}

function messageAuthor(item: Extract<TranscriptItem, { type: "message" }>): string {
  return item.author ?? (item.role === "user" ? "you" : "agent");
}

/** Transcript 保持紧凑，不重复打印 author；归属仍保留在 State 中供着色与接入方追溯。 */
function blockTitle(item: Extract<TranscriptItem, { type: "block" }>): ReactNode {
  return <strong>{` ${item.title}`}</strong>;
}

/**
 * 内容段 → 预算内的展示行。裁剪产出的是已按 wrapWidth 折行的视觉行（不会被 opentui
 * 二次 wrap，高度由构造保证）；未裁剪（预算内/展开/策略豁免）时保留 logical lines，
 * 交给 opentui word wrap，维持原有观感。
 */
function clippedContentLines(
  item: TranscriptItem & { type: "block" },
  content: TranscriptBlockContent,
  clip: ClipContext,
): ContentLine[] {
  const lines = blockContentLines(content);
  if (lines.length === 0) return [];
  const dim = content.type === "output";
  const budget = blockExpanded(clip, item.id) ? null : clip.policy(item, content);
  if (!budget) {
    const rows = lines.map((text) => ({ text, hint: false, dim }));
    // 按块展开的内容尾部挂收起提示行（hint 行参与点击行号计算，点它收起该块）
    if (perBlockExpanded(clip, item.id)) {
      rows.push({ text: collapseHint(), hint: true, dim });
    }
    return rows;
  }
  const { head, tail, hiddenRows } = clipLines(lines, clip.wrapWidth, budget);
  if (hiddenRows === 0) return head.map((text) => ({ text, hint: false, dim }));
  return [
    ...head.map((text) => ({ text, hint: false, dim })),
    { text: hiddenHint(hiddenRows), hint: true, dim },
    ...tail.map((text) => ({ text, hint: false, dim })),
  ];
}

function renderRichContent(
  item: TranscriptItem & { type: "block" },
  content: TranscriptBlockContent,
  key: string,
  theme: Theme,
  syntaxStyle: SyntaxStyle,
  clip: ClipContext,
  separateDiff: boolean,
  hintClicks: HintClickHandlers,
): ReactNode {
  const budget = blockExpanded(clip, item.id) ? null : clip.policy(item, content);
  const collapseTail = perBlockExpanded(clip, item.id);
  if (content.type === "code" || content.type === "command") {
    const code = content.type === "command" ? content.command : content.code;
    const language = content.type === "command" ? (content.language ?? "bash") : content.language;
    const codeLines = code.replace(/\n$/, "").split("\n");
    // code/command 走 logical line 裁剪（预留 1 行提示）：patch 不能掐、代码可以——
    // tree-sitter 对截断源码降级为 fallback 配色，可接受。clipped 时禁二次 wrap 保住预算。
    const clipped = budget !== null && codeLines.length > budget.maxRows;
    const shown = clipped ? codeLines.slice(0, budget.maxRows - 1).join("\n") : code;
    return (
      <box key={key} style={{ flexDirection: "column" }}>
        <HighlightedCode
          code={shown}
          language={language}
          fallbackColor={theme.tool}
          syntaxStyle={syntaxStyle}
          wrap={!clipped}
        />
        {clipped ? (
          <text
            fg={theme.dim}
            style={{ marginLeft: 4 }}
            selectable
            onMouseDown={hintClicks.down(item.id)}
            onMouseUp={hintClicks.up(item.id)}
          >
            {hiddenHint(codeLines.length - (budget.maxRows - 1))}
          </text>
        ) : collapseTail ? (
          <text
            fg={theme.dim}
            style={{ marginLeft: 4 }}
            selectable
            onMouseDown={hintClicks.down(item.id)}
            onMouseUp={hintClicks.up(item.id)}
          >
            {collapseHint()}
          </text>
        ) : null}
      </box>
    );
  }
  if (content.type === "diff") {
    return renderDiffContent(content, key, theme, syntaxStyle, budget, separateDiff, item.id, hintClicks, collapseTail);
  }
  const lines = clippedContentLines(item, content, clip);
  // 提示行在 renderable 内的行号：此处的 text 不含标题行，内容行从 row 0 开始
  const hintRows = lines
    .map((line, index) => (line.hint ? index : -1))
    .filter((row) => row >= 0);
  return lines.length > 0 ? (
    <text
      key={key}
      style={{ marginLeft: 4 }}
      selectable
      onMouseDown={hintRows.length > 0 ? hintClicks.down(item.id) : undefined}
      onMouseUp={hintRows.length > 0 ? hintClicks.up(item.id, hintRows) : undefined}
    >
      {lines.map((line, index) => (
        <span key={index} fg={line.hint || line.dim ? theme.dim : theme.tool}>
          {`${index === 0 ? "" : "\n"}${line.text}`}
        </span>
      ))}
    </text>
  ) : null;
}

/**
 * diff 内容块：文件操作统一采用 Codex 风格的完整单栏展示。
 * - 所有操作都使用带行号的 unified 视图，保持文件从上到下的阅读顺序；
 * - add/delete 也展示完整内容和背景色，文件操作的结果不藏到额外交互后；
 * - move 额外展示旧路径，patch 缺失时仍保留文件标题。
 */
function renderDiffContent(
  content: Extract<TranscriptBlockContent, { type: "diff" }>,
  key: string,
  theme: Theme,
  syntaxStyle: SyntaxStyle,
  budget: ClipBudget | null,
  separate: boolean,
  blockId: string,
  hintClicks: HintClickHandlers,
  collapseTail: boolean,
): ReactNode {
  const stats = content.patch ? diffStats(content.patch) : null;
  const children: ReactNode[] = [
    <DiffHeader key={`${key}:h`} content={content} stats={stats} theme={theme} />,
  ];

  const patch = content.patch;
  if (patch) {
    const view: DiffView = "unified";
    const totalRows = diffRows(patch, view);
    // diff 是有语法结构的，掐内容会裁出非法 patch——用固定高度 box + overflow hidden
    // 做视口封顶（看头部），diff renderable 自身保持全量高度。
    const clipped = budget !== null && totalRows > budget.maxRows;
    const shownRows = clipped ? budget.maxRows - 1 : totalRows;
    const diffNode = (
      <diff
        key={`${key}:patch`}
        diff={patch}
        view={view}
        filetype={pathToFiletype(content.path)}
        syntaxStyle={syntaxStyle}
        showLineNumbers
        wrapMode="none"
        addedBg={theme.diffAddedBg ?? "transparent"}
        removedBg={theme.diffRemovedBg ?? "transparent"}
        contextBg="transparent"
        addedSignColor={theme.success}
        removedSignColor={theme.error}
        style={{ width: "100%", height: totalRows }}
      />
    );
    if (clipped) {
      children.push(
        <box key={`${key}:vp`} style={{ height: shownRows, overflow: "hidden", flexDirection: "column" }}>
          {diffNode}
        </box>,
        <text
          key={`${key}:hint`}
          fg={theme.dim}
          selectable
          onMouseDown={hintClicks.down(blockId)}
          onMouseUp={hintClicks.up(blockId)}
        >
          {hiddenHint(totalRows - shownRows)}
        </text>,
      );
    } else {
      children.push(diffNode);
      if (collapseTail) {
        children.push(
          <text
            key={`${key}:collapse`}
            fg={theme.dim}
            selectable
            onMouseDown={hintClicks.down(blockId)}
            onMouseUp={hintClicks.up(blockId)}
          >
            {collapseHint()}
          </text>,
        );
      }
    }
  }

  return (
    <box key={key} style={{ flexDirection: "column", marginLeft: 4, marginTop: separate ? 1 : 0 }}>
      {children}
    </box>
  );
}

/** Codex 式文件标题：树枝弱化，路径保持正文色，增删统计各用自己的状态色。 */
function DiffHeader(props: {
  content: Extract<TranscriptBlockContent, { type: "diff" }>;
  stats: { added: number; removed: number } | null;
  theme: Theme;
}): ReactNode {
  const path = props.content.oldPath
    ? `${props.content.oldPath} → ${props.content.path}`
    : props.content.path;
  return (
    <text selectable>
      <span fg={props.theme.dim}>{"└ "}</span>
      <span>{path}</span>
      {props.stats ? (
        <>
          {" ("}
          <span fg={props.theme.success}>{`+${props.stats.added}`}</span>
          {" "}
          <span fg={props.theme.error}>{`-${props.stats.removed}`}</span>
          {")"}
        </>
      ) : null}
    </text>
  );
}

function HighlightedCode(props: {
  code: string;
  language: string;
  fallbackColor: string;
  syntaxStyle: SyntaxStyle;
  /** false 时禁 word wrap（裁剪态：超宽行右缘截断，保证视觉行数 == 预算行数） */
  wrap?: boolean;
}): ReactNode {
  const [content, setContent] = useState<string | StyledText>(props.code);
  useEffect(() => {
    let active = true;
    setContent(props.code);
    void treeSitterToStyledText(props.code, props.language, props.syntaxStyle, getTreeSitterClient(), {
      conceal: { enabled: false },
    })
      .then((highlighted) => {
        if (active) setContent(highlighted);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [props.code, props.language, props.syntaxStyle]);
  return (
    <text
      content={content}
      fg={props.fallbackColor}
      wrapMode={props.wrap === false ? "none" : undefined}
      style={{ marginLeft: 4 }}
      selectable
    />
  );
}

function syntaxStyleFor(theme: Theme): SyntaxStyle {
  return SyntaxStyle.fromStyles({
    default: { fg: theme.tool },
    keyword: { fg: theme.agent, bold: true },
    string: { fg: theme.success },
    comment: { fg: theme.dim, italic: true },
    number: { fg: theme.plan },
    variable: { fg: theme.user },
    function: { fg: theme.accent },
    operator: { fg: theme.error },
    property: { fg: theme.plan },
    type: { fg: theme.plan },
    punctuation: { fg: theme.dim },
    "markup.link.url": { fg: theme.accent, underline: true },
    "string.special.url": { fg: theme.accent, underline: true },
  });
}


// 高度预算由 clip 层负责，这里只做"内容 → logical lines"的展开，不再截断
function blockContentLines(content: TranscriptBlockContent): string[] {
  if (content.type === "text") return content.text.split("\n").filter(Boolean);
  if (content.type === "lines" || content.type === "output") return content.lines;
  if (content.type === "code" || content.type === "command" || content.type === "diff") return [];
  const markOf = (status: string): string =>
    status === "completed" ? "[✓]" : status === "in_progress" ? "[•]" : "[ ]";
  return content.entries.map((entry) => `${markOf(entry.status)} ${entry.content}`);
}
