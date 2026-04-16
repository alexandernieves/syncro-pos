"use client";

import React, { useState, useEffect } from "react";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction, CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  IconTruck, IconSearch, IconBuildingStore, IconPackage, IconExternalLink, IconPhone, IconPlus, IconFilter, IconMail, IconMapPin, IconDotsVertical, IconBriefcase, IconCalendar,
  IconTrendingUp, IconTrendingDown, IconCurrencyDollar, IconAlertTriangle, IconClock, IconReceipt, IconArrowUpRight, IconArrowDownRight, IconCheck, IconX, IconDownload
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { UniversalTable } from "@/components/universal-table";
import { getSuppliersColumns } from "@/components/suppliers-columns";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

const FORM_INITIAL_STATE = {
  name: "",
  taxId: "", // RIF
  phone: "",
  email: "",
  address: "",
  status: "active",
  contactPerson: "",
  paymentType: "contado",
  creditDays: 0,
  currency: "USD",
  taxType: "ORDINARIO", // ORDINARIO, ESPECIAL, EXENTO
  bankName: "",
  bankAccount: "",
  bankId: "", // Cédula/RIF del titular
  bankPhone: "", // Para Pago Móvil
};

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState(FORM_INITIAL_STATE);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [alertsSummary, setAlertsSummary] = useState<any>(null);

  useEffect(() => {
    fetchSuppliers();
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/suppliers/alerts/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) setAlertsSummary(await res.json());
    } catch (error) {
      console.error("Error fetching alerts", error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/suppliers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setSuppliers(await res.json());
      }
    } catch (error) {
      toast.error("Error al cargar proveedores");
    } finally {
      setLoading(false);
    }
  };

  const tableData = React.useMemo(() => {
    return suppliers.map((sup: any, index: number) => ({
      id: sup.id || sup._id || index,
      header: JSON.stringify({
        name: sup.name,
        category: "Proveedor Master"
      }),
      type: JSON.stringify({
        taxId: sup.taxId || sup.rif || "N/A"
      }),
      status: JSON.stringify({
        status: sup.status || "active"
      }),
      target: JSON.stringify({
        email: sup.email,
        phone: sup.phone
      }),
      limit: JSON.stringify({
        productsCount: sup.productsCount || sup.products?.length || 0
      }),
      reviewer: "actions",
      raw: sup
    }));
  }, [suppliers]);

  const handleCreate = async () => {
    try {
      if (!formData.name) {
        toast.error("El nombre es obligatorio");
        return;
      }

      const method = editingSupplierId ? "PATCH" : "POST";
      const url = editingSupplierId 
        ? `${API}/suppliers/${editingSupplierId}` 
        : `${API}/suppliers`;

      // Map frontend fields to backend schema
      const payload = {
        name: formData.name,
        taxId: formData.taxId,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        status: formData.status.toUpperCase(),
        contactName: formData.contactPerson,
        paymentTerms: formData.paymentType.toUpperCase(),
        creditDays: formData.creditDays,
        currency: formData.currency,
        notes: `SENIAT: ${formData.taxType}, Pago Móvil: ${formData.bankPhone}, Banco: ${formData.bankName}`
      };

      const token = localStorage.getItem("token");
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(editingSupplierId ? "Proveedor actualizado" : "Proveedor creado");
        setIsDialogOpen(false);
        setFormData(FORM_INITIAL_STATE);
        setEditingSupplierId(null);
        fetchSuppliers();
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || "Error al procesar la solicitud");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error de conexión");
    }
  };

  const handleEditClick = (supplier: any) => {
    // raw data is passed from the table
    setEditingSupplierId(supplier.id);
    setFormData({
      ...FORM_INITIAL_STATE,
      name: supplier.name || "",
      taxId: supplier.taxId || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      status: (supplier.status || "ACTIVE").toLowerCase(),
      contactPerson: supplier.contactName || "",
      paymentType: (supplier.paymentTerms || "CONTADO").toLowerCase(),
      creditDays: supplier.creditDays || 0,
      currency: supplier.currency || "USD",
      taxType: supplier.taxType || "ORDINARIO",
      bankName: supplier.bankName || "",
      bankAccount: supplier.bankAccount || "",
      bankId: supplier.bankId || "",
      bankPhone: supplier.bankPhone || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Está seguro de eliminar este proveedor?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/suppliers/${id}`, { 
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        toast.success("Proveedor eliminado");
        fetchSuppliers();
      }
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleExport = () => {
    const headers = ["Nombre", "RIF", "Email", "Teléfono", "Dirección", "Estatus"];
    const csvData = suppliers.map(s => [
      s.name, s.taxId, s.email, s.phone, s.address, s.status
    ].join(","));
    
    const blob = new Blob([[headers.join(","), ...csvData].join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proveedores_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-6 py-4 md:gap-8 md:py-6 font-sans">
      
    <div className="flex flex-col gap-6 w-full">
      {/* Top Banner Stats */}
      {alertsSummary && (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* Deuda Total / Balance */}
      <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
        <CardHeader>
          <CardDescription>Pasivos Totales</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            ${(alertsSummary?.summary?.totalBalance || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1">
              <IconTrendingDown className="size-3 text-red-500" />
              Creditos
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Facturas pendientes {(alertsSummary?.summary?.pendingInvoices || 0)}
          </div>
          <div className="text-muted-foreground">
            Balance acumulado en divisas
          </div>
        </CardFooter>
      </Card>

      {/* Proveedores Críticos */}
      <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
        <CardHeader>
          <CardDescription>Alertas Críticas</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-rose-600">
            {alertsSummary?.summary?.critical || 0}
          </CardTitle>
          <CardAction>
            <Badge variant="destructive" className="animate-pulse">
              Prioridad
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-rose-600">
            Atención necesaria <IconAlertTriangle className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Suministros o facturas vencidas
          </div>
        </CardFooter>
      </Card>

      {/* Cuentas Activas */}
      <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
        <CardHeader>
          <CardDescription>Proveedores Activos</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {suppliers.length}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1">
              <IconTrendingUp className="size-3 text-emerald-500" />
              Estable
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {suppliers.filter(s => s.status === 'ACTIVE').length} En operación dinámica
          </div>
          <div className="text-muted-foreground">Directorio general actualizado</div>
        </CardFooter>
      </Card>

      {/* Confiabilidad */}
      <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
        <CardHeader>
          <CardDescription>Tasa de Cumplimiento</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-emerald-600">
            98.5%
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1">
              <IconTrendingUp className="size-3 text-emerald-500" />
              +2.1%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Rendimiento superior al promedio
          </div>
          <div className="text-muted-foreground">Basado en entregas a tiempo</div>
        </CardFooter>
      </Card>
    </div>
      )}

      <div className="flex items-center justify-between px-4 lg:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Directorio de Proveedores</h1>
          <p className="text-sm text-muted-foreground font-medium">Gestión integral de suministros y relaciones comerciales.</p>
        </div>
        
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 shadow-none" onClick={handleExport}>
              <IconDownload size={16} className="mr-2" /> Exportar
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 h-9 shadow-none font-bold text-xs px-5">
                  <IconPlus size={16} />
                  <span className="hidden lg:inline">Nuevo Proveedor</span>
                  <span className="lg:hidden">Nuevo</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingSupplierId ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
                <DialogDescription>
                  {editingSupplierId ? "Actualice la información del proveedor" : "Complete la información del nuevo proveedor"}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre / Razón Social</Label>
                    <Input 
                      id="name"
                      placeholder="Ej: Inversiones Globales C.A." 
                      value={formData.name || ""}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxId">RIF</Label>
                    <Input 
                      id="taxId"
                      placeholder="J-12345678-9" 
                      value={formData.taxId || ""}
                      onChange={e => setFormData({...formData, taxId: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input 
                      id="phone"
                      placeholder="+58 412..." 
                      value={formData.phone || ""}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email"
                      type="email"
                      placeholder="contacto@empresa.com" 
                      value={formData.email || ""}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">Persona de Contacto</Label>
                    <Input 
                      id="contactPerson"
                      placeholder="Nombre del contacto" 
                      value={formData.contactPerson || ""}
                      onChange={e => setFormData({...formData, contactPerson: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Estado</Label>
                    <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="blocked">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input 
                    id="address"
                    placeholder="Ciudad, Estado, Calle..." 
                    value={formData.address || ""}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="paymentType">Tipo de Pago</Label>
                    <Select value={formData.paymentType} onValueChange={v => setFormData({...formData, paymentType: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contado">Contado</SelectItem>
                        <SelectItem value="credito">Crédito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="creditDays">Días de Crédito</Label>
                    <Input 
                      id="creditDays"
                      type="number"
                      value={formData.creditDays}
                      onChange={e => setFormData({...formData, creditDays: Number(e.target.value)})}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taxType">Contribuyente (SENIAT)</Label>
                    <Select value={formData.taxType} onValueChange={v => setFormData({...formData, taxType: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ORDINARIO">Contribuyente Ordinario</SelectItem>
                        <SelectItem value="ESPECIAL">Contribuyente Especial</SelectItem>
                        <SelectItem value="EXENTO">Exento / No Sujeto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Moneda de Facturación</Label>
                    <Select value={formData.currency} onValueChange={v => setFormData({...formData, currency: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">Divisas (USD)</SelectItem>
                        <SelectItem value="VED">Bolívares (VED)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t pt-4 mt-2">
                  <h3 className="text-sm font-bold mb-3">Datos Bancarios / Pago Móvil</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bankName">Banco</Label>
                      <Input 
                        id="bankName"
                        placeholder="Banesco, Mercantil, etc." 
                        value={formData.bankName || ""}
                        onChange={e => setFormData({...formData, bankName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankPhone">Teléfono (Pago Móvil)</Label>
                      <Input 
                        id="bankPhone"
                        placeholder="0412..." 
                        value={formData.bankPhone || ""}
                        onChange={e => setFormData({...formData, bankPhone: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  setEditingSupplierId(null);
                  setFormData(FORM_INITIAL_STATE);
                }}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate}>
                  {editingSupplierId ? "Guardar Cambios" : "Crear Proveedor"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="px-4 lg:px-6 space-y-4">
          <div className="flex-1 mt-4">
              {loading ? (
                  <Skeleton className="h-[500px] w-full rounded-2xl" />
              ) : (
                  <UniversalTable 
                      data={tableData} 
                      columns={getSuppliersColumns(handleEditClick, handleDelete) as any}
                      tabs={{
                          outline: "Directorio General",
                          pastPerformance: `Cuentas por Pagar (${suppliers.filter(s => (s as any).outstandingBalance > 0).length})`,
                          keyPersonnel: `Especiales (${suppliers.filter(s => (s as any).taxType === 'ESPECIAL').length})`,
                          focusDocuments: "Bloqueados"
                      }}
                      customTabsContent={{
                        pastPerformance: (
                          <div className="space-y-4">
                            <UniversalTable 
                              hideHeader={true}
                              data={tableData.filter(d => (d.raw as any).outstandingBalance > 0)}
                              columns={getSuppliersColumns(handleEditClick, handleDelete) as any}
                            />
                          </div>
                        ),
                        keyPersonnel: (
                          <div className="space-y-4">
                            <UniversalTable 
                              hideHeader={true}
                              data={tableData.filter(d => (d.raw as any).taxType === 'ESPECIAL')}
                              columns={getSuppliersColumns(handleEditClick, handleDelete) as any}
                            />
                          </div>
                        ),
                        focusDocuments: (
                          <div className="space-y-4">
                            <UniversalTable 
                              hideHeader={true}
                              data={tableData.filter(d => d.status === 'blocked')}
                              columns={getSuppliersColumns(handleEditClick, handleDelete) as any}
                            />
                          </div>
                        )
                      }}
                  />
              )}
          </div>
      </div>
    </div>
    </div>
  );
}
