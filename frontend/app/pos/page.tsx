"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BranchSwitcher } from "@/components/branch-switcher";
import { ModeSwitcher } from "@/components/mode-switcher";
import { ThemeSelector } from "@/components/theme-selector";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconShoppingCart, IconTrash, IconSearch, IconCash, IconCreditCard,
  IconPlus, IconMinus, IconUser, IconChevronRight, IconUserPlus, IconX, IconBox,
  IconArrowLeft, IconLogout, IconDeviceDesktop, IconCalculator, IconRefresh, IconReceiptTax,
  IconEye, IconPencil, IconScan, IconCamera, IconBarcode, IconAlertCircle
} from "@tabler/icons-react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { useSync } from "@/hooks/useSync";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

type Product = {
  id: string;
  name: string;
  totalStock: number;
  variants: Array<{
    id: string;
    name: string;
    price: number;
    stock: number;
    sku: string;
    barcode?: string;
  }>;
  image?: string;
  category?: { name: string };
};

type Client = {
  id: string;
  _id?: string;
  name: string;
  documentId?: string;
};

type CartProduct = {
  id: string;
  variantId: string;
  name: string;
  price: number;
  stock: number;
};

type CartItem = {
  product: CartProduct;
  quantity: number;
};

type Shift = {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openingBalance: number;
  closingBalance?: number;
  openedAt: string;
  closedAt?: string;
  userId: string;
  branchId: string;
};

