import { useCallback, useSyncExternalStore } from "react";

import type { Store } from "./contract.ts";

/** Surface 直接订阅所需 State，不从父级完整快照间接取数。 */
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
