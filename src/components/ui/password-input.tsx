import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  /** Classes for the wrapper that holds the field and the eye button. */
  containerClassName?: string;
  /** Classes for the eye button itself. */
  toggleClassName?: string;
  /** Controlled visibility; leave undefined so the field remembers its own state. */
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
};

/**
 * Password field with an "olhinho" that reveals the typed text.
 * Visibility is per field and never leaks into the value sent to the server.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      containerClassName,
      toggleClassName,
      visible,
      onVisibleChange,
      ...props
    },
    ref,
  ) => {
    const [internalVisible, setInternalVisible] = React.useState(false);
    const isControlled = visible !== undefined;
    const show = isControlled ? !!visible : internalVisible;

    const handleToggle = () => {
      const next = !show;
      if (!isControlled) setInternalVisible(next);
      onVisibleChange?.(next);
    };

    return (
      <div className={cn("relative", containerClassName)}>
        <Input
          ref={ref}
          type={show ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={handleToggle}
          aria-label={show ? "Esconder senha" : "Mostrar senha"}
          aria-pressed={show}
          className={cn(
            "absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            toggleClassName,
          )}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
