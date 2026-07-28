import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type { PickerView } from "../../state/composer.ts";
import { visiblePickerOptions } from "./interactions/picker.tsx";

interface PickerInput {
  id: string;
  query: string;
  selectedIndex: number;
}

export function usePickerController(
  picker: (PickerView & { id: string }) | null,
  search: (id: string, query: string) => void | Promise<void>,
): {
  query: string;
  options: PickerView["options"];
  selectedIndex: number;
  updateQuery(query: string): void;
  updateSelectedIndex(index: number): void;
} {
  const [input, setInput] = useState<PickerInput | null>(null);

  useEffect(() => {
    setInput(
      picker
        ? {
            id: picker.id,
            query: picker.search?.query ?? "",
            selectedIndex: 0,
          }
        : null,
    );
  }, [picker?.id]);

  const active = input && picker && input.id === picker.id ? input : null;
  const query = active?.query ?? picker?.search?.query ?? "";
  const options = picker ? visiblePickerOptions(picker, query) : [];
  const selectedIndex = options.length > 0
    ? Math.min(active?.selectedIndex ?? 0, options.length - 1)
    : 0;

  const updateQuery = useCallback(
    (nextQuery: string) => {
      if (!picker?.search) return;
      setInput({
        id: picker.id,
        query: nextQuery,
        selectedIndex: 0,
      });
      if (picker.search.mode === "remote") {
        void search(picker.id, nextQuery);
      }
    },
    [picker, search],
  );

  const updateSelectedIndex = useCallback(
    (index: number) => {
      if (!picker) return;
      setInput({
        id: picker.id,
        query,
        selectedIndex: index,
      });
    },
    [picker, query],
  );

  return {
    query,
    options,
    selectedIndex,
    updateQuery,
    updateSelectedIndex,
  };
}
