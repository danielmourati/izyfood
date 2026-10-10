import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Order } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Keep the original order opener stable, with a legacy fallback to the first item author. */
export function ensureOrderOpener(
  order: Order,
  user?: { id: string; name: string } | null,
): Order {
  const firstAuthoredItem = order.items?.find(item => item.addedByName?.trim());
  return {
    ...order,
    openedBy: order.openedBy || firstAuthoredItem?.addedBy || user?.id,
    openedByName: order.openedByName?.trim() || firstAuthoredItem?.addedByName?.trim() || user?.name?.trim(),
  };
}

export function getOrderAttendantName(order: {
  openedByName?: string;
  operatorName?: string;
  items?: Array<{ addedByName?: string }>;
}): string {
  return order.openedByName?.trim()
    || order.items?.find(item => item.addedByName?.trim())?.addedByName?.trim()
    || order.operatorName?.trim()
    || 'Não informado';
}

/** Format number to BRL string with comma as decimal separator */
export function fmt(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace('.', ',');
}

/** Format weight with comma */
export function fmtWeight(value: number): string {
  return value.toString().replace('.', ',');
}

/** The special "Todos os adicionais" option always sorts to the top of option lists. */
export function isAllAdditionalsOption(name: string): boolean {
  return name.trim().toLocaleLowerCase('pt-BR') === 'todos os adicionais';
}

/** Stable sort that keeps "Todos os adicionais" first, preserving the original order otherwise. */
export function sortAllAdditionalsFirst<T extends { name: string }>(options: T[]): T[] {
  return [...options].sort(
    (a, b) => Number(isAllAdditionalsOption(b.name)) - Number(isAllAdditionalsOption(a.name))
  );
}

/** Return item observations without duplicating structured and legacy values. */
export function getOrderItemNoteLines(item: {
  notes?: string;
  selectedNotes?: string[];
  otherNotes?: string;
}): string[] {
  const structured = [
    ...(item.selectedNotes || []),
    ...(item.otherNotes?.trim() ? [item.otherNotes] : []),
  ];
  const source = structured.length > 0 ? structured : String(item.notes || '').split('|');
  const seen = new Set<string>();

  return source.reduce<string[]>((lines, value) => {
    const note = String(value || '').trim();
    const key = note.toLocaleLowerCase('pt-BR');
    if (note && !seen.has(key)) {
      seen.add(key);
      lines.push(note);
    }
    return lines;
  }, []);
}

export interface OrderItemAdditionalLine {
  name: string;
  quantity: number;
  price: number;
}

/** Merge legacy observations and current additional items into one display/print list. */
export function getOrderItemAdditionalLines(item: {
  notes?: string;
  selectedNotes?: string[];
  otherNotes?: string;
  selectedComplements?: { name: string; price: number; quantity: number }[];
}): OrderItemAdditionalLine[] {
  const merged = new Map<string, OrderItemAdditionalLine>();

  for (const name of getOrderItemNoteLines(item)) {
    const key = name.toLocaleLowerCase('pt-BR');
    merged.set(key, { name, quantity: 1, price: 0 });
  }

  for (const additional of item.selectedComplements || []) {
    const name = String(additional.name || '').trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase('pt-BR');
    merged.set(key, {
      name,
      quantity: additional.quantity || 1,
      price: additional.price || 0,
    });
  }

  return [...merged.values()];
}

/** Format a numeric value for controlled BRL currency inputs. */
export function formatBRLInput(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Convert a masked BRL value such as "R$ 1.234,56" to a number. */
export function parseBRLInput(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) / 100 : 0;
}

/** Apply a BRL mask while the user types, treating the last two digits as cents. */
export function maskBRLInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 15);
  return digits ? formatBRLInput(Number(digits) / 100) : '';
}

/** Mask phone input to (00) 00000-0000 format */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
