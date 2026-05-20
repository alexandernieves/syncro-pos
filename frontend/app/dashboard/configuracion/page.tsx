"use client";
import React, { useEffect, useState } from "react";
import { API_URL } from "@/lib/constants"
import { clearAuthSession } from "@/lib/auth-helpers";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconBuilding,
  IconUsers,
  IconCash,
  IconShieldLock,
  IconPrinter,
  IconBell,
  IconPalette,
  IconDeviceFloppy,
  IconPlus,
  IconTrash,
  IconCheck,
  IconUser,
  IconMail,
  IconPhone,
  IconMapPin,
  IconWorld,
  IconReceipt,
  IconCreditCard,
  IconDevices,
  IconHistory,
  IconFingerprint,
  IconLogout,
  IconPencil,
  IconStar,
  IconInnerShadowTop,
  IconBuildingStore,
  IconHexagon,
  IconChevronDown,
  IconAlertTriangle,
  IconLock,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ICONS_MAP: Record<string, React.ElementType> = {
  IconInnerShadowTop,
  IconBuildingStore,
  IconHexagon,
};

const SECTIONS = [
  { id: "negocio", label: "Negocio", icon: IconBuilding },
  { id: "facturacion", label: "Facturación e IVA", icon: IconReceipt },
  { id: "pagos", label: "Métodos de Pago", icon: IconCreditCard },
  { id: "pos", label: "Punto de Venta", icon: IconCash },
  { id: "usuarios", label: "Usuarios y Roles", icon: IconShieldLock },
  { id: "sucursales", label: "Sucursales", icon: IconMapPin },
  { id: "sesiones", label: "Sesión y Seguridad", icon: IconFingerprint },
];

const VENEZUELA_STATES = [
  "Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar", "Carabobo", "Cojedes", 
  "Delta Amacuro", "Distrito Capital", "Falcón", "Guárico", "Lara", "Mérida", "Miranda", 
  "Monagas", "Nueva Esparta", "Portuguesa", "Sucre", "Táchira", "Trujillo", "La Guaira", 
  "Yaracuy", "Zulia"
];

