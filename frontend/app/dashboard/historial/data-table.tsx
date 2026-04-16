"use client"

import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table"
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconLayoutColumns,
  IconSearch
} from "@tabler/icons-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  filterPlaceholder?: string
  filterColumn?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterPlaceholder = "Filtrar...",
  filterColumn,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  return (
    <div className="w-full space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            {filterColumn && (
                <div className="relative group">
                    <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder={filterPlaceholder}
                        value={(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn(filterColumn)?.setFilterValue(event.target.value)
                        }
                        className="h-9 w-[200px] lg:w-[350px] text-xs pl-9 bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
                    />
                </div>
            )}
        </div>
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2 shadow-sm">
                        <IconLayoutColumns size={14} />
                        <span className="hidden lg:inline text-xs font-semibold">Columnizar</span>
                        <IconChevronDown size={12} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 border-none shadow-2xl rounded-xl">
                    {table
                        .getAllColumns()
                        .filter((column) => column.getCanHide())
                        .map((column) => {
                            return (
                                <DropdownMenuCheckboxItem
                                    key={column.id}
                                    className="capitalize text-xs"
                                    checked={column.getIsVisible()}
                                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                >
                                    {column.id}
                                </DropdownMenuCheckboxItem>
                            )
                        })}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      <div className="rounded-xl border border-muted/60 overflow-hidden shadow-sm bg-card">
        <Table>
          <TableHeader className="bg-muted/30 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-b">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="text-muted-foreground font-semibold h-11 px-4 text-[10px] uppercase tracking-widest">
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
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-primary/[0.02] transition-colors border-b last:border-0"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3 px-4 h-14">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-sm text-muted-foreground italic">
                  No se registran transacciones en este periodo.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer Exactly as Dashboard */}
      <div className="flex items-center justify-between px-2 py-2 font-medium">
          <div className="text-muted-foreground flex-1 text-xs hidden lg:flex uppercase tracking-tight opacity-70">
            {table.getFilteredSelectedRowModel().rows.length} de{" "}
            {table.getFilteredRowModel().rows.length} registros seleccionados
          </div>
          <div className="flex items-center gap-8">
            <div className="hidden items-center gap-3 lg:flex">
                <Label htmlFor="rows-per-page" className="text-[10px] font-black uppercase tracking-widest opacity-60">
                    Registros
                </Label>
                <Select
                    value={`${table.getState().pagination.pageSize}`}
                    onValueChange={(value) => {
                        table.setPageSize(Number(value))
                    }}
                >
                    <SelectTrigger size="sm" className="w-16 h-8 text-xs font-bold rounded-lg border-muted/50" id="rows-per-page">
                        <SelectValue placeholder={table.getState().pagination.pageSize} />
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
            <div className="flex items-center justify-center text-xs font-bold uppercase tracking-tighter opacity-80">
                Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount() || 1}
            </div>
            <div className="flex items-center gap-1.5">
                <Button
                    variant="outline"
                    className="hidden h-8 w-8 p-0 lg:flex shadow-none border-muted-foreground/20 rounded-lg"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                >
                    <IconChevronsLeft size={16} />
                </Button>
                <Button
                    variant="outline"
                    className="h-8 w-8 p-0 shadow-none border-muted-foreground/20 rounded-lg"
                    size="icon"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    <IconChevronLeft size={16} />
                </Button>
                <Button
                    variant="outline"
                    className="h-8 w-8 p-0 shadow-none border-muted-foreground/20 rounded-lg"
                    size="icon"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                    <IconChevronRight size={16} />
                </Button>
                <Button
                    variant="outline"
                    className="hidden h-8 w-8 p-0 lg:flex shadow-none border-muted-foreground/20 rounded-lg"
                    size="icon"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                >
                    <IconChevronsRight size={16} />
                </Button>
            </div>
          </div>
      </div>
    </div>
  )
}
