import React from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  variant?: 'cards' | 'compact' | 'dropdown';
  className?: string;
}

export function ThemeToggle({ variant = 'cards', className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/50", className)}>
        <Button
          type="button"
          variant={theme === 'light' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-xs gap-1.5"
          onClick={() => setTheme('light')}
          title="Modo Claro (Padrão Degust)"
        >
          <Sun className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Claro</span>
        </Button>

        <Button
          type="button"
          variant={theme === 'dark' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-xs gap-1.5"
          onClick={() => setTheme('dark')}
          title="Modo Escuro"
        >
          <Moon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Escuro</span>
        </Button>

        <Button
          type="button"
          variant={theme === 'system' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-xs gap-1.5"
          onClick={() => setTheme('system')}
          title="Seguir o Sistema"
        >
          <Laptop className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Auto</span>
        </Button>
      </div>
    );
  }

  // Default: variant === 'cards'
  const options = [
    {
      id: 'light',
      title: 'Modo Claro',
      subtitle: 'Paleta padrão Degust',
      icon: Sun,
      previewBg: 'bg-[#faf8f5] border-[#e8ded2]',
      previewHeader: 'bg-[#e23624]',
      previewCard: 'bg-white border-[#e8ded2]',
      previewText: 'bg-[#3b201a]',
    },
    {
      id: 'dark',
      title: 'Modo Escuro',
      subtitle: 'Visual noturno elegante',
      icon: Moon,
      previewBg: 'bg-[#181110] border-[#2e201c]',
      previewHeader: 'bg-[#e64030]',
      previewCard: 'bg-[#241a18] border-[#382622]',
      previewText: 'bg-[#f5ebd9]',
    },
    {
      id: 'system',
      title: 'Sistema',
      subtitle: 'Sincroniza com a SO',
      icon: Laptop,
      previewBg: 'bg-gradient-to-r from-[#faf8f5] to-[#181110] border-border',
      previewHeader: 'bg-primary',
      previewCard: 'bg-card border-border',
      previewText: 'bg-foreground',
    },
  ] as const;

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3", className)}>
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = theme === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setTheme(option.id)}
            className={cn(
              "relative flex flex-col items-start p-3.5 rounded-xl border-2 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border/60 hover:border-border hover:bg-muted/30"
            )}
          >
            {/* Visual Mini Preview */}
            <div className={cn("w-full h-16 rounded-lg p-2 flex flex-col gap-1.5 mb-3 border overflow-hidden", option.previewBg)}>
              <div className={cn("w-full h-2 rounded-full opacity-80", option.previewHeader)} />
              <div className="flex gap-1.5 flex-1">
                <div className={cn("w-1/3 rounded p-1 flex flex-col gap-1 border", option.previewCard)}>
                  <div className={cn("w-3/4 h-1.5 rounded-full opacity-60", option.previewText)} />
                  <div className={cn("w-1/2 h-1 rounded-full opacity-40", option.previewText)} />
                </div>
                <div className={cn("flex-1 rounded p-1 flex flex-col gap-1 border", option.previewCard)}>
                  <div className={cn("w-1/2 h-1.5 rounded-full opacity-70", option.previewText)} />
                  <div className={cn("w-5/6 h-1 rounded-full opacity-30", option.previewText)} />
                </div>
              </div>
            </div>

            {/* Label and Badge */}
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-md", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-none mb-1">{option.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{option.subtitle}</p>
                </div>
              </div>

              {isSelected && (
                <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 stroke-[3]" />
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
