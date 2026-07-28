"use client";
import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/constants";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import {
  IconPlus, IconPencil, IconTrash, IconDotsVertical,
  IconUsers, IconDeviceFloppy, IconDownload, IconLoader2,
  IconEye, IconWorld, IconChartBar, IconTag, IconChevronUp, IconChevronDown
} from "@tabler/icons-react";
import { toast } from "sonner";
import { PosTable } from "@/components/pos-table";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";

const API = API_URL;

type ClientePetgo = {
  id: number;
  nombre: string;
  telefono: string;
  producto: string;
  createdAt: string;
  visitorId: string | null;
  visitsCount: number;
  lastVisit: VisitaPetgo | null;
};

type VisitaPetgo = {
  id: number;
  createdAt: string;
  userAgent: string | null;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  fbclid: string | null;
  visitorId: string | null;
  ipAddress: string | null;
  tiempo_pagina: number | null;
  formulario_iniciado: boolean | null;
  formulario_completado: boolean | null;
  cantidad_clics: number | null;
  hizo_scroll: boolean | null;
  scroll_maximo: number | null;
};

const emptyForm = { nombre: "", telefono: "", producto: "", visitorId: "" };

const formatTimeOnPage = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds <= 0) return "0s";
  const totalSecs = Math.round(seconds);
  if (totalSecs >= 60) {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${totalSecs}s`;
};

export default function ClientesPetgoPage() {
  const [clientes, setClientes] = useState<ClientePetgo[]>([]);
  const [visitas, setVisitas] = useState<VisitaPetgo[]>([]);
  const [activeTab, setActiveTab] = useState("clientes");
  
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingVisitas, setLoadingVisitas] = useState(true);
  
  // Client Modal
  const [openClientModal, setOpenClientModal] = useState(false);
  const [clientForm, setClientForm] = useState(emptyForm);
  const [editClientId, setEditClientId] = useState<number | null>(null);
  const [savingClient, setSavingClient] = useState(false);
  
  // Single Client Visits Modal
  const [openVisitsModal, setOpenVisitsModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientePetgo | null>(null);
  const [clientVisits, setClientVisits] = useState<VisitaPetgo[]>([]);
  const [loadingClientVisits, setLoadingClientVisits] = useState(false);

  const [rowSelectionClientes, setRowSelectionClientes] = useState<Record<string, boolean>>({});
  const [rowSelectionVisitas, setRowSelectionVisitas] = useState<Record<string, boolean>>({});

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // Fetch Clientes
  const loadClientes = useCallback(async () => {
    setLoadingClientes(true);
    try {
      const res = await fetch(`${API}/landings/clientes-petgo`, { headers });
      if (!res.ok) throw new Error("No se pudo obtener la información de los clientes.");
      const data = await res.json();
      setClientes(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e.message || "Error al cargar los clientes Petgo");
    } finally {
      setLoadingClientes(false);
    }
  }, []);

  // Fetch Visitas
  const loadVisitas = useCallback(async () => {
    setLoadingVisitas(true);
    try {
      const res = await fetch(`${API}/landings/visitas-petgo`, { headers });
      if (!res.ok) throw new Error("No se pudo obtener el historial de visitas.");
      const data = await res.json();
      setVisitas(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e.message || "Error al cargar el historial de visitas");
    } finally {
      setLoadingVisitas(false);
    }
  }, []);

  useEffect(() => {
    loadClientes();
    loadVisitas();
  }, [loadClientes, loadVisitas]);

  // Client actions
  const openCreateClient = () => { 
    setClientForm(emptyForm); 
    setEditClientId(null); 
    setOpenClientModal(true); 
  };
  
  const openEditClient = (c: ClientePetgo) => {
    setClientForm({ 
      nombre: c.nombre, 
      telefono: c.telefono, 
      producto: c.producto, 
      visitorId: c.visitorId || "" 
    });
    setEditClientId(c.id);
    setOpenClientModal(true);
  };

  const handleSaveClient = async () => {
    if (!clientForm.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (!clientForm.telefono.trim()) { toast.error("El teléfono es obligatorio"); return; }
    if (!clientForm.producto.trim()) { toast.error("El producto es obligatorio"); return; }
    
    setSavingClient(true);
    try {
      const url = editClientId ? `${API}/landings/clientes-petgo/${editClientId}` : `${API}/landings/clientes-petgo`;
      const method = editClientId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          ...clientForm,
          visitorId: clientForm.visitorId.trim() || null
        }),
      });
      if (res.ok) {
        toast.success(editClientId ? `Cliente actualizado correctamente` : `Cliente registrado correctamente`);
        setOpenClientModal(false);
        loadClientes();
        loadVisitas(); // Reload visits in case visitor_id association changed
      } else {
        const errorData = await res.json();
        toast.error(errorData?.message || "Error al guardar el cliente");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingClient(false);
    }
  };

  const handleDeleteClient = async (id: number, nombre: string) => {
    if (!confirm(`¿Estás seguro de eliminar al cliente "${nombre}"?`)) return;
    try {
      const res = await fetch(`${API}/landings/clientes-petgo/${id}`, { method: "DELETE", headers });
      if (res.ok) {
        toast.success(`Cliente "${nombre}" eliminado`);
        loadClientes();
      } else {
        toast.error("Error al eliminar el cliente");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleBulkDeleteClientes = async () => {
    const selectedIds = Object.keys(rowSelectionClientes);
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(`¿Estás seguro de eliminar ${selectedIds.length} clientes seleccionados?`);
    if (!confirmed) return;

    toast.promise(
      async () => {
        let successCount = 0;
        let failCount = 0;

        for (const id of selectedIds) {
          try {
            const res = await fetch(`${API}/landings/clientes-petgo/${id}`, {
              method: "DELETE",
              headers
            });
            if (res.ok) successCount++;
            else failCount++;
          } catch (e) {
            failCount++;
          }
        }

        setRowSelectionClientes({});
        loadClientes();
        
        if (failCount > 0) {
          throw new Error(`Se eliminaron ${successCount} clientes, pero ${failCount} fallaron.`);
        }
        return true;
      },
      {
        loading: "Eliminando clientes seleccionados...",
        success: "Clientes eliminados correctamente",
        error: (err) => err.message,
      }
    );
  };

  // Visita actions
  const handleDeleteVisita = async (id: number) => {
    if (!confirm(`¿Estás seguro de eliminar esta visita del historial?`)) return;
    try {
      const res = await fetch(`${API}/landings/visitas-petgo/${id}`, { method: "DELETE", headers });
      if (res.ok) {
        toast.success(`Registro de visita eliminado`);
        loadVisitas();
        loadClientes(); // Reload counts
      } else {
        toast.error("Error al eliminar la visita");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleBulkDeleteVisitas = async () => {
    const selectedIds = Object.keys(rowSelectionVisitas);
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(`¿Estás seguro de eliminar ${selectedIds.length} visitas seleccionadas?`);
    if (!confirmed) return;

    toast.promise(
      async () => {
        let successCount = 0;
        let failCount = 0;

        for (const id of selectedIds) {
          try {
            const res = await fetch(`${API}/landings/visitas-petgo/${id}`, {
              method: "DELETE",
              headers
            });
            if (res.ok) successCount++;
            else failCount++;
          } catch (e) {
            failCount++;
          }
        }

        setRowSelectionVisitas({});
        loadVisitas();
        loadClientes();
        
        if (failCount > 0) {
          throw new Error(`Se eliminaron ${successCount} visitas, pero ${failCount} fallaron.`);
        }
        return true;
      },
      {
        loading: "Eliminando visitas seleccionadas...",
        success: "Visitas eliminadas correctamente",
        error: (err) => err.message,
      }
    );
  };

  // View individual client visits
  const openClientVisits = async (client: ClientePetgo) => {
    setSelectedClient(client);
    setOpenVisitsModal(true);
    setLoadingClientVisits(true);
    try {
      const res = await fetch(`${API}/landings/clientes-petgo/${client.id}/visitas`, { headers });
      if (!res.ok) throw new Error("No se pudo obtener el historial de visitas del cliente.");
      const data = await res.json();
      setClientVisits(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e.message || "Error al cargar visitas del cliente");
      setClientVisits([]);
    } finally {
      setLoadingClientVisits(false);
    }
  };

  // Excel exports
  const handleExportClientes = () => {
    try {
      const selectedIds = Object.keys(rowSelectionClientes);
      const isSelected = selectedIds.length > 0;
      const itemsToExport = isSelected 
        ? clientes.filter(c => selectedIds.includes(String(c.id))) 
        : clientes;

      if (itemsToExport.length === 0) return toast.info("No hay datos para exportar");

      const dataToExport = itemsToExport.map(c => ({
        ID: c.id,
        Nombre: c.nombre,
        Teléfono: c.telefono,
        Producto: c.producto,
        "Visitor ID": c.visitorId || "—",
        "Cant. Visitas": c.visitsCount,
        "Último Origen UTM": c.lastVisit ? `${c.lastVisit.utmSource || "orgánico"} / ${c.lastVisit.utmMedium || "link"}` : "—",
        "Última Campaña": c.lastVisit?.utmCampaign || "—",
        "Fecha Registro": c.createdAt ? new Date(c.createdAt).toLocaleString('es-ES') : ""
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "ClientesPetgo");
      XLSX.writeFile(wb, `Clientes_Petgo_${isSelected ? 'Seleccion_' : ''}${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(isSelected ? "Clientes seleccionados exportados" : "Todos los clientes exportados");
    } catch (e) {
      toast.error("Error al exportar clientes");
    }
  };

  const handleExportVisitas = () => {
    try {
      const selectedIds = Object.keys(rowSelectionVisitas);
      const isSelected = selectedIds.length > 0;
      const itemsToExport = isSelected 
        ? visitas.filter(v => selectedIds.includes(String(v.id))) 
        : visitas;

      if (itemsToExport.length === 0) return toast.info("No hay datos para exportar");

      const dataToExport = itemsToExport.map(v => {
        const client = clientes.find(c => c.visitorId === v.visitorId);
        let formStatus = "No inició";
        if (v.formulario_completado) formStatus = "Completó";
        else if (v.formulario_iniciado) formStatus = "Inició";

        return {
          ID: v.id,
          Fecha: v.createdAt ? new Date(v.createdAt).toLocaleString('es-ES') : "",
          "IP Address": v.ipAddress || "—",
          Device: v.deviceType || "—",
          OS: v.os || "—",
          Browser: v.browser || "—",
          "UTM Source": v.utmSource || "—",
          "UTM Medium": v.utmMedium || "—",
          "UTM Campaign": v.utmCampaign || "—",
          Referrer: v.referrer || "—",
          "Tiempo en Página": formatTimeOnPage(v.tiempo_pagina),
          "Clics": v.cantidad_clics ?? 0,
          "Scroll Máx": v.scroll_maximo ? `${v.scroll_maximo}%` : "0%",
          "Formulario": formStatus,
          "Visitor ID": v.visitorId || "—",
          "Cliente Asociado": client ? client.nombre : "Anónimo"
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "VisitasPetgo");
      XLSX.writeFile(wb, `Visitas_Petgo_${isSelected ? 'Seleccion_' : ''}${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(isSelected ? "Visitas seleccionadas exportadas" : "Todo el historial de visitas exportado");
    } catch (e) {
      toast.error("Error al exportar visitas");
    }
  };

  // Helper format for traffic origin badge
  const getTrafficSource = (visit: VisitaPetgo | null, visitorId: string | null) => {
    if (!visitorId) return <span className="text-xs text-muted-foreground italic">Carga Manual</span>;
    if (!visit) return <span className="text-xs text-muted-foreground">Sin visitas</span>;
    
    const source = visit.utmSource || "";
    const medium = visit.utmMedium || "";
    const campaign = visit.utmCampaign || "";

    if (source || medium || campaign) {
      return (
        <div className="flex flex-col">
          <span className="font-semibold text-xs text-primary max-w-[150px] truncate">
            {source || "social"} / {medium || "cpc"}
          </span>
          {campaign && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={campaign}>
              Campaña: {campaign}
            </span>
          )}
        </div>
      );
    }

    if (visit.referrer && !visit.referrer.includes("localhost") && !visit.referrer.includes("127.0.0.1")) {
      try {
        const url = new URL(visit.referrer);
        return <span className="text-xs font-medium text-emerald-600 truncate max-w-[150px]" title={visit.referrer}>Ref: {url.hostname}</span>;
      } catch {
        return <span className="text-xs font-medium text-emerald-600 truncate max-w-[150px]">Ref: Orgánico</span>;
      }
    }

    return <span className="text-xs text-muted-foreground">Directo / Sin UTM</span>;
  };

  // Columns for Clientes
  const columnsClientes: ColumnDef<ClientePetgo>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "nombre",
      header: "Nombre",
      cell: ({ row }) => (
        <div className="flex items-center gap-3 font-medium">
          <div className="bg-primary/10 text-primary rounded-lg p-2 shrink-0">
            <IconUsers size={18} />
          </div>
          {row.original.nombre}
        </div>
      ),
    },
    {
      accessorKey: "telefono",
      header: "Teléfono",
      cell: ({ row }) => <span className="text-sm font-mono text-muted-foreground">{row.original.telefono}</span>,
    },
    {
      accessorKey: "producto",
      header: "Producto Interesado",
      cell: ({ row }) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 max-w-[320px] break-words whitespace-normal" title={row.original.producto}>
          {row.original.producto}
        </span>
      ),
    },
    {
      id: "trafficSource",
      header: "Origen / Campaña",
      cell: ({ row }) => getTrafficSource(row.original.lastVisit, row.original.visitorId),
    },
    {
      accessorKey: "visitsCount",
      header: "Visitas",
      cell: ({ row }) => {
        const count = row.original.visitsCount;
        const client = row.original;
        
        if (count === 0) {
          return <span className="text-xs text-muted-foreground font-semibold">0 visitas</span>;
        }
        
        return (
          <button 
            onClick={() => openClientVisits(client)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition"
            title="Ver historial de visitas"
          >
            <IconChartBar size={12} />
            {count} {count === 1 ? 'visita' : 'visitas'}
          </button>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Registro",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.createdAt ? new Date(row.original.createdAt).toLocaleString('es-ES', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          }) : "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <IconDotsVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {c.visitorId && (
                <DropdownMenuItem onClick={() => openClientVisits(c)}>
                  <IconEye size={13} className="mr-2 text-primary" /> Ver Visitas
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => openEditClient(c)}>
                <IconPencil size={13} className="mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => handleDeleteClient(c.id, c.nombre)}>
                <IconTrash size={13} className="mr-2" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  // Columns for Visitas
  const columnsVisitas: ColumnDef<VisitaPetgo>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        const isSorted = column.getIsSorted();
        return (
          <button
            onClick={() => column.toggleSorting(isSorted === "asc")}
            className="flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            Fecha / Hora
            {isSorted === "asc" ? (
              <IconChevronUp size={14} className="ml-1 text-primary shrink-0" />
            ) : isSorted === "desc" ? (
              <IconChevronDown size={14} className="ml-1 text-primary shrink-0" />
            ) : (
              <IconChevronDown size={14} className="ml-1 opacity-30 shrink-0" />
            )}
          </button>
        );
      },
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-muted-foreground">
          {row.original.createdAt ? new Date(row.original.createdAt).toLocaleString('es-ES') : "—"}
        </span>
      ),
    },
    {
      id: "clientLink",
      header: "Cliente Asociado",
      cell: ({ row }) => {
        const v = row.original;
        const matchedClient = clientes.find(c => c.visitorId === v.visitorId);
        if (matchedClient) {
          return (
            <div className="flex items-center gap-1.5 font-bold text-xs text-[#039CDE]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              {matchedClient.nombre}
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-300"></span>
            Anónimo / Tráfico
          </div>
        );
      },
    },
    {
      id: "deviceInfo",
      header: "Dispositivo & OS",
      cell: ({ row }) => {
        const v = row.original;
        return (
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground">{v.deviceType || "Desktop"}</span>
            <span className="text-[10px] text-muted-foreground">{v.os || "Unknown OS"} • {v.browser || "Browser"}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "ipAddress",
      header: "IP Address",
      cell: ({ row }) => <span className="text-xs font-mono text-muted-foreground">{row.original.ipAddress || "—"}</span>,
    },
    {
      id: "utmInfo",
      header: "Parámetros UTM",
      cell: ({ row }) => {
        const v = row.original;
        if (!v.utmSource && !v.utmCampaign) return <span className="text-xs text-muted-foreground italic">—</span>;
        return (
          <div className="flex flex-col text-[11px] leading-tight">
            {v.utmSource && <span className="font-semibold text-primary">Fuente: {v.utmSource} ({v.utmMedium || 'cpc'})</span>}
            {v.utmCampaign && <span className="text-muted-foreground">Camp: {v.utmCampaign}</span>}
          </div>
        );
      },
    },
    {
      accessorKey: "referrer",
      header: "Referente (Referrer)",
      cell: ({ row }) => {
        const ref = row.original.referrer;
        if (!ref) return <span className="text-xs text-muted-foreground italic">Tráfico Directo</span>;
        
        try {
          const url = new URL(ref);
          return <span className="text-xs text-muted-foreground truncate max-w-[180px] block" title={ref}>{url.hostname}{url.pathname !== '/' ? url.pathname : ''}</span>;
        } catch {
          return <span className="text-xs text-muted-foreground truncate max-w-[180px] block" title={ref}>{ref}</span>;
        }
      },
    },
    {
      accessorKey: "tiempo_pagina",
      header: ({ column }) => {
        const isSorted = column.getIsSorted();
        return (
          <button
            onClick={() => column.toggleSorting(isSorted === "asc")}
            className="flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            Tiempo en página
            {isSorted === "asc" ? (
              <IconChevronUp size={14} className="ml-1 text-primary shrink-0" />
            ) : isSorted === "desc" ? (
              <IconChevronDown size={14} className="ml-1 text-primary shrink-0" />
            ) : (
              <IconChevronDown size={14} className="ml-1 opacity-30 shrink-0" />
            )}
          </button>
        );
      },
      cell: ({ row }) => {
        const val = row.original.tiempo_pagina;
        return <span className="text-xs font-medium text-foreground">{formatTimeOnPage(val)}</span>;
      }
    },
    {
      accessorKey: "cantidad_clics",
      header: "Clics",
      cell: ({ row }) => {
        const val = row.original.cantidad_clics;
        return <span className="text-xs text-muted-foreground font-mono">{val !== null && val !== undefined ? val : 0}</span>;
      }
    },
    {
      accessorKey: "scroll_maximo",
      header: ({ column }) => {
        const isSorted = column.getIsSorted();
        return (
          <button
            onClick={() => column.toggleSorting(isSorted === "asc")}
            className="flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            Scroll máx.
            {isSorted === "asc" ? (
              <IconChevronUp size={14} className="ml-1 text-primary shrink-0" />
            ) : isSorted === "desc" ? (
              <IconChevronDown size={14} className="ml-1 text-primary shrink-0" />
            ) : (
              <IconChevronDown size={14} className="ml-1 opacity-30 shrink-0" />
            )}
          </button>
        );
      },
      cell: ({ row }) => {
        const val = row.original.scroll_maximo;
        return <span className="text-xs font-semibold text-foreground">{val !== null && val !== undefined ? `${val}%` : "0%"}</span>;
      }
    },
    {
      id: "formularioEstado",
      header: "Formulario",
      cell: ({ row }) => {
        const iniciado = row.original.formulario_iniciado;
        const completado = row.original.formulario_completado;
        if (completado) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              Completó
            </span>
          );
        }
        if (iniciado) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              Inició
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            No inició
          </span>
        );
      }
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const v = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <IconDotsVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem variant="destructive" onClick={() => handleDeleteVisita(v.id)}>
                <IconTrash size={13} className="mr-2" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text">
            Analíticas & Clientes de Petgo
          </h1>
          <p className="text-muted-foreground text-sm">
            Control de prospectos y visitas capturadas desde la landing page comercial
          </p>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs defaultValue="clientes" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 border rounded-xl w-fit">
          <TabsTrigger value="clientes" className="rounded-lg font-bold text-xs flex gap-1.5 items-center px-4 py-2">
            <IconUsers size={15} /> Clientes ({clientes.length})
          </TabsTrigger>
          <TabsTrigger value="visitas" className="rounded-lg font-bold text-xs flex gap-1.5 items-center px-4 py-2">
            <IconWorld size={15} /> Historial de Visitas ({visitas.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: CLIENTES */}
        <TabsContent value="clientes" className="mt-0 border-0 focus-visible:ring-0 focus-visible:ring-offset-0">
          <PosTable
            columns={columnsClientes}
            data={clientes}
            loading={loadingClientes}
            rowSelection={rowSelectionClientes}
            onRowSelectionChange={setRowSelectionClientes}
            getRowId={(row) => String(row.id)}
            searchPlaceholder="Buscar clientes por nombre, teléfono o producto..."
            bulkActions={
              Object.keys(rowSelectionClientes).length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-8 gap-2 font-bold text-xs"
                  onClick={handleBulkDeleteClientes}
                >
                  <IconTrash size={14} /> Eliminar Seleccionados ({Object.keys(rowSelectionClientes).length})
                </Button>
              )
            }
            actions={
              <div className="flex items-center gap-2">
                <Button variant="outline" className="gap-2 border-primary/20 text-muted-foreground" onClick={handleExportClientes}>
                  <IconDownload size={16} /> Exportar Clientes
                </Button>
                <Button className="gap-2" onClick={openCreateClient}>
                  <IconPlus size={16} /> Nuevo Cliente
                </Button>
              </div>
            }
          />
        </TabsContent>

        {/* Tab 2: VISITAS */}
        <TabsContent value="visitas" className="mt-0 border-0 focus-visible:ring-0 focus-visible:ring-offset-0">
          <PosTable
            columns={columnsVisitas}
            data={visitas}
            loading={loadingVisitas}
            rowSelection={rowSelectionVisitas}
            onRowSelectionChange={setRowSelectionVisitas}
            getRowId={(row) => String(row.id)}
            searchPlaceholder="Buscar visitas por IP, dispositivo, OS, Browser o Referer..."
            bulkActions={
              Object.keys(rowSelectionVisitas).length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-8 gap-2 font-bold text-xs"
                  onClick={handleBulkDeleteVisitas}
                >
                  <IconTrash size={14} /> Eliminar Seleccionadas ({Object.keys(rowSelectionVisitas).length})
                </Button>
              )
            }
            actions={
              <div className="flex items-center gap-2">
                <Button variant="outline" className="gap-2 border-primary/20 text-muted-foreground" onClick={handleExportVisitas}>
                  <IconDownload size={16} /> Exportar Historial
                </Button>
              </div>
            }
          />
        </TabsContent>
      </Tabs>

      {/* DIALOG MODAL: CREATE / EDIT CLIENT */}
      <Dialog open={openClientModal} onOpenChange={setOpenClientModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconUsers size={20} /> {editClientId ? "Editar Cliente Petgo" : "Registrar Nuevo Cliente Petgo"}
            </DialogTitle>
            <DialogDescription>
              {editClientId 
                ? "Modifica la información básica y el identificador de rastreo del cliente." 
                : "Ingresa los datos para registrar un cliente de forma manual."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nombre Completo *</Label>
              <Input
                placeholder="Ej: Juan Pérez"
                value={clientForm.nombre}
                onChange={e => setClientForm(p => ({ ...p, nombre: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Teléfono *</Label>
              <Input
                placeholder="Ej: 04121234567"
                value={clientForm.telefono}
                onChange={e => setClientForm(p => ({ ...p, telefono: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Producto Interesado *</Label>
              <Input
                placeholder="Ej: Arnés Antitirones, Snack Premium..."
                value={clientForm.producto}
                onChange={e => setClientForm(p => ({ ...p, producto: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Visitor ID (Tracking / Opcional)</Label>
              <Input
                placeholder="Ej: vis_ph4bhjvpssmaynv..."
                value={clientForm.visitorId}
                onChange={e => setClientForm(p => ({ ...p, visitorId: e.target.value }))}
              />
              <span className="text-[10px] text-muted-foreground">
                Úsalo para vincular el registro manual con su historial de visitas en la web.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveClient} disabled={savingClient} className="gap-2">
              <IconDeviceFloppy size={16} />
              {savingClient ? "Guardando..." : editClientId ? "Actualizar" : "Registrar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG MODAL: DETAILED VISITS OF A SPECIFIC CLIENT */}
      <Dialog open={openVisitsModal} onOpenChange={setOpenVisitsModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] w-[95vw] flex flex-col p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <IconChartBar size={22} className="text-primary" /> Historial de Visitas: {selectedClient?.nombre}
            </DialogTitle>
            <DialogDescription>
              Mostrando la cronología de navegación web para el Visitor ID: <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs text-foreground font-semibold">{selectedClient?.visitorId}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Table Container scrollable */}
          <div className="flex-1 overflow-auto min-h-[300px] border rounded-xl mt-4">
            {loadingClientVisits ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Cargando historial de visitas...</p>
              </div>
            ) : clientVisits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <IconWorld className="h-10 w-10 text-muted-foreground/60" />
                <h3 className="font-semibold text-base text-muted-foreground">Sin registros de visitas</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Este cliente no registra visitas web vinculadas con su Visitor ID.
                </p>
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-muted/70 sticky top-0 border-b">
                  <tr>
                    <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha / Hora</th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Dispositivo / OS</th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Navegador</th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">IP</th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">UTM / Campaña</th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Referente</th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Tiempo en página</th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Clics</th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Scroll máx.</th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Formulario</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clientVisits.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/30 transition">
                      <td className="p-3 text-xs font-semibold whitespace-nowrap">
                        {v.createdAt ? new Date(v.createdAt).toLocaleString('es-ES') : "—"}
                      </td>
                      <td className="p-3 text-xs">
                        <span className="font-medium">{v.deviceType || "Desktop"}</span>
                        <span className="block text-[10px] text-muted-foreground">{v.os || "Unknown OS"}</span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{v.browser || "—"}</td>
                      <td className="p-3 text-xs font-mono text-muted-foreground">{v.ipAddress || "—"}</td>
                      <td className="p-3 text-xs">
                        {v.utmSource || v.utmCampaign ? (
                          <div className="flex flex-col text-[10px] leading-tight">
                            {v.utmSource && <span className="font-semibold text-primary">{v.utmSource} ({v.utmMedium || 'cpc'})</span>}
                            {v.utmCampaign && <span className="text-muted-foreground">{v.utmCampaign}</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate" title={v.referrer || ""}>
                        {v.referrer ? (v.referrer.includes("http") ? new URL(v.referrer).hostname : v.referrer) : "Directo"}
                      </td>
                      <td className="p-3 text-xs font-medium text-foreground">
                        {formatTimeOnPage(v.tiempo_pagina)}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground font-mono">
                        {v.cantidad_clics !== null && v.cantidad_clics !== undefined ? v.cantidad_clics : 0}
                      </td>
                      <td className="p-3 text-xs font-semibold text-foreground">
                        {v.scroll_maximo !== null && v.scroll_maximo !== undefined ? `${v.scroll_maximo}%` : "0%"}
                      </td>
                      <td className="p-3 text-xs">
                        {v.formulario_completado ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            Completó
                          </span>
                        ) : v.formulario_iniciado ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            Inició
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                            No inició
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter className="shrink-0 mt-4">
            <DialogClose asChild>
              <Button variant="outline" className="font-bold">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
