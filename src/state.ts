import { useCallback, useSyncExternalStore } from "react";

declare const storeStateType: unique symbol;

/** Store 对一组 State 提供的只读访问与订阅契约。 */
export interface Store<State extends object> {
  /** 仅用于在 TypeScript 中保留 State 类型，不存在于运行时。 */
  readonly [storeStateType]?: State;
  getState<Key extends keyof State>(key: Key): State[Key];
  subscribe<Key extends keyof State>(
    key: Key,
    onChange: () => void,
  ): () => void;
}

/** Store 的内部可写单元；写入与通知分离以支持跨 State 原子提交。 */
export interface StateCell<T> {
  snapshot: T;
  readonly listeners: Set<() => void>;
}

export function createStateCell<T>(snapshot: T): StateCell<T> {
  const listeners = new Set<() => void>();
  return {
    snapshot,
    listeners,
  };
}

/** Surface 直接订阅所需 State，不从父级完整 view 间接取数。 */
export function useStoreState<State extends object, Key extends keyof State>(
  store: Store<State>,
  key: Key,
): State[Key] {
  const getSnapshot = useCallback(
    () => store.getState(key),
    [key, store],
  );
  return useSyncExternalStore(
    useCallback(
      (onChange) => store.subscribe(key, onChange),
      [key, store],
    ),
    getSnapshot,
    getSnapshot,
  );
}

/**
 * 一个 Surface 可以只消费某个 State 的派生值。派生值未变化时，State 发布不会触发重渲染。
 */
export function useStoreSelector<
  State extends object,
  Key extends keyof State,
  Selected,
>(
  store: Store<State>,
  key: Key,
  selector: (snapshot: State[Key]) => Selected,
): Selected {
  const getSelected = useCallback(
    () => selector(store.getState(key)),
    [key, selector, store],
  );
  return useSyncExternalStore(
    useCallback(
      (onChange) => store.subscribe(key, onChange),
      [key, store],
    ),
    getSelected,
    getSelected,
  );
}