// Ticket View for Printing
const ThermalTicket = ({ order, settings }: { order: any, settings: any }) => {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="hidden print:block font-mono text-[10px] w-[80mm] p-4 text-black bg-white mx-auto uppercase">
      <div className="text-center mb-4">
        <h2 className="text-sm font-black tracking-widest">{settings?.businessName || 'SYNCRO POS'}</h2>
        <p>{settings?.businessAddress || 'S/N'}</p>
        <p>{settings?.businessPhone || 'TEL: 000-0000000'}</p>
        <div className="my-2 border-b border-dashed border-black" />
      </div>
      <div className="flex justify-between mb-1">
        <span>#VENTA: {order.id?.substring(0,8) || '0000'}</span>
        <span>{order.date}</span>
      </div>
      <div className="flex justify-between mb-4">
        <span>CLIENTE: {order.clientName}</span>
      </div>
      <div className="border-b border-dashed border-black mb-2" />
      <table className="w-full mb-2">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left font-normal pb-1">CANT</th>
            <th className="text-left font-normal pb-1 uppercase">DETALLE</th>
            <th className="text-right font-normal pb-1">SUB</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it: any, i: number) => (
            <tr key={it.id || i}>
              <td className="py-1">{it.quantity}X</td>
              <td className="py-1 uppercase">{it.product.name}</td>
              <td className="py-1 text-right">${(it.product.price * it.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-dashed border-black pt-2 space-y-1">
        <div className="flex justify-between font-black text-xs">
          <span>TOTAL USD:</span>
          <span>${order.total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between italic">
          <span>TASA BCV: Bs {(order?.payments?.[0]?.exchangeRate || settings?.exchangeRate || 1).toFixed(2)}</span>
          <span>BS: {(order.total * (order?.payments?.[0]?.exchangeRate || settings?.exchangeRate || 1)).toLocaleString('es-VE')}</span>
        </div>
      </div>
      <div className="text-center mt-6">
        <p>¡GRACIAS POR SU COMPRA!</p>
        <p className="text-[8px] mt-2 italic text-slate-500">Documento no fiscal • Generado por Syncro POS</p>
      </div>
    </div>
  );
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

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD">("CASH");
  const [amountReceived, setAmountReceived] = useState<string>("0");
  
  // Quick Client State
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", documentId: "", phone: "" });
  const [savingClient, setSavingClient] = useState(false);

  // Client document search
  const [clientDocSearch, setClientDocSearch] = useState("");
  const [searchingClient, setSearchingClient] = useState(false);

  // Advanced Payment State
  const [addedPayments, setAddedPayments] = useState<any[]>([]);
  const [tempPaymentMethod, setTempPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER">("CASH");
  const [tempAmount, setTempAmount] = useState<string>("0");
  const [syncingBcv, setSyncingBcv] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [baseCurrency, setBaseCurrency] = useState<"USD" | "EUR">("USD");

  // Scanner & Waitlist State
  const [scannerOpen, setScannerOpen] = useState(false);
  const [useCamera, setUseCamera] = useState(false);
  const [isDetected, setIsDetected] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistData, setWaitlistData] = useState({ name: "", price: "", stock: "1", barcode: "" });
  const [savingWaitlist, setSavingWaitlist] = useState(false);

  // Auth & Hydration state
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const scannerInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-focus hidden input for laser scanner
  useEffect(() => {
    if (scannerOpen && !useCamera) {
      const timer = setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [scannerOpen, useCamera]);

  const { isOnline, syncPendingSales, pullRemoteData } = useSync();

  const canAccessDashboard = user?.permissions?.includes("dashboard") || user?.role === "ownerpos" || user?.role === "admin";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const currentExchangeRate = baseCurrency === "USD" ? (settings?.exchangeRate || 1) : (settings?.exchangeRateEur || 1);

  const checkShift = useCallback(async () => {
    try {
      const currentToken = localStorage.getItem("token") || "";
      const h = { Authorization: `Bearer ${currentToken}`, "Content-Type": "application/json" };
      const res = await fetch(`${API}/shifts/active`, { headers: h });
      const data = await res.json();
      if (res.ok && data && data.status === "OPEN") {
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
    
    // First, load from LOCAL DB for an instant UI
    try {
      const localProducts = await db.products.toArray();
      const localClients = await db.clients.toArray();
      
      if (localProducts.length > 0) {
        setProducts(localProducts as any);
      }
      if (localClients.length > 0) {
        setClients(localClients as any);
      }
    } catch (e) {
      console.error("Local load error", e);
    } finally {
      if (products.length > 0) setLoading(false);
    }

    // Then, pull from remote to update local DB and refresh UI
    if (navigator.onLine) {
      await pullRemoteData();
      
      // Refresh local state from updated DB
      const updatedProducts = await db.products.toArray();
      const updatedClients = await db.clients.toArray();
      setProducts(updatedProducts as any);
      setClients(updatedClients as any);
      
      // Also fetch settings which aren't in IndexedDB yet
      const currentToken = localStorage.getItem("token") || "";
      const h = { Authorization: `Bearer ${currentToken}`, "Content-Type": "application/json" };
      try {
        const sRes = await fetch(`${API}/settings`, { headers: h });
        const sData = await sRes.json();
        setSettings(sData);
        if (sData && sData.taxRate) {
          setTaxRate(Number(sData.taxRate));
        }
      } catch (e) {}
    }
    
    setLoading(false);
  }, [pullRemoteData, products.length]);

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

  // BARCODE SCANNER GLOBAL LISTENER
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [lastCharTime, setLastCharTime] = useState(0);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if focus is in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const currentTime = new Date().getTime();
      const diff = currentTime - lastCharTime;

      // Reset buffer if delay > 50ms (typing manually vs scanner)
      if (diff > 50) {
        if (e.key.length === 1) setBarcodeBuffer(e.key);
      } else {
        if (e.key.length === 1) setBarcodeBuffer(prev => prev + e.key);
      }

      setLastCharTime(currentTime);

      if (e.key === "Enter") {
        if (barcodeBuffer.length > 2) {
          processBarcode(barcodeBuffer);
        }
        setBarcodeBuffer("");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [barcodeBuffer, lastCharTime]);

  useEffect(() => {
    let html5QrCode: any = null;

    const startScanner = async () => {
      try {
        let element = null;
        for (let i = 0; i < 10; i++) {
          element = document.getElementById("reader");
          if (element) break;
          await new Promise(r => setTimeout(r, 100));
        }
        if (!element) return;

        html5QrCode = new Html5Qrcode("reader");
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 60,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                return { width: viewfinderWidth * 0.9, height: viewfinderHeight * 0.5 };
            },
            aspectRatio: 1.0,
            disableFlip: true,
            videoConstraints: {
                width: { min: 1280, ideal: 1920, max: 3840 },
                height: { min: 720, ideal: 1080, max: 2160 },
                facingMode: "environment",
                focusMode: "continuous",
            }
          },
          (decodedText: string) => {
            setIsDetected(true);
            const audio = new Audio("/scanner.mp3");
            audio.play().catch(() => {});
            processBarcode(decodedText);
            setTimeout(() => {
              setScannerOpen(false);
              setUseCamera(false);
              setIsDetected(false);
            }, 800);
          },
          () => {}
        );
      } catch (err) {
        console.error("Camera error", err);
      }
    };

    if (useCamera && scannerOpen) {
      startScanner();
    }

    return () => {
      if (html5QrCode) {
        const cleanup = async () => {
            if (html5QrCode.isScanning) {
                await html5QrCode.stop();
            }
        };
        cleanup().catch(() => {});
      }
    };
  }, [useCamera, scannerOpen]);

  const processBarcode = (code: string) => {
    console.log("Processing Barcode:", code);
    const found = products.find(p => 
      p.variants?.some(v => v.barcode === code || v.sku === code)
    );
    if (found) {
      addToCart(found);
      toast.success(`Leído: ${found.name}`, { icon: '🔍' });
    } else {
      toast.error(`Producto no encontrado (${code})`);
      setWaitlistData(prev => ({ ...prev, barcode: code }));
      setWaitlistOpen(true);
    }
  };

  const handleWaitlistSubmit = async () => {
    if (!waitlistData.name || !waitlistData.price) {
      return toast.error("Nombre y precio son obligatorios");
    }
    setSavingWaitlist(true);
    try {
      const currentBranchId = localStorage.getItem("currentBranchId");
      const res = await fetch(`${API}/products/waitlist`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...waitlistData,
          price: Number(waitlistData.price),
          stock: Number(waitlistData.stock),
          branchId: currentBranchId
        }),
      });

      if (res.ok) {
        const created = await res.json();
        toast.success("Producto agregado a lista de espera y carrito");
        
        // Add to cart as a "Ghost/Waitlist" product
        const waitlistProduct: CartProduct = {
          id: `waitlist-${created.id}`,
          variantId: "", // Empty for waitlist
          name: `(ESPERA) ${created.name}`,
          price: created.price,
          stock: created.stock,
        };
        
        setCart(prev => [...prev, { product: waitlistProduct, quantity: 1, waitlistId: created.id } as any]);
        setWaitlistOpen(false);
        setWaitlistData({ name: "", price: "", stock: "1", barcode: "" });
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al guardar en lista de espera");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingWaitlist(false);
    }
  };



  const handleOpenShift = async () => {
    try {
      // Check if token is valid
      const currentToken = localStorage.getItem("token");
      if (!currentToken) {
        toast.error("No hay sesión activa. Por favor inicie sesión nuevamente.");
        router.push("/login");
        return;
      }

      const currentBranchId = localStorage.getItem("currentBranchId") || "";
      if (!currentBranchId) {
        toast.error("No hay una sucursal seleccionada");
        return;
      }

      if (!openingBalance || Number(openingBalance) < 0) {
        toast.error("Monto de apertura inválido");
        return;
      }
      
      console.log("Opening shift with:", {
        openingBalance: Number(openingBalance),
        branchId: currentBranchId,
        token: currentToken.substring(0, 20) + "..."
      });
      
      const res = await fetch(`${API}/shifts/open`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          openingBalance: Number(openingBalance),
          branchId: currentBranchId
        }),
      });
      
      console.log("Shift open response status:", res.status);
      
      if (res.ok) {
        const data = await res.json();
        setActiveShift(data);
        toast.success("Caja abierta correctamente");
      } else {
        const err = await res.json();
        console.error("Shift open error:", err);
        
        if (res.status === 401) {
          toast.error("Sesión expirada. Por favor inicie sesión nuevamente.");
          router.push("/login");
        } else {
          toast.error(err.message || "Error al abrir caja");
        }
      }
    } catch (error) {
      console.error("Shift open error:", error);
      toast.error("Error de conexión");
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    try {
      if (!activeShift.id) {
        toast.error("ID de turno no encontrado");
        return;
      }
      
      const res = await fetch(`${API}/shifts/close/${activeShift.id}`, {
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
    const variant = product.variants?.[0]; // Default to first variant for now
    if (!variant || variant.stock <= 0) {
      toast.error("Producto sin stock");
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.variantId === variant.id);
      if (existing) {
        if (existing.quantity >= variant.stock) {
          toast.error("No hay más stock disponible");
          return prev;
        }
        return prev.map(item => 
          item.product.variantId === variant.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      // Store dummy product with variant details for UI
      const uiProduct: CartProduct = {
        id: product.id,
        variantId: variant.id,
        name: product.name + (variant.name !== 'Principal' ? ` (${variant.name})` : ''),
        price: variant.price,
        stock: variant.stock,
      };
      return [...prev, { product: uiProduct, quantity: 1 }];
    });

  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === id) {
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
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const updatedTotal = subtotal + (subtotal * (taxRate / 100));
  
  // Calculate IGTF based on CASH payments added
  const cashPaymentsTotal = addedPayments
    .filter(p => p.method === "CASH")
    .reduce((acc, p) => acc + p.amount, 0);
  
  const igtfRateVal = settings?.igtfRate !== undefined && settings?.igtfRate !== null ? Number(settings.igtfRate) : 3;
  const igtfAmount = cashPaymentsTotal * (igtfRateVal / 100);
  const finalTotalWithIgtf = updatedTotal + igtfAmount;
  const remainingToPay = finalTotalWithIgtf - addedPayments.reduce((acc, p) => acc + p.amount, 0);

  const openPaymentModal = (method: "CASH" | "CARD") => {
    setPaymentMethod(method);
    setAddedPayments([]); // Start fresh for mixed payment logic if needed, or just keep it
    setTempPaymentMethod(method);
    setTempAmount(finalTotalWithIgtf.toFixed(2));
    setIsPaymentModalOpen(true);
  };

  const handleSyncBcv = async () => {
    setSyncingBcv(true);
    try {
      const res = await fetch(`${API}/settings/sync-bcv`, { method: "POST", headers });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        toast.success(`Tasas BCV actualizadas exitosamente`);
        loadData();
      } else {
        toast.error("No se pudo sincronizar la tasa");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSyncingBcv(false);
    }
  };

  const addPayment = () => {
    const amt = Number(tempAmount);
    if (amt <= 0) return toast.error("Monto inválido");
    
    setAddedPayments([...addedPayments, {
      method: tempPaymentMethod,
      amount: amt,
      amountLocal: amt * currentExchangeRate,
      exchangeRate: currentExchangeRate,
      reference: ""
    }]);
    setTempAmount("0");
  };

  const processSale = async () => {
    if (cart.length === 0) return toast.error("El carrito está vacío");
    if (remainingToPay > 0.01) return toast.error("Aún falta saldo por cubrir");
    
    setProcessing(true);
    
    try {
      const currentBranchId = localStorage.getItem("currentBranchId");
      if (!currentBranchId) {
        toast.error("Seleccione una sucursal primero");
        setProcessing(false);
        return;
      }

      const saleData = {
        branchId: currentBranchId,
        items: cart.map(item => ({
          variantId: (item as any).waitlistId ? null : item.product.variantId,
          waitlistId: (item as any).waitlistId || null,
          quantity: item.quantity,
          price: item.product.price, // Ensure price is sent
          subtotal: item.product.price * item.quantity
        })),
        payments: addedPayments,
        clientId: selectedClientId === "consumidor-final" ? null : selectedClientId,
      };

      // OFFLINE MODE: If offline, queue the sale
      if (!navigator.onLine) {
        await db.pendingSales.add({
          data: saleData,
          status: "pending",
          createdAt: Date.now()
        });

        toast.success("Venta guardada localmente (Pendiente de sincronizar)", {
          description: "La venta se subirá al sistema automáticamente cuando se recupere la conexión.",
          duration: 6000
        });

        setCart([]);
        setIsPaymentModalOpen(false);
        setProcessing(false);
        return;
      }

      // ONLINE MODE: Direct POST
      const res = await fetch(`${API}/sales`, {
        method: "POST", headers, body: JSON.stringify(saleData),
      });

      if (res.ok) {
        toast.success("Venta realizada con éxito");
        // Print logic
        const settings = {
          businessName: user?.companyName || "SYNCRO POS",
          exchangeRate: currentExchangeRate
        }
        // Small delay to allow react to render ThermalTicket if needed
        setTimeout(() => window.print(), 100);

        setCart([]);
        setIsPaymentModalOpen(false);
        loadData(); // Refresh stock
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al procesar la venta");
      }
    } catch (e) {
      // Catch network errors and queue locally
      console.error("Sale error, checking offline fallback", e);
      
      const currentBranchId = localStorage.getItem("currentBranchId");
      const saleData = {
        branchId: currentBranchId,
        items: cart.map(item => ({ variantId: item.product.variantId, quantity: item.quantity })),
        payments: addedPayments,
        clientId: selectedClientId === "consumidor-final" ? null : selectedClientId,
      };

      await db.pendingSales.add({
        data: saleData,
        status: "pending",
        createdAt: Date.now()
      });

      toast.warning("Error de red. Venta guardada localmente.", {
        description: "Se sincronizará al recuperar conexión."
      });

      setCart([]);
      setIsPaymentModalOpen(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClient.name) return toast.error("El nombre es obligatorio");
    setSavingClient(true);
    try {
      const res = await fetch(`${API}/clients`, {
        method: "POST",
        headers,
        body: JSON.stringify(newClient),
      });
      if (res.ok) {
        const created = await res.json();
        toast.success(`Cliente "${created.name}" registrado correctamente`);
        setClients(prev => [...prev, created]);
        setSelectedClientId(created.id || created._id);
        setIsQuickClientOpen(false);
        setNewClient({ name: "", documentId: "", phone: "" });
        setClientDocSearch("");
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al registrar cliente");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingClient(false);
    }
  };

  const handleClientDocSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !clientDocSearch.trim()) return;
    setSearchingClient(true);
    try {
      const res = await fetch(`${API}/clients/search?q=${encodeURIComponent(clientDocSearch.trim())}`, { headers });
      const results = await res.json();
      if (results && results.length > 0) {
        const found = results[0];
        setSelectedClientId(found.id);
        // Ensure client is in local list
        setClients(prev => prev.find(c => c.id === found.id) ? prev : [...prev, found]);
        toast.success(`Cliente encontrado: ${found.name}`);
        setClientDocSearch("");
      } else {
        toast.warning("Cliente no encontrado. Complete el registro.");
        setNewClient(prev => ({ ...prev, documentId: clientDocSearch.trim() }));
        setIsQuickClientOpen(true);
      }
    } catch {
      toast.error("Error buscando cliente");
    } finally {
      setSearchingClient(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.variants?.some(v => 
      v.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    )
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
        <header className="h-14 bg-background border-b px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center">
            {canAccessDashboard && (
              <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="h-8 w-8 mr-4">
                <IconArrowLeft className="size-4" />
              </Button>
            )}
            <h1 className="font-bold text-lg tracking-tight">SYNCRO POS</h1>
          </div>
          <BranchSwitcher />
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
                {canAccessDashboard ? (
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
                      toast.info("Sesión cerrada");
                      localStorage.clear();
                      router.push("/");
                    }}
                  >
                    <IconLogout className="size-4 mr-2" /> Cerrar Sesión
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
    <div className="flex flex-col h-screen bg-muted/20 print:bg-white p-0">
      
      {/* THERMAL TICKET RENDER */}
      <ThermalTicket 
        order={{
          id: 'POS-INTERNAL',
          date: new Date().toLocaleDateString(),
          clientName: clients.find(c => c.id === selectedClientId || c._id === selectedClientId)?.name || "Consumidor Final",
          total: updatedTotal,
          items: cart,
          payments: addedPayments.map(p => ({
            method: p.method,
            amount: p.amount,
            amountLocal: p.amountLocal,
            exchangeRate: p.exchangeRate || currentExchangeRate
          }))
        }}
        settings={{
          businessName: "SYNCRO POS",
          exchangeRate: currentExchangeRate
        }}
      />

      <header className="h-14 bg-background border-b px-6 flex items-center justify-between sticky top-0 z-10 shrink-0 print:hidden">
        <div className="flex items-center gap-4">
          {canAccessDashboard && (
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="h-8 w-8">
              <IconArrowLeft className="size-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg tracking-tight">SYNCRO POS</h1>
            <Badge variant="outline" className={cn(
              "hidden sm:inline-flex text-[10px] h-5 py-0 px-1.5 font-bold uppercase tracking-wider",
              isOnline ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"
            )}>
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-[10px] text-muted-foreground leading-none">Cajero</p>
            <p className="text-xs font-semibold leading-none mt-1">{user?.name || "Administrador"}</p>
          </div>
          {settings?.bcvUpdateDate && (
            <div className="hidden lg:flex flex-col items-end mr-1">
              <p className="text-[10px] text-muted-foreground leading-none">Fecha Valor</p>
              <p className="text-xs font-semibold text-[#79716b] leading-none mt-1">{settings.bcvUpdateDate}</p>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Select value={baseCurrency} onValueChange={(v: "USD" | "EUR") => setBaseCurrency(v)}>
              <SelectTrigger className="h-8 w-[72px] text-[10px] font-bold border-[#79716b]/30 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD" className="text-xs font-semibold">USD</SelectItem>
                <SelectItem value="EUR" className="text-xs font-semibold">EUR</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 border-[#79716b]/30 gap-2" onClick={handleSyncBcv} disabled={syncingBcv}>
              <IconRefresh size={14} className={syncingBcv ? "animate-spin" : ""} />
              <span className="text-[10px] font-bold">BCV: {currentExchangeRate.toFixed(2)}</span>
            </Button>
          </div>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <BranchSwitcher />
          <div className="flex items-center gap-1">
            <ThemeSelector />
            <ModeSwitcher />
          </div>
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
            <Separator orientation="vertical" className="h-4 mx-1" />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-primary hover:bg-primary/5" 
              onClick={() => setScannerOpen(true)}
              title="Escanear con cámara"
            >
              <IconScan size={18} />
            </Button>
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
                    key={p.id} 
                    className={`cursor-pointer border rounded-md hover:border-primary bg-background overflow-hidden flex flex-col group transition-all h-full ${p.totalStock <= 0 ? 'opacity-50 pointer-events-none' : ''}`}
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
                      {p.totalStock <= 5 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-red-600/10 text-red-600 text-[8px] font-bold py-0.5 text-center px-1">
                          STOCK BAJO: {p.totalStock}
                        </div>
                      )}
                    </div>
                    <div className="p-2 flex flex-col flex-1 justify-between gap-1">
                      <div>
                        <p className="font-semibold text-[11px] leading-tight line-clamp-2">{p.name}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{p.variants?.[0]?.sku}</p>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-bold text-xs">${(p.variants?.[0]?.price || 0).toFixed(2)}</span>
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
            
            <div className="space-y-2">
              <div className="flex justify-between items-center px-0.5">
                <Label className="text-[10px] font-black uppercase text-[#79716b] tracking-widest">Identificación Cliente</Label>
                <button className="text-primary text-[10px] font-bold hover:underline" onClick={() => setIsQuickClientOpen(true)}>
                  + NUEVO
                </button>
              </div>
              {/* Smart document search */}
              <div className="relative">
                <Input
                  placeholder="Buscar por cédula / RIF... (Enter)"
                  value={clientDocSearch}
                  onChange={e => setClientDocSearch(e.target.value)}
                  onKeyDown={handleClientDocSearch}
                  className="h-8 text-xs pr-8"
                  disabled={searchingClient}
                />
                {searchingClient && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <IconRefresh size={12} className="animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="h-9 text-xs bg-muted/20 border-[#79716b]/30">
                  <SelectValue placeholder="Seleccionar Cliente" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-[#79716b]/30">
                  <SelectItem value="consumidor-final">Consumidor Final</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.documentId || 'S/D'})</SelectItem>
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
                <div key={item.product.id} className="p-3 rounded-lg border bg-muted/5 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-[11px] leading-tight flex-1">{item.product.name}</p>
                    <p className="font-bold text-xs ml-2">${(item.product.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center border rounded h-7">
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none border-r" onClick={() => updateQuantity(item.product.id, -1)}>
                        <IconMinus size={10} />
                      </Button>
                      <span className="w-8 text-center text-[10px] font-bold">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none border-l" onClick={() => updateQuantity(item.product.id, 1)}>
                        <IconPlus size={10} />
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(item.product.id)}>
                      <IconTrash size={12} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t bg-muted/5 shrink-0 space-y-4">
            <div className="space-y-1.5 px-1">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>IVA ({taxRate}%)</span>
                <span className="tabular-nums">${(subtotal * (taxRate / 100)).toFixed(2)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-foreground">Total Checkout</span>
                <span className="text-[10px] text-muted-foreground font-medium tabular-nums">~ Bs {(updatedTotal * currentExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
              </div>
              <span className="text-2xl font-black tracking-tight tabular-nums">${updatedTotal.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" className="h-11 font-black text-[10px] uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20" onClick={() => openPaymentModal("CASH")} disabled={cart.length === 0 || processing}>
                <IconCash className="size-4 mr-2" /> Pagar Mixto
              </Button>
              <Button size="sm" variant="outline" className="h-11 font-black text-[10px] uppercase tracking-widest border-[#79716b]/30 hover:bg-[#79716b]/10" onClick={() => openPaymentModal("CARD")} disabled={cart.length === 0 || processing}>
                <IconCreditCard className="size-4 mr-2" /> Crédito / Débito
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
      
      {/* DIALOG: PAYMENT CALCULATION */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full border ${paymentMethod === 'CASH' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20'}`}>
                {paymentMethod === 'CASH' ? <IconCash size={20} /> : <IconCreditCard size={20} />}
              </div>
              <div className="space-y-1">
                <DialogTitle>Finalizar Venta</DialogTitle>
                <DialogDescription>
                  Revisa los montos y añade los pagos correspondientes.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Totals Summary */}
            <div className="flex justify-between items-center bg-muted/50 p-4 rounded-lg border">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Monto a Pagar (Base + IVA)</p>
                <p className="text-2xl font-bold">${updatedTotal.toFixed(2)}</p>
              </div>
              {igtfAmount > 0 && (
                <div className="text-right">
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-500 mb-1">Impacto IGTF (3%)</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    + ${igtfAmount.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Payment Entry Form */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium leading-none">Registrar Pago</h4>
                <Badge variant="secondary" className="font-mono text-xs">
                  Total Final: ${finalTotalWithIgtf.toFixed(2)}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Select value={tempPaymentMethod} onValueChange={(v: any) => setTempPaymentMethod(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Efectivo</SelectItem>
                    <SelectItem value="CARD">Tarjeta</SelectItem>
                    <SelectItem value="TRANSFER">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input 
                    type="number" 
                    className="pl-7 font-medium"
                    value={tempAmount}
                    onChange={(e) => setTempAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <Button variant="secondary" onClick={addPayment}>Añadir</Button>
              </div>
            </div>

            {/* List of Added Payments */}
            {addedPayments.length > 0 && (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 mt-2">
                {addedPayments.map((p, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-md border bg-card animate-in slide-in-from-left-2 duration-200">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full border bg-muted flex items-center justify-center text-muted-foreground">
                        {p.method === 'CASH' ? <IconCash size={14} /> : p.method === 'CARD' ? <IconCreditCard size={14} /> : <IconRefresh size={14} />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{p.method === 'CASH' ? 'Efectivo' : p.method === 'CARD' ? 'Tarjeta' : 'Transferencia'}</span>
                        <span className="text-xs text-muted-foreground">Bs {p.amountLocal.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-base font-semibold tabular-nums">${p.amount.toFixed(2)}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setAddedPayments(addedPayments.filter((_, idx) => idx !== i))}>
                        <IconX size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Remaining Balance Summary */}
            {remainingToPay > 0.001 ? (
              <div className="flex justify-between items-center px-4 py-3 rounded-lg bg-rose-50 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20">
                  <span className="text-sm font-medium text-rose-600 dark:text-rose-400">Saldo Pendiente</span>
                  <span className="text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">${remainingToPay.toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex justify-between items-center px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20">
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Total Cubierto</span>
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">$0.00</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>Cancelar</Button>
            <Button 
                onClick={processSale} 
                disabled={processing || remainingToPay > 0.01}
                className="w-full sm:w-auto"
            >
              {processing ? "Procesando..." : "Confirmar Venta y Emitir Recibo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: QUICK CLIENT REGISTRATION */}
      <Dialog open={isQuickClientOpen} onOpenChange={setIsQuickClientOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconUserPlus size={18} className="text-primary" /> Nuevo Cliente
            </DialogTitle>
            <DialogDescription>
              Completa los datos para registrar el cliente en el sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
             <div className="space-y-2">
               <Label>Nombre Completo <span className="text-destructive">*</span></Label>
               <Input 
                placeholder="Juan Pérez"
                value={newClient.name}
                onChange={(e) => setNewClient({...newClient, name: e.target.value})}
               />
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Cédula / RIF</Label>
                 <Input 
                  placeholder="V-12345678"
                  className="tabular-nums"
                  value={newClient.documentId}
                  onChange={(e) => setNewClient({...newClient, documentId: e.target.value})}
                 />
               </div>
               <div className="space-y-2">
                 <Label>Teléfono</Label>
                 <Input 
                  placeholder="0414-0000000"
                  className="tabular-nums"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                 />
               </div>
             </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsQuickClientOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateClient} disabled={savingClient}>
              {savingClient ? "Guardando..." : "Registrar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CLOSE SHIFT (ARQUEO DE CAJA) */}
      <Dialog open={isClosingShift} onOpenChange={setIsClosingShift}>
        <DialogContent className="sm:max-w-[400px] bg-zinc-950 border-[#79716b]/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
              <IconCalculator className="text-rose-500" /> Cierre de Turno
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
              Finalización de jornada y arqueo de caja
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
             <div className="p-4 rounded-xl bg-[#79716b]/5 border border-[#79716b]/10 space-y-3">
               <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#79716b]">
                 <span>Monto de Apertura</span>
                 <span className="text-white">${activeShift?.openingBalance?.toFixed(2)}</span>
               </div>
               <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#79716b]">
                 <span>Ventas en Efectivo</span>
                 <span className="text-emerald-500">CONSULTANDO...</span>
               </div>
             </div>

             <div className="space-y-3">
               <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monto Real en Caja (Contado)</Label>
               <div className="relative">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                 <Input 
                  type="number"
                  className="h-14 pl-8 bg-zinc-900 border-[#79716b]/30 text-2xl font-black tabular-nums"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                 />
               </div>
               <p className="text-[9px] text-muted-foreground italic text-center">Ingrese el monto total de efectivo que tiene físicamente en la gaveta.</p>
             </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="ghost" onClick={() => setIsClosingShift(false)} className="font-bold text-[10px] uppercase">Cancelar</Button>
            <Button onClick={handleCloseShift} disabled={isClosingShift && processing} className="flex-1 bg-rose-600 hover:bg-rose-700 h-11 font-black text-[11px] uppercase tracking-widest">
              {processing ? "PROCESANDO..." : "FINALIZAR JORNADA Y CERRAR CAJA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: ESCÁNER Y CÁMARA (ESTILO UNIFICADO) */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className="sm:max-w-md overflow-hidden bg-black/95 border-white/10 shadow-2xl p-0">
          <DialogHeader className="sr-only">
             <DialogTitle>Captura de Código de Barras</DialogTitle>
          </DialogHeader>
          
          <div className="relative w-full h-[360px] sm:h-[400px] flex flex-col items-center justify-center">
            {/* Header Flotante del Modal */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-full border border-white/10">
                 <div className={cn("size-2 rounded-full", isDetected ? "bg-green-500" : "bg-emerald-500 animate-pulse")} />
                 <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {useCamera ? "CÁMARA ACTIVA" : "LISTO PARA CAPTURA"}
                 </span>
              </div>
              <Button variant="ghost" size="icon" className="size-8 rounded-full bg-black/50 hover:bg-white/10 text-white" onClick={() => setScannerOpen(false)}>
                <IconX size={16} />
              </Button>
            </div>

            {!useCamera ? (
              <div className="flex flex-col items-center w-full max-w-[280px] text-center space-y-6 pt-4 animate-in zoom-in-95 duration-500">
                <input 
                  ref={scannerInputRef}
                  autoFocus
                  className="opacity-0 absolute top-0 left-0 size-1 pointer-events-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value;
                      if (val) processBarcode(val);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                  onBlur={() => {
                    if (scannerOpen && !useCamera) {
                       setTimeout(() => scannerInputRef.current?.focus(), 100);
                    }
                  }}
                />
                <div className="w-full flex flex-col items-center justify-center py-12 gap-8 bg-muted/10 border border-muted/20 rounded-2xl relative overflow-hidden">
                   <div className="size-24 rounded-xl bg-background border border-muted/50 shadow-sm flex items-center justify-center text-muted-foreground relative z-10">
                     <IconBarcode size={48} stroke={1.2} />
                   </div>
                   <div className="text-center space-y-2 relative z-10">
                     <p className="font-semibold text-lg tracking-tight">Escáner Listo</p>
                     <p className="text-[11px] text-muted-foreground/50 font-normal tracking-tight">Esperando lector láser...</p>
                   </div>
                </div>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="mx-auto size-14 hover:bg-primary/5 transition-all group" 
                  onClick={() => setUseCamera(true)}
                  title="Usar Cámara"
                >
                  <IconCamera size={32} className="text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-all duration-500" />
                </Button>
              </div>
            ) : (
                <div className="w-full space-y-6 relative flex flex-col items-center justify-center py-6">
                    <div className={cn(
                        "relative w-[280px] h-[100px] rounded-xl overflow-hidden border shadow-2xl bg-black transition-all duration-500",
                        isDetected ? "border-green-500" : "border-white/10"
                    )}>
                        <div id="reader" className="absolute inset-0"></div>
                        
                        {/* Láser Minimalista (Oscilante) */}
                        <div className={cn(
                            "absolute inset-x-4 z-10 animate-scanline transition-all duration-300",
                            isDetected ? "text-green-500" : "text-primary"
                        )} />
                        
                        {/* Esquinas Rectangulares */}
                        <div className="absolute inset-3 z-20 pointer-events-none opacity-20">
                            <div className={cn("absolute top-0 left-0 size-4 border-t border-l transition-colors duration-500", isDetected ? "border-green-500" : "border-white")} />
                            <div className={cn("absolute top-0 right-0 size-4 border-t border-r transition-colors duration-500", isDetected ? "border-green-500" : "border-white")} />
                            <div className={cn("absolute bottom-0 left-0 size-4 border-b border-l transition-colors duration-500", isDetected ? "border-green-500" : "border-white")} />
                            <div className={cn("absolute bottom-0 right-0 size-4 border-b border-r transition-colors duration-500", isDetected ? "border-green-500" : "border-white")} />
                        </div>

                        {isDetected && (
                            <div className="absolute inset-0 bg-green-500/20 z-10 animate-in fade-in zoom-in duration-300" />
                        )}
                    </div>
                </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: PRODUCT WAITLIST (FOR NON-EXISTING PRODUCTS) */}
      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <IconAlertCircle className="text-amber-500" /> Producto no registrado
            </DialogTitle>
            <DialogDescription className="text-xs">
              El código <strong>{waitlistData.barcode}</strong> no existe. Ingréselo en la lista de espera para poder facturarlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
             <div className="space-y-2">
               <Label>Nombre del Producto <span className="text-destructive">*</span></Label>
               <Input 
                placeholder="Ej. Refresco Cola 2L"
                value={waitlistData.name}
                onChange={(e) => setWaitlistData({...waitlistData, name: e.target.value})}
               />
             </div>
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Precio Sugerido ($) <span className="text-destructive">*</span></Label>
                 <Input 
                  type="number"
                  placeholder="0.00"
                  value={waitlistData.price}
                  onChange={(e) => setWaitlistData({...waitlistData, price: e.target.value})}
                 />
               </div>
               <div className="space-y-2">
                 <Label>Stock Inicial</Label>
                 <Input 
                  type="number"
                  placeholder="1"
                  value={waitlistData.stock}
                  onChange={(e) => setWaitlistData({...waitlistData, stock: e.target.value})}
                 />
               </div>
             </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWaitlistOpen(false)}>Cancelar</Button>
            <Button onClick={handleWaitlistSubmit} disabled={savingWaitlist} className="bg-amber-500 hover:bg-amber-600">
              {savingWaitlist ? "Guardando..." : "Agregar a Espera y Carrito"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
