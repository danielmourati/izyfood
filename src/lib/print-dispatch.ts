/** Any failure after entering physical transport is ambiguous: never resend it. */
export class PrintDispatchError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'Falha após iniciar envio à impressora.');
    this.name = 'PrintDispatchError';
  }
}

export async function dispatchOnce(send: () => Promise<void>, beforeDispatch?: () => Promise<void>): Promise<void> {
  await beforeDispatch?.();
  try { await send(); } catch (error) { throw new PrintDispatchError(error); }
}