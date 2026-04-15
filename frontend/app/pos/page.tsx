"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BranchSwitcher } from "@/components/branch-switcher";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconShoppingCart, IconTrash, IconSearch, IconCash, IconCreditCard,
  IconPlus, IconMinus, IconUser, IconChevronRight, IconUserPlus, IconX, IconBox,
  IconArrowLeft, IconLogout, IconDeviceDesktop, IconCalculator
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

type Product = {
  _id: string;
  name: string;
  price: number;
  stock: number;
  sku: string;
  image?: string;
  barcodes?: string[];
  category?: { name: string };
};

type Client = {
  _id: string;
  name: string;
  documentId: string;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type Shift = {
  _id: string;
  status: 'OPEN' | 'CLOSED';
  openingBalance: number;
};

export default function POSPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("consumidor-final");
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [taxRate, setTaxRate] = useState(16);

  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [openingBalance, setOpeningBalance] = useState<string>("0");
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [closingBalance, setClosingBalance] = useState<string>("0");

  // Auth & Hydration state
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  const isOwner = user && user.role !== "pos";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const checkShift = useCallback(async () => {
    try {
      const res = await fetch(`${API}/shifts/active`, { headers });
      const data = await res.json();
      if (data && data.status === "OPEN") {
        setActiveShift(data);
      } else {
        setActiveShift(null);
      }
    } catch (error) {
      console.error("Error checking shift:", error);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const currentBranchId = localStorage.getItem("currentBranchId") || "";
    try {
      const pUrl = currentBranchId ? `${API}/products?branchId=${currentBranchId}` : `${API}/products`;
      const [pRes, cRes, sRes] = await Promise.all([
        fetch(pUrl, { headers }),
        fetch(`${API}/clients`, { headers }),
        fetch(`${API}/settings`, { headers }),
      ]);
      const pData = await pRes.json();
      const cData = await cRes.json();
      const sData = await sRes.json();

      setProducts(Array.isArray(pData) ? pData : []);
      setClients(Array.isArray(cData) ? cData : []);
      if (sData && sData.taxRate) {
        setTaxRate(Number(sData.taxRate));
      }
    } catch {
      toast.error("Error al cargar datos del punto de venta");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    const storedToken = localStorage.getItem("token") || "";
    const storedUserStr = localStorage.getItem("user");
    if (storedUserStr) setUser(JSON.parse(storedUserStr));
    setToken(storedToken);
  }, []);

  useEffect(() => {
    if (mounted && token) {
      checkShift();
    } else if (mounted && !token) {
      router.push("/");
    }
  }, [mounted, token, checkShift, router]);

  useEffect(() => {
    if (activeShift) {
      loadData();
    }
  }, [activeShift, loadData]);

  const handleOpenShift = async () => {
    try {
      const res = await fetch(`${API}/shifts/open`, {
        method: "POST",
        headers,
        body: JSON.stringify({ openingBalance: Number(openingBalance) }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveShift(data);
        toast.success("Caja abierta correctamente");
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al abrir caja");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    try {
      const res = await fetch(`${API}/shifts/close/${activeShift._id}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ closingBalance: Number(closingBalance) }),
      });
      if (res.ok) {
        setActiveShift(null);
        setIsClosingShift(false);
        toast.success("Caja cerrada correctamente");
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al cerrar caja");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error("Producto sin stock");
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product._id === product._id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error("No hay más stock disponible");
          return prev;
        }
        return prev.map(item => 
          item.product._id === product._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product._id === id) {
        const newQty = item.quantity + delta;
        if (newQty > item.product.stock) {
          toast.error("Stock insuficiente");
          return item;
        }
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.product._id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const processSale = async (paymentMethod: "CASH" | "CARD") => {
    if (cart.length === 0) return toast.error("El carrito está vacío");
    if (!activeShift) return toast.error("No hay un turno activo");

    setProcessing(true);
    
    try {
      const currentBranchId = localStorage.getItem("currentBranchId");
      const saleData = {
        branch: currentBranchId || null,
        client: selectedClientId === "consumidor-final" ? null : selectedClientId,
        items: cart.map(item => ({
          product: item.product._id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
          subtotal: item.product.price * item.quantity,
        })),
        paymentMethod,
        subtotal,
        tax,
        total,
        shiftId: activeShift._id,
        status: "COMPLETED",
      };

      const res = await fetch(`${API}/sales`, {
        method: "POST", headers, body: JSON.stringify(saleData),
      });

      if (res.ok) {
        toast.success("Venta realizada con éxito");
        setCart([]);
        loadData(); // Refresh stock
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al procesar la venta");
      }
    } catch {
      toast.error("Error de conexión con el servidor");
    } finally {
      setProcessing(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p as any).barcodes?.some((bc: string) => bc.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!mounted || initialLoading) {
    return (
      <div className="h-screen w-full flex flex-col bg-background">
        <header className="h-14 border-b px-6 flex items-center justify-between shrink-0">
          <Skeleton className="h-8 w-32" />
          <div className="flex gap-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </header>
        <div className="flex-1 flex flex-col lg:flex-row h-full">
          {/* Main Area Skeleton */}
          <div className="flex-1 flex flex-col h-full border-r">
            <div className="p-6 border-b flex gap-4">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-24" />
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-3">
                  <Skeleton className="h-32 w-full rounded-md" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          </div>
          {/* Sidebar Skeleton */}
          <div className="w-[380px] p-6 space-y-6">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-6 border-t space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-32" />
              </div>
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SCREEN: Opening Cash Register
  if (!activeShift) {
    return (
      <div className="h-screen w-full flex flex-col bg-muted/10">
        {/* Header for opening screen */}
        <header className="h-14 bg-background border-b px-6 flex items-center shrink-0">
          {isOwner && (
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="h-8 w-8 mr-4">
              <IconArrowLeft className="size-4" />
            </Button>
          )}
          <h1 className="font-bold text-lg tracking-tight">SYNCRO POS</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm space-y-8 bg-background border p-8 rounded-lg shadow-sm">
            <div className="space-y-2 text-center">
              <div className="size-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconCalculator className="size-6 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight leading-none">Terminal de Venta</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Inicie su turno de trabajo estableciendo el fondo de caja inicial.
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 border rounded-md bg-muted/30">
                <IconUser className="size-5 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-medium text-muted-foreground">Cajero</span>
                  <span className="text-sm font-semibold leading-none">{user?.name || "Administrador"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="opening-balance">Monto Inicial en Caja</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                  <Input 
                    id="opening-balance"
                    type="number" 
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="pl-7 h-12 text-xl font-semibold"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleOpenShift} 
                className="w-full h-11"
              >
                Abrir Caja Registradora
              </Button>
              
              <div className="flex flex-col gap-1">
                {isOwner ? (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="w-full h-9 text-muted-foreground gap-2"
                    onClick={() => router.push("/dashboard")}
                  >
                    <IconArrowLeft className="size-3" /> Regresar al Dashboard
                  </Button>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="w-full h-9 text-destructive hover:bg-destructive/5"
                    onClick={() => {
                      localStorage.clear();
                      router.push("/");
                    }}
                  >
                    Cerrar Sesión
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t text-center">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest leading-none">
              SYNCRO POS • {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

  // MAIN POS INTERFACE
  return (
    <div className="flex flex-col h-screen bg-muted/20">
      
      <header className="h-14 bg-background border-b px-6 flex items-center justify-between sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-4">
          {isOwner && (
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="h-8 w-8">
              <IconArrowLeft className="size-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg tracking-tight">SYNCRO POS</h1>
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] h-5 py-0">Terminal Activa</Badge>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-[10px] text-muted-foreground leading-none">Cajero</p>
            <p className="text-xs font-semibold leading-none mt-1">{user?.name || "Administrador"}</p>
          </div>
          <Separator orientation="vertical" className="h-6 mx-1" />
          {isOwner && <BranchSwitcher />}
          <Button 
            variant="ghost" 
            size="sm"
            className="text-destructive font-medium h-8"
            onClick={() => setIsClosingShift(true)}
          >
            <IconCash size={16} className="mr-2" /> Cerrar Turno
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-4 p-4 lg:p-6 pb-2">
        
        {/* SECCIÓN IZQUIERDA: PRODUCTOS */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center gap-3 bg-background border rounded-md px-3 h-10 shrink-0 shadow-sm">
            <IconSearch className="text-muted-foreground size-4 shrink-0" />
            <Input 
              placeholder="Buscar productos por nombre o SKU..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-full p-0"
            />
            {searchTerm && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSearchTerm("")}>
                <IconX size={14} />
              </Button>
            )}
          </div>

          {/* Rejilla de Productos */}
          <div className="flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(12)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <div className="h-32 bg-muted rounded-t-lg" />
                    <CardContent className="p-4 flex flex-col gap-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map(p => (
                  <div 
                    key={p._id} 
                    className={`cursor-pointer border rounded-md hover:border-primary bg-background overflow-hidden flex flex-col group transition-all h-full ${p.stock <= 0 ? 'opacity-50 pointer-events-none' : ''}`}
                    onClick={() => addToCart(p)}
                  >
                    <div className="aspect-square bg-muted/50 overflow-hidden border-b relative">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="size-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="size-full flex items-center justify-center opacity-20">
                          <IconBox size={24} />
                        </div>
                      )}
                      {p.stock <= 5 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-red-600/10 text-red-600 text-[8px] font-bold py-0.5 text-center px-1">
                          STOCK BAJO: {p.stock}
                        </div>
                      )}
                    </div>
                    <div className="p-2 flex flex-col flex-1 justify-between gap-1">
                      <div>
                        <p className="font-semibold text-[11px] leading-tight line-clamp-2">{p.name}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{p.sku}</p>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-bold text-xs">${p.price.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-[380px] flex flex-col h-full bg-background border rounded-lg overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-muted/10 shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <IconShoppingCart className="text-primary size-4" /> Ticket Actual
                </h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {cart.length} productos • {new Date().toLocaleDateString()}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/5" onClick={() => setCart([])}>
                <IconTrash size={16} />
              </Button>
            </div>
            
            <Separator className="mt-4 mb-3" />
            
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-0.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Cliente</Label>
                <button className="text-primary text-[10px] hover:underline" onClick={() => toast.info("Módulo de clientes pronto...")}>
                  Nuevo
                </button>
              </div>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Seleccionar Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consumidor-final">Consumidor Final</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3 opacity-30 py-20">
                <IconShoppingCart size={48} />
                <p className="text-xs font-bold uppercase tracking-widest">Carrito Vacío</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product._id} className="p-3 rounded-lg border bg-muted/5 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-[11px] leading-tight flex-1">{item.product.name}</p>
                    <p className="font-bold text-xs ml-2">${(item.product.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center border rounded h-7">
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none border-r" onClick={() => updateQuantity(item.product._id, -1)}>
                        <IconMinus size={10} />
                      </Button>
                      <span className="w-8 text-center text-[10px] font-bold">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none border-l" onClick={() => updateQuantity(item.product._id, 1)}>
                        <IconPlus size={10} />
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(item.product._id)}>
                      <IconTrash size={12} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t bg-muted/5 shrink-0 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Total Cobrar</span>
              <span className="text-2xl font-bold tracking-tight text-primary">${total.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" className="h-10 font-bold text-xs uppercase" onClick={() => processSale("CASH")} disabled={cart.length === 0 || processing}>
                <IconCash className="size-4 mr-2" /> Efectivo
              </Button>
              <Button size="sm" variant="outline" className="h-10 font-bold text-xs uppercase" onClick={() => processSale("CARD")} disabled={cart.length === 0 || processing}>
                <IconCreditCard className="size-4 mr-2" /> Tarjeta
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* DIALOG: CLOSE SHIFT */}
      <Dialog open={isClosingShift} onOpenChange={setIsClosingShift}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Cerrar Turno</DialogTitle>
            <DialogDescription className="text-xs">
              Ingrese el efectivo total en caja para el arqueo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="closing-balance" className="text-xs">Efectivo en Caja</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input 
                  id="closing-balance"
                  type="number" 
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  className="pl-7 h-11 font-semibold"
                  autoFocus
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setIsClosingShift(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCloseShift}>Confirmar Cierre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}
