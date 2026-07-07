"use client";

import { cn } from "@/lib/utils";

interface TimerRingProps {
  elapsed: number;
  total: number;
  display?: string;
  state?: "normal" | "warning" | "danger";
  size?: number;
}

/**
 * Chronomètre circulaire animé (SVG) — affichage du temps écoulé/restant
 * avec anneau de progression, couleur selon l'état et halo lumineux.
 */
export function TimerRing({
  elapsed,
  total,
  display,
  state = "normal",
  size = 72,
}: TimerRingProps) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(Math.max(elapsed / total, 0), 1) : 0;
  const offset = circumference * (1 - pct);

  const palette =
    state === "danger"
      ? { stroke: "hsl(var(--destructive))", text: "text-destructive", glow: "rgba(239,68,68,0.55)" }
      : state === "warning"
      ? { stroke: "rgb(249,115,22)", text: "text-orange-500", glow: "rgba(249,115,22,0.5)" }
      : { stroke: "hsl(var(--primary))", text: "text-primary", glow: "rgba(50,181,212,0.45)" };

  const remaining = Math.max(total - elapsed, 0);
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const remainingStr = `${mm}:${ss.toString().padStart(2, "0")}`;

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      role="timer"
      aria-live="off"
    >
      <span
        className={cn(
          "absolute inset-0 rounded-full",
          state !== "normal" && "animate-pulse-ring"
        )}
        style={{ boxShadow: state === "normal" ? "none" : `0 0 0 0 ${palette.glow}` }}
      />
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
          opacity={0.6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={palette.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1s linear, stroke 0.4s ease",
            filter: `drop-shadow(0 0 6px ${palette.glow})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-code font-bold leading-none", palette.text)} style={{ fontSize: size * 0.22 }}>
          {remainingStr}
        </span>
        {display && (
          <span className="font-code text-[8px] text-muted-foreground uppercase mt-0.5">
            / {display}
          </span>
        )}
      </div>
    </div>
  );
}
