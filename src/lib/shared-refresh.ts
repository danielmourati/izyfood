/** One read per key, with a trailing read only when data changed in flight.
 * Instances belong to one provider/session; settled results are never cached.
 */
export class SharedRefresh {
  private flights = new Map<string, { promise: Promise<void>; dirty: boolean; read: () => Promise<void> }>();

  invalidate(key: string): void {
    const flight = this.flights.get(key);
    if (flight) flight.dirty = true;
  }

  run(key: string, read: () => Promise<void>, fresh = false): Promise<void> {
    const active = this.flights.get(key);
    if (active) {
      active.read = read;
      if (fresh) active.dirty = true;
      return active.promise;
    }
    const flight = { promise: Promise.resolve(), dirty: false, read };
    // Defer execution until the map entry exists, including for synchronous errors.
    flight.promise = Promise.resolve().then(async () => {
      try {
        do {
          flight.dirty = false;
          await flight.read();
        } while (flight.dirty);
      } finally {
        if (this.flights.get(key) === flight) this.flights.delete(key);
      }
    });
    this.flights.set(key, flight);
    return flight.promise;
  }
}