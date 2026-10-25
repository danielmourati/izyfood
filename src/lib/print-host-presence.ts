import { supabase } from '@/integrations/supabase/client';
import { getDeviceId, getDeviceLabel } from '@/lib/printer';
import { PRINT_HOST_PRESENCE_PREFIX } from '@/lib/print-queue';

/** Caixa é considerado ativo se gravou sinal de vida há menos deste tempo. */
export const HOST_ALIVE_MS = 45_000;
export const HOST_HEARTBEAT_MS = 15_000;

export function isHostAlive(lastSeen: string | null | undefined, now = Date.now()): boolean {
  if (!lastSeen) return false;
  const t = new Date(lastSeen).getTime();
  return Number.isFinite(t) && now - t < HOST_ALIVE_MS;
}

export interface HostState {
  online: boolean;
  label: string | null;
  lastSeenAt: string | null;
  deviceId: string | null;
}

export function isOtherPrintHost(state: HostState, deviceId: string): boolean {
  return state.online && !!state.deviceId && state.deviceId !== deviceId;
}

type Listener = (s: HostState) => void;

/**
 * Um único canal de presença + verificação no banco por aparelho/loja,
 * compartilhado por todas as telas (contagem de referências).
 */
class PresenceManager {
  private tenantId: string | null = null;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private listeners = new Set<Listener>();
  private hostRefs = 0;
  private userName: string | null = null;
  private presenceHost: { label: string | null } | null = null;
  private dbHost: { label: string | null; lastSeenAt: string; deviceId: string } | null = null;
  private pollTimer: number | null = null;
  private beatTimer: number | null = null;
  private retryTimer: number | null = null;
  state: HostState = { online: false, label: null, lastSeenAt: null, deviceId: null };
  private beating = false;

  private emit() {
    const lastSeenAt = this.dbHost?.lastSeenAt ?? null;
    const dbAlive = isHostAlive(lastSeenAt);
    // Only the server-confirmed lease authorizes a device, never presence alone.
    const online = dbAlive;
    const label = dbAlive ? this.dbHost?.label ?? null : null;
    this.state = { online, label, lastSeenAt, deviceId: dbAlive ? this.dbHost?.deviceId ?? null : null };
    this.listeners.forEach(l => l(this.state));
  }

  subscribe(tenantId: string, l: Listener) {
    if (this.tenantId !== tenantId) this.reset(tenantId);
    this.listeners.add(l);
    l(this.state);
    return () => {
      this.listeners.delete(l);
      if (this.listeners.size === 0 && this.hostRefs === 0) this.reset(null);
    };
  }

  setHost(tenantId: string, enabled: boolean, userName: string | null) {
    if (this.tenantId !== tenantId) this.reset(tenantId);
    this.userName = userName;
    this.hostRefs += enabled ? 1 : 0;
    if (enabled) this.startBeat();
    this.track();
    return () => {
      if (!enabled) return;
      this.hostRefs = Math.max(0, this.hostRefs - 1);
      if (this.hostRefs === 0) {
        this.stopBeat();
        const tid = this.tenantId;
        // Keep the short lease on unmount; another tab on the same device may use it.
        if (tid) this.poll();
        this.track();
      }
    };
  }

  private reset(tenantId: string | null) {
    if (this.channel) { supabase.removeChannel(this.channel); this.channel = null; }
    if (this.pollTimer) window.clearInterval(this.pollTimer);
    if (this.retryTimer) window.clearTimeout(this.retryTimer);
    this.stopBeat();
    this.pollTimer = null;
    this.presenceHost = null;
    this.dbHost = null;
    this.tenantId = tenantId;
    this.hostRefs = 0;
    this.emit();
    if (!tenantId) return;
    this.connect();
    this.poll();
    this.pollTimer = window.setInterval(() => this.poll(), HOST_HEARTBEAT_MS);
  }

