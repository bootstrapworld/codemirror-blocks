/**
 * A small drag-and-drop layer built on Pointer Events, so that dragging works
 * with a mouse, a pen, and a finger. It has the shape of a hooks-based library (a provider,
 * `useDrag`, `useDrop`) but is much smaller, and does not use the browser's
 * native drag-and-drop (which does not work on touch screens).
 *
 * - A drag from a mouse or pen starts once the pointer has moved a few pixels.
 * - A drag from a finger starts after a long press. Moving the finger earlier
 *   cancels the pending drag, so that the page scrolls as usual.
 * - Drop targets are found with `document.elementFromPoint`, walking up the
 *   ancestors of the element under the pointer. Drop handlers run innermost
 *   first, and `didDrop` tells outer ones whether an inner one already ran.
 * - The preview is a clone of the source element that follows the pointer.
 */
import React, {
  use,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
require("./dnd.less");

export enum ItemTypes {
  NODE = "node",
}

/** What is being dragged: a node already in the editor, or new text. */
export type DragItem = { id?: string; content?: string };
export type Point = { x: number; y: number };
export type DropInfo = { didDrop: boolean; clientOffset: Point };

/** Pixels a mouse/pen must move before a drag starts. */
const MOUSE_SLOP = 4;
/** How long a finger must rest on a block before a drag starts (ms). */
export const LONG_PRESS_MS = 250;
/** Pixels a finger may drift during the long press before it is a scroll. */
const TOUCH_SLOP = 8;

type Source = { getItem: () => DragItem };
type Target = { drop: (item: DragItem, info: DropInfo) => void };

type Pending = {
  pointerId: number;
  pointerType: string;
  start: Point;
  el: HTMLElement;
  source: Source;
  timer?: ReturnType<typeof setTimeout>;
};
type Active = {
  pointerId: number;
  el: HTMLElement;
  item: DragItem;
  preview: HTMLElement;
  /** the innermost drop target under the pointer, if any */
  over: Element | null;
  pos: Point;
  pointerType: string;
};

class DragStore {
  sources = new WeakMap<Element, Source>();
  targets = new WeakMap<Element, Target>();
  pending: Pending | null = null;
  active: Active | null = null;
  private listeners = new Set<() => void>();

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  private emit() {
    this.listeners.forEach((l) => l());
  }

  /** Drop targets under (x, y), innermost first. */
  private targetsAt(p: Point): { el: Element; target: Target }[] {
    const found: { el: Element; target: Target }[] = [];
    let el: Element | null = document.elementFromPoint(p.x, p.y);
    while (el) {
      const target = this.targets.get(el);
      if (target) found.push({ el, target });
      el = el.parentElement;
    }
    return found;
  }

  private begin(p: Pending, pos: Point) {
    const preview = p.el.cloneNode(true) as HTMLElement;
    preview.removeAttribute("id");
    preview.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    preview.classList.add("cmb-drag-preview");
    preview.setAttribute("aria-hidden", "true"); // a picture, not a second block
    preview.removeAttribute("data-cmb-drag-source");
    document.body.appendChild(preview);
    document.body.classList.add("cmb-dragging");
    try {
      p.el.setPointerCapture(p.pointerId);
    } catch (_) {
      // the pointer may be gone already; the window listeners still work
    }
    this.active = {
      pointerId: p.pointerId,
      el: p.el,
      item: p.source.getItem(),
      preview,
      over: null,
      pos,
      pointerType: p.pointerType,
    };
    this.clearPending();
    this.move(pos);
    this.emit();
  }

  /** Abandon any drag (the provider is going away). */
  reset() {
    this.clearPending();
    this.end();
  }

  private clearPending() {
    if (this.pending?.timer) clearTimeout(this.pending.timer);
    this.pending = null;
  }

  private move(pos: Point) {
    const a = this.active;
    if (!a) return;
    a.pos = pos;
    a.preview.style.transform = `translate(${pos.x + 1}px, ${pos.y + 1}px)`;
    const over = this.targetsAt(pos)[0]?.el ?? null;
    if (over !== a.over) {
      a.over = over;
      this.emit();
    }
  }

  private end() {
    const a = this.active;
    if (!a) return;
    a.preview.remove();
    document.body.classList.remove("cmb-dragging");
    try {
      a.el.releasePointerCapture(a.pointerId);
    } catch (_) {
      // already released, or the element is gone
    }
    this.active = null;
    this.emit();
  }

  private drop() {
    const a = this.active;
    if (!a) return;
    const hits = this.targetsAt(a.pos);
    this.end();
    let didDrop = false;
    for (const { target } of hits) {
      target.drop(a.item, { didDrop, clientOffset: a.pos });
      didDrop = true;
    }
  }

  /** The click that follows a drag's pointerup must not select/activate. */
  private swallowNextClick() {
    const stop = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", stop, true), 0);
  }

  // ---- window-level listeners -------------------------------------------
  onPointerDown(e: PointerEvent, el: HTMLElement, source: Source) {
    if (
      this.active ||
      this.pending ||
      (e.pointerType === "mouse" && e.button !== 0)
    ) {
      return;
    }
    const p: Pending = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      start: { x: e.clientX, y: e.clientY },
      el,
      source,
    };
    this.pending = p;
    if (e.pointerType === "touch") {
      p.timer = setTimeout(() => {
        if (this.pending === p) this.begin(p, p.start);
      }, LONG_PRESS_MS);
    }
  }

  onPointerMove = (e: PointerEvent) => {
    const pos = { x: e.clientX, y: e.clientY };
    const p = this.pending;
    if (p && p.pointerId === e.pointerId) {
      const dist = Math.hypot(pos.x - p.start.x, pos.y - p.start.y);
      if (p.pointerType === "touch") {
        if (dist > TOUCH_SLOP) this.clearPending(); // it's a scroll
      } else if (dist >= MOUSE_SLOP) {
        this.begin(p, pos);
      }
    } else if (this.active && this.active.pointerId === e.pointerId) {
      this.move(pos);
    }
  };

  onPointerUp = (e: PointerEvent) => {
    if (this.pending?.pointerId === e.pointerId) this.clearPending();
    if (this.active?.pointerId === e.pointerId) {
      this.move({ x: e.clientX, y: e.clientY });
      this.swallowNextClick();
      this.drop();
    }
  };

  onPointerCancel = (e: PointerEvent) => {
    if (this.pending?.pointerId === e.pointerId) this.clearPending();
    if (this.active?.pointerId === e.pointerId) this.end();
  };

  onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      this.clearPending();
      this.end();
    }
  };

  /** Once a touch drag is active, the page must not pan under the finger. */
  onTouchMove = (e: TouchEvent) => {
    if (this.active?.pointerType === "touch" && e.cancelable)
      e.preventDefault();
  };

  /** Suppress the long-press menu while a touch is pending or dragging. */
  onContextMenu = (e: Event) => {
    if (this.active || this.pending?.pointerType === "touch")
      e.preventDefault();
  };

  onSelectStart = (e: Event) => {
    if (this.active) e.preventDefault();
  };
}

