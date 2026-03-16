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
