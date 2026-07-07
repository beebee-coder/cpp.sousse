"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Intensité de l'inclinaison en degrés (max par axe). */
  intensity?: number;
  /** Affiche un reflet lumineux suivant le curseur. */
  glare?: boolean;
}

export function TiltCard({
  className,
  intensity = 9,
  glare = true,
  children,
  ...props
}: TiltCardProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = React.useState({ rx: 0, ry: 0, mx: 50, my: 50, active: false });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({
      ry: (px - 0.5) * 2 * intensity,
      rx: -(py - 0.5) * 2 * intensity,
      mx: px * 100,
      my: py * 100,
      active: true,
    });
  };

  const reset = () =>
    setTilt((t) => ({ ...t, rx: 0, ry: 0, active: false }));

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transition: tilt.active
          ? "transform 0.06s linear"
          : "transform 0.45s cubic-bezier(0.22,1,0.36,1)",
      }}
      className={cn("relative [transform-style:preserve-3d] will-change-transform", className)}
      {...props}
    >
      {children}
      {glare && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{
            opacity: tilt.active ? 1 : 0,
            background: `radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, rgba(255,255,255,0.22), transparent 45%)`,
          }}
        />
      )}
    </div>
  );
}
