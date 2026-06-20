
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'busy' | 'alert';
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const statusColors = {
    online: "bg-secondary shadow-[0_0_8px_rgba(46,184,146,0.5)]",
    offline: "bg-muted",
    busy: "bg-primary animate-pulse-fast shadow-[0_0_8px_rgba(50,181,212,0.5)]",
    alert: "bg-destructive animate-bounce",
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-background/50 border border-border rounded-sm">
      <span className={cn("w-2 h-2 rounded-full", statusColors[status])} />
      <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}
