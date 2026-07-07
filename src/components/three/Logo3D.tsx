import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

/** Cube 3D en rotation — emblème de marque "VisioNode". */
export function Logo3D({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const faces = ["front", "back", "right", "left", "top", "bottom"] as const;
  return (
    <div
      className={cn("logo3d shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div
        className="logo3d-inner"
        style={{ "--s": `${size / 2}px` } as CSSProperties}
      >
        {faces.map((f) => (
          <span key={f} className={`logo3d-face logo3d-${f}`} />
        ))}
      </div>
    </div>
  );
}
