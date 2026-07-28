// ChatShell：把 ChatProtocol 接到五个独立 Surface，并编排全局布局与文本选择。

import {
  useRenderer,
  useSelectionHandler,
} from "@opentui/react";
import {
  useState,
  type ReactNode,
} from "react";

import type { ChatProtocol } from "../protocol/chat-protocol.ts";
import type { CommandSpec } from "../protocol/command.ts";
import type { ToastMessage } from "../state/footer.ts";
import { ComposerSurface } from "../surfaces/composer/surface.tsx";
import type { Candidate } from "../surfaces/composer/completion.ts";
import { FooterSurface } from "../surfaces/footer/surface.tsx";
import { SidecarSurface } from "../surfaces/sidecar/surface.tsx";
import type { ClipPolicy } from "../surfaces/timeline/clip.ts";
import { TimelineSurface } from "../surfaces/timeline/surface.tsx";
import { defaultTheme, type Theme } from "../theme.ts";
import { useTokenSelectionOnDoubleClick } from "./token-selection.ts";

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
  const [localToast, setLocalToast] = useState<ToastMessage | null>(null);
  const store = protocol.stateStore;

  useSelectionHandler((selection) => {
    const selectedText = selection.getSelectedText();
    if (selectedText) renderer.copyToClipboardOSC52(selectedText);
  });
  // 双击选词是壳内一切可见文本的通性，只在根容器挂这一处：鼠标事件带着命中
  // target 沿 parent 链冒泡，所有后代文本（含未来新增的组件）天然被覆盖。
  const selectTokenOnDoubleClick = useTokenSelectionOnDoubleClick();

  return (
    <box
      style={{ flexDirection: "row", flexGrow: 1, position: "relative" }}
      onMouseDown={selectTokenOnDoubleClick}
    >
      <box style={{ flexDirection: "column", flexGrow: 1, position: "relative" }}>
        <TimelineSurface
          store={store}
          theme={theme}
          clipPolicy={props.clipPolicy}
        />
        <ComposerSurface
          protocol={protocol}
          store={store}
          commands={props.commands}
          mentions={props.mentions}
          theme={theme}
          setLocalToast={setLocalToast}
        />
        <FooterSurface
          store={store}
          localToast={localToast}
          theme={theme}
        />
      </box>

      <SidecarSurface
        store={store}
        theme={theme}
      />
    </box>
  );
}
