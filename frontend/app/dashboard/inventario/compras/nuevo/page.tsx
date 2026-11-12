"use client";

import * as React from "react";
import { API_URL } from "@/lib/constants"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconDotsVertical,
  IconGripVertical,
  IconLayoutColumns,
  IconPlus,
  IconSearch,
  IconTrash,
  IconTruck,
  IconPackage,
  IconInfoCircle,
  IconFileText,
  IconCheck,
  IconArrowLeft,
  IconBuildingStore,
} from "@tabler/icons-react";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PURCHASE_UNITS, UNIT_SINGULAR, fmtQty, unitInfo } from "@/lib/purchase-units";
import { z } from "zod";

import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

const API = API_URL;

// --- Types & Schema ---

const orderItemSchema = z.object({
  variantId: z.string(),
  productName: z.string(),
  variantName: z.string(),
  quantity: z.number(),
  /** Ordered in this unit (cajas, bultos…) */
  unit: z.string(),
  /** Stock units in one ordered unit */
  unitFactor: z.number(),
  /** Cost of one stock unit (the line cost is this × unitFactor unless typed) */
  baseCost: z.number(),
  /** Units wanted while the units per box are still unknown */
  wantedUnits: z.number().optional(),
  cost: z.number(),
  taxRate: z.number(),
  id: z.string(), // Needed for DND (same as variantId)
});

type OrderItem = z.infer<typeof orderItemSchema>;

// --- Components ---

function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({ id });
  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
    >
      <IconGripVertical className="size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  );
}

