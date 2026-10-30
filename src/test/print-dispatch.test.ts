import { describe, expect, it, vi } from 'vitest';
import { dispatchOnce, PrintDispatchError } from '@/lib/print-dispatch';

describe('physical dispatch boundary', () => {
  it('does not send bytes when server authorization fails', async () => {
    const send = vi.fn();
    await expect(dispatchOnce(send, async () => { throw new Error('lease lost'); })).rejects.toThrow('lease lost');
    expect(send).not.toHaveBeenCalled();
  });
  it('attempts an ambiguous physical send exactly once, without retrying', async () => {
    const send = vi.fn().mockRejectedValue(new Error('response lost after acceptance'));
    await expect(dispatchOnce(send)).rejects.toBeInstanceOf(PrintDispatchError);
    expect(send).toHaveBeenCalledTimes(1);
  });
});