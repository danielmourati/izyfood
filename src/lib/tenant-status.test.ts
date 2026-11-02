import { describe, it, expect } from 'vitest';
import { isStoreAvailable, normalizeTenantStatus } from './tenant-status';

describe('store availability', () => {
  it('active store is shown', () => expect(isStoreAvailable('active')).toBe(true));
  it('inactive store shows not found', () => expect(isStoreAvailable('inactive')).toBe(false));
  it('deleted store shows not found', () => expect(isStoreAvailable(normalizeTenantStatus(null))).toBe(false));
});
