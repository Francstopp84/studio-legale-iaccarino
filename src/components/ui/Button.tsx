"use client";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, children, disabled, className = "", style, ...props }, ref) => {
    const sizes = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-4 py-2.5 text-sm",
      lg: "px-6 py-4 text-lg",
    };

    const variants = {
      primary: {
        background: "linear-gradient(135deg, var(--accent), #b8912e)",
        color: "#1a1814",
        border: "none",
      },
      secondary: {
        background: "transparent",
        color: "var(--accent)",
        border: "1px solid var(--accent)",
      },
      danger: {
        background: "rgba(196, 92, 74, 0.15)",
        color: "var(--danger)",
        border: "1px solid var(--danger)",
      },
      ghost: {
        background: "transparent",
        color: "var(--text-secondary)",
        border: "none",
      },
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${sizes[size]} rounded-xl font-semibold inline-flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${className}`}
        style={{ ...variants[variant], ...style }}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
