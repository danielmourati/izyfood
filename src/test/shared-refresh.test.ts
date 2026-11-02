import { describe, expect, it, vi } from 'vitest';
import { SharedRefresh } from '@/lib/shared-refresh';

function deferred() {
  let resolve = () => {};
  let reject: (reason: Error) => void = () => {};
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('shared refresh', () => {
  it('shares simultaneous and in-flight reads, without caching settled data', async () => {
    const refresh = new SharedRefresh();
    const gate = deferred();
    const read = vi.fn(() => gate.promise);
    const first = refresh.run('products', read);
    expect(refresh.run('products', read)).toBe(first);
    await Promise.resolve();
    expect(refresh.run('products', read)).toBe(first);
    expect(read).toHaveBeenCalledTimes(1);
    gate.resolve();
    await first;
    await refresh.run('products', read);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('coalesces a burst of changes into one trailing read and waits for fresh data', async () => {
    const refresh = new SharedRefresh();
    const gate = deferred();
    let server = 1;
    let displayed = 0;
    const read = vi.fn(async () => {
      const snapshot = server;
      if (read.mock.calls.length === 1) await gate.promise;
      displayed = snapshot;
    });
    const first = refresh.run('tablesAndOrders', read);
    await Promise.resolve();
    server = 2;
    for (let i = 0; i < 20; i++) refresh.invalidate('tablesAndOrders');
    expect(refresh.run('tablesAndOrders', read)).toBe(first);
    gate.resolve();
    await first;
    expect(read).toHaveBeenCalledTimes(2);
    expect(displayed).toBe(2);
  });

  it('preserves changes arriving during a trailing read', async () => {
    const refresh = new SharedRefresh();
    const gates = [deferred(), deferred()];
    const read = vi.fn(async () => { await gates[read.mock.calls.length - 1]?.promise; });
    const result = refresh.run('orders', read);
    await Promise.resolve();
    refresh.invalidate('orders');
    gates[0].resolve();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    refresh.invalidate('orders');
    gates[1].resolve();
    await result;
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('runs independent entities and sessions separately', async () => {
    const a = new SharedRefresh();
    const b = new SharedRefresh();
    const read = vi.fn(async () => {});
    await Promise.all([a.run('products', read), a.run('sales', read), b.run('products', read)]);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('releases a rejected read so reconnect can retry', async () => {
    const refresh = new SharedRefresh();
    const gate = deferred();
    const result = refresh.run('orders', () => gate.promise);
    const rejection = expect(result).rejects.toThrow('offline');
    gate.reject(new Error('offline'));
    await rejection;
    const read = vi.fn(async () => {});
    await refresh.run('orders', read);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('a post-write refresh cannot join a stale read without rechecking', async () => {
    const refresh = new SharedRefresh();
    const gate = deferred();
    const read = vi.fn().mockImplementationOnce(() => gate.promise).mockResolvedValue(undefined);
    const first = refresh.run('tablesAndOrders', read);
    await Promise.resolve();
    const afterTransfer = refresh.run('tablesAndOrders', read, true);
    expect(afterTransfer).toBe(first);
    gate.resolve();
    await afterTransfer;
    expect(read).toHaveBeenCalledTimes(2);
  });
});