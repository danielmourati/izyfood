import { describe, it, expect, vi } from 'vitest';
import { pushEscapeLayer, escapeLayerCount } from '@/lib/escape-stack';

const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

describe('escape stack', () => {
  it('closes layers one at a time, newest first', () => {
    const order: string[] = [];
    const pops: Array<() => void> = [];
    const make = (n: string) => { const pop = pushEscapeLayer(() => { order.push(n); pop(); }); pops.push(pop); };
    make('pedido'); make('pizza'); make('confirmacao');
    esc(); expect(order).toEqual(['confirmacao']);
    esc(); expect(order).toEqual(['confirmacao', 'pizza']);
    esc(); expect(order).toEqual(['confirmacao', 'pizza', 'pedido']);
    expect(escapeLayerCount()).toBe(0);
  });
  it('closed layer leaves the stack and ESC without layers does nothing', () => {
    const a = vi.fn(); const b = vi.fn();
    const popA = pushEscapeLayer(a); const popB = pushEscapeLayer(b);
    popB(); esc();
    expect(b).not.toHaveBeenCalled(); expect(a).toHaveBeenCalledTimes(1);
    popA(); esc(); expect(a).toHaveBeenCalledTimes(1);
  });
});
