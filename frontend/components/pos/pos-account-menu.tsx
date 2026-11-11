"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { IconCash, IconChevronDown, IconDeviceFloppy, IconLoader2, IconLogout, IconPalette } from "@tabler/icons-react";
import { apiFetch } from "@/lib/api";
import { signOutAndReload } from "@/lib/auth-helpers";
import { previewTheme, rememberTheme, storedPosTheme, storedTheme, type ThemeId } from "@/lib/themes";
import { ThemePicker } from "@/components/theme-settings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * POS header for staff who aren't the owner: a theme button (their own colours, only for the
 * POS) and one menu with "Cerrar turno" and "Cerrar sesión".
 */
export function PosAccountMenu({ onCloseShift, shiftOpen }: { onCloseShift: () => void; shiftOpen: boolean }) {
  const [themesOpen, setThemesOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const signOut = async () => {
    setLeaving(true);
    toast.info("Sesión cerrada");
    await signOutAndReload("/login");
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-lg border-[#DAD5CC] bg-[#FAF7F2] text-[#16140F] shadow-xs hover:bg-[#F5F1E8]"
        onClick={() => setThemesOpen(true)}
        aria-label="Tema del punto de venta"
        title="Tema del punto de venta"
      >
        <IconPalette size={16} className="text-primary" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 h-9 gap-1.5 rounded-lg border border-rose-200/80 bg-rose-50 px-3 text-xs font-bold text-rose-700 shadow-xs transition-all hover:bg-rose-100"
          >
            <IconCash size={15} />
            <span>Turno</span>
            <IconChevronDown size={13} strokeWidth={2.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
          <DropdownMenuItem onSelect={onCloseShift} className="cursor-pointer gap-2 rounded-lg py-2 text-xs font-bold">
            <IconCash size={15} /> Cerrar turno
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirmOut(true)} className="cursor-pointer gap-2 rounded-lg py-2 text-xs font-bold text-destructive focus:text-destructive">
            <IconLogout size={15} /> Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOut} onOpenChange={(o) => !leaving && setConfirmOut(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              {shiftOpen
                ? "Tu turno sigue abierto: no se cierra la caja. Cuando vuelvas a entrar continúas donde lo dejaste, o puedes cerrar el turno primero."
                : "Saldrás del punto de venta y volverás a la pantalla de inicio de sesión."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void signOut();
              }}
              disabled={leaving}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {leaving ? <IconLoader2 size={16} className="animate-spin" /> : <IconLogout size={16} />} Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PosThemeDialog open={themesOpen} onOpenChange={setThemesOpen} />
    </>
  );
}

/** The cashier's own POS theme: saved for them on the server, the rest of Syncro keeps the business's. */
function PosThemeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [draft, setDraft] = useState<ThemeId>(storedTheme().id);
  const [saving, setSaving] = useState(false);
  const own = typeof window !== "undefined" ? storedPosTheme() : null;
  const current = (own ?? storedTheme()).id;

  useEffect(() => {
    if (open) setDraft((storedPosTheme() ?? storedTheme()).id);
    else previewTheme(null);
  }, [open]);

  useEffect(() => {
    if (open) previewTheme(draft);
  }, [draft, open]);

  const save = async (theme: ThemeId | null) => {
    setSaving(true);
    try {
      const res = await apiFetch("/settings/theme", { method: "PUT", body: JSON.stringify({ scope: "pos", theme }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "No se pudo guardar el tema");
      previewTheme(null);
      rememberTheme("pos", theme);
      toast.success(theme ? "Tema guardado para tu punto de venta" : "Vuelves a usar el tema del negocio");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el tema");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><IconPalette size={20} className="text-primary" /> Tema del punto de venta</DialogTitle>
          <DialogDescription>Solo cambia los colores de tu punto de venta. Se guarda en tu usuario, así que lo verás en cualquier computadora.</DialogDescription>
        </DialogHeader>
        <ThemePicker value={draft} onPick={setDraft} columns={3} />
        <DialogFooter className="gap-2 sm:justify-between">
          {own ? (
            <Button variant="ghost" onClick={() => void save(null)} disabled={saving}>Usar el tema del negocio</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button className="gap-2" onClick={() => void save(draft)} disabled={saving || draft === current}>
              {saving ? <IconLoader2 size={16} className="animate-spin" /> : <IconDeviceFloppy size={16} />} Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