function DraggableRow({ row }: { row: Row<OrderItem> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.variantId,
  });

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80 border-b hover:bg-muted/40 transition-colors group"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} className="py-2.5">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  
  const [selectedSupplierId, setSelectedSupplierId] = React.useState("");
  const [selectedBranchId, setSelectedBranchId] = React.useState("");
  /** Last unit used for each product ("cajas de 24" comes back by itself) */
  const [unitMemory, setUnitMemory] = React.useState<Record<string, { unit: string; unitFactor: number; cost: number }>>({});
  const prefilled = React.useRef(false);
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<OrderItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  
  // Catalog (large window)
  const [searchQuery, setSearchQuery] = React.useState("");
  const [catalogOpen, setCatalogOpen] = React.useState(false);
  const [activeCard, setActiveCard] = React.useState(0);
  const catalogRef = React.useRef<HTMLDivElement>(null);

  // Table State
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });

  const sortableId = React.useId();
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor)
  );

  React.useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { 'Authorization': `Bearer ${token}` };
      const [suppRes, branchRes, prodRes, memRes] = await Promise.all([
        fetch(`${API}/suppliers`, { headers }),
        fetch(`${API}/branches`, { headers }),
        fetch(`${API}/products`, { headers }),
        fetch(`${API}/purchase-orders/unit-memory`, { headers }),
      ]);
      if (suppRes.ok) setSuppliers(await suppRes.json());
      if (branchRes.ok) {
        const list = await branchRes.json();
        setBranches(list);
        // The branch you're working in
        const here = localStorage.getItem("currentBranchId");
        const pick = list.find((b: any) => b.id === here) ?? list.find((b: any) => b.isMain) ?? list[0];
        if (pick) setSelectedBranchId((cur) => cur || pick.id);
      }
      if (memRes.ok) setUnitMemory(await memRes.json());
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        const flattened: any[] = [];
        prodData.forEach((p: any) => {
          p.variants.forEach((v: any) => flattened.push({ ...v, productName: p.name, productSupplierId: p.supplierId ?? null }));
        });
        setProducts(flattened);
      }
    } catch (error) {
      toast.error("Error cargando datos");
    }
  };

  /** A new line, in the unit last used for that product */
  const lineFor = (v: any, quantity = 1): OrderItem => {
    const mem = unitMemory[v.id];
    const unitFactor = mem?.unitFactor && mem.unitFactor > 0 ? mem.unitFactor : 1;
    const baseCost = Number(v.cost) || (mem ? mem.cost / unitFactor : 0);
    return {
      variantId: v.id, id: v.id, productName: v.productName, variantName: v.name,
      quantity, unit: mem?.unit ?? "UNIDAD", unitFactor, baseCost, cost: mem?.cost ?? Math.round(baseCost * unitFactor * 100) / 100, taxRate: 16,
    };
  };

  const addItem = (vId: string) => {
    const v = products.find(p => p.id === vId);
    if (!v || items.some(i => i.variantId === vId)) return;
    setItems([...items, lineFor(v)]);
  };

  // From Alertas de stock → "Compra": that product already in the order, its usual supplier chosen
  React.useEffect(() => {
    if (prefilled.current || !products.length) return;
    const q = new URLSearchParams(window.location.search);
    const vId = q.get("variant");
    if (!vId) return;
    prefilled.current = true;
    const v = products.find((p) => p.id === vId);
    if (!v) return;
    const units = Math.max(1, Math.round(Number(q.get("qty")) || 1));
    const line = lineFor(v, units);
    // In boxes: enough boxes to cover the units needed
    if (line.unitFactor > 1) line.quantity = Math.max(1, Math.ceil(units / line.unitFactor));
    setItems([line]);
    if (v.productSupplierId && suppliers.some((s) => s.id === v.productSupplierId)) setSelectedSupplierId(v.productSupplierId);
    toast.success(`${v.productName} listo en la orden`, { description: "Solo elige el proveedor y emite la orden." });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, suppliers, unitMemory]);

  /** Change the unit: the line cost follows (a box of 24 costs 24 units) */
  const setUnit = (vId: string, unit: string, factorIn?: number) =>
    setItems((list) => list.map((i) => {
      if (i.variantId !== vId) return i;
      const fixed = unitInfo(unit).factor;
      const unitFactor = fixed ?? (factorIn && factorIn > 0 ? factorIn : i.unit === unit ? i.unitFactor : (unitMemory[vId]?.unit === unit ? unitMemory[vId].unitFactor : 0));
      // Same need in the new unit (14 units → 2 boxes of 12). Changing only the size of a box that
      // was already known keeps the boxes ordered.
      const units = i.unitFactor > 0 ? i.quantity * i.unitFactor : (i.wantedUnits ?? i.quantity);
      const keep = i.unit === unit && i.unitFactor > 0;
      const quantity = keep ? i.quantity : unitFactor > 0 ? Math.max(1, Math.ceil(units / unitFactor)) : i.quantity;
      return { ...i, unit, unitFactor, quantity, wantedUnits: unitFactor > 0 ? undefined : units, cost: Math.round(i.baseCost * Math.max(unitFactor, 1) * 100) / 100 };
    }));

  /** Adds from the catalog; a product already in the order gets one more unit */
  const addFromCatalog = (p: any) => {
    const existing = items.find((i) => i.variantId === p.id);
    if (existing) {
      updateItem(p.id, "quantity", existing.quantity + 1);
      toast.success(`${p.productName}: ${existing.quantity + 1} en la orden`);
    } else {
      addItem(p.id);
      toast.success(`${p.productName} añadido`);
    }
  };

  /** Arrows move through the cards (as many per row as fit), Enter adds the selected one */
  const onCatalogKey = (e: React.KeyboardEvent) => {
    const grid = catalogRef.current?.querySelector(".grid") as HTMLElement | null;
    const cols = grid ? Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length) : 1;
    const last = filteredProducts.length - 1;
    const move = (to: number) => {
      e.preventDefault();
      const next = Math.max(0, Math.min(last, to));
      setActiveCard(next);
      catalogRef.current?.querySelector(`[data-card="${next}"]`)?.scrollIntoView({ block: "nearest" });
    };
    if (e.key === "ArrowDown") move(activeCard + cols);
    else if (e.key === "ArrowUp") move(activeCard - cols);
    else if (e.key === "ArrowRight") move(activeCard + 1);
    else if (e.key === "ArrowLeft") move(activeCard - 1);
    else if (e.key === "Enter" && filteredProducts[activeCard]) { e.preventDefault(); addFromCatalog(filteredProducts[activeCard]); }
  };

  const removeItem = (vId: string) => setItems(items.filter(i => i.variantId !== vId));
  const updateItem = (vId: string, field: keyof OrderItem, val: any) => 
    setItems(items.map(i => i.variantId === vId ? { ...i, [field]: val } : i));

  const filteredProducts = React.useMemo(() => {
    if (!searchQuery) return products;
    const lower = searchQuery.toLowerCase();
    return products.filter(p => 
      p.productName.toLowerCase().includes(lower) || 
      p.name.toLowerCase().includes(lower) || 
      (p.sku && p.sku.toLowerCase().includes(lower))
    );
  }, [products, searchQuery]);

  const columns = React.useMemo<ColumnDef<OrderItem>[]>(() => [
    { id: "drag", header: () => null, cell: ({ row }) => <DragHandle id={row.original.variantId} /> },
    {
      accessorKey: "productName",
      header: "Producto / variante",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-medium text-foreground leading-none mb-1">{row.original.productName}</span>
          <span className="text-[10px] text-muted-foreground font-medium tracking-tight border w-fit px-1.5 py-0.5 rounded">{row.original.variantName}</span>
        </div>
      ),
    },
    {
      accessorKey: "quantity",
      header: () => <div className="text-center">Cantidad</div>,
      cell: ({ row }) => {
        const it = row.original;
        const info = unitInfo(it.unit);
        const askFactor = info.factor === null;
        return (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              <Input
                type="number" min={1} className="h-8 w-16 text-center text-sm font-medium shadow-none"
                value={it.quantity} onChange={(e) => updateItem(it.variantId, 'quantity', Math.max(0, Number(e.target.value)))}
                aria-label="Cantidad"
              />
              <select
                value={it.unit}
                onChange={(e) => setUnit(it.variantId, e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                aria-label="Unidad de medida"
              >
                {PURCHASE_UNITS.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
              </select>
            </div>
            {askFactor && (
              <label className={cn("flex items-center gap-1 text-[11px]", it.unitFactor > 1 ? "text-muted-foreground" : "font-semibold text-amber-700")}>
                de
                <Input
                  key={`${it.variantId}-${it.unit}-${it.unitFactor}`}
                  type="number" min={2} className="h-6 w-14 px-1 text-center text-xs shadow-none"
                  defaultValue={it.unitFactor > 0 ? it.unitFactor : ""} placeholder="¿?"
                  onBlur={(e) => { const n = Number(e.target.value); if (n > 0 && n !== it.unitFactor) setUnit(it.variantId, it.unit, n); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                  aria-label={`Unidades por ${UNIT_SINGULAR[it.unit]}`}
                />
                unid. c/u
              </label>
            )}
            {it.unit !== "UNIDAD" && it.unitFactor > 1 && <span className="text-[11px] text-muted-foreground">= {fmtQty(it.quantity * it.unitFactor)} unidades</span>}
          </div>
        );
      },
    },
    {
      accessorKey: "cost",
      header: () => <div className="text-right">Costo</div>,
      cell: ({ row }) => (
        <div className="flex flex-col items-end gap-0.5">
          <Input
            type="number" className="h-8 w-28 text-right text-sm font-medium shadow-none"
            value={row.original.cost}
            onChange={(e) => {
              const cost = Math.max(0, Number(e.target.value));
              setItems((list) => list.map((i) => i.variantId === row.original.variantId ? { ...i, cost, baseCost: cost / Math.max(i.unitFactor, 1) } : i));
            }}
            aria-label="Costo"
          />
          <span className="text-[11px] text-muted-foreground">por {UNIT_SINGULAR[row.original.unit] ?? "unidad"}</span>
        </div>
      ),
    },
    { id: "subtotal", header: () => <div className="text-right">Subtotal</div>, cell: ({ row }) => (
      <div className="text-[13px] font-medium tabular-nums text-right text-foreground pr-2">
        USD {(row.original.quantity * row.original.cost).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    )},
    { id: "actions", header: () => null, cell: ({ row }) => (
      <div className="flex justify-end">
        <Button variant="ghost" size="icon" onClick={() => removeItem(row.original.variantId)} className="size-8 text-muted-foreground/50 hover:bg-rose-500/10 hover:text-rose-500">
          <IconTrash size={14} />
        </Button>
      </div>
    )},
  ], [items, products]);

  const table = useReactTable({
    data: items, columns, state: { sorting, columnVisibility, rowSelection, columnFilters, pagination },
    onRowSelectionChange: setRowSelection, onSortingChange: setSorting, onColumnFiltersChange: setColumnFilters, onColumnVisibilityChange: setColumnVisibility, onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getPaginationRowModel: getPaginationRowModel(), getSortedRowModel: getSortedRowModel(), getFacetedRowModel: getFacetedRowModel(), getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: (row) => row.variantId,
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex(i => i.variantId === active.id);
        const newIndex = prev.findIndex(i => i.variantId === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((acc, curr) => acc + (curr.quantity * curr.cost), 0);
    const tax = items.reduce((acc, curr) => acc + (curr.quantity * curr.cost * (curr.taxRate / 100)), 0);
    return { subtotal, tax, total: subtotal + tax };
  };

  const handleSubmit = async () => {
    if (!selectedSupplierId) return toast.error("Elige el proveedor");
    if (!selectedBranchId || items.length === 0) return toast.error("Complete campos obligatorios");
    const noFactor = items.find((i) => unitInfo(i.unit).factor === null && !(i.unitFactor > 1));
    if (noFactor) return toast.error(`¿Cuántas unidades trae cada ${UNIT_SINGULAR[noFactor.unit]} de ${noFactor.productName}?`);
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/purchase-orders`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ supplierId: selectedSupplierId, branchId: selectedBranchId, notes, items: items.map(i => ({ variantId: i.variantId, quantity: i.quantity, unit: i.unit, unitFactor: i.unitFactor, cost: i.cost, taxRate: i.taxRate })) })
      });
      if (res.ok) { toast.success("Orden creada"); router.push("/dashboard/inventario/compras"); }
      else { const err = await res.json().catch(() => null); toast.error(err?.message || "No se pudo crear la orden"); }
    } finally { setLoading(false); }
  };

  const { subtotal, tax, total } = calculateTotals();

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 max-w-7xl mx-auto px-4 lg:px-6 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="h-9 shadow-none">
            <IconArrowLeft size={16} className="mr-2" /> Volver
          </Button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight">Generar orden de compra</h1>
            <Badge variant="outline" className="mt-1 w-fit text-[10px] font-semibold text-muted-foreground">Procura e inventario</Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Dialog open={catalogOpen} onOpenChange={(o) => { setCatalogOpen(o); if (o) { setSearchQuery(""); setActiveCard(0); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <IconPlus size={16} /> Añadir productos
              </Button>
            </DialogTrigger>
            <DialogContent className="flex h-[88vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
              <DialogHeader className="border-b px-6 pb-4 pt-5 text-left">
                <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                  <IconPackage size={20} className="text-primary" /> Catálogo de productos
                  {items.length > 0 && <Badge variant="secondary" className="ml-1 font-semibold">{items.length} en la orden</Badge>}
                </DialogTitle>
                <div className="relative mt-3">
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Buscar por nombre, presentación o SKU…"
                    className="h-11 pl-10 text-base"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setActiveCard(0); }}
                    onKeyDown={onCatalogKey}
                    aria-label="Buscar productos"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Clic o Enter para añadir · ↑ ↓ ← → para moverte · Esc para cerrar</p>
              </DialogHeader>
              <div ref={catalogRef} className="flex-1 overflow-y-auto bg-muted/30 p-5">
                {filteredProducts.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                    <IconPackage size={28} className="opacity-50" />
                    <p className="text-sm">No hay productos con «{searchQuery}».</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredProducts.map((p, i) => {
                      const inOrder = items.find((it) => it.variantId === p.id);
                      const variant = p.name && !["Única", "Unica", "Principal", "Default"].includes(p.name) ? p.name : null;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          data-card={i}
                          onClick={() => addFromCatalog(p)}
                          onMouseEnter={() => setActiveCard(i)}
                          className={cn(
                            "group flex flex-col gap-3 rounded-xl border bg-card p-4 text-left shadow-xs transition-all outline-none",
                            "hover:border-primary/50 hover:shadow-md",
                            i === activeCard && "border-primary ring-2 ring-primary/30",
                            inOrder && "border-emerald-500/50 bg-emerald-500/5",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <IconPackage size={18} />
                            </div>
                            <span className="rounded-md border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{p.sku || "S/SKU"}</span>
                          </div>
                          <div className="min-h-[2.5rem]">
                            <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.productName}</p>
                            {variant && <p className="mt-0.5 text-xs text-muted-foreground">{variant}</p>}
                          </div>
                          <div className="mt-auto flex items-end justify-between gap-2">
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Costo</p>
                              <p className="text-base font-bold tabular-nums">${Number(p.cost || 0).toFixed(2)}</p>
                              <p className={cn("text-[11px]", Number(p.stock) <= Number(p.minStock || 0) ? "font-semibold text-destructive" : "text-muted-foreground")}>
                                Stock: {Number(p.stock ?? 0)}
                              </p>
                            </div>
                            {inOrder ? (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                <IconCheck size={13} /> {inOrder.quantity} en la orden
                              </span>
                            ) : (
                              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-80 transition-opacity group-hover:opacity-100">
                                <IconPlus size={16} />
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 border-t px-6 py-3">
                <p className="text-sm text-muted-foreground">{items.length ? `${items.length} producto${items.length === 1 ? "" : "s"} en la orden` : "Aún no añades productos"}</p>
                <Button onClick={() => setCatalogOpen(false)}>Listo</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button onClick={handleSubmit} disabled={loading || items.length === 0} className="gap-2 h-9 shadow-none font-bold text-xs px-5">
            {loading ? "Procesando..." : <>Emitir orden de compra <IconCheck size={16} /></>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <IconTruck size={14} className="opacity-70" /> Información del proveedor y destino
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Socio comercial (proveedor)</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="h-10 w-full shadow-none">
                    <SelectValue placeholder="Seleccione un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id} >{s.name} ({s.taxId})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Sucursal de recepción</Label>
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="h-10 w-full shadow-none">
                    <SelectValue placeholder="Sucursal de entrega" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id} >{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* ITEM TABLE (DASHBOARD UI REUSE) */}
          <Tabs defaultValue="items" className="w-full flex-col justify-start gap-6">
            <div className="flex items-center justify-between px-0">
               <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
                  <TabsTrigger value="items">Items de la orden</TabsTrigger>
               </TabsList>
            </div>

            <TabsContent value="items" className="relative flex flex-col gap-4">
               <div className="overflow-hidden rounded-lg border bg-card">
                  <DndContext collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd} sensors={sensors} id={sortableId}>
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-muted/60">
                        {table.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                            {headerGroup.headers.map((header) => (
                              <TableHead key={header.id} className="py-3 text-xs font-medium text-muted-foreground">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </TableHead>
                            ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody className="**:data-[slot=table-cell]:first:w-8">
                        {items.length ? (
                          <SortableContext items={items.map(i => i.variantId)} strategy={verticalListSortingStrategy}>
                            {table.getRowModel().rows.map((row) => (
                              <DraggableRow key={row.id} row={row} />
                            ))}
                          </SortableContext>
                        ) : (
                          <TableRow><TableCell colSpan={columns.length} className="h-48 text-center text-muted-foreground opacity-40 italic text-xs">Añada productos a la orden para comenzar</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </DndContext>
               </div>
               <div className="flex items-center justify-between px-2">
                  <div className="text-muted-foreground text-[10px] font-medium">{items.length} item(s) cargados</div>
                  <div className="flex items-center gap-2">
                     <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled><IconChevronLeft size={14} /></Button>
                     <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled><IconChevronRight size={14} /></Button>
                  </div>
               </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold"><IconFileText size={14} className="opacity-70" /> Resumen de inversión</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center text-xs">
                 <span className="text-muted-foreground font-medium tracking-tight">Imponible</span>
                 <span className="font-bold tabular-nums">USD {subtotal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                 <span className="text-muted-foreground font-medium tracking-tight">IVA (16%)</span>
                 <span className="font-bold tabular-nums">USD {tax.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center py-1">
                 <span className="text-sm font-bold">Total orden</span>
                 <span className="text-xl font-black tabular-nums text-primary">USD {total.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="pt-4 space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Observaciones</Label>
                  <textarea 
                    className="min-h-[90px] w-full resize-none rounded-lg border bg-background p-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Instrucciones para el proveedor..."
                    value={notes} onChange={(e) => setNotes(e.target.value)}
                  />
               </div>
            </CardContent>
          </Card>
          <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10 flex gap-3 items-start">
             <IconInfoCircle className="text-blue-500 mt-1" size={16} />
             <p className="text-[10px] text-blue-700 font-medium leading-relaxed">Los costos unitarios son editables. El sistema registrará el último costo para futuras sugerencias.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
