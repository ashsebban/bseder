import * as React from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "md" | "sm";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white shadow-soft hover:bg-brand-strong focus-visible:ring-brand/40",
  secondary:
    "bg-surface text-text border border-line hover:border-brand/30 hover:bg-brand-soft/60 focus-visible:ring-brand/20",
  ghost:
    "bg-transparent text-text-muted hover:bg-brand-soft/50 hover:text-text focus-visible:ring-brand/20",
  destructive:
    "border border-destructive-line bg-destructive-soft text-destructive hover:bg-destructive-soft/80 hover:text-destructive-strong focus-visible:ring-destructive/25",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "h-12 px-5 text-base",
  sm: "h-10 px-4 text-sm",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-2xl font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
