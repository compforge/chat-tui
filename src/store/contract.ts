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
