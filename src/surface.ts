import { useCallback, useSyncExternalStore } from "react";

/** 独立订阅和渲染的 UI 区域；具体 Surface 以语义命名，不需要基类或注册器。 */
export interface Surface<T> {
  getSnapshot(): T;
  subscribe(onChange: () => void): () => void;
}

/** ChatSurfaceStore 的内部可写单元；写入与通知分离以支持跨 Surface 原子提交。 */
export interface SurfaceCell<T> extends Surface<T> {
  snapshot: T;
  readonly listeners: Set<() => void>;
}

export function createSurfaceCell<T>(snapshot: T): SurfaceCell<T> {
  const listeners = new Set<() => void>();
  const surface: SurfaceCell<T> = {
    snapshot,
    listeners,
    getSnapshot: () => surface.snapshot,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
  return surface;
}

/** React Surface 只订阅自己的快照，不从父级完整 view 间接取数。 */
export function useSurface<T>(surface: Surface<T>): T {
  return useSyncExternalStore(
    useCallback((onChange) => surface.subscribe(onChange), [surface]),
    surface.getSnapshot,
    surface.getSnapshot,
  );
}
