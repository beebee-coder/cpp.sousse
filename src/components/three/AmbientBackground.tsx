"use client";

/**
 * Fond ambiant global : aurore flottante + grille perspective 3D.
 * Positionné en fixed, derrière tout le contenu (z -10).
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-background" />
      <div
        className="ambient-blob animate-drift"
        style={{
          width: "42vw",
          height: "42vw",
          top: "-12%",
          left: "-6%",
          background:
            "radial-gradient(circle, hsl(var(--primary) / 0.45), transparent 70%)",
        }}
      />
      <div
        className="ambient-blob animate-drift"
        style={{
          width: "38vw",
          height: "38vw",
          bottom: "-14%",
          right: "-8%",
          background:
            "radial-gradient(circle, hsl(var(--secondary) / 0.4), transparent 70%)",
          animationDelay: "-6s",
        }}
      />
      <div
        className="ambient-blob animate-pulse-glow"
        style={{
          width: "30vw",
          height: "30vw",
          top: "28%",
          left: "42%",
          background:
            "radial-gradient(circle, hsl(220 80% 55% / 0.32), transparent 70%)",
        }}
      />
      <div className="ambient-grid" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,transparent_30%,hsl(var(--background))_88%)]" />
    </div>
  );
}
