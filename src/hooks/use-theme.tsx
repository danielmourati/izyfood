import { useEffect, useCallback } from 'react';

// Modo escuro desativado: forçamos tema claro em todas as sessões.
export function useTheme() {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    try { localStorage.removeItem('theme'); } catch { /* noop */ }
  }, []);

  const toggleTheme = useCallback(() => { /* noop */ }, []);
  return { theme: 'light' as const, toggleTheme };
}
