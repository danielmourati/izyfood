export const QUERY_PAGE_SIZE = 500;

/** Publish only complete results; an interrupted page must never become a total. */
export async function collectPages<T>(read: (offset: number, size: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = QUERY_PAGE_SIZE): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += size) {
    const { data, error } = await read(offset, size);
    if (error) throw error;
    if (!data) throw new Error('Consulta incompleta. Tente novamente.');
    rows.push(...data);
    if (data.length < size) return rows;
  }
}

export function brazilDayBounds(day: string): { from: string; to: string } {
  return { from: new Date(`${day}T00:00:00-03:00`).toISOString(), to: new Date(`${day}T23:59:59.999-03:00`).toISOString() };
}

export function brazilToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}