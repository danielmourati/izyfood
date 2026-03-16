import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { useEffect, useState } from "react";

const TOAST_DURATION = 4000;

function ToastProgressBar({ toastId }: { toastId: string }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / TOAST_DURATION) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [toastId]);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/30">
      <div
        className="h-full bg-primary transition-none"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={TOAST_DURATION}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
            <ToastProgressBar toastId={id} />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
