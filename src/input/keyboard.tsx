import type { CliRenderer, KeyEvent, Renderable } from "@opentui/core";
import type {
  Binding,
  Command,
  CommandContext,
  Keymap,
  Layer,
  TargetMode,
} from "@opentui/keymap";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { useRenderer } from "@opentui/react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type DependencyList,
  type ReactNode,
} from "react";

export type InputKeymap = Keymap<Renderable, KeyEvent>;

export interface InputTargetRef<
  TRenderable extends Renderable = Renderable,
> {
  current: TRenderable | null;
}

export interface InputBindingLayer<
  TRenderable extends Renderable = Renderable,
> extends Omit<Layer<Renderable, KeyEvent>, "target" | "targetMode"> {
  targetRef?: InputTargetRef<TRenderable>;
  targetMode?: TargetMode;
}

/**
 * Contested keys are routed by active layer, not hook registration order.
 * A matched binding consumes the event by default, so exactly one behavior runs.
 */
export const INPUT_LAYER_PRIORITY = {
  application: 0,
  surface: 100,
  popup: 200,
  modal: 300,
  editing: 400,
  overlay: 500,
} as const;

const keymaps = new WeakMap<CliRenderer, InputKeymap>();
const InputContext = createContext<InputKeymap | null>(null);

function inputKeymap(renderer: CliRenderer): InputKeymap {
  const existing = keymaps.get(renderer);
  if (existing) return existing;
  const created = createDefaultOpenTuiKeymap(renderer);
  keymaps.set(renderer, created);
  return created;
}

export interface InputProviderProps {
  children?: ReactNode;
}

/**
 * Owns the single OpenTUI keymap for a renderer. Nested providers reuse it, so
 * ChatShell remains standalone while larger applications can wrap all screens.
 */
export function InputProvider(props: InputProviderProps): ReactNode {
  const renderer = useRenderer();
  const inherited = useContext(InputContext);
  const keymap = useMemo(
    () => inherited ?? inputKeymap(renderer),
    [inherited, renderer],
  );

  if (inherited) return props.children;
  return (
    <InputContext.Provider value={keymap}>
      {props.children}
    </InputContext.Provider>
  );
}

/**
 * Register semantic behaviors in an explicit input layer.
 *
 * The binding structure is stable until deps change, while command bodies are
 * resolved from the latest render. This prevents a freshly rendered nested mode
 * from briefly running the previous render's keyboard behavior.
 */
export function useInputBindings(
  createLayer: () => InputBindingLayer,
  deps?: DependencyList,
): void {
  const renderer = useRenderer();
  const inherited = useContext(InputContext);
  const keymap = inherited ?? inputKeymap(renderer);
  const latest = useRef(createLayer);
  latest.current = createLayer;

  const layer = useMemo(() => {
    const layer = latest.current();
    const commands = layer.commands as
      | readonly Command<Renderable, KeyEvent>[]
      | undefined;
    const bindings = layer.bindings as
      | readonly Binding<Renderable, KeyEvent>[]
      | undefined;
    return {
      ...layer,
      commands: commands?.map((command) => ({
        ...command,
        run: (context: CommandContext<Renderable, KeyEvent>) => {
          const currentCommands = latest.current().commands as
            | readonly Command<Renderable, KeyEvent>[]
            | undefined;
          const current = currentCommands?.find(
            (candidate) => candidate.name === command.name,
          );
          if (!current) return false;
          return current.run(context);
        },
      })),
      bindings: bindings?.map((binding, index) => {
        if (typeof binding.cmd !== "function") return binding;
        return {
          ...binding,
          cmd: (context: CommandContext<Renderable, KeyEvent>) => {
            const currentBindings = latest.current().bindings as
              | readonly Binding<Renderable, KeyEvent>[]
              | undefined;
            const current = currentBindings?.[index]?.cmd;
            if (typeof current !== "function") return false;
            return current(context);
          },
        };
      }),
    };
  }, deps ?? []);

  useEffect(() => {
    const hasExplicitTarget = layer.targetRef !== undefined;
    const target = layer.targetRef?.current ?? undefined;
    const targetMode =
      layer.targetMode ?? (hasExplicitTarget ? "focus-within" : undefined);
    if (targetMode && !target) return;
    const {
      targetRef: _targetRef,
      targetMode: _targetMode,
      ...baseLayer
    } = layer;
    return keymap.registerLayer(
      targetMode
        ? { ...baseLayer, target, targetMode }
        : baseLayer,
    );
  }, [keymap, layer]);
}
