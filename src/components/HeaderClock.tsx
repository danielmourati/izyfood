import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

/**
 * Compact live date/time badge for headers. Updates every second, pt-BR format.
 */
export function HeaderClock({ className = '' }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div
      className={`flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums ${className}`}
      title={`${date} ${time}`}
      aria-label="Data e hora atuais"
    >
      <Clock className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{date}</span>
      <span className="font-medium text-foreground">{time}</span>
    </div>
  );
}
