"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconArrowDown, IconArrowBackUp, IconArrowUp, IconPencil, IconPhoto, IconPlus, IconScissors, IconSearch, IconSpeakerphone, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRequireSyncroAdmin } from "@/hooks/use-require-syncro-admin";
import { type AdminBusiness, adminApi } from "@/lib/syncro-admin";
import { AD_THEMES, type AdTheme, ScAdCard } from "@/components/portal/sc-ad-card";

/**
 * Syncro Central → Publicidad Syncro Credit. Products picked from each business's own catalog,
 * shown as minimal posts in the "Para ti" carousel of the clients' app. Each ad has its own
 * background; the order here is the order in the app.
 */
type Ad = {
  id: string;
  businessId: string;
  productId: string;
  headline: string | null;
  image: string | null;
  theme: AdTheme;
  active: boolean;
  sortOrder: number;
  endsAt: string | null;
  business: { id: string; name: string };
  product: { id: string; name: string; image: string | null; variants: { price: number; promoPrice: number | null }[] };
};
type Draft = { id?: string; businessId: string; product: Ad["product"] | null; theme: AdTheme; headline: string; endsAt: string; image: string | null };

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const toCard = (d: { theme: string; headline?: string | null; image?: string | null; product: Ad["product"] | null; businessName?: string }) => ({
  theme: d.theme,
  headline: d.headline || null,
  business: d.businessName ? { name: d.businessName } : null,
  product: { name: d.product?.name || "Elige un producto", image: d.image || d.product?.image || null, price: d.product?.variants?.[0]?.price ?? null, promoPrice: d.product?.variants?.[0]?.promoPrice ?? null },
});

