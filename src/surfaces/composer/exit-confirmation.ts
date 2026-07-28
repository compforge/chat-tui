import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { ToastMessage } from "../../state/footer.ts";
import {
  CTRL_C_CONFIRM_WINDOW_MS,
  ctrlCAction,
  type CtrlCAction,
} from "./keys.ts";

/** Owns the short-lived second-Ctrl+C confirmation lifecycle. */
export function useExitConfirmation(
  setToast: Dispatch<SetStateAction<ToastMessage | null>>,
): {
  arm(text: string): void;
  disarm(): void;
  nextAction(hasDraft: boolean): CtrlCAction;
} {
  const armedAt = useRef(0);
  const status = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    armedAt.current = Date.now();
    status.current = text;
    setToast({ text, tone: "info" });
    timer.current = setTimeout(() => {
      armedAt.current = 0;
      status.current = null;
      timer.current = null;
      setToast((current) => (current?.text === text ? null : current));
    }, CTRL_C_CONFIRM_WINDOW_MS + 100);
  }, [setToast]);

  const disarm = useCallback(() => {
    if (!armedAt.current && !status.current && !timer.current) return;
    armedAt.current = 0;
    const currentStatus = status.current;
    status.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (currentStatus) {
      setToast((current) =>
        current?.text === currentStatus ? null : current
      );
    }
  }, [setToast]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const nextAction = useCallback(
    (hasDraft: boolean) =>
      ctrlCAction({
        hasDraft,
        armedAt: armedAt.current,
        now: Date.now(),
      }),
    [],
  );

  return { arm, disarm, nextAction };
}
