import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  /** First footer line (bold) */
  title?: React.ReactNode;
  /** Second footer line (muted) */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /** Colors the value and the footer title */
  tone?: "default" | "primary" | "good" | "warn" | "bad";
  onClick?: () => void;
  className?: string;
};

const TONE: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "",
  primary: "text-primary",
  good: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-rose-600",
};

/** KPI card with the dashboard look: gradient, big number and a two-line footer. */
export function StatCard({ label, value, title, hint, icon, tone = "default", onClick, className }: StatCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn("@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs", onClick && "cursor-pointer transition-colors hover:border-primary/40", className)}
    >
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn("text-2xl font-semibold tabular-nums @[250px]/card:text-3xl", TONE[tone])}>{value}</CardTitle>
        {icon && <CardAction className={cn("text-muted-foreground/60", tone !== "default" && TONE[tone])}>{icon}</CardAction>}
      </CardHeader>
      {(title || hint) && (
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {title && <div className={cn("line-clamp-1 flex gap-2 font-medium", TONE[tone])}>{title}</div>}
          {hint && <div className="text-muted-foreground">{hint}</div>}
        </CardFooter>
      )}
    </Card>
  );
}

/** Grid for StatCards, same spacing as the dashboard. */
export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 }) {
  return <div className={cn("grid grid-cols-1 gap-4 @xl/main:grid-cols-2", cols === 4 ? "@5xl/main:grid-cols-4" : "@5xl/main:grid-cols-3")}>{children}</div>;
}
