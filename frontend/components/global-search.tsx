"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconPackage,
  IconBox,
  IconTruck,
  IconShoppingCart,
  IconReportAnalytics,
  IconUsers,
  IconCash,
  IconHistory,
  IconSettings,
  IconHelp,
  IconLayoutDashboard,
  IconCategory,
  IconTruckLoading,
  IconArrowsExchange,
  IconAlertTriangle,
  IconListCheck,
  IconReceipt2,
  IconCreditCard,
  IconUserCircle,
  IconFileText,
} from "@tabler/icons-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, onOpenChange])

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false)
      command()
    },
    [onOpenChange]
  )

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Escribe para buscar en el sistema..." />
      <CommandList>
        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
        <CommandGroup heading="Acceso rápido">
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
            <IconLayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard principal</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/pos"))}>
            <IconShoppingCart className="mr-2 h-4 w-4" />
            <span>Punto de venta (POS)</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ventas y clientes">
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/clientes"))}>
            <IconUsers className="mr-2 h-4 w-4" />
            <span>Clientes / directorio</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/clientes/creditos"))}>
            <IconCreditCard className="mr-2 h-4 w-4" />
            <span>Cuentas por cobrar (fiados)</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/historial"))}>
            <IconHistory className="mr-2 h-4 w-4" />
            <span>Historial de ventas</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Inventario y productos">
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/productos/todos"))}>
            <IconPackage className="mr-2 h-4 w-4" />
            <span>Todos los productos</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/productos/categorias"))}>
            <IconCategory className="mr-2 h-4 w-4" />
            <span>Categorías de productos</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/inventario/almacen"))}>
            <IconBox className="mr-2 h-4 w-4" />
            <span>Almacén / stock actual</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/inventario/compras"))}>
            <IconTruckLoading className="mr-2 h-4 w-4" />
            <span>Órdenes de compra</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/inventario/traslados"))}>
            <IconArrowsExchange className="mr-2 h-4 w-4" />
            <span>Traslados entre sucursales</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/inventario/alertas"))}>
            <IconAlertTriangle className="mr-2 h-4 w-4" />
            <span>Alertas de stock bajo</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/inventario/movimientos"))}>
            <IconFileText className="mr-2 h-4 w-4" />
            <span>Kardex / movimientos</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Administración">
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/proveedores"))}>
            <IconTruck className="mr-2 h-4 w-4" />
            <span>Proveedores</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/contabilidad/gastos"))}>
            <IconReceipt2 className="mr-2 h-4 w-4" />
            <span>Gastos y caja chica</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/reportes"))}>
            <IconReportAnalytics className="mr-2 h-4 w-4" />
            <span>Reportes y estadísticas</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Sistema">
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/configuracion"))}>
            <IconSettings className="mr-2 h-4 w-4" />
            <span>Configuración del sistema</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/facturacion"))}>
            <IconCreditCard className="mr-2 h-4 w-4" />
            <span>Mi suscripción / facturación SaaS</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/cuenta"))}>
            <IconUserCircle className="mr-2 h-4 w-4" />
            <span>Mi perfil / cuenta</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
