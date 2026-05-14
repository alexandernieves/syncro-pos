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
        <CommandGroup heading="Acceso Rápido">
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
            <IconLayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard Principal</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/pos"))}>
            <IconShoppingCart className="mr-2 h-4 w-4" />
            <span>Punto de Venta (POS)</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ventas y Clientes">
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/clientes"))}>
            <IconUsers className="mr-2 h-4 w-4" />
            <span>Clientes / Directorio</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/clientes/creditos"))}>
            <IconCreditCard className="mr-2 h-4 w-4" />
            <span>Cuentas por Cobrar (Fiados)</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/historial"))}>
            <IconHistory className="mr-2 h-4 w-4" />
            <span>Historial de Ventas</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Inventario y Productos">
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/productos/todos"))}>
            <IconPackage className="mr-2 h-4 w-4" />
            <span>Todos los Productos</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/productos/categorias"))}>
            <IconCategory className="mr-2 h-4 w-4" />
            <span>Categorías de Productos</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/inventario/almacen"))}>
            <IconBox className="mr-2 h-4 w-4" />
            <span>Almacén / Stock Actual</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/inventario/compras"))}>
            <IconTruckLoading className="mr-2 h-4 w-4" />
            <span>Órdenes de Compra</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/inventario/traslados"))}>
            <IconArrowsExchange className="mr-2 h-4 w-4" />
            <span>Traslados entre Sucursales</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/inventario/alertas"))}>
            <IconAlertTriangle className="mr-2 h-4 w-4" />
            <span>Alertas de Stock Bajo</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/inventario/movimientos"))}>
            <IconFileText className="mr-2 h-4 w-4" />
            <span>Kardex / Movimientos</span>
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
            <span>Gastos y Caja Chica</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/reportes"))}>
            <IconReportAnalytics className="mr-2 h-4 w-4" />
            <span>Reportes y Estadísticas</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Sistema">
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/configuracion"))}>
            <IconSettings className="mr-2 h-4 w-4" />
            <span>Configuración del Sistema</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/facturacion"))}>
            <IconCreditCard className="mr-2 h-4 w-4" />
            <span>Mi Suscripción / Facturación SaaS</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard/cuenta"))}>
            <IconUserCircle className="mr-2 h-4 w-4" />
            <span>Mi Perfil / Cuenta</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
