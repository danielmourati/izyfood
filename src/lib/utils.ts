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

/** Mask phone input to (00) 00000-0000 format */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
