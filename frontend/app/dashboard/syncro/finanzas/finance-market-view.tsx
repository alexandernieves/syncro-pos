"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  ShoppingBasket,
  ShoppingCart,
  Store,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usd } from "@/lib/syncro-admin";
import { readableDate } from "./finance-calendar";
import { FinanceSelect } from "./finance-fields";
import { FinanceSheet } from "./finance-sheet";
import { walletAccounts, type MarketTrip } from "./calculations";

const money = (cents: number) => usd((cents || 0) / 100);
const walletLabels: Record<string, string> = { bank: "Banco", cash: "Efectivo", binance: "Binance" };

export function FinanceMarketView({
  asOf,
  groceryLimit,
  foodSpentCents,
  trips,
  busy,
  mobile,
  onSaveTrips,
  onCloseTripAsExpense,
}: {
  asOf: string;
  groceryLimit: number;
  foodSpentCents: number;
  trips: MarketTrip[];
  busy: boolean;
  mobile: boolean;
  onSaveTrips: (next: MarketTrip[]) => Promise<void> | void;
  onCloseTripAsExpense: (payload: { trip: MarketTrip; wallet: string }) => Promise<void> | void;
}) {
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [storeName, setStoreName] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);

  const openTrip = trips.find(t => t.status === "open");
  const closedTrips = trips.filter(t => t.status === "closed").slice(0, 10);
  const cartTotal = openTrip?.totalCents ?? 0;
  const projectedFoodTotal = foodSpentCents + cartTotal;
  const remaining = groceryLimit > 0 ? Math.max(0, groceryLimit - projectedFoodTotal) : 0;
  const exceeded = groceryLimit > 0 && projectedFoodTotal > groceryLimit;
  const progressPct = groceryLimit > 0 ? Math.min(100, Math.round((projectedFoodTotal / groceryLimit) * 100)) : 0;

  async function handleAddItem(event: FormEvent) {
    event.preventDefault();
    const name = itemName.trim();
    const priceCents = Math.round(Number(itemPrice) * 100);
    const qty = Math.max(1, Math.min(999, Math.round(Number(itemQty) || 1)));
    if (!name || !Number.isFinite(priceCents) || priceCents <= 0) return;

    const newItem = { id: crypto.randomUUID().slice(0, 12), name, cents: priceCents, qty };
    let nextTrips: MarketTrip[];
    if (openTrip) {
      const updatedItems = [newItem, ...openTrip.items];
      const totalCents = updatedItems.reduce((sum, item) => sum + item.cents * (item.qty ?? 1), 0);
      nextTrips = trips.map(t =>
        t.id === openTrip.id
          ? { ...t, store: storeName.trim() || t.store || null, items: updatedItems, totalCents }
          : t,
      );
    } else {
      const created: MarketTrip = {
        id: crypto.randomUUID().slice(0, 16),
        date: asOf,
        store: storeName.trim() || null,
        status: "open",
        items: [newItem],
        totalCents: priceCents * qty,
      };
      nextTrips = [created, ...trips];
    }

    await onSaveTrips(nextTrips);
    setItemName("");
    setItemPrice("");
    setItemQty("1");
  }

  async function handleRemoveItem(itemId: string) {
    if (!openTrip) return;
    const updatedItems = openTrip.items.filter(item => item.id !== itemId);
    const totalCents = updatedItems.reduce((sum, item) => sum + item.cents * (item.qty ?? 1), 0);
    const nextTrips = updatedItems.length
      ? trips.map(t => (t.id === openTrip.id ? { ...t, items: updatedItems, totalCents } : t))
      : trips.filter(t => t.id !== openTrip.id);
    await onSaveTrips(nextTrips);
  }

  async function handleCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!openTrip) return;
    const wallet = String(new FormData(event.currentTarget).get("wallet") ?? "bank");
    await onCloseTripAsExpense({ trip: openTrip, wallet });
    setCloseOpen(false);
  }

  return (
    <div className="space-y-4">
      {/* Hero Supermarket Live Budget Card */}
      <section className="finance-bank-card relative overflow-hidden rounded-[28px] p-5 text-white shadow-[0_20px_44px_-18px_rgba(20,16,12,0.55)]">
        <div aria-hidden className="finance-grid-bg pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                <ShoppingCart className="size-3.5 text-[#F6A27F]" /> Carrito de mercado en vivo
              </p>
              <p className="mt-1 text-[clamp(30px,8vw,40px)] font-bold leading-none tracking-[-0.04em] tabular-nums">
                {money(cartTotal)}
              </p>
              <p className="mt-1 text-xs text-white/65">
                {openTrip ? `${openTrip.items.length} productos en el carrito hoy` : "Agrega productos aquí o díctaselos a Nubi por WhatsApp"}
              </p>
            </div>
            {openTrip && openTrip.totalCents > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={() => setCloseOpen(true)}
                className="h-10 rounded-full bg-emerald-500 px-4 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600"
              >
                <CheckCircle2 className="size-4" /> Cerrar compra
              </Button>
            )}
          </div>

          {/* Monthly Mercado Cap Progress */}
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70">Tope mensual de mercado</span>
              <span className="font-bold tabular-nums">
                {groceryLimit > 0 ? `${money(projectedFoodTotal)} / ${money(groceryLimit)}` : "Sin tope definido"}
              </span>
            </div>
            {groceryLimit > 0 && (
              <>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/15">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ type: "spring", stiffness: 220, damping: 28 }}
                    className={`h-full rounded-full ${exceeded ? "bg-rose-500" : progressPct >= 80 ? "bg-amber-400" : "bg-emerald-400"}`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className={exceeded ? "flex items-center gap-1 font-semibold text-rose-300" : "text-emerald-300 font-medium"}>
                    {exceeded ? (
                      <>
                        <AlertTriangle className="size-3" /> Excedido por {money(projectedFoodTotal - groceryLimit)}
                      </>
                    ) : (
                      `Te quedan ${money(remaining)} para no pasarte`
                    )}
                  </span>
                  <span className="text-white/55 tabular-nums">Ya pagado: {money(foodSpentCents)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Quick Add Product Form */}
      <section className="finance-grid-light space-y-3 rounded-[24px] border bg-card p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Agregar producto al carrito</h2>
          <span className="text-[11px] text-muted-foreground">También puedes dictárselo a Nubi</span>
        </div>
        <form onSubmit={handleAddItem} className="grid gap-2.5 sm:grid-cols-12">
          <Input
            className="h-11 rounded-2xl sm:col-span-5"
            placeholder="Ej. Pechuga de pollo"
            value={itemName}
            onChange={e => setItemName(e.target.value)}
            maxLength={120}
            required
          />
          <Input
            className="h-11 rounded-2xl tabular-nums sm:col-span-3"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="Precio USD"
            value={itemPrice}
            onChange={e => setItemPrice(e.target.value)}
            required
          />
          <Input
            className="h-11 rounded-2xl tabular-nums sm:col-span-2"
            type="number"
            inputMode="numeric"
            min="1"
            max="999"
            placeholder="Cant."
            value={itemQty}
            onChange={e => setItemQty(e.target.value)}
          />
          <Button type="submit" disabled={busy} className="h-11 rounded-2xl font-semibold sm:col-span-2">
            <Plus className="size-4" /> Sumar
          </Button>
        </form>
        {!openTrip?.store && (
          <div className="flex items-center gap-2">
            <Store className="size-4 text-muted-foreground" />
            <Input
              className="h-9 rounded-xl text-xs"
              placeholder="Supermercado (opcional, ej. Excelsior Gama)"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              maxLength={80}
            />
          </div>
        )}
      </section>

      {/* Open Cart Items */}
      {openTrip && openTrip.items.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              En el carrito {openTrip.store ? `· ${openTrip.store}` : ""}
            </h3>
            <span className="text-xs font-bold tabular-nums">{money(openTrip.totalCents)}</span>
          </div>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-[22px] border bg-card shadow-xs">
            {openTrip.items.map(item => (
              <li key={item.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                    <ShoppingBasket className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {(item.qty ?? 1) > 1 ? `${item.qty} × ${money(item.cents)}` : "1 unidad"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <strong className="text-sm font-bold tabular-nums">{money(item.cents * (item.qty ?? 1))}</strong>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 rounded-full text-muted-foreground hover:text-destructive"
                    onClick={() => void handleRemoveItem(item.id)}
                    aria-label={`Quitar ${item.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recent Closed Trips */}
      {closedTrips.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Compras anteriores registradas
          </h3>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-[22px] border bg-card shadow-xs">
            {closedTrips.map(trip => (
              <li key={trip.id} className="flex items-center justify-between gap-3 p-3.5">
                <div>
                  <p className="text-sm font-semibold">{trip.store || "Compra de mercado"}</p>
                  <p className="text-xs text-muted-foreground">
                    {readableDate(trip.date)} · {trip.items.length} {trip.items.length === 1 ? "producto" : "productos"}
                  </p>
                </div>
                <strong className="text-sm font-bold tabular-nums">{money(trip.totalCents)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Checkout Sheet */}
      <FinanceSheet
        open={closeOpen}
        onOpenChange={open => { if (!busy) setCloseOpen(open); }}
        mobile={mobile}
        title="Cerrar compra de mercado"
        description={`Se registrará un gasto de Mercado por ${money(cartTotal)} y se archivará este carrito.`}
      >
        <fieldset disabled={busy} className="min-w-0">
          <form className="grid gap-3.5" onSubmit={handleCheckout}>
            <FinanceSelect
              label="Pagado desde"
              name="wallet"
              defaultValue="bank"
              options={walletAccounts.map(key => [key, walletLabels[key]])}
            />
            <Button type="submit" className="h-12 rounded-full text-base font-semibold">
              Confirmar y registrar {money(cartTotal)}
            </Button>
          </form>
        </fieldset>
      </FinanceSheet>
    </div>
  );
}