  private connect() {
    const tid = this.tenantId;
    if (!tid) return;
    if (this.channel) { supabase.removeChannel(this.channel); this.channel = null; }
    const channel = supabase.channel(`${PRINT_HOST_PRESENCE_PREFIX}${tid}`, {
      config: { presence: { key: getDeviceId() } },
    });
    this.channel = channel;
    const read = () => {
      const state = channel.presenceState() as Record<string, any[]>;
      const host = Object.values(state).flat().find((e: any) => e?.role === 'host') as any;
      this.presenceHost = host ? { label: [host.userName, host.label].filter(Boolean).join(' · ') || null } : null;
      this.poll();
    };
    channel
      .on('presence', { event: 'sync' }, read)
      .on('presence', { event: 'join' }, read)
      .on('presence', { event: 'leave' }, read)
      .subscribe((status) => {
        if (this.channel !== channel) return;
        if (status === 'SUBSCRIBED') this.track();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          this.presenceHost = null;
          this.emit();
          if (this.retryTimer) window.clearTimeout(this.retryTimer);
          this.retryTimer = window.setTimeout(() => this.connect(), 3000);
        }
      });
  }

  private track() {
    const ch = this.channel;
    if (!ch) return;
    const payload = this.hostRefs > 0 && this.state.deviceId === getDeviceId() && this.state.online
      ? { role: 'host', label: getDeviceLabel(), userName: this.userName, at: new Date().toISOString() }
      : { role: 'watcher', label: getDeviceLabel(), at: new Date().toISOString() };
    ch.track(payload).catch(() => {});
  }

  async poll() {
    const tid = this.tenantId;
    if (!tid) return;
    try {
      const { data, error } = await supabase
        .from('print_hosts')
        .select('label,user_name,last_seen_at,device_id')
        .eq('tenant_id', tid)
        .order('last_seen_at', { ascending: false })
        .limit(1);
      const row = data?.[0];
      if (error || this.tenantId !== tid) return;
      this.dbHost = row ? { label: [row.user_name, row.label].filter(Boolean).join(' · ') || null, lastSeenAt: row.last_seen_at, deviceId: row.device_id } : null;
      this.emit();
    } catch { /* rede instável: mantém último estado */ }
  }

  private async beat() {
    const tid = this.tenantId;
    if (!tid || this.hostRefs === 0 || this.beating) return;
    this.beating = true;
    try {
      await this.acquire(tid, this.userName);
    } catch { this.emit(); /* retries on the next heartbeat */ }
    finally { this.beating = false; }
  }

  async acquire(tenantId: string, userName: string | null): Promise<boolean> {
    if (this.tenantId !== tenantId) this.reset(tenantId);
    const { data, error } = await supabase.rpc('acquire_print_host', {
      _device_id: getDeviceId(), _label: getDeviceLabel(), _user_name: userName ?? undefined,
    });
    if (error) throw error;
    await this.poll();
    this.track();
    return data === true;
  }

  /** Admin: transfere o Caixa para este aparelho, derrubando o anterior. */
  async takeover(tenantId: string, userName: string | null): Promise<boolean> {
    if (this.tenantId !== tenantId) this.reset(tenantId);
    const { data, error } = await supabase.rpc('takeover_print_host', {
      _device_id: getDeviceId(), _label: getDeviceLabel(), _user_name: userName ?? undefined,
    });
    if (error) throw error;
    await this.poll();
    this.track();
    return data === true;
  }

  async release(tenantId: string) {
    const { error } = await supabase.from('print_hosts').delete().eq('tenant_id', tenantId).eq('device_id', getDeviceId());
    if (error) throw error;
    await this.poll();
  }

  private startBeat() {
    if (this.beatTimer) return;
    this.beat();
    this.beatTimer = window.setInterval(() => this.beat(), HOST_HEARTBEAT_MS);
  }

  private stopBeat() {
    if (this.beatTimer) window.clearInterval(this.beatTimer);
    this.beatTimer = null;
  }

  /** Ao voltar internet/tela: reconecta e reverifica. */
  wake() {
    if (!this.tenantId) return;
    this.connect();
    this.poll();
    if (this.hostRefs > 0) this.beat();
  }
}

export const printHostPresence = new PresenceManager();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => printHostPresence.wake());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') printHostPresence.wake();
  });
}