export default function PublicidadPage() {
  useRequireSyncroAdmin();
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Ad["product"][]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Ad | null>(null);
  const [cutting, setCutting] = useState(false);

  // background removed from the product photo, for this ad only (the catalog photo stays as it is)
  const cutout = async () => {
    if (!draft?.product) return;
    setCutting(true);
    try {
      const { url } = await adminApi<{ url: string }>("/credit-ads/cutout", { method: "POST", ...json({ productId: draft.product.id }) });
      setDraft((d) => (d ? { ...d, image: url } : d));
      toast.success("Fondo quitado");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCutting(false);
    }
  };

  const load = useCallback(() => {
    adminApi<Ad[]>("/credit-ads").then(setAds).catch((e) => { toast.error(e.message); setAds([]); });
  }, []);
  useEffect(() => {
    load();
    adminApi<AdminBusiness[]>("/businesses").then(setBusinesses).catch(() => setBusinesses([]));
  }, [load]);

  // the catalog of the chosen business (only while creating)
  useEffect(() => {
    if (!draft || draft.id || !draft.businessId) { setProducts([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      adminApi<Ad["product"][]>(`/credit-ads/products?businessId=${encodeURIComponent(draft.businessId)}&q=${encodeURIComponent(q)}`)
        .then(setProducts)
        .catch((e) => toast.error(e.message))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [draft?.businessId, draft?.id, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const bizName = useMemo(() => new Map(businesses.map((b) => [b.id, b.name])), [businesses]);
  const themes = Object.keys(AD_THEMES) as AdTheme[];

  const openNew = () => {
    setQ("");
    setDraft({ businessId: "", product: null, theme: themes[(ads?.length ?? 0) % themes.length], headline: "", endsAt: "", image: null });
  };
  const openEdit = (ad: Ad) => {
    setDraft({ id: ad.id, businessId: ad.businessId, product: ad.product, theme: ad.theme, headline: ad.headline || "", endsAt: ad.endsAt ? ad.endsAt.slice(0, 10) : "", image: ad.image });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.id && (!draft.businessId || !draft.product)) return toast.error("Elige el comercio y el producto");
    setSaving(true);
    try {
      const body = { theme: draft.theme, headline: draft.headline, image: draft.image, endsAt: draft.endsAt ? new Date(`${draft.endsAt}T23:59:59`).toISOString() : null };
      if (draft.id) await adminApi(`/credit-ads/${draft.id}`, { method: "PUT", ...json(body) });
      else await adminApi("/credit-ads", { method: "POST", ...json({ ...body, businessId: draft.businessId, productId: draft.product!.id }) });
      toast.success(draft.id ? "Anuncio actualizado" : "Anuncio publicado en Syncro Credit");
      setDraft(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (ad: Ad, active: boolean) => {
    setAds((list) => list?.map((a) => (a.id === ad.id ? { ...a, active } : a)) ?? null);
    try { await adminApi(`/credit-ads/${ad.id}`, { method: "PUT", ...json({ active }) }); } catch (e: any) { toast.error(e.message); load(); }
  };
  const move = async (i: number, dir: -1 | 1) => {
    if (!ads) return;
    const a = ads[i], b = ads[i + dir];
    if (!b) return;
    const next = [...ads];
    next[i] = { ...b, sortOrder: a.sortOrder };
    next[i + dir] = { ...a, sortOrder: b.sortOrder };
    setAds(next);
    try {
      await adminApi(`/credit-ads/${a.id}`, { method: "PUT", ...json({ sortOrder: b.sortOrder === a.sortOrder ? b.sortOrder + dir : b.sortOrder }) });
      await adminApi(`/credit-ads/${b.id}`, { method: "PUT", ...json({ sortOrder: a.sortOrder }) });
      load();
    } catch (e: any) { toast.error(e.message); load(); }
  };
  const remove = async () => {
    if (!toDelete) return;
    try { await adminApi(`/credit-ads/${toDelete.id}`, { method: "DELETE" }); toast.success("Anuncio eliminado"); } catch (e: any) { toast.error(e.message); }
    setToDelete(null);
    load();
  };

  const expired = (ad: Ad) => !!ad.endsAt && new Date(ad.endsAt) < new Date();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><IconSpeakerphone className="text-primary" /> Publicidad Syncro Credit</h1>
          <p className="text-sm text-muted-foreground">Productos destacados que ven los clientes en “Para ti” de la app. Salen del catálogo de cada comercio; el orden de aquí es el de la app.</p>
        </div>
        <Button className="gap-2" onClick={openNew}><IconPlus size={16} /> Nuevo anuncio</Button>
      </div>

      {ads === null ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : !ads.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center">
          <IconSpeakerphone size={36} className="text-muted-foreground" />
          <p className="font-semibold">Todavía no hay anuncios</p>
          <p className="max-w-sm text-sm text-muted-foreground">Elige un producto de algún comercio y dale un fondo: aparecerá en el inicio de la app de sus clientes.</p>
          <Button className="mt-1 gap-2" onClick={openNew}><IconPlus size={16} /> Crear el primero</Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {ads.map((ad, i) => (
            <div key={ad.id} className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-3", (!ad.active || expired(ad)) && "opacity-60")}>
              <ScAdCard ad={toCard({ ...ad, businessName: ad.business.name })} className="!w-full" />
              <div className="flex items-center gap-2">
                <Switch checked={ad.active} onCheckedChange={(v) => setActive(ad, v)} aria-label="Activo" />
                <span className="text-sm font-medium">{expired(ad) ? "Terminó" : ad.active ? "Activo" : "Pausado"}</span>
                <span className="ml-auto flex gap-1">
                  <Button size="icon" variant="ghost" className="size-8" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><IconArrowUp size={16} /></Button>
                  <Button size="icon" variant="ghost" className="size-8" disabled={i === ads.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><IconArrowDown size={16} /></Button>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(ad)} aria-label="Editar"><IconPencil size={16} /></Button>
                  <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => setToDelete(ad)} aria-label="Eliminar"><IconTrash size={16} /></Button>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {ad.business.name}{ad.endsAt ? ` · hasta el ${new Date(ad.endsAt).toLocaleDateString("es-VE", { day: "numeric", month: "short" })}` : " · sin fecha de fin"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-4xl">
          {draft && (
            <>
              <DialogHeader>
                <DialogTitle>{draft.id ? "Editar anuncio" : "Nuevo anuncio"}</DialogTitle>
                <DialogDescription>Un producto del catálogo del comercio, presentado como un post: poco texto, el producto protagonista y su propio fondo.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 md:grid-cols-[1fr_300px]">
                <div className="flex min-w-0 flex-col gap-4">
                  {!draft.id && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Comercio</Label>
                        <Select value={draft.businessId} onValueChange={(v) => { setQ(""); setDraft({ ...draft, businessId: v, product: null }); }}>
                          <SelectTrigger><SelectValue placeholder="Elige un comercio" /></SelectTrigger>
                          <SelectContent>
                            {businesses.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {draft.businessId && (
                        <div className="space-y-1.5">
                          <Label>Producto</Label>
                          <div className="relative">
                            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el catálogo" className="pl-9" autoFocus />
                          </div>
                          <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                            {searching && !products.length ? <p className="col-span-full py-6 text-center text-sm text-muted-foreground">Buscando…</p> : null}
                            {!searching && !products.length ? <p className="col-span-full py-6 text-center text-sm text-muted-foreground">Sin productos</p> : null}
                            {products.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => setDraft({ ...draft, product: p, image: null })}
                                className={cn("flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition hover:bg-muted", draft.product?.id === p.id && "border-primary ring-2 ring-primary/20")}
                              >
                                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  {p.image ? <img src={p.image} alt="" className="size-full object-contain" /> : <IconPhoto size={16} className="text-muted-foreground" />}
                                </span>
                                <span className="min-w-0">
                                  <span className="line-clamp-2 font-medium">{p.name}</span>
                                  {p.variants?.[0] && <span className="text-muted-foreground">${p.variants[0].price.toFixed(2)}</span>}
                                </span>
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-muted-foreground">Los que tienen foto se ven mejor: salen primero.</p>
                        </div>
                      )}
                    </>
                  )}

                  <div className="space-y-1.5">
                    <Label>Fondo</Label>
                    <div className="flex flex-wrap gap-2">
                      {themes.map((t) => (
                        <button
                          key={t}
                          onClick={() => setDraft({ ...draft, theme: t })}
                          title={AD_THEMES[t].label}
                          aria-label={AD_THEMES[t].label}
                          className={cn("size-9 rounded-full border-2 transition", draft.theme === t ? "border-foreground scale-110" : "border-transparent")}
                          style={{ background: AD_THEMES[t].bg }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><Label>Frase corta (opcional)</Label><span className="text-[11px] text-muted-foreground">{draft.headline.length}/28</span></div>
                      <Input maxLength={28} value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} placeholder="Ej. Recién llegado" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Termina el (opcional)</Label>
                      <Input type="date" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <p className="self-start text-xs font-semibold text-muted-foreground">Así se ve en la app</p>
                  <div className="rounded-[28px] bg-[#F7F5F0] p-3">
                    <ScAdCard ad={toCard({ ...draft, businessName: bizName.get(draft.businessId) })} />
                  </div>
                  {draft.product?.image && (
                    draft.image ? (
                      <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setDraft({ ...draft, image: null })}>
                        <IconArrowBackUp size={16} /> Usar la foto original
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" className="w-full gap-2" disabled={cutting} onClick={cutout}>
                        <IconScissors size={16} /> {cutting ? "Quitando el fondo…" : "Quitar fondo"}
                      </Button>
                    )
                  )}
                  <p className="text-center text-[11px] text-muted-foreground">Funciona con fotos de fondo liso (blanco o de un color). La foto del catálogo del comercio no cambia.</p>
                  <div className="mt-auto flex w-full gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setDraft(null)}>Cancelar</Button>
                    <Button className="flex-1" disabled={saving || (!draft.id && !draft.product)} onClick={save}>{saving ? "Guardando…" : draft.id ? "Guardar" : "Publicar"}</Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este anuncio?</AlertDialogTitle>
            <AlertDialogDescription>{toDelete?.product.name} dejará de verse en Syncro Credit. Si solo quieres pausarlo, usa el interruptor.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={remove}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