export default function ConfiguracionPage() {
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = React.useState("negocio");
  const [loading, setLoading] = useState(true);

  React.useEffect(() => { setMounted(true); }, []);

  // --- State for each section ---
  const [negocio, setNegocio] = useState({
    businessName: "Syncro POS",
    businessIcon: "IconInnerShadowTop",
    ruc: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    currency: "USD",
    country: "Venezuela",
  });

  const [pagoMovil, setPagoMovil] = useState({
    bank: "",
    id: "",
    phone: "",
    enabled: false
  });

  const [binance, setBinance] = useState({
    binanceId: "",
    email: "",
    enabled: false
  });

  const [zinli, setZinli] = useState({
    email: "",
    enabled: false
  });

  const [paypal, setPaypal] = useState({
    email: "",
    enabled: false
  });

  const [iva, setIva] = useState({ rate: "16", igtfRate: "3", enabled: true });
  const [receiptFooter, setReceiptFooter] = useState("Gracias por su compra. Vuelva pronto.");
  const [paymentMethods, setPaymentMethods] = useState([
    { id: 1, name: "Efectivo", enabled: true },
    { id: 2, name: "Tarjeta de Crédito", enabled: true },
    { id: 3, name: "Tarjeta de Débito", enabled: true },
    { id: 4, name: "Transferencia", enabled: false },
  ]);

  const [posConfig, setPosConfig] = useState({
    requireClient: false,
    printOnSale: true,
    lowStockAlert: "5",
    allowNegativeStock: false,
  });

  const [dashboardConfig, setDashboardConfig] = useState({
    salesGoal: "10000",
    showSalesGoal: true,
  });

  const [printConfig, setPrintConfig] = useState({
    defaultPrinter: "",
    paperWidth: "80",
    copiesPerSale: "1",
  });

  const [sucursales, setSucursales] = useState<any[]>([]);
  const [newBranch, setNewBranch] = useState({ name: "", location: "", phone: "", email: "", isMain: false, country: "Venezuela", state: "Distrito Capital" });
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [mainBranchDialogOpen, setMainBranchDialogOpen] = useState(false);
  const [mainBranchCandidate, setMainBranchCandidate] = useState<any>(null);
  const [mainBranchPassword, setMainBranchPassword] = useState("");

  const [sessionInfo, setSessionInfo] = useState<any>(null);

  // States for Wipe Branch Feature
  const [wipeBranchId, setWipeBranchId] = useState("");
  const [wipeConfirmText, setWipeConfirmText] = useState("");
  const [wipePassword, setWipePassword] = useState("");
  const [isWipeAlertOpen, setIsWipeAlertOpen] = useState(false);
  const [isWipeAuthOpen, setIsWipeAuthOpen] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<any>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  // PIN de autorización de descuentos
  const [discountPin, setDiscountPin] = useState("");
  const [discountPinConfirm, setDiscountPinConfirm] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [pinPermissions, setPinPermissions] = useState<any>({
    applyDiscount: true,
    deleteCartItem: false,
    cancelSale: false,
    processReturn: true,
    closeShift: false,
    inventoryAdjustments: true,
  });
  const [isPinPermissionsModalOpen, setIsPinPermissionsModalOpen] = useState(false);

  const API = API_URL;

  const fetchBranches = async () => {
    try {
      const branchesRes = await fetch(`${API}/branches`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if(branchesRes.ok) {
        const bData = await branchesRes.json();
        setSucursales(bData);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "", email: "", password: "", role: "Rol Personalizado", privileges: [] as string[], branchIds: [] as string[]
  });
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editUser, setEditUser] = useState({
    id: "", name: "", email: "", role: "Cajero", privileges: [] as string[], branchIds: [] as string[]
  });

  const AVAILABLE_PRIVILEGES = [
    { id: "dashboard", label: "Dashboard" },
    { id: "pos", label: "Punto de Venta" },
    { id: "productos", label: "Gestión de Productos" },
    { id: "inventario", label: "Inventario" },
    { id: "proveedores", label: "Proveedores" },
    { id: "reportes", label: "Reportes" },
    { id: "clientes", label: "Clientes" },
    { id: "contabilidad", label: "Contabilidad" },
    { id: "historial", label: "Historial" },
    { id: "configuracion", label: "Configuración" },
  ];

  const fetchUsers = async () => {
    try {
      const usersRes = await fetch(`${API}/users`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if(usersRes.ok) {
        const uData = await usersRes.json();
        setUsuarios(uData);
      }
    } catch (e) {
      console.error("Error fetching users:", e);
    }
  };

  // Fetch settings and session on mount
  React.useEffect(() => {
    const fetchData = async () => {
      // Fetch settings
      try {
        const settingsRes = await fetch(`${API}/settings`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          if (data) {
            setNegocio({
              businessName: data.businessName || "Syncro POS",
              businessIcon: data.businessIcon || "IconInnerShadowTop",
              ruc: data.ruc || "",
              address: data.address || "",
              phone: data.phone || "",
              email: data.email || "",
              website: data.website || "",
              currency: data.currency || "USD",
              country: data.country || "Venezuela",
            });
            setIva({ rate: String(data.taxRate ?? "16"), enabled: data.taxEnabled !== false, igtfRate: String(data.igtfRate ?? "3") });
            setReceiptFooter(data.receiptFooter || "Gracias por su compra. Vuelva pronto.");
            if (data.paymentMethods) {
              setPaymentMethods(data.paymentMethods.map((p: any, idx: number) => ({ id: idx + 1, ...p })));
            }
            setPosConfig({
              requireClient: data.requireClient || false,
              printOnSale: data.printOnSale !== false,
              lowStockAlert: String(data.lowStockAlert || "5"),
              allowNegativeStock: data.allowNegativeStock || false,
            });
            setPrintConfig({
              defaultPrinter: data.defaultPrinter || "",
              paperWidth: String(data.paperWidth || "80"),
              copiesPerSale: String(data.copiesPerSale || "1"),
            });
            setPagoMovil({
              bank: data.pagoMovilBank || "",
              id: data.pagoMovilId || "",
              phone: data.pagoMovilPhone || "",
              enabled: data.pagoMovilEnabled || false,
            });
            setBinance({
              binanceId: data.binanceId || "",
              email: data.binanceEmail || "",
              enabled: data.binanceEnabled || false,
            });
            setZinli({
              email: data.zinliEmail || "",
              enabled: data.zinliEnabled || false,
            });
            setPaypal({
              email: data.paypalEmail || "",
              enabled: data.paypalEnabled || false,
            });
            setDiscountPin(data.discountPin || "");
            if (data.pinPermissions) {
              setPinPermissions(typeof data.pinPermissions === 'string' ? JSON.parse(data.pinPermissions) : data.pinPermissions);
            }
            setDashboardConfig({
              salesGoal: String(data.salesGoal || "10000"),
              showSalesGoal: data.showSalesGoal !== undefined ? data.showSalesGoal : true,
            });
          }
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }

      // Fetch session info
      try {
        const sessionRes = await fetch(`${API}/auth/session`);
        if (sessionRes.ok) {
          const sData = await sessionRes.json();
          console.log("Session info received:", sData);
          setSessionInfo(sData);
        } else {
          console.warn("Session request failed with status:", sessionRes.status);
        }
        await fetchBranches();
        await fetchUsers();
      } catch (error) {
        console.error("Error fetching initial data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    console.log("ConfiguracionPage Section:", activeSection);
  }, [activeSection]);

  const handleSave = async (section: string) => {
    try {
      const payload = {
        businessName: negocio.businessName,
        businessIcon: negocio.businessIcon,
        ruc: negocio.ruc,
        address: negocio.address,
        phone: negocio.phone,
        email: negocio.email,
        website: negocio.website,
        currency: negocio.currency,
        country: negocio.country,
        taxRate: Number(iva.rate),
        taxEnabled: iva.enabled,
        igtfRate: Number(iva.igtfRate),
        receiptFooter,
        paymentMethods: paymentMethods.map(({ name, enabled }) => ({ name, enabled })),
        requireClient: posConfig.requireClient,
        printOnSale: posConfig.printOnSale,
        lowStockAlert: Number(posConfig.lowStockAlert) || 5,
        allowNegativeStock: posConfig.allowNegativeStock,
        pagoMovilBank: pagoMovil.bank,
        pagoMovilId: pagoMovil.id,
        pagoMovilPhone: pagoMovil.phone,
        pagoMovilEnabled: pagoMovil.enabled,
        binanceId: binance.binanceId,
        binanceEmail: binance.email,
        binanceEnabled: binance.enabled,
        zinliEmail: zinli.email,
        zinliEnabled: zinli.enabled,
        paypalEmail: paypal.email,
        paypalEnabled: paypal.enabled,
        discountPin: discountPin || null,
        pinPermissions: pinPermissions, 
        salesGoal: Number(dashboardConfig.salesGoal) || 10000,
        showSalesGoal: !!dashboardConfig.showSalesGoal,
      };

      const res = await fetch(`${API}/settings`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Configuración guardada correctamente");
        window.dispatchEvent(new Event("settingsUpdated"));
      } else {
        toast.error("Error al guardar la configuración");
      }
    } catch (err) {
      toast.error("Error de conexión al servidor");
    }
  };

  const togglePayment = (id: number) => {
    setPaymentMethods(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6 w-full animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
          <div className="space-y-6">
            <div className="border rounded-xl p-8 space-y-6">
              <Skeleton className="h-8 w-1/3" />
              <div className="grid grid-cols-2 gap-6">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-10 w-48" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-full">
      {/* LEFT NAV */}
      <aside className="w-full lg:w-64 shrink-0 border-r bg-muted/20 p-4 flex flex-col gap-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">Secciones</p>
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={[
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left w-full",
              activeSection === id
                ? "bg-primary text-primary-foreground shadow-md scale-[1.02]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            ].join(" ")}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-6 overflow-y-auto">

        {/* ─── NEGOCIO ─── */}
        {activeSection === "negocio" && (
          <div className="max-w-2xl flex flex-col gap-6">
            <div><h2 className="text-xl font-bold">Información del Negocio</h2><p className="text-sm text-muted-foreground">Datos generales que aparecerán en tus comprobantes y reportes.</p></div>
            <Card>
              <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Isotipo del Negocio</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        <span className="flex items-center gap-2">
                          {React.createElement(ICONS_MAP[negocio.businessIcon] || IconInnerShadowTop, { className: "size-4 text-primary" })}
                          {negocio.businessIcon === 'IconInnerShadowTop' && 'Original'}
                          {negocio.businessIcon === 'IconBuildingStore' && 'Tienda'}
                          {negocio.businessIcon === 'IconHexagon' && 'Global'}
                        </span>
                        <IconChevronDown size={14} className="text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
                      {[
                        { id: 'IconInnerShadowTop', label: "Original" },
                        { id: 'IconBuildingStore', label: "Tienda" },
                        { id: 'IconHexagon', label: "Global" },
                      ].map((item) => {
                        const ItemIcon = ICONS_MAP[item.id];
                        return (
                          <DropdownMenuItem key={item.id} onClick={() => setNegocio({ ...negocio, businessIcon: item.id })} className="gap-2 cursor-pointer">
                            <div className="flex size-6 items-center justify-center rounded-sm border bg-background">
                              <ItemIcon className="size-4 shrink-0 text-primary" />
                            </div>
                            {item.label}
                            {negocio.businessIcon === item.id && <IconCheck className="ml-auto size-4" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {[
                  { field: "businessName", label: "Nombre del Negocio", icon: IconBuilding, placeholder: "Syncro POS" },
                  { field: "ruc", label: "RUC / NIT / RFC", icon: IconReceipt, placeholder: "00000000000" },
                  { field: "phone", label: "Teléfono", icon: IconPhone, placeholder: "+1 (555) 000-0000" },
                  { field: "email", label: "Correo Electrónico", icon: IconMail, placeholder: "contacto@negocio.com" },
                  { field: "website", label: "Sitio Web", icon: IconWorld, placeholder: "www.minegocio.com" },
                  { field: "currency", label: "Moneda", icon: IconCash, placeholder: "USD" },
                ].map(({ field, label, icon: Icon, placeholder }) => (
                  <div key={field} className="flex flex-col gap-1.5">
                    <Label>{label}</Label>
                    <div className="relative">
                      <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder={placeholder}
                        value={(negocio as any)[field] || ""}
                        onChange={e => setNegocio(prev => ({ ...prev, [field]: e.target.value }))}
                      />
                    </div>
                  </div>
                ))}
                
                <div className="flex flex-col gap-1.5">
                  <Label>País</Label>
                  <Select value={negocio.country} onValueChange={v => setNegocio({...negocio, country: v})}>
                    <SelectTrigger className="w-full">
                      <div className="flex items-center gap-3">
                        <IconMapPin size={15} className="text-muted-foreground" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {VENEZUELA_STATES && ["Venezuela"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <Label>Dirección</Label>
                  <div className="relative">
                    <IconMapPin size={15} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Calle, Ciudad, País" value={negocio.address || ""} onChange={e => setNegocio(prev => ({ ...prev, address: e.target.value }))} />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Button className="self-start gap-2" onClick={() => handleSave("Negocio")}><IconDeviceFloppy size={16}/>Guardar Cambios</Button>
          </div>
        )}



        {/* ─── FACTURACION ─── */}
        {activeSection === "facturacion" && (
          <div className="max-w-2xl flex flex-col gap-6">
            <div><h2 className="text-xl font-bold">Facturación e IVA</h2><p className="text-sm text-muted-foreground">Configura los impuestos y el formato de tus comprobantes.</p></div>
            <Card>
              <CardContent className="p-6 flex flex-col gap-5">
                <div className="flex justify-between items-center">
                  <div><p className="font-medium">IVA / Impuesto sobre ventas</p><p className="text-sm text-muted-foreground">Aplicado automáticamente a cada venta</p></div>
                  <Badge className={iva.enabled ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"} onClick={() => setIva(p => ({ ...p, enabled: !p.enabled }))} style={{ cursor: "pointer" }}>
                    {iva.enabled ? "Activo" : "Desactivado"}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <Label>Porcentaje de IVA (%)</Label>
                    <p className="text-xs text-muted-foreground mb-1">Aplica al monto base de la venta (Ej: 16). Ajustar a 0 si no aplica.</p>
                    <Input type="number" value={iva.rate} onChange={e => setIva(p => ({ ...p, rate: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Porcentaje de IGTF (%)</Label>
                    <p className="text-xs text-muted-foreground mb-1">Aplica al pago en Efectivo Moneda Extranjera. Ajustar a 0 si no aplica.</p>
                    <Input type="number" value={iva.igtfRate} onChange={e => setIva(p => ({ ...p, igtfRate: e.target.value }))} />
                  </div>
                </div>
                <Separator />
                <div className="flex flex-col gap-1.5">
                  <Label>Mensaje al pie del comprobante</Label>
                  <Input value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} placeholder="Gracias por su compra..." />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Prefijo de número de venta</Label>
                  <Input placeholder="VTA-" defaultValue="VTA-" className="max-w-xs" />
                  <p className="text-xs text-muted-foreground">Ej: VTA-0001, VTA-0002...</p>
                </div>
              </CardContent>
            </Card>
            <Button className="self-start gap-2" onClick={() => handleSave("Facturación")}><IconDeviceFloppy size={16}/>Guardar</Button>
          </div>
        )}

        {/* ─── PAGOS ─── */}
        {activeSection === "pagos" && (
          <div className="max-w-2xl flex flex-col gap-6">
            <div><h2 className="text-xl font-bold">Métodos de Pago</h2><p className="text-sm text-muted-foreground">Activa o desactiva los métodos disponibles en el punto de venta.</p></div>
            <Card>
              <CardContent className="p-6 flex flex-col gap-1">
                {paymentMethods.map(p => (
                  <div key={p.id} className="flex justify-between items-center py-3 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <IconCreditCard size={18} className="text-muted-foreground" />
                      <span className="font-medium text-sm">{p.name}</span>
                    </div>
                    <button
                      onClick={() => togglePayment(p.id)}
                      className={["flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors", p.enabled ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"].join(" ")}
                    >
                      {p.enabled && <IconCheck size={12}/>}
                      {p.enabled ? "Habilitado" : "Deshabilitado"}
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 flex flex-col gap-6">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-600">
                      <IconDevices size={20} />
                    </div>
                    <div>
                      <p className="font-bold">Pago Móvil</p>
                      <p className="text-xs text-muted-foreground">Datos que verá el cliente para transferir</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPagoMovil(p => ({ ...p, enabled: !p.enabled }))}
                    className={cn("w-11 h-6 rounded-full transition-colors relative", pagoMovil.enabled ? "bg-primary" : "bg-muted")}
                  >
                    <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", pagoMovil.enabled ? "left-5" : "left-0.5")} />
                  </button>
                </div>

                <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4 transition-all duration-300", !pagoMovil.enabled && "opacity-40 pointer-events-none")}>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Banco</Label>
                    <Input 
                      placeholder="Ej. Banesco" 
                      value={pagoMovil.bank} 
                      onChange={e => setPagoMovil({...pagoMovil, bank: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cédula / RIF</Label>
                    <Input 
                      placeholder="V-12345678" 
                      value={pagoMovil.id} 
                      onChange={e => setPagoMovil({...pagoMovil, id: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Teléfono</Label>
                    <Input 
                      placeholder="0412 1234567" 
                      value={pagoMovil.phone} 
                      onChange={e => setPagoMovil({...pagoMovil, phone: e.target.value})} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ─── BINANCE ─── */}
            <Card>
              <CardContent className="p-6 flex flex-col gap-6">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-600">
                      <IconHexagon size={20} />
                    </div>
                    <div>
                      <p className="font-bold">Binance Pay</p>
                      <p className="text-xs text-muted-foreground">Recibe criptomonedas directamente</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setBinance(p => ({ ...p, enabled: !p.enabled }))}
                    className={cn("w-11 h-6 rounded-full transition-colors relative", binance.enabled ? "bg-yellow-500" : "bg-muted")}
                  >
                    <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", binance.enabled ? "left-5" : "left-0.5")} />
                  </button>
                </div>

                <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-300", !binance.enabled && "opacity-40 pointer-events-none")}>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Binance ID</Label>
                    <Input 
                      placeholder="Ej. 123456789" 
                      value={binance.binanceId} 
                      onChange={e => setBinance({...binance, binanceId: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Correo de la Cuenta</Label>
                    <Input 
                      placeholder="ali@binance.com" 
                      value={binance.email} 
                      onChange={e => setBinance({...binance, email: e.target.value})} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ─── ZINLI ─── */}
            <Card>
              <CardContent className="p-6 flex flex-col gap-6">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
                      <IconWorld size={20} />
                    </div>
                    <div>
                      <p className="font-bold">Zinli</p>
                      <p className="text-xs text-muted-foreground">Billetera digital panameña</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setZinli(p => ({ ...p, enabled: !p.enabled }))}
                    className={cn("w-11 h-6 rounded-full transition-colors relative", zinli.enabled ? "bg-purple-600" : "bg-muted")}
                  >
                    <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", zinli.enabled ? "left-5" : "left-0.5")} />
                  </button>
                </div>

                <div className={cn("grid grid-cols-1 gap-4 transition-all duration-300", !zinli.enabled && "opacity-40 pointer-events-none")}>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Correo Zinli</Label>
                    <Input 
                      placeholder="tienda@zinli.com" 
                      value={zinli.email} 
                      onChange={e => setZinli({...zinli, email: e.target.value})} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ─── PAYPAL ─── */}
            <Card>
              <CardContent className="p-6 flex flex-col gap-6">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-blue-700/10 flex items-center justify-center text-blue-800">
                      <IconBuilding size={20} />
                    </div>
                    <div>
                      <p className="font-bold">PayPal</p>
                      <p className="text-xs text-muted-foreground">Pagos internacionales</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPaypal(p => ({ ...p, enabled: !p.enabled }))}
                    className={cn("w-11 h-6 rounded-full transition-colors relative", paypal.enabled ? "bg-blue-800" : "bg-muted")}
                  >
                    <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", paypal.enabled ? "left-5" : "left-0.5")} />
                  </button>
                </div>

                <div className={cn("grid grid-cols-1 gap-4 transition-all duration-300", !paypal.enabled && "opacity-40 pointer-events-none")}>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Correo PayPal</Label>
                    <Input 
                      placeholder="pagos@negocio.com" 
                      value={paypal.email} 
                      onChange={e => setPaypal({...paypal, email: e.target.value})} 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button className="self-start gap-2" onClick={() => handleSave("Pagos")}><IconDeviceFloppy size={16}/>Guardar Configuración de Pagos</Button>
          </div>
        )}

        {/* ─── POS ─── */}
        {activeSection === "pos" && (
          <div className="max-w-2xl flex flex-col gap-6">
            <div><h2 className="text-xl font-bold">Punto de Venta</h2><p className="text-sm text-muted-foreground">Ajusta el comportamiento del terminal de ventas.</p></div>
            <Card>
              <CardContent className="p-6 flex flex-col gap-1 divide-y">
                {[
                  { field: "requireClient", label: "Requerir cliente en cada venta", desc: "Obligatorio seleccionar un cliente antes de cobrar" },
                  { field: "printOnSale", label: "Imprimir comprobante automáticamente", desc: "Envía a impresión al completar la venta" },
                  { field: "allowNegativeStock", label: "Permitir venta con stock negativo", desc: "Vende aunque no quede inventario registrado" },
                ].map(({ field, label, desc }) => (
                  <div key={field} className="flex justify-between items-center py-4">
                    <div><p className="font-medium text-sm">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                    <button
                      onClick={() => setPosConfig(p => ({ ...p, [field]: !(p as any)[field] }))}
                      className={["w-11 h-6 rounded-full transition-colors relative", (posConfig as any)[field] ? "bg-primary" : "bg-muted"].join(" ")}
                    >
                      <div className={["absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", (posConfig as any)[field] ? "left-5" : "left-0.5"].join(" ")} />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between items-center py-4">
                  <div><p className="font-medium text-sm">Alerta de stock mínimo</p><p className="text-xs text-muted-foreground">Avisa cuando el stock baje de este número</p></div>
                  <Input type="number" value={posConfig.lowStockAlert} onChange={e => setPosConfig(p => ({ ...p, lowStockAlert: e.target.value }))} className="w-20 text-center" />
                </div>
                
                <Separator className="my-2" />
                
                <div>
                  <h3 className="text-sm font-bold text-primary mb-2">Configuración del Dashboard</h3>
                </div>

                <div className="flex justify-between items-center py-4">
                  <div>
                    <p className="font-medium text-sm">Mostrar Meta de Ventas</p>
                    <p className="text-xs text-muted-foreground">Activa el módulo de seguimiento de metas en el inicio</p>
                  </div>
                  <Switch 
                    checked={dashboardConfig.showSalesGoal} 
                    onCheckedChange={(val) => setDashboardConfig(d => ({ ...d, showSalesGoal: val }))}
                  />
                </div>

                <div className="flex justify-between items-center py-4">
                  <div>
                    <p className="font-medium text-sm">Meta de Ventas Mensual ($)</p>
                    <p className="text-xs text-muted-foreground">Monto objetivo para el indicador del Dashboard</p>
                  </div>
                  <Input 
                    type="number" 
                    value={dashboardConfig.salesGoal} 
                    onChange={e => setDashboardConfig(d => ({ ...d, salesGoal: e.target.value }))} 
                    className="w-32 text-right font-mono" 
                    placeholder="10000"
                  />
                </div>
              </CardContent>
            </Card>
            <Button className="self-start gap-2" onClick={() => handleSave("Punto de Venta")}><IconDeviceFloppy size={16}/>Guardar</Button>
          </div>
        )}

        {/* ─── USUARIOS ─── */}
        {activeSection === "usuarios" && (
          <div className="max-w-2xl flex flex-col gap-6">
            <div className="flex justify-between items-start">
              <div><h2 className="text-xl font-bold">Usuarios y Roles</h2><p className="text-sm text-muted-foreground">Gestiona quién tiene acceso al sistema.</p></div>
              <Button className="gap-2" onClick={() => {
                setNewUser({ name: "", email: "", password: "", role: "Cajero", privileges: ["pos"], branchIds: [] });
                setCreateUserOpen(true);
              }}><IconPlus size={16}/>Nuevo Usuario</Button>
            </div>
            {usuarios.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">No hay usuarios o el servicio no está disponible</div>
            ) : usuarios.map(u => (
              <Card key={u.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 text-primary size-10 rounded-full flex items-center justify-center font-bold text-lg">{u.name?.charAt(0) || "U"}</div>
                    <div>
                      <p className="font-semibold text-sm">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{u.role}</Badge>
                    <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-primary" onClick={() => {
                      setEditUser({
                        id: u.id,
                        name: u.name || "",
                        email: u.email || "",
                        role: u.role || "",
                        privileges: u.permissions || [],
                        branchIds: u.branchIds || []
                      });
                      setEditUserOpen(true);
                    }}><IconPencil size={14}/></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={async () => {
                      if(confirm("¿Eliminar usuario?")) {
                        try {
                          const res = await fetch(`${API}/users/${u.id}`, { 
                            method: "DELETE",
                            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
                          });
                          if(res.ok) {
                            toast.success("Usuario eliminado");
                            fetchUsers();
                          } else toast.error("Error al eliminar");
                        } catch(e) { toast.error("Error de conexión"); }
                      }
                    }}><IconTrash size={14}/></Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
              <DialogContent className="sm:max-w-md md:max-w-2xl h-[90vh] md:h-auto overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                  <DialogDescription>
                    Asigna un perfil y personaliza a qué áreas de la aplicación tendrá acceso mediante los switches.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Nombre Completo</Label>
                      <Input placeholder="Ej. Carlos Pérez" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Correo Electrónico</Label>
                      <Input type="email" placeholder="carlos@mipos.com" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Contraseña</Label>
                      <Input type="password" placeholder="••••••••" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nombre del Rol Personalizado</Label>
                      <Input placeholder="Ej. Gerente, Vendedor..." value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} />
                    </div>
                  </div>

                  <Separator className="my-2" />
                  
                  <div>
                    <Label className="text-base font-semibold">Permisos de Acceso</Label>
                    <p className="text-xs text-muted-foreground mb-4">Activa los módulos que este usuario podrá visualizar y administrar.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      {AVAILABLE_PRIVILEGES.map(priv => (
                        <div key={priv.id} className="flex justify-between items-center py-2 border-b last:border-0 border-muted">
                          <span className="text-sm">{priv.label}</span>
                          <button
                            onClick={() => {
                              const has = newUser.privileges.includes(priv.id);
                              setNewUser({
                                ...newUser,
                                privileges: has ? newUser.privileges.filter(p => p !== priv.id) : [...newUser.privileges, priv.id],
                              });
                            }}
                            className={["w-10 h-5 rounded-full transition-colors relative shrink-0", newUser.privileges.includes(priv.id) ? "bg-primary" : "bg-muted"].join(" ")}
                          >
                            <div className={["absolute top-[2px] w-4 h-4 bg-white rounded-full shadow transition-all", newUser.privileges.includes(priv.id) ? "left-[22px]" : "left-[2px]"].join(" ")} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="my-2" />
                  
                  <div>
                    <Label className="text-base font-semibold">Sucursales de Acceso</Label>
                    <p className="text-xs text-muted-foreground mb-4">Selecciona las sucursales donde este usuario podrá operar.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      {sucursales.map(branch => (
                        <div key={branch.id} className="flex justify-between items-center py-2 border-b last:border-0 border-muted">
                          <span className="text-sm font-medium">{branch.name}</span>
                          <button
                            onClick={() => {
                              const has = newUser.branchIds.includes(branch.id);
                              setNewUser({
                                ...newUser,
                                branchIds: has ? newUser.branchIds.filter(id => id !== branch.id) : [...newUser.branchIds, branch.id],
                              });
                            }}
                            className={["w-10 h-5 rounded-full transition-colors relative shrink-0", newUser.branchIds.includes(branch.id) ? "bg-primary" : "bg-muted"].join(" ")}
                          >
                            <div className={["absolute top-[2px] w-4 h-4 bg-white rounded-full shadow transition-all", newUser.branchIds.includes(branch.id) ? "left-[22px]" : "left-[2px]"].join(" ")} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateUserOpen(false)}>Cancelar</Button>
                  <Button onClick={async () => {
                    if(!newUser.name || !newUser.email || !newUser.password) {
                      toast.error("Rellena todos los campos"); return;
                    }
                    try {
                      const { privileges, branchIds, ...userDataToSend } = newUser;
                      const res = await fetch(`${API}/users`, {
                        method: "POST", 
                        headers: { 
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${localStorage.getItem("token")}`
                        },
                        body: JSON.stringify({ ...userDataToSend, country: "Venezuela", permissions: privileges, branchIds: branchIds })
                      });
                      if(res.ok) {
                        toast.success("Usuario creado con éxito");
                        setCreateUserOpen(false);
                        fetchUsers();
                      } else {
                        const errorData = await res.json();
                        toast.error(errorData.message || "Error al crear usuario");
                      }
                    } catch(e) {
                      toast.error("Error de conexión");
                    }
                  }}>Crear Usuario</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
              <DialogContent className="sm:max-w-md md:max-w-2xl h-[90vh] md:h-auto overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Editar Usuario</DialogTitle>
                  <DialogDescription>
                    Modifica el perfil del usuario o cambia sus permisos de acceso.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                       <Label>Nombre Completo</Label>
                       <Input value={editUser.name} onChange={e => setEditUser({ ...editUser, name: e.target.value })} />
                     </div>
                     <div className="space-y-1.5">
                       <Label>Correo Electrónico</Label>
                       <Input type="email" value={editUser.email} onChange={e => setEditUser({ ...editUser, email: e.target.value })} />
                     </div>
                     <div className="space-y-1.5 md:col-span-2">
                       <Label>Nombre del Rol Personalizado</Label>
                       <Input value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })} />
                     </div>
                  </div>

                  <Separator className="my-2" />
                  
                  <div>
                    <Label className="text-base font-semibold">Permisos de Acceso</Label>
                    <p className="text-xs text-muted-foreground mb-4">Activa los módulos que este usuario podrá visualizar y administrar.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      {AVAILABLE_PRIVILEGES.map(priv => (
                        <div key={priv.id} className="flex justify-between items-center py-2 border-b last:border-0 border-muted">
                          <span className="text-sm">{priv.label}</span>
                          <button
                            onClick={() => {
                              const has = editUser.privileges.includes(priv.id);
                              setEditUser({
                                ...editUser,
                                privileges: has ? editUser.privileges.filter(p => p !== priv.id) : [...editUser.privileges, priv.id],
                              });
                            }}
                            className={["w-10 h-5 rounded-full transition-colors relative shrink-0", editUser.privileges.includes(priv.id) ? "bg-primary" : "bg-muted"].join(" ")}
                          >
                            <div className={["absolute top-[2px] w-4 h-4 bg-white rounded-full shadow transition-all", editUser.privileges.includes(priv.id) ? "left-[22px]" : "left-[2px]"].join(" ")} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="my-2" />
                  
                  <div>
                    <Label className="text-base font-semibold">Sucursales de Acceso</Label>
                    <p className="text-xs text-muted-foreground mb-4">Selecciona las sucursales donde este usuario podrá operar.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      {sucursales.map(branch => (
                        <div key={branch.id} className="flex justify-between items-center py-2 border-b last:border-0 border-muted">
                          <span className="text-sm font-medium">{branch.name}</span>
                          <button
                            onClick={() => {
                              const has = editUser.branchIds.includes(branch.id);
                              setEditUser({
                                ...editUser,
                                branchIds: has ? editUser.branchIds.filter(id => id !== branch.id) : [...editUser.branchIds, branch.id],
                              });
                            }}
                            className={["w-10 h-5 rounded-full transition-colors relative shrink-0", editUser.branchIds.includes(branch.id) ? "bg-primary" : "bg-muted"].join(" ")}
                          >
                            <div className={["absolute top-[2px] w-4 h-4 bg-white rounded-full shadow transition-all", editUser.branchIds.includes(branch.id) ? "left-[22px]" : "left-[2px]"].join(" ")} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditUserOpen(false)}>Cancelar</Button>
                  <Button onClick={async () => {
                    if(!editUser.name || !editUser.email) {
                      toast.error("Rellena los campos obligatorios"); return;
                    }
                    try {
                      const { id, privileges, branchIds, ...updateData } = editUser;
                      const res = await fetch(`${API}/users/${id}`, {
                        method: "PATCH", 
                        headers: { 
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${localStorage.getItem("token")}`
                        },
                        body: JSON.stringify({ ...updateData, permissions: privileges, branchIds: branchIds })
                      });
                      if(res.ok) {
                        toast.success("Usuario actualizado con éxito");
                        setEditUserOpen(false);
                        fetchUsers();
                      } else {
                        const errorData = await res.json();
                        toast.error(errorData.message || "Error al actualizar usuario");
                      }
                    } catch(e) {
                      toast.error("Error de conexión");
                    }
                  }}>Guardar Cambios</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>
        )}

        {/* ─── SESIONES ─── */}
        {activeSection === "sesiones" && (
          <div className="max-w-2xl flex flex-col gap-6">
            <div>
              <h2 className="text-xl font-bold">Sesión del Ordenador</h2>
              <p className="text-sm text-muted-foreground">Información sobre tu conexión actual y seguridad de la cuenta.</p>
            </div>
            
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3 border-b border-primary/10">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/20 p-2 rounded-full text-primary">
                    <IconDevices size={20} />
                  </div>
                  <div>
                    <CardTitle className="text-sm">Sesión Actual</CardTitle>
                    <CardDescription className="text-xs">Este es el dispositivo que estás usando ahora mismo.</CardDescription>
                  </div>
                  <Badge className="ml-auto bg-green-500/20 text-green-600 border-green-500/30">Activa</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <IconWorld size={18} className="text-muted-foreground" />
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Dirección IP</p>
                        <p className="text-sm font-medium">
                          {sessionInfo?.ip === "::1" || sessionInfo?.ip === "127.0.0.1" 
                            ? "Red Local (localhost)" 
                            : (sessionInfo?.ip || "Detectando...")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IconDevices size={18} className="text-muted-foreground" />
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Plataforma</p>
                        <p className="text-sm font-medium capitalize">{sessionInfo?.platform || "Mac OS"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <IconHistory size={18} className="text-muted-foreground" />
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">Última actividad</p>
                        <p className="text-sm font-medium">{sessionInfo?.timestamp ? new Date(sessionInfo.timestamp).toLocaleString() : "Ahora"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IconFingerprint size={18} className="text-muted-foreground" />
                      <div className="space-y-0.5 text-xs truncate">
                        <p className="text-muted-foreground">Navegador</p>
                        <p className="text-sm font-medium truncate max-w-[200px]" title={sessionInfo?.userAgent}>
                          {sessionInfo?.userAgent?.split(') ')[1]?.split(' ')[0] || "Chrome"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Seguridad de la Sesión</CardTitle>
                <CardDescription className="text-xs italic">
                  Tu sesión se cerrará automáticamente después de 15 minutos de inactividad para proteger tus datos.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 flex flex-col gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-3">
                    <IconShieldLock size={18} className="text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Estado de la cuenta</p>
                      <p className="text-xs text-muted-foreground">Tu cuenta está protegida con cifrado SSL.</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Protegido</Badge>
                </div>
                
                <Button variant="outline" className="w-full justify-start gap-2 border-destructive/20 text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    await clearAuthSession();
                    window.location.href = "/";
                  }}
                >

                  <IconLogout size={16} />
                  Cerrar todas las sesiones
                </Button>
              </CardContent>
            </Card>

            {/* PIN de Autorización */}
            <Card className="border-amber-500/20">
              <CardHeader className="border-b border-amber-500/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                    <IconLock size={18} />
                  </div>
                  <div>
                    <CardTitle className="text-sm">PIN de Autorización</CardTitle>
                    <CardDescription className="text-xs">PIN de 4 dígitos para autorizar acciones sensibles en el POS (descuentos, etc.)</CardDescription>
                  </div>
                  {discountPin && <Badge className="ml-auto bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border text-[10px]">Configurado</Badge>}
                </div>
              </CardHeader>
              <CardContent className="p-6 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nuevo PIN (4 dígitos)</Label>
                    <div className="relative">
                      <Input
                        type={showPin ? 'text' : 'password'}
                        maxLength={4}
                        placeholder="••••"
                        value={discountPin}
                        onChange={e => setDiscountPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="pr-10 text-center font-mono text-lg tracking-[0.5em]"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPin(v => !v)}
                      >
                        {showPin ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirmar PIN</Label>
                    <div className="relative">
                      <Input
                        type={showPin ? 'text' : 'password'}
                        maxLength={4}
                        placeholder="••••"
                        value={discountPinConfirm}
                        onChange={e => setDiscountPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className={cn(
                          "pr-10 text-center font-mono text-lg tracking-[0.5em]",
                          discountPinConfirm && discountPin !== discountPinConfirm ? "border-destructive" : ""
                        )}
                      />
                      {discountPinConfirm.length === 4 && discountPin === discountPinConfirm && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                          <IconCheck size={16} />
                        </span>
                      )}
                    </div>
                    {discountPinConfirm && discountPin !== discountPinConfirm && (
                      <p className="text-[11px] text-destructive">Los PINs no coinciden</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-2">
                  <Button
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                    disabled={discountPin.length !== 4 || discountPin !== discountPinConfirm || savingPin}
                    onClick={async () => {
                      setSavingPin(true);
                      try {
                        const token = localStorage.getItem("token");
                        const res = await fetch(`${API}/settings`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                          body: JSON.stringify({ discountPin, pinPermissions })
                        });
                        if (res.ok) {
                          toast.success("PIN de seguridad guardado");
                          setDiscountPinConfirm("");
                        } else throw new Error();
                      } catch {
                        toast.error("Error al guardar el PIN");
                      } finally {
                        setSavingPin(false);
                      }
                    }}
                  >
                    {savingPin ? "Guardando..." : "Guardar PIN"}
                  </Button>
                  <Button variant="outline" className="flex-1 border-amber-500/20 text-amber-500 hover:bg-amber-500/10" onClick={() => setIsPinPermissionsModalOpen(true)}>
                    <IconLock size={16} className="mr-2" />
                    Configurar Permisos
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ZONA DE PELIGRO - WIPE BRANCH */}
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-sm text-destructive flex items-center gap-2">
                  <IconAlertTriangle size={18} /> Zona de Peligro
                </CardTitle>
                <CardDescription className="text-xs">
                  Acciones destructivas e irreversibles para la gestión de datos.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors font-bold"
                  onClick={() => {
                    setWipeBranchId("");
                    setWipeConfirmText("");
                    setIsWipeAlertOpen(true);
                  }}
                >
                  <IconTrash size={16} />
                  Eliminar Data de Sucursal
                </Button>
              </CardContent>
            </Card>

            {/* MODAL 1: ADVERTENCIA Y SELECCION */}
            <Dialog open={isWipeAlertOpen} onOpenChange={setIsWipeAlertOpen}>
              <DialogContent className="sm:max-w-md border-destructive">
                <DialogHeader>
                  <DialogTitle className="text-destructive flex items-center gap-2">
                    <IconAlertTriangle size={20} /> ¡Advertencia de Eliminación!
                  </DialogTitle>
                  <DialogDescription className="font-medium text-foreground">
                    Estás a punto de borrar TODOS los datos de una sucursal (Ventas, Gastos, Turnos, Inventario). Esta acción es <strong className="text-destructive">IRREVERSIBLE</strong>.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="font-bold">Selecciona la Sucursal a limpiar</Label>
                    <Select value={wipeBranchId} onValueChange={setWipeBranchId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar sucursal..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sucursales.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Para confirmar, escribe la palabra <strong className="select-none">Eliminar</strong></Label>
                    <Input 
                      placeholder="Escribe Eliminar..." 
                      value={wipeConfirmText} 
                      onChange={e => setWipeConfirmText(e.target.value)} 
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsWipeAlertOpen(false)}>Cancelar</Button>
                  <Button 
                    variant="destructive" 
                    disabled={wipeConfirmText !== "Eliminar" || !wipeBranchId}
                    onClick={() => {
                      setIsWipeAlertOpen(false);
                      setWipePassword("");
                      setTimeout(() => setIsWipeAuthOpen(true), 150); // Small delay to avoid modal overlap issues
                    }}
                  >
                    Proceder a Autenticación
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* MODAL 2: AUTENTICACION FINAL */}
            <Dialog open={isWipeAuthOpen} onOpenChange={setIsWipeAuthOpen}>
              <DialogContent className="sm:max-w-md border-destructive">
                <DialogHeader>
                  <DialogTitle className="text-destructive flex items-center gap-2">
                    <IconShieldLock size={20} /> Autenticación Requerida
                  </DialogTitle>
                  <DialogDescription>
                    Por seguridad, ingresa tu contraseña para confirmar el borrado de la sucursal seleccionada.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Contraseña</Label>
                    <Input 
                      type="password"
                      placeholder="••••••••" 
                      value={wipePassword} 
                      onChange={e => setWipePassword(e.target.value)} 
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsWipeAuthOpen(false)} disabled={isWiping}>Cancelar</Button>
                  <Button 
                    variant="destructive" 
                    disabled={!wipePassword || isWiping}
                    onClick={async () => {
                      setIsWiping(true);
                      try {
                        const token = localStorage.getItem("token");
                        const res = await fetch(`${API}/branches/${wipeBranchId}/wipe`, {
                          method: "POST",
                          headers: { 
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}` 
                          },
                          body: JSON.stringify({ password: wipePassword })
                        });
                        
                        if (res.ok) {
                          toast.success("Sucursal limpiada exitosamente. Como desde cero.");
                          setIsWipeAuthOpen(false);
                          setWipeBranchId("");
                          setWipeConfirmText("");
                          setWipePassword("");
                          // Refresh data globally or reload to ensure clean state
                          setTimeout(() => window.location.reload(), 1500);
                        } else {
                          const errorData = await res.json();
                          toast.error(errorData.message || "Contraseña incorrecta o error de servidor");
                        }
                      } catch (e) {
                        toast.error("Error de red al intentar limpiar sucursal");
                      } finally {
                        setIsWiping(false);
                      }
                    }}
                  >
                    {isWiping ? "Borrando..." : "Confirmar Eliminación"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>
        )}
        {/* ─── SUCURSALES ─── */}
        {activeSection === "sucursales" && (
          <div className="max-w-4xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Sucursales y Bodegas</h2>
                <p className="text-sm text-muted-foreground">Gestione las diferentes ubicaciones físicas de su inventario.</p>
              </div>
              <Button className="gap-2" onClick={() => setCreateBranchOpen(true)}>
                <IconPlus size={16} /> Nueva Sucursal
              </Button>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1">Sedes Activas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sucursales.map(b => (
                  <Card key={b.id} className="group hover:border-primary/40 transition-colors bg-background/50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                          <IconMapPin size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-sm">
                            {b.name} 
                            {b.isMain && <Badge className="ml-2 bg-primary/10 text-primary border-primary/20">Principal</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <IconMapPin size={12} className="text-muted-foreground/60" /> 
                            <span className="font-medium">{b.state || "Distrito Capital"}</span>, {b.location}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="size-8 text-primary" onClick={() => { 
                          setEditingBranch({
                            ...b,
                            phone: b.phone || "",
                            state: b.state || "Distrito Capital"
                          }); 
                          setEditDialogOpen(true); 
                        }}>
                          <IconPencil size={16} /> 
                        </Button>
                        {!b.isMain && (
                          <Button variant="ghost" size="icon" className="size-8 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10" onClick={() => {
                            setMainBranchCandidate(b);
                            setMainBranchPassword("");
                            setMainBranchDialogOpen(true);
                          }}>
                            <IconStar size={16} />
                          </Button>
                        )}
                        {!b.isMain && (
                          <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setBranchToDelete(b);
                              setIsDeleteAlertOpen(true);
                            }}
                          >
                            <IconTrash size={16} />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* DIALOGO DE CREACION */}
            <Dialog open={createBranchOpen} onOpenChange={setCreateBranchOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Nueva Sucursal</DialogTitle>
                  <DialogDescription>Añade un nuevo punto de venta o almacén al sistema.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="branch-name">Nombre de Sucursal</Label>
                    <Input id="branch-name" placeholder="Ej: Sucursal Norte" value={newBranch.name} onChange={e => setNewBranch({...newBranch, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select value={newBranch.state} onValueChange={v => setNewBranch({...newBranch, state: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px] overflow-y-auto">
                        {VENEZUELA_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch-loc">Ubicación / Dirección Exacta</Label>
                    <Input id="branch-loc" placeholder="Ej: Calle 5 con Av. Las Delicias" value={newBranch.location} onChange={e => setNewBranch({...newBranch, location: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch-phone">Teléfono</Label>
                    <Input id="branch-phone" placeholder="+58..." value={newBranch.phone} onChange={e => setNewBranch({...newBranch, phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>País</Label>
                    <Select value="Venezuela" disabled>
                      <SelectTrigger className="bg-muted opacity-80">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Venezuela">Venezuela</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateBranchOpen(false)}>Cancelar</Button>
                  <Button className="gap-2" onClick={async () => {
                    if(!newBranch.name || !newBranch.location) return toast.error("Nombre y ubicación son obligatorios");
                    try {
                      const res = await fetch(`${API}/branches`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
                        body: JSON.stringify(newBranch)
                      });
                      if(res.ok) {
                        const b = await res.json();
                        setSucursales([...sucursales, b]);
                        setNewBranch({ name: "", location: "", phone: "", email: "", isMain: false, country: "Venezuela", state: "Distrito Capital" });
                        setCreateBranchOpen(false);
                        toast.success("Sucursal creada con éxito");
                        window.dispatchEvent(new Event("branchUpdated"));
                      } else {
                        const err = await res.json();
                        toast.error(err.message || "Error al crear sucursal");
                      }
                    } catch { toast.error("Error de conexión"); }
                  }}><IconPlus size={16} /> Crear Sucursal</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* DIALOGO DE EDICION */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Editar Sucursal</DialogTitle>
                  <DialogDescription>Modifica los datos de esta sede o bodega.</DialogDescription>
                </DialogHeader>
                {editingBranch && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nombre de Sucursal</Label>
                      <Input value={editingBranch.name || ""} onChange={e => setEditingBranch({...editingBranch, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                       <Label>Estado</Label>
                       <Select value={editingBranch.state || "Distrito Capital"} onValueChange={v => setEditingBranch({...editingBranch, state: v})}>
                         <SelectTrigger>
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent className="max-h-[200px] overflow-y-auto">
                           {VENEZUELA_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                         </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Ubicación / Dirección Exacta</Label>
                      <Input value={editingBranch.location || ""} onChange={e => setEditingBranch({...editingBranch, location: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Teléfono</Label>
                      <Input value={editingBranch.phone || ""} onChange={e => setEditingBranch({...editingBranch, phone: e.target.value})} />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={async () => {
                    try {
                      console.log("Branches: Invoking update for:", editingBranch.name);
                      const { id, _id, createdAt, updatedAt, businessId, ...updatePayload } = editingBranch;
                      const branchId = id || _id;
                      // Ensure everything is a string
                      updatePayload.state = String(updatePayload.state || "Distrito Capital");
                      
                      const res = await fetch(`${API}/branches/${branchId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
                        body: JSON.stringify(updatePayload)
                      });
                      if(res.ok) {
                        toast.success("Cambios guardados con éxito.");
                        setEditDialogOpen(false);
                        // Hard refresh branches to ensure UI is in sync
                        await fetchBranches();
                        window.dispatchEvent(new Event("branchUpdated"));
                      } else {

                        const err = await res.json();
                        toast.error(err.message || "Error al actualizar");
                      }
                    } catch (err) { 
                      console.error("Branches: Update error", err);
                      toast.error("Error de conexión"); 
                    }
                  }}>Guardar Cambios</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* DIALOGO DE DESIGNAR COMO PRINCIPAL */}
            <Dialog open={mainBranchDialogOpen} onOpenChange={setMainBranchDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Establecer como Sucursal Principal</DialogTitle>
                  <DialogDescription>
                    Esta acción cambiará la sucursal por defecto. Por seguridad, por favor confirma tu contraseña.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Contraseña de {sessionInfo?.email || "Administrador"}</Label>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      value={mainBranchPassword} 
                      onChange={e => setMainBranchPassword(e.target.value)} 
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setMainBranchDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={async () => {
                    try {
                      // Verify password first
                      const verifyRes = await fetch(`${API}/auth/verify-password`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
                        body: JSON.stringify({ password: mainBranchPassword })
                      });
                      
                      if (!verifyRes.ok) {
                        toast.error("Contraseña incorrecta");
                        return;
                      }

                      // Proceed to set main
                      const setMainRes = await fetch(`${API}/branches/${mainBranchCandidate.id || mainBranchCandidate._id}/set-main`, {
                        method: "PUT",
                        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
                      });
                      
                      if(setMainRes.ok) {
                        toast.success("Sucursal principal actualizada");
                        setMainBranchDialogOpen(false);
                        await fetchBranches();
                        window.dispatchEvent(new Event("branchUpdated"));
                      } else {
                        toast.error("Error al actualizar la sucursal principal");
                      }
                    } catch (err) { 
                      console.error("Set main branch error:", err);
                      toast.error("Error de conexión"); 
                    }
                  }}>Confirmar y Aplicar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

      </main>

      {/* ALERT DIALOG DE ELIMINACION DE SUCURSAL */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <IconAlertTriangle size={20} /> ¿Estás completamente seguro?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la sucursal <strong>{branchToDelete?.name}</strong> de la base de datos.
              Esta acción no se puede deshacer y podría afectar los registros asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBranchToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                if (!branchToDelete) return;
                try {
                  const res = await fetch(`${API}/branches/${branchToDelete.id || branchToDelete._id}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
                  });
                  if(res.ok) {
                    setSucursales(sucursales.filter(s => (s.id || s._id) !== (branchToDelete.id || branchToDelete._id)));
                    toast.success("Sucursal eliminada definitivamente");
                    window.dispatchEvent(new Event("branchUpdated"));
                  } else {
                    const err = await res.json();
                    toast.error(err.message || "Error al eliminar la sucursal");
                  }
                } catch { toast.error("Error de conexión al servidor"); }
                finally { setBranchToDelete(null); }
              }}
            >
              Sí, eliminar sucursal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Modal Permisos de PIN */}
      <Dialog open={isPinPermissionsModalOpen} onOpenChange={setIsPinPermissionsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500">
              <IconLock size={20} /> Permisos de Autorización (PIN)
            </DialogTitle>
            <DialogDescription>
              Selecciona qué acciones dentro del sistema solicitarán el ingreso del PIN de autorización de 4 dígitos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
            {[
              { key: 'applyDiscount', label: 'Aplicar Descuentos (Porcentaje o Monto)', desc: 'Solicitará el PIN antes de abrir el modal de descuentos en el punto de venta.' },
              { key: 'deleteCartItem', label: 'Eliminar Producto del Carrito', desc: 'Evita que los cajeros borren productos que ya habían sido marcados o registrados.' },
              { key: 'cancelSale', label: 'Cancelar Venta (Limpiar Carrito)', desc: 'Evita la anulación completa de un carrito de compras que estaba en proceso.' },
              { key: 'processReturn', label: 'Procesar Devoluciones de Venta', desc: 'Evita que se realicen retornos de mercancía y entregas de dinero sin supervisión.' },
              { key: 'closeShift', label: 'Cerrar Caja (Turno)', desc: 'Protege el proceso de cuadre de caja al final del día.' },
              { key: 'inventoryAdjustments', label: 'Ajustes de Inventario y Conteo Físico', desc: 'Aplica a finalizaciones de auditorías y ajustes manuales en el módulo de inventario.' }
            ].map(perm => (
              <div key={perm.key} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-bold leading-tight">{perm.label}</Label>
                  <p className="text-[11px] text-muted-foreground leading-snug">{perm.desc}</p>
                </div>
                <Switch 
                  checked={!!pinPermissions[perm.key]}
                  onCheckedChange={(val) => setPinPermissions({ ...pinPermissions, [perm.key]: val })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPinPermissionsModalOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-amber-500 hover:bg-amber-600 text-white" 
              onClick={async () => {
                try {
                  const token = localStorage.getItem("token");
                  const res = await fetch(`${API}/settings`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ pinPermissions })
                  });
                  if (res.ok) {
                    toast.success("Permisos de autorización guardados");
                    setIsPinPermissionsModalOpen(false);
                  } else throw new Error();
                } catch {
                  toast.error("Error al guardar los permisos");
                }
              }}
            >
              Guardar Permisos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
