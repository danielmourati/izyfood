import { useTheme as useNextTheme } from 'next-themes';

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();

  const currentTheme = (theme || 'light') as 'light' | 'dark' | 'system';
  const isDark = resolvedTheme === 'dark';

  const toggleTheme = () => {
    if (resolvedTheme === 'dark') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  };

  return {
    theme: currentTheme,
    setTheme: (newTheme: 'light' | 'dark' | 'system') => setTheme(newTheme),
    isDark,
    resolvedTheme: (resolvedTheme || 'light') as 'light' | 'dark',
    toggleTheme,
  };
}
