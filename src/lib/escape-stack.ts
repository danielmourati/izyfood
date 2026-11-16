import { useEffect, useRef } from 'react';

/**
 * Global ESC stack: only the most recently opened layer handles Escape,
 * one layer per key press. Radix dialogs register too (see ui/dialog.tsx).
 */
type Layer = { id: number; handler: () => void };
const layers: Layer[] = [];
let nextId = 1;
const forwarded = new WeakSet<Event>();
let installed = false;

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || forwarded.has(e) || e.defaultPrevented) return;
  // Open popovers/selects/menus sit above dialogs: let Radix close them first.
  if (typeof document !== 'undefined' && document.querySelector('[data-radix-popper-content-wrapper]')) return;
  const top = layers[layers.length - 1];
  if (!top) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  top.handler();
}

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', onKeyDown, true);
}

export function pushEscapeLayer(handler: () => void): () => void {
  install();
  const layer = { id: nextId++, handler };
  layers.push(layer);
  return () => {
    const i = layers.findIndex(l => l.id === layer.id);
    if (i >= 0) layers.splice(i, 1);
  };
}

export function escapeLayerCount() {
  return layers.length;
}

/** Re-dispatch an Escape that our stack lets through to the element's own (Radix) listener. */
export function forwardEscape(target: Element | null) {
  if (!target) return;
  const ev = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
  forwarded.add(ev);
  target.dispatchEvent(ev);
}

export function useEscapeLayer(open: boolean, onEscape: () => void) {
  const ref = useRef(onEscape);
  ref.current = onEscape;
  useEffect(() => {
    if (!open) return;
    return pushEscapeLayer(() => ref.current());
  }, [open]);
}

/** For Radix content: registers while mounted and forwards ESC to the content node. */
export function useRadixEscapeLayer<T extends Element>(node: React.RefObject<T>) {
  useEffect(() => pushEscapeLayer(() => forwardEscape(node.current)), [node]);
}
