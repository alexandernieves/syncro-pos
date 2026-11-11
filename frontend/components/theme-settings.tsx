"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { IconBuildingStore, IconCheck, IconChristmasTree, IconDeviceFloppy, IconLoader2, IconMapPin, IconPalette } from "@tabler/icons-react";
import { apiFetch } from "@/lib/api";
import { DEFAULT_THEME, adoptServerThemes, availableThemes, isOwnerRole, previewTheme, storedTheme, type SavedThemes, type SyncroTheme, type ThemeId } from "@/lib/themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A small drawing of Syncro in the theme's colours: menu, header, a card and a button. */
export function ThemePreview({ t }: { t: SyncroTheme }) {
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

/**
 * The theme cards with arrow-key navigation (Configuración → Temas and the POS theme dialog).
 * Picking one only calls `onPick`; saving is up to the screen.
 */
export function ThemePicker({ value, onPick, columns = 2 }: { value: ThemeId; onPick: (id: ThemeId) => void; columns?: 2 | 3 }) {
  const themes = availableThemes();
  // Free-choice themes first; the Christmas ones in their own group while the season lasts
  const groups = [
    { key: "all", title: "", note: "", items: themes.filter((t) => !t.seasonal) },
    { key: "season", title: "Temporada navideña", note: "Disponibles hasta el 6 de enero. Después, quien tenga uno puesto vuelve solo al tema Syncro.", items: themes.filter((t) => t.seasonal) },
  ].filter((g) => g.items.length);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrows move between themes and pick them, like any radio group
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + themes.length) % themes.length;
    onPick(themes[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Tema de colores" className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-3">
          {g.title && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold"><IconChristmasTree size={16} className="text-primary" /> {g.title}</h3>
              <p className="text-xs text-muted-foreground">{g.note}</p>
            </div>
          )}
          <div className={cn("grid gap-4 sm:grid-cols-2", columns === 3 && "lg:grid-cols-3")}>
            {g.items.map((t) => {
              const i = themes.indexOf(t);
              const active = value === t.id;
              return (
                <button
                  key={t.id}
                  ref={(el) => { refs.current[i] = el; }}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => onPick(t.id)}
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
                        {t.id === DEFAULT_THEME && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Por defecto</span>}
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
        </section>
      ))}
    </div>
  );
}

type Branch = { id: string; name: string; isMain?: boolean };
const EMPTY: SavedThemes = { business: null, branches: {}, pos: {} };

const who = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
    return { userId: u?.id as string | undefined, role: u?.role as string | undefined, branchId: localStorage.getItem("currentBranchId") };
  } catch {
    return { userId: undefined, role: undefined, branchId: null };
  }
};

/**
 * Configuración → Temas: the owner picks the colours for the whole business or for one branch
 * and presses "Guardar". It's saved on the server, so every user and computer of the business
 * (or of that branch) gets it, and it doesn't reset when someone signs out.
 */
