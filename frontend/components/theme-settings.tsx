"use client";

import { useRef } from "react";
import { IconCheck, IconPalette } from "@tabler/icons-react";
import { availableThemes, type SyncroTheme } from "@/lib/themes";
import { useSyncroTheme } from "@/components/theme-sync";
import { cn } from "@/lib/utils";

/** A small drawing of Syncro in the theme's colours: menu, header, a card and a button. */
function ThemePreview({ t }: { t: SyncroTheme }) {
  const p = t.preview;
  return (
    <div className="flex h-28 overflow-hidden rounded-lg border" style={{ background: p.shell, borderColor: `color-mix(in oklab, ${p.text} 12%, transparent)` }} aria-hidden>
      {/* Menu */}
      <div className="flex w-[30%] flex-col gap-1.5 p-2.5">
        <div className="mb-1 flex items-center gap-1">
          <span className="size-2.5 rounded-[3px]" style={{ background: p.text }} />
          <span className="h-1.5 w-8 rounded-full" style={{ background: p.text, opacity: 0.7 }} />
        </div>
        <span className="h-1.5 w-10 rounded-full" style={{ background: p.primary }} />
        {[9, 7, 10, 6].map((w, i) => (
          <span key={i} className="h-1.5 rounded-full" style={{ width: `${w * 4}px`, background: p.muted, opacity: 0.55 }} />
        ))}
      </div>
      {/* View */}
      <div className="my-1.5 mr-1.5 flex flex-1 flex-col gap-1.5 rounded-md p-2" style={{ background: p.background }}>
        <div className="flex gap-1.5">
          {[0, 1].map((i) => (
            <div key={i} className="flex-1 rounded p-1.5" style={{ background: p.card, boxShadow: `0 0 0 1px color-mix(in oklab, ${p.text} 8%, transparent)` }}>
              <span className="block h-1 w-6 rounded-full" style={{ background: p.muted, opacity: 0.6 }} />
              <span className="mt-1 block h-2 w-9 rounded-full" style={{ background: p.text }} />
            </div>
          ))}
        </div>
        <div className="flex flex-1 items-end rounded p-1.5" style={{ background: p.card, boxShadow: `0 0 0 1px color-mix(in oklab, ${p.text} 8%, transparent)` }}>
          <span className="h-3 w-12 rounded" style={{ background: p.primary }} />
        </div>
      </div>
    </div>
  );
}

/** Configuración → Temas: the colours of Syncro on this computer. */
export function ThemeSettings() {
  const { theme, setTheme } = useSyncroTheme();
  const themes = availableThemes();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrows move between themes and pick them, like any radio group
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + themes.length) % themes.length;
    setTheme(themes[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold"><IconPalette size={20} className="text-primary" /> Temas</h2>
        <p className="text-sm text-muted-foreground">Elige los colores de Syncro en esta computadora. El cambio se ve al instante y no afecta a las demás.</p>
      </div>

      <div role="radiogroup" aria-label="Tema de colores" className="grid gap-4 sm:grid-cols-2">
        {themes.map((t, i) => {
          const active = theme.id === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setTheme(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "group flex flex-col gap-3 rounded-xl border bg-card p-3 text-left transition-all outline-none",
                "hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary ring-1 ring-primary" : "border-border",
              )}
            >
              <ThemePreview t={t} />
              <div className="flex items-start gap-2 px-0.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {t.name}
                    {t.id === "syncro" && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Por defecto</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                </div>
                <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                  {active && <IconCheck size={12} stroke={3} />}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