const StoreContext = React.createContext<DragStore | null>(null);

function useStore(): DragStore {
  const store = use(StoreContext);
  if (!store) throw new Error("useDrag/useDrop need a DragProvider");
  return store;
}

/** Owns the window listeners and the state of the current drag. */
export function DragProvider(props: { children?: React.ReactNode }) {
  const [store] = useState(() => new DragStore());
  // The non-passive touchmove listener must exist before the first touch (iOS
  // ignores preventDefault on touchmove listeners added later), hence a layout
  // effect.
  useLayoutEffect(() => {
    const w = window;
    w.addEventListener("pointermove", store.onPointerMove);
    w.addEventListener("pointerup", store.onPointerUp);
    w.addEventListener("pointercancel", store.onPointerCancel);
    w.addEventListener("keydown", store.onKeyDown);
    w.addEventListener("touchmove", store.onTouchMove, { passive: false });
    w.addEventListener("contextmenu", store.onContextMenu);
    w.addEventListener("selectstart", store.onSelectStart);
    return () => {
      w.removeEventListener("pointermove", store.onPointerMove);
      w.removeEventListener("pointerup", store.onPointerUp);
      w.removeEventListener("pointercancel", store.onPointerCancel);
      w.removeEventListener("keydown", store.onKeyDown);
      w.removeEventListener("touchmove", store.onTouchMove);
      w.removeEventListener("contextmenu", store.onContextMenu);
      w.removeEventListener("selectstart", store.onSelectStart);
      store.reset();
    };
  }, [store]);
  return React.createElement(
    StoreContext.Provider,
    { value: store },
    props.children
  );
}

/**
 * Make an element a drag source. `item` is read when the drag starts.
 * Returns `[{isDragging}, connectSource]`; pass `connectSource` as the ref of
 * the element, which is also its own drag preview.
 */
export function useDrag(options: { item: DragItem | (() => DragItem) }) {
  const store = useStore();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const elRef = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const connectSource = useCallback(
    (el: HTMLElement | null) => {
      if (el === elRef.current) return;
      cleanupRef.current?.();
      cleanupRef.current = null;
      elRef.current = el;
      if (!el) return;
      const source: Source = {
        getItem: () => {
          const item = optionsRef.current.item;
          return typeof item === "function" ? item() : item;
        },
      };
      const onDown = (e: PointerEvent) => store.onPointerDown(e, el, source);
      el.setAttribute("data-cmb-drag-source", "");
      el.addEventListener("pointerdown", onDown);
      cleanupRef.current = () => {
        el.removeEventListener("pointerdown", onDown);
        el.removeAttribute("data-cmb-drag-source");
      };
    },
    [store]
  );

  const isDragging = useSyncExternalStore(
    store.subscribe,
    () => !!elRef.current && store.active?.el === elRef.current
  );
  return [{ isDragging }, connectSource] as const;
}

/**
 * Make an element a drop target. `drop` gets the item and `{didDrop,
 * clientOffset}`. Returns `[{isOver}, connectTarget]`; `isOver` is true only
 * for the innermost target under the pointer.
 */
export function useDrop(options: {
  drop: (
    item: DragItem & { id: string; content: string },
    info: DropInfo
  ) => void;
}) {
  const store = useStore();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const elRef = useRef<HTMLElement | null>(null);

  const connectTarget = useCallback(
    (el: HTMLElement | null) => {
      if (el === elRef.current) return;
      if (elRef.current) store.targets.delete(elRef.current);
      elRef.current = el;
      if (el) {
        store.targets.set(el, {
          drop: (item, info) =>
            optionsRef.current.drop(
              item as DragItem & { id: string; content: string },
              info
            ),
        });
      }
    },
    [store]
  );

  const isOver = useSyncExternalStore(
    store.subscribe,
    () => !!elRef.current && store.active?.over === elRef.current
  );
  return [{ isOver }, connectTarget] as const;
}
