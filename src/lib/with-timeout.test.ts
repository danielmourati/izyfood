import { describe, it, expect, vi } from 'vitest';
import { withTimeout, TimeoutError, TIMEOUT_MESSAGE } from './with-timeout';

describe('withTimeout', () => {
  it('rejects after 15s when the server never answers', async () => {
    vi.useFakeTimers();
    const p = withTimeout(new Promise(() => {}), 15000);
    vi.advanceTimersByTime(15000);
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
    await expect(p).rejects.toThrow(TIMEOUT_MESSAGE);
    vi.useRealTimers();
  });

  it('resolves when the answer arrives in time', async () => {
    await expect(withTimeout(Promise.resolve(42), 15000)).resolves.toBe(42);
  });
});
