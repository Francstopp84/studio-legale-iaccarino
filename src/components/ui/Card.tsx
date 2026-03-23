"use client";

import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "highlighted" | "interactive";
  phaseColor?: string;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", phaseColor, children, className = "", style, ...props }, ref) => {
    const baseStyle: React.CSSProperties = {
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "16px",
      padding: "1.5rem",
      ...style,
    };

    if (variant === "highlighted" && phaseColor) {
      baseStyle.borderColor = phaseColor;
      baseStyle.boxShadow = `0 0 20px ${phaseColor}15`;
    }

    return (
      <div
        ref={ref}
        className={`card-texture transition-all ${variant === "interactive" ? "cursor-pointer hover:border-[var(--accent)] hover:shadow-[0_0_20px_var(--accent-glow)]" : ""} ${className}`}
        style={baseStyle}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
export default Card;
