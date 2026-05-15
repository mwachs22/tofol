"use client";

import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import type { EntityResult } from "@/lib/adapter/interface";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

interface SuggestionListProps {
  items: EntityResult[];
  command: (item: EntityResult) => void;
}

export interface SuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const SuggestionList = forwardRef<SuggestionListRef, SuggestionListProps>(
  function SuggestionList({ items, command }, ref) {
    const [selected, setSelected] = useState(0);

    useEffect(() => setSelected(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }) {
        if (event.key === "ArrowUp") {
          setSelected((s) => (s - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelected((s) => (s + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          if (items[selected]) command(items[selected]);
          return true;
        }
        return false;
      },
    }));

    if (!items.length) {
      return (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg px-3 py-2 text-xs text-zinc-400">
          No results
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 min-w-[180px] max-w-[280px]">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => command(item)}
            className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
              i === selected
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            <span className="text-[10px] text-zinc-400 font-mono shrink-0">{item.type}</span>
            <span className="truncate">{item.name}</span>
          </button>
        ))}
      </div>
    );
  }
);

export function buildEntitySuggestion(workspaceId: string): Partial<SuggestionOptions<EntityResult>> {
  return {
    char: "@",
    allowSpaces: false,
    startOfLine: false,

    items: async ({ query }) => {
      if (!query) return [];
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/adapter/entities?q=${encodeURIComponent(query)}`
        );
        if (!res.ok) return [];
        return (await res.json()) as EntityResult[];
      } catch {
        return [];
      }
    },

    render() {
      let renderer: ReactRenderer<SuggestionListRef>;
      let popup: HTMLDivElement | null = null;

      return {
        onStart(props) {
          popup = document.createElement("div");
          popup.style.position = "absolute";
          popup.style.zIndex = "50";
          document.body.appendChild(popup);

          renderer = new ReactRenderer(SuggestionList, {
            props,
            editor: props.editor,
          });
          popup.appendChild(renderer.element);
          positionPopup(popup, props.clientRect);
        },

        onUpdate(props) {
          renderer.updateProps(props);
          positionPopup(popup!, props.clientRect);
        },

        onKeyDown(props) {
          if (props.event.key === "Escape") {
            popup?.remove();
            renderer.destroy();
            return true;
          }
          return renderer.ref?.onKeyDown(props) ?? false;
        },

        onExit() {
          popup?.remove();
          renderer.destroy();
        },
      };
    },

    command({ editor, range, props }) {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(`@${props.name}`)
        .run();
    },
  };
}

function positionPopup(
  popup: HTMLDivElement,
  getRects: (() => DOMRect | null) | null | undefined
) {
  const rect = getRects?.();
  if (!rect) return;
  popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popup.style.left = `${rect.left + window.scrollX}px`;
}
