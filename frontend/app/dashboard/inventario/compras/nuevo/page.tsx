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

const API = process.env.NEXT_PUBLIC_API_URL || ``${API_URL}`;

// --- Types & Schema ---

export const orderItemSchema = z.object({
  variantId: z.string(),
  productName: z.string(),
  variantName: z.string(),
  quantity: z.number(),
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
      className="size-7 text-muted-foreground/50 hover:bg-white/5 hover:text-white transition-colors"
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
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80 bg-transparent border-b border-[#79716b]/30 hover:bg-[#79716b]/5 transition-colors group"
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
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<OrderItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  
  // Modal State
  const [searchQuery, setSearchQuery] = React.useState("");

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
      const [suppRes, branchRes, prodRes] = await Promise.all([
        fetch(`${API}/suppliers`, { headers }),
        fetch(`${API}/branches`, { headers }),
        fetch(`${API}/products`, { headers })
      ]);
      if (suppRes.ok) setSuppliers(await suppRes.json());
      if (branchRes.ok) setBranches(await branchRes.json());
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        const flattened: any[] = [];
        prodData.forEach((p: any) => {
          p.variants.forEach((v: any) => flattened.push({ ...v, productName: p.name }));
        });
        setProducts(flattened);
      }
    } catch (error) {
      toast.error("Error cargando datos");
    }
  };

  const addItem = (vId: string) => {
    const v = products.find(p => p.id === vId);
    if (!v || items.some(i => i.variantId === vId)) return;
    setItems([...items, {
      variantId: v.id, id: v.id, productName: v.productName, variantName: v.name,
      quantity: 1, cost: v.cost || 0, taxRate: 16
    }]);
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
      header: "PRODUCTO / VARIANTE",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-medium text-foreground leading-none mb-1">{row.original.productName}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-tight border border-[#79716b]/30 w-fit px-1.5 py-0.5 rounded bg-transparent">{row.original.variantName}</span>
        </div>
      ),
    },
    {
      accessorKey: "quantity",
      header: () => <div className="text-center">CANTIDAD</div>,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Input 
            type="number" className="h-8 text-center text-sm font-medium shadow-none w-20 bg-transparent border-transparent hover:border-muted focus-visible:bg-muted/10 transition-all" 
            value={row.original.quantity} onChange={(e) => updateItem(row.original.variantId, 'quantity', Number(e.target.value))}
          />
        </div>
      ),
    },
    {
      accessorKey: "cost",
      header: () => <div className="text-right">COSTO UNIT.</div>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Input 
            type="number" className="h-8 text-right text-sm font-medium shadow-none w-28 bg-transparent border-transparent hover:border-muted focus-visible:bg-muted/10 transition-all" 
            value={row.original.cost} onChange={(e) => updateItem(row.original.variantId, 'cost', Number(e.target.value))}
          />
        </div>
      ),
    },
    { id: "subtotal", header: () => <div className="text-right">SUBTOTAL</div>, cell: ({ row }) => (
      <div className="text-[13px] font-medium tabular-nums text-right text-foreground pr-2">
        USD {(row.original.quantity * row.original.cost).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
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
    if (!selectedSupplierId || !selectedBranchId || items.length === 0) return toast.error("Complete campos obligatorios");
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/purchase-orders`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ supplierId: selectedSupplierId, branchId: selectedBranchId, notes, items: items.map(i => ({ variantId: i.variantId, quantity: i.quantity, cost: i.cost, taxRate: i.taxRate })) })
      });
      if (res.ok) { toast.success("Orden creada"); router.push("/dashboard/inventario/compras"); }
    } finally { setLoading(false); }
  };

  const { subtotal, tax, total } = calculateTotals();

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 max-w-7xl mx-auto px-4 lg:px-6 font-sans text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="h-9 shadow-none border-[#79716b]/30 bg-card">
            <IconArrowLeft size={16} className="mr-2" /> Volver
          </Button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight">Generar Orden de Compra</h1>
            <Badge variant="outline" className="w-fit text-[9px] font-black uppercase tracking-[0.2em] border-[#79716b]/50 text-[#79716b] mt-1">Procura e Inventario</Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 border-[#79716b]/30 bg-card text-white hover:bg-muted/50 transition-colors">
                <IconPlus size={16} /> Añadir Productos
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl bg-zinc-950 border-[#79716b]/30 text-white max-h-[80vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <IconPackage className="text-[#79716b]" /> Catálogo de Productos
                </DialogTitle>
                <div className="relative mt-4">
                  <IconSearch className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Filtrar por nombre, SKU o categoría..." 
                    className="pl-10 h-10 bg-muted/20 border-[#79716b]/30 focus-visible:ring-1 focus-visible:ring-[#79716b]/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => {
                        addItem(p.id);
                        toast.success(`${p.productName} añadido`);
                      }}
                      className="p-4 rounded-xl border border-[#79716b]/20 bg-muted/10 hover:bg-[#79716b]/10 hover:border-[#79716b]/40 cursor-pointer transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-[#79716b]">
                          <IconBuildingStore size={18} />
                        </div>
                        <Badge variant="outline" className="text-[9px] font-bold border-[#79716b]/30 text-[#79716b]">{p.sku || 'S/N'}</Badge>
                      </div>
                      <h3 className="text-sm font-bold leading-tight line-clamp-1">{p.productName}</h3>
                      <p className="text-[11px] text-muted-foreground mt-1">{p.name}</p>
                      <div className="mt-4 flex justify-between items-center px-1">
                        <span className="text-xs font-black text-emerald-400">USD {p.cost?.toFixed(2) || '0.00'}</span>
                        <div className="size-6 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <IconPlus size={14} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground opacity-50 italic">
                      No se encontraron productos que coincidan con la búsqueda.
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button onClick={handleSubmit} disabled={loading || items.length === 0} className="gap-2 h-9 shadow-none font-bold text-xs px-5">
            {loading ? "Procesando..." : <>Emitir Orden de Compra <IconCheck size={16} /></>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-[#79716b]/20 shadow-sm bg-card/30 overflow-hidden">
            <CardHeader className="bg-muted h-12 flex items-center justify-start py-0 border-b border-[#79716b]/30 px-4">
              <CardTitle className="text-[11px] font-normal uppercase tracking-wider text-white flex items-center gap-2">
                <IconTruck size={14} className="opacity-70" /> Información del Proveedor y Destino
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
              <div className="space-y-2 text-white">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60 ">Socio Comercial (Proveedor)</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="h-10 bg-muted/20 border-[#79716b]/30 shadow-none text-white">
                    <SelectValue placeholder="Seleccione un proveedor" className="text-white"/>
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-[#79716b]/30">
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-white">{s.name} ({s.taxId})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Sucursal de Recepción</Label>
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="h-10 bg-muted/20 border-[#79716b]/30 shadow-none text-white">
                    <SelectValue placeholder="Sucursal de entrega" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-[#79716b]/30">
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id} className="text-white">{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* ITEM TABLE (DASHBOARD UI REUSE) */}
          <Tabs defaultValue="items" className="w-full flex-col justify-start gap-6">
            <div className="flex items-center justify-between px-0">
               <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex border-[#79716b]/30 bg-card/30">
                  <TabsTrigger value="items" className="text-white">Items de la Orden</TabsTrigger>
               </TabsList>
            </div>

            <TabsContent value="items" className="relative flex flex-col gap-4">
               <div className="overflow-hidden rounded-lg border border-[#79716b]/30">
                  <DndContext collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd} sensors={sensors} id={sortableId}>
                    <Table>
                      <TableHeader className="bg-muted sticky top-0 z-10">
                        {table.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                            {headerGroup.headers.map((header) => (
                              <TableHead key={header.id} className="text-white font-normal text-[10px] uppercase tracking-wider py-4">
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
                  <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-widest">{items.length} ITEM(S) CARGADOS</div>
                  <div className="flex items-center gap-2">
                     <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-[#79716b]/20" disabled><IconChevronLeft size={14} /></Button>
                     <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-[#79716b]/20" disabled><IconChevronRight size={14} /></Button>
                  </div>
               </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card className="border-[#79716b]/20 shadow-sm bg-card/50 overflow-hidden">
            <CardHeader className="bg-muted h-12 flex items-center justify-start py-0 border-b border-[#79716b]/30 px-4">
              <CardTitle className="text-[11px] font-normal uppercase tracking-wider text-white flex items-center gap-2"><IconFileText size={14} className="opacity-70" /> Resumen de Inversión</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center text-xs">
                 <span className="text-muted-foreground font-medium uppercase tracking-tight">Imponible</span>
                 <span className="font-bold tabular-nums text-white">USD {subtotal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                 <span className="text-muted-foreground font-medium uppercase tracking-tight">IVA (16%)</span>
                 <span className="font-bold tabular-nums text-white">USD {tax.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
              </div>
              <Separator className="bg-[#79716b]/30" />
              <div className="flex justify-between items-center py-1">
                 <span className="text-sm font-black uppercase tracking-tighter text-white">Total Orden</span>
                 <span className="text-xl font-black tabular-nums text-emerald-400">USD {total.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pt-4 space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Observaciones</Label>
                  <textarea 
                    className="w-full bg-muted/10 border border-[#79716b]/30 rounded-lg p-3 text-xs text-white min-h-[90px] focus:outline-none focus:border-[#79716b]/80 transition-all resize-none"
                    placeholder="Instrucciones para el proveedor..."
                    value={notes} onChange={(e) => setNotes(e.target.value)}
                  />
               </div>
            </CardContent>
          </Card>
          <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10 flex gap-3 items-start">
             <IconInfoCircle className="text-blue-500 mt-1" size={16} />
             <p className="text-[10px] text-blue-500/80 font-medium leading-relaxed">Los costos unitarios son editables. El sistema registrará el último costo para futuras sugerencias.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