export function ThemeSettings() {
  const [saved, setSaved] = useState<SavedThemes | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [scope, setScope] = useState<string>("business"); // "business" or a branch id
  const [draft, setDraft] = useState<ThemeId>(storedTheme().id);
  const [saving, setSaving] = useState(false);
  const [owner, setOwner] = useState(false);
  const [here, setHere] = useState<string | null>(null);

  useEffect(() => {
    const w = who();
    setOwner(isOwnerRole(w.role));
    setHere(w.branchId);
    void (async () => {
      try {
        const [s, b] = await Promise.all([apiFetch("/settings"), apiFetch("/branches")]);
        const settings = s.ok ? await s.json() : null;
        const list: Branch[] = b.ok ? await b.json() : [];
        const themes: SavedThemes = { ...EMPTY, ...(settings?.themes ?? {}) };
        setSaved(themes);
        setBranches(Array.isArray(list) ? list : []);
        // Opens on the branch in use if it has its own theme
        if (w.branchId && themes.branches?.[w.branchId]) setScope(w.branchId);
      } catch {
        setSaved({ ...EMPTY });
      }
    })();
    return () => previewTheme(null);
  }, []);

  /** What is saved for a place (a branch without its own theme follows the business). */
  const savedFor = useCallback((sc: string): ThemeId => {
    const s = saved ?? EMPTY;
    if (sc !== "business" && s.branches[sc]) return s.branches[sc];
    return s.business ?? storedTheme().id;
  }, [saved]);

  // Each place starts on what it has saved
  useEffect(() => {
    if (saved) setDraft(savedFor(scope));
  }, [saved, scope, savedFor]);

  /** Whether the place being edited is what this screen is showing right now */
  const showsHere = scope === "business" ? !(here && saved?.branches[here]) : scope === here;
  useEffect(() => {
    if (!saved) return;
    previewTheme(showsHere ? draft : null);
  }, [draft, showsHere, saved]);

  const dirty = !!saved && draft !== savedFor(scope);
  const branchOwn = scope !== "business" && !!saved?.branches[scope];
  const multi = branches.length > 1;

  const save = async (theme: ThemeId | null) => {
    if (!owner) return;
    setSaving(true);
    try {
      const body = scope === "business" ? { scope: "business", theme } : { scope: "branch", branchId: scope, theme };
      const res = await apiFetch("/settings/theme", { method: "PUT", body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "No se pudo guardar el tema");
      const themes: SavedThemes = { ...EMPTY, ...data };
      setSaved(themes);
      previewTheme(null);
      adoptServerThemes(themes, who());
      const where = scope === "business" ? "todo el negocio" : branches.find((b) => b.id === scope)?.name ?? "la sucursal";
      toast.success(theme ? `Tema guardado para ${where}` : `${where} vuelve a usar el tema del negocio`);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el tema");
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd + S saves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && dirty && owner && !saving) {
        e.preventDefault();
        void save(draft);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const places = [{ id: "business", name: "Todo el negocio" }, ...branches.map((b) => ({ id: b.id, name: b.name }))];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold"><IconPalette size={20} className="text-primary" /> Temas</h2>
        <p className="text-sm text-muted-foreground">
          Elige los colores de Syncro y presiona <b>Guardar</b>. Se guarda en tu negocio: lo ven todos tus usuarios en cualquier computadora y no se pierde al cerrar sesión.
        </p>
      </div>

      {!owner && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Solo el dueño puede cambiar el tema del negocio. En el punto de venta puedes elegir uno propio desde el botón de temas.</p>
      )}

      {multi && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">¿Dónde se aplica?</p>
          <div role="radiogroup" aria-label="Dónde se aplica el tema" className="flex flex-wrap gap-2">
            {places.map((p) => {
              const active = scope === p.id;
              const own = p.id !== "business" && saved?.branches[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setScope(p.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-muted",
                  )}
                >
                  {p.id === "business" ? <IconBuildingStore size={15} /> : <IconMapPin size={15} />}
                  {p.name}
                  {own && <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">propio</span>}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {scope === "business"
              ? "Para todas las sucursales que no tengan un tema propio."
              : branchOwn
                ? "Esta sucursal tiene su propio tema."
                : "Esta sucursal usa el tema del negocio. Elige uno y guarda para darle uno propio."}
            {!showsHere && " Tú tienes abierta otra sucursal: el cambio se verá allí."}
          </p>
        </div>
      )}

      <ThemePicker value={draft} onPick={setDraft} />

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t bg-background/95 px-1 py-3 backdrop-blur">
        <Button className="gap-2" onClick={() => void save(draft)} disabled={!owner || !dirty || saving || !saved}>
          {saving ? <IconLoader2 size={16} className="animate-spin" /> : <IconDeviceFloppy size={16} />} Guardar tema
        </Button>
        {branchOwn && owner && (
          <Button variant="ghost" onClick={() => void save(null)} disabled={saving}>Usar el tema del negocio</Button>
        )}
        <span className="text-xs text-muted-foreground">
          {dirty ? "Cambios sin guardar: si sales sin guardar, vuelve el tema anterior. (Ctrl + S)" : "Guardado"}
        </span>
      </div>
    </div>
  );
}
