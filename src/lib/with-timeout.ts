export const TIMEOUT_MESSAGE = 'O servidor demorou para responder. Tente de novo.';

export class TimeoutError extends Error {
  constructor(message = TIMEOUT_MESSAGE) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Rejects with TimeoutError if the promise does not settle within `ms`. */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
