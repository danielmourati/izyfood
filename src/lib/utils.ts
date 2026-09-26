import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format number to BRL string with comma as decimal separator */
export function fmt(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace('.', ',');
}

/** Format weight with comma */
export function fmtWeight(value: number): string {
  return value.toString().replace('.', ',');
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
