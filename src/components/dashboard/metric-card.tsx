import type { LucideIcon } from "lucide-react";

export function MetricCard({ label, value, detail, icon: Icon, progress }: { label: string; value: string; detail?: string; icon: LucideIcon; progress?: number }) {
  return <div className="glass-surface rounded-[28px] p-5"><div className="flex items-center justify-between"><p className="text-sm text-piano/50">{label}</p><span className="grid h-9 w-9 place-items-center rounded-full bg-piano/[0.06] text-piano/60"><Icon size={17} /></span></div><p className="mt-5 text-3xl font-semibold tracking-[-0.02em] text-piano">{value}</p>{detail ? <p className="mt-2 text-xs text-piano/45">{detail}</p> : null}{typeof progress === "number" ? <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-piano/[0.06]"><div className="h-full rounded-full bg-gold transition-[width] duration-700" style={{ width: `${progress}%` }} /></div> : null}</div>;
}
