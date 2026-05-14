"use client"

import * as React from "react"
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
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleCheckFilled,
  IconDotsVertical,
  IconGripVertical,
  IconLayoutColumns,
  IconLoader,
  IconPlus,
  IconTrendingUp,
  IconAlertTriangle,
  IconBox,
  IconX
} from "@tabler/icons-react"
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
} from "@tanstack/react-table"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { toast } from "sonner"
import { z } from "zod"

import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export const schema = z.object({
  id: z.union([z.string(), z.number()]),
  header: z.string(),
  type: z.string(),
  status: z.string(),
  target: z.string(),
  limit: z.string(),
  reviewer: z.string(),
  image: z.string().optional(),
})

// Create a separate component for the drag handle
function DragHandle({ id }: { id: UniqueIdentifier }) {
  const { attributes, listeners } = useSortable({
    id,
  })

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent"
    >
      <IconGripVertical className="size-3 text-muted-foreground" />
      <span className="sr-only">Arrastrar para reordenar</span>
    </Button>
  )
}

const columns: ColumnDef<z.infer<typeof schema>>[] = [
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  },
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Seleccionar todo"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Seleccionar fila"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "header",
    header: "Producto / Especificación",
    cell: ({ row }) => {
      return <TableCellViewer item={row.original} />
    },
    enableHiding: false,
  },
  {
    accessorKey: "type",
    header: "SKU / Código",
    cell: ({ row }) => (
      <div className="w-32">
        <code className="text-[10px] font-bold bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">
          {row.original.type}
        </code>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Estado Stock",
    cell: ({ row }) => {
        const isOk = row.original.status === "En Stock";
        const isLow = row.original.status === "Stock Bajo";
        
        return (
            <Badge variant="outline" className={`px-1.5 font-bold tracking-tight border-none ${isOk ? 'bg-emerald-500/10 text-emerald-600' : isLow ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'}`}>
                {isOk ? (
                <IconCircleCheckFilled size={14} className="mr-1 shadow-sm" />
                ) : isLow ? (
                <IconAlertTriangle size={14} className="mr-1" />
                ) : (
                <IconX className="mr-1" size={14} />
                )}
                {row.original.status}
            </Badge>
        )
    },
  },
  {
    accessorKey: "target",
    header: () => <div className="w-full text-right">Existencia</div>,
    cell: ({ row }) => (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
            loading: `Guardando stock de ${row.original.header}`,
            success: "Stock actualizado",
            error: "Error al actualizar",
          })
        }}
      >
        <Label htmlFor={`${row.original.id}-target`} className="sr-only">
          Existencia
        </Label>
        <Input
          className="h-8 w-20 border-transparent bg-transparent text-right shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background dark:bg-transparent dark:hover:bg-input/30 dark:focus-visible:bg-input/30 font-black"
          defaultValue={row.original.target}
          id={`${row.original.id}-target`}
        />
      </form>
    ),
  },
  {
    accessorKey: "limit",
    header: () => <div className="w-full text-right">Mínimo</div>,
    cell: ({ row }) => (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
            loading: `Guardando mínimo de ${row.original.header}`,
            success: "Mínimo actualizado",
            error: "Error al actualizar",
          })
        }}
      >
        <Label htmlFor={`${row.original.id}-limit`} className="sr-only">
          Mínimo
        </Label>
        <Input
          className="h-8 w-20 border-transparent bg-transparent text-right shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background dark:bg-transparent dark:hover:bg-input/30 dark:focus-visible:bg-input/30 text-muted-foreground/80"
          defaultValue={row.original.limit}
          id={`${row.original.id}-limit`}
        />
      </form>
    ),
  },
  {
    accessorKey: "reviewer",
    header: "Proveedor / Categoría",
    cell: ({ row }) => {
      const isAssigned = row.original.reviewer !== "Asignar"

      if (isAssigned) {
        return <span className="text-xs font-medium text-muted-foreground">{row.original.reviewer}</span>
      }

      return (
        <>
          <Label htmlFor={`${row.original.id}-reviewer`} className="sr-only">
            Proveedor
          </Label>
          <Select>
            <SelectTrigger
              className="w-38 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate h-8 text-[11px]"
              size="sm"
              id={`${row.original.id}-reviewer`}
            >
              <SelectValue placeholder="Asignar" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="Proveedor A">Proveedor A</SelectItem>
              <SelectItem value="Proveedor B">Proveedor B</SelectItem>
            </SelectContent>
          </Select>
        </>
      )
    },
  },
  {
    id: "actions",
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex size-8 text-muted-foreground data-[state=open]:bg-muted rounded-full"
            size="icon"
          >
            <IconDotsVertical size={16} />
            <span className="sr-only">Abrir menú</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 border-none shadow-2xl rounded-xl">
          <DropdownMenuItem className="text-xs">Editar Producto</DropdownMenuItem>
          <DropdownMenuItem className="text-xs">Duplicar</DropdownMenuItem>
          <DropdownMenuItem className="text-xs">Kardex de Movimientos</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="text-xs text-rose-600">Eliminar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

function DraggableRow({ row }: { row: Row<z.infer<typeof schema>> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80 transition-shadow bg-card"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} className="py-2">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

export function InventoryDataTable({
  data: initialData,
}: {
  data: z.infer<typeof schema>[]
}) {
  const [data, setData] = React.useState(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  
  // Update local data when initialData changes
  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  return (
    <Tabs
      defaultValue="outline"
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-0 lg:px-0 mb-4">
        <Label htmlFor="view-selector" className="sr-only">
          Vista
        </Label>
        <Select defaultValue="outline">
          <SelectTrigger
            className="flex w-fit md:hidden h-8 text-xs font-bold"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Seleccionar vista" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="outline">Existencias</SelectItem>
            <SelectItem value="past-performance">Movimientos</SelectItem>
            <SelectItem value="key-personnel">Alertas</SelectItem>
            <SelectItem value="focus-documents">Documentos</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-primary/20 **:data-[slot=badge]:text-primary **:data-[slot=badge]:px-1 md:flex h-10 p-1 bg-muted/40 rounded-xl border border-muted/50">
          <TabsTrigger value="outline" className="text-xs font-bold rounded-lg px-4">Existencias</TabsTrigger>
          <TabsTrigger value="past-performance" className="text-xs font-bold rounded-lg px-4">
            Movimientos <Badge variant="secondary" className="ml-1 text-[9px]">3</Badge>
          </TabsTrigger>
          <TabsTrigger value="key-personnel" className="text-xs font-bold rounded-lg px-4">
            Alertas <Badge variant="secondary" className="ml-1 text-[9px]">2</Badge>
          </TabsTrigger>
          <TabsTrigger value="focus-documents" className="text-xs font-bold rounded-lg px-4">Documentos</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 shadow-sm rounded-lg">
                <IconLayoutColumns size={16} />
                <span className="hidden lg:inline text-xs font-bold">Columnas</span>
                <IconChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-none shadow-2xl rounded-xl">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize text-xs font-medium"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="default" size="sm" className="h-9 gap-2 shadow-md rounded-lg font-bold">
            <IconPlus size={16} />
            <span className="hidden lg:inline text-xs">Añadir Sección</span>
          </Button>
        </div>
      </div>
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-0"
      >
        <div className="overflow-hidden rounded-2xl border border-muted/60 shadow-xs bg-card">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/30">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent border-b">
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan} className="text-muted-foreground font-black text-[10px] uppercase tracking-widest h-10">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground italic"
                    >
                      No se encontraron resultados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        
        <div className="flex items-center justify-between px-2 py-4">
          <div className="hidden flex-1 text-[11px] font-bold uppercase tracking-tight text-muted-foreground/60 lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} de{" "}
            {table.getFilteredRowModel().rows.length} registros seleccionados
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-[10px] font-black uppercase tracking-widest opacity-60">
                Registros
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger size="sm" className="w-20 h-8 text-xs font-bold rounded-lg border-muted/50" id="rows-per-page">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top" className="rounded-xl border-none shadow-2xl">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`} className="text-xs">
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-xs font-bold uppercase tracking-tighter opacity-80">
              Página {table.getState().pagination.pageIndex + 1} de{" "}
              {table.getPageCount() || 1}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex shadow-none border-muted-foreground/20 rounded-lg"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Primera página</span>
                <IconChevronsLeft size={16} />
              </Button>
              <Button
                variant="outline"
                className="size-8 shadow-none border-muted-foreground/20 rounded-lg"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Anterior</span>
                <IconChevronLeft size={16} />
              </Button>
              <Button
                variant="outline"
                className="size-8 shadow-none border-muted-foreground/20 rounded-lg"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Siguiente</span>
                <IconChevronRight size={16} />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex shadow-none border-muted-foreground/20 rounded-lg"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Última página</span>
                <IconChevronsRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent
        value="past-performance"
        className="flex flex-col px-0"
      >
        <div className="aspect-video w-full flex-1 rounded-2xl border border-dashed border-muted/40 bg-muted/10 flex items-center justify-center text-muted-foreground italic text-sm">
            Sección de Historial de Movimientos
        </div>
      </TabsContent>
      <TabsContent value="key-personnel" className="flex flex-col px-0">
        <div className="aspect-video w-full flex-1 rounded-2xl border border-dashed border-muted/40 bg-muted/10 flex items-center justify-center text-muted-foreground italic text-sm">
            Sección de Alertas Críticas
        </div>
      </TabsContent>
      <TabsContent
        value="focus-documents"
        className="flex flex-col px-0"
      >
        <div className="aspect-video w-full flex-1 rounded-2xl border border-dashed border-muted/40 bg-muted/10 flex items-center justify-center text-muted-foreground italic text-sm">
            Repositorio de Documentos Adjuntos
        </div>
      </TabsContent>
    </Tabs>
  )
}

const chartData = [
  { month: "Enero", stock: 186, sales: 80 },
  { month: "Febrero", stock: 305, sales: 200 },
  { month: "Marzo", stock: 237, sales: 120 },
  { month: "Abril", stock: 173, sales: 190 },
  { month: "Mayo", stock: 209, sales: 130 },
  { month: "Junio", stock: 214, sales: 140 },
]

const chartConfig = {
  stock: {
    label: "Existencia",
    color: "var(--primary)",
  },
  sales: {
    label: "Ventas",
    color: "hsl(var(--primary) / 0.5)",
  },
} satisfies ChartConfig

function TableCellViewer({ item }: { item: z.infer<typeof schema> }) {
  const isMobile = useIsMobile()

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <div className="flex items-center gap-3 cursor-pointer group/item">
            <div className="size-10 rounded-xl border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0 group-hover/item:border-primary/30 transition-colors">
                {item.image ? <img src={item.image} className="size-full object-cover" /> : <IconBox className="text-muted-foreground/30" size={20} />}
            </div>
            <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-foreground group-hover/item:text-primary transition-colors line-clamp-1">{item.header}</span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{item.type}</span>
            </div>
        </div>
      </DrawerTrigger>
      <DrawerContent className="h-[95vh] md:h-screen md:w-[450px] md:left-auto md:right-0 md:rounded-l-2xl md:rounded-r-none border-none shadow-2xl">
        <DrawerHeader className="gap-1 border-b pb-4">
          <DrawerTitle className="text-xl font-bold tracking-tight">{item.header}</DrawerTitle>
          <DrawerDescription className="text-xs font-medium">
            Análisis de stock y movimientos de los últimos 6 meses
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-6 overflow-y-auto px-6 py-6 text-sm">
          {!isMobile && (
            <>
              <div className="rounded-2xl border border-muted/50 p-4 bg-muted/5">
                <ChartContainer config={chartConfig} className="h-[180px] w-full">
                    <AreaChart
                    accessibilityLayer
                    data={chartData}
                    margin={{
                        left: 0,
                        right: 0,
                        top: 10,
                        bottom: 0
                    }}
                    >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                    <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => value.slice(0, 3)}
                        hide
                    />
                    <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent indicator="dot" />}
                    />
                    <Area
                        dataKey="sales"
                        type="natural"
                        fill="hsl(var(--primary) / 0.1)"
                        fillOpacity={0.1}
                        stroke="hsl(var(--primary) / 0.3)"
                        strokeWidth={2}
                        stackId="a"
                    />
                    <Area
                        dataKey="stock"
                        type="natural"
                        fill="hsl(var(--primary) / 0.2)"
                        fillOpacity={0.4}
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        stackId="a"
                    />
                    </AreaChart>
                </ChartContainer>
              </div>
              <Separator className="opacity-50" />
              <div className="grid gap-2">
                <div className="flex gap-2 items-center leading-none font-bold text-emerald-600">
                  <IconTrendingUp className="size-4" />
                  Tendencia al alza (+5.2%) este mes
                </div>
                <div className="text-muted-foreground text-xs leading-relaxed font-medium">
                  El producto mantiene una rotación estable. Se recomienda mantener el punto de reorden actual para evitar quiebres de stock en temporadas altas.
                </div>
              </div>
              <Separator className="opacity-50" />
            </>
          )}
          <form className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="header" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Nombre del Producto</Label>
              <Input id="header" defaultValue={item.header} className="h-10 rounded-xl bg-muted/20 border-none font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="type" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">SKU / Código</Label>
                <Input id="type" defaultValue={item.type} className="h-10 rounded-xl bg-muted/20 border-none font-mono text-xs font-bold" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="status" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Estado</Label>
                <Select defaultValue={item.status}>
                  <SelectTrigger id="status" className="w-full h-10 rounded-xl bg-muted/20 border-none font-bold">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="En Stock" className="text-xs">En Stock</SelectItem>
                    <SelectItem value="Stock Bajo" className="text-xs">Stock Bajo</SelectItem>
                    <SelectItem value="Sin Stock" className="text-xs">Sin Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="target" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Existencia Actual</Label>
                <Input id="target" defaultValue={item.target} className="h-10 rounded-xl bg-muted/20 border-none font-black text-primary text-lg" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="limit" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Mínimo Requerido</Label>
                <Input id="limit" defaultValue={item.limit} className="h-10 rounded-xl bg-muted/20 border-none font-bold" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reviewer" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Proveedor Principal</Label>
              <Select defaultValue={item.reviewer}>
                <SelectTrigger id="reviewer" className="w-full h-10 rounded-xl bg-muted/20 border-none font-bold">
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="Proveedor A" className="text-xs">Proveedor A</SelectItem>
                  <SelectItem value="Proveedor B" className="text-xs">Proveedor B</SelectItem>
                  <SelectItem value="Proveedor C" className="text-xs">Proveedor C</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        </div>
        <DrawerFooter className="flex-row gap-2 border-t pt-4 bg-muted/5">
          <Button className="flex-1 rounded-xl h-11 font-bold shadow-lg">Guardar Cambios</Button>
          <DrawerClose asChild>
            <Button variant="outline" className="flex-1 rounded-xl h-11 font-bold">Cancelar</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
