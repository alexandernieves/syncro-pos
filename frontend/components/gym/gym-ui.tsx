import { IconUser } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type MemberStatus, STATUS_CLASS, STATUS_LABEL } from "@/lib/gym";

/** Page shell for the gym views: same spacing as the rest of the dashboard. */
export function GymPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6", className)}>{children}</div>;
}

export function GymPageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {/* Arrows left/right move through these; Enter runs the selected one, or the last (main) one */}
      {actions && <div data-kbd-actions className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

/** Member or trainer photo with initials fallback, styled like the client avatars. */
export function MemberAvatar({ src, name, size = 36, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/15 bg-primary/10 font-bold text-primary", className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32) }}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials(name) || <IconUser size={size * 0.45} />}
    </span>
  );
}

/** Person cell for tables: avatar, name and a muted second line. */
export function PersonCell({ src, name, sub }: { src?: string | null; name: string; sub?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <MemberAvatar src={src} name={name} />
      <div className="min-w-0">
        <p className="truncate font-medium">{name}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: MemberStatus }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 whitespace-nowrap", STATUS_CLASS[status])}>
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** Pill filters used above the gym tables. */
export function FilterChips<T extends string>({ value, options, onChange, counts }: { value: T; options: [T, string][]; onChange: (v: T) => void; counts?: Partial<Record<T, number>> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([key, label]) => (
        <button
          key={key || "all"}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
            value === key ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
          {counts?.[key] !== undefined && <span className={cn("tabular-nums", value === key ? "opacity-80" : "opacity-60")}>{counts[key]}</span>}
        </button>
      ))}
    </div>
  );
}
