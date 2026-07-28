import type { ChatState, ChatStatePatch } from "../state/chat.ts";
import {
  createStateCell,
  type StateCell,
  type Store,
} from "./contract.ts";

/** 负责读取和订阅 ChatState；State 与渲染 Surface 不要求一一对应。 */
export interface ChatStore extends Store<ChatState> {
  getRevision(): number;
}

/** 可写 Store 通过原子 commit 发布 State 变化。 */
export interface WritableChatStore extends ChatStore {
  /**
   * 所有新快照先落地，再通知发生变化的 State；订阅回调始终看到同一 revision。
   */
  commit(patch: ChatStatePatch): void;
}

export function createChatStore(
  initial: ChatState,
): WritableChatStore {
  const cells: { [Key in keyof ChatState]: StateCell<ChatState[Key]> } = {
    timeline: createStateCell(initial.timeline),
    composer: createStateCell(initial.composer),
    activity: createStateCell(initial.activity),
    footer: createStateCell(initial.footer),
    sidecar: createStateCell(initial.sidecar),
  };
  let revision = 0;

  const commit = (patch: ChatStatePatch): void => {
    const changed: Array<{ listeners: Set<() => void> }> = [];
    const replace = <Key extends keyof ChatState>(
      key: Key,
      next: ChatState[Key] | undefined,
    ): void => {
      const target = cells[key] as StateCell<ChatState[Key]>;
      if (!Object.hasOwn(patch, key) || next === target.snapshot) return;
      target.snapshot = next as ChatState[Key];
      changed.push(target);
    };

    replace("timeline", patch.timeline);
    replace("composer", patch.composer);
    replace("activity", patch.activity);
    replace("footer", patch.footer);
    replace("sidecar", patch.sidecar);
    if (changed.length === 0) return;

    revision += 1;
    for (const target of changed) {
      for (const listener of [...target.listeners]) listener();
    }
  };

  return {
    getState: <Key extends keyof ChatState>(key: Key) =>
      cells[key].snapshot,
    subscribe: <Key extends keyof ChatState>(
      key: Key,
      onChange: () => void,
    ) => {
      const listeners = cells[key].listeners;
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getRevision: () => revision,
    commit,
  };
}
