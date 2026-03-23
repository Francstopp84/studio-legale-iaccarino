"use client";

import { LucideIcon } from "lucide-react";

interface PhaseHeaderProps {
  phase: number;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  progress?: number;
}

export default function PhaseHeader({ phase, title, description, icon: Icon, color, progress }: PhaseHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-4 mb-2">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: `${color}20` }}
        >
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color }}>
            Fase {phase}
          </p>
          <h1 className="text-2xl font-display font-bold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h1>
        </div>
      </div>
      <p className="text-sm ml-16" style={{ color: "var(--text-secondary)" }}>
        {description}
      </p>
      {progress !== undefined && (
        <div className="ml-16 mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}
