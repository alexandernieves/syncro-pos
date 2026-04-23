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
  IconShoppingCart, IconTrash, IconWallet, IconSearch, IconCash, IconCreditCard,
  IconPlus, IconMinus, IconUser, IconChevronRight, IconUserPlus, IconX, IconBox,
  IconArrowLeft, IconLogout, IconDeviceDesktop, IconDevices, IconCalculator, IconRefresh, IconReceiptTax,
  IconEye, IconPencil, IconScan, IconCamera, IconBarcode, IconAlertCircle, IconCircleCheckFilled,
  IconHexagon, IconWorld, IconBuilding, IconHistory, IconReceipt, IconFilter, IconArrowBackUp,
  IconPlayerPause, IconReceiptOff
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
import { Switch } from "@/components/ui/switch";
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
  walletBalance?: number;
};

type CartProduct = {
  id: string;
  variantId?: string;
  waitlistId?: string;
  name: string;
  price: number;
  stock: number;
  sku?: string;
  barcode?: string;
};

type ProductWaitlist = {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode: string;
  status: string;
  branchId?: string;
  createdAt: string;
  branch?: { name: string };
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
  expectedTotals?: {
    CASH: number;
    CARD: number;
    TRANSFER: number;
    PAGO_MOVIL: number;
    BINANCE: number;
    ZINLI: number;
    PAYPAL: number;
  };
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
  const [cashBreakdown, setCashBreakdown] = useState({ b1: 0, b5: 0, b10: 0, b20: 0, b50: 0, b100: 0 });
  const [posBatch, setPosBatch] = useState<string>("0");
  const [pagoMovilBatch, setPagoMovilBatch] = useState<string>("0");
  const [cashBs, setCashBs] = useState<string>("0");

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
  const [tempPaymentMethod, setTempPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER" | "PAGO_MOVIL" | "BINANCE" | "ZINLI" | "PAYPAL">("CASH");
  const [saveChangeToWallet, setSaveChangeToWallet] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(true);
  const [tempAmount, setTempAmount] = useState<string>("0");
  const [tempReference, setTempReference] = useState<string>("");
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

  // View state for toggling between POS and History
  const [view, setView] = useState<'pos' | 'history'>('pos');
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string>("");
  const [user, setUser] = useState<any>(null);

  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState<any>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState("");
  const [processingReturn, setProcessingReturn] = useState(false);
  const [fetchingSaleDetails, setFetchingSaleDetails] = useState(false);

  // Waitlist State
  const [waitlist, setWaitlist] = useState<ProductWaitlist[]>([]);
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);

  // Parked Tickets State
  const [parkedTickets, setParkedTickets] = useState<any[]>([]);
  const [isParkedModalOpen, setIsParkedModalOpen] = useState(false);

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
      fetchWaitlist();
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
            qrbox: 250,
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
      
      const totalPhysicalUsd = cashBreakdown.b1 + (cashBreakdown.b5*5) + (cashBreakdown.b10*10) + (cashBreakdown.b20*20) + (cashBreakdown.b50*50) + (cashBreakdown.b100*100);
      const totalPhysicalBsToUsd = (Number(cashBs) || 0) / currentExchangeRate;
      const finalClosingBalance = totalPhysicalUsd + totalPhysicalBsToUsd;
      
      const res = await fetch(`${API}/shifts/close/${activeShift.id}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ closingBalance: finalClosingBalance }),
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
        sku: variant.sku,
        barcode: variant.barcode,
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
  const totalPaid = addedPayments.reduce((acc, p) => acc + p.amount, 0);
  const remainingToPay = Math.max(0, finalTotalWithIgtf - totalPaid);
  const changeDue = Math.max(0, totalPaid - finalTotalWithIgtf);
  const changeDueBs = changeDue * currentExchangeRate;

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
      reference: tempPaymentMethod !== "CASH" ? tempReference : ""
    }]);
    setTempAmount("0");
    setTempReference("");
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
        saveChangeToWallet: saveChangeToWallet ? Math.abs(remainingToPay) : 0,
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
        
        if (printReceipt) {
          setTimeout(() => window.print(), 100);
        }
        
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
        if (printReceipt) {
          setTimeout(() => window.print(), 100);
        }

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
        items: cart.map(item => ({ 
          variantId: item.product.variantId || null, 
          waitlistId: item.product.waitlistId || null,
          quantity: item.quantity 
        })),
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
      
      if (printReceipt) {
        setTimeout(() => window.print(), 100);
      }
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

  const openReturnModal = async (sale: any) => {
    setSelectedSaleForReturn(null);
    setReturnQuantities({});
    setReturnReason("");
    setFetchingSaleDetails(true);
    setIsReturnModalOpen(true);

    try {
      const res = await fetch(`${API}/sales/${sale.id}`, { headers });
      if (res.ok) {
        const fullSale = await res.json();
        setSelectedSaleForReturn(fullSale);
        
        // Initialize return quantities to 0
        const initialQtys: Record<string, number> = {};
        fullSale.items.forEach((item: any) => {
          if (item.variantId) initialQtys[item.variantId] = 0;
        });
        setReturnQuantities(initialQtys);
      } else {
        toast.error("Error al obtener detalles de la venta");
        setIsReturnModalOpen(false);
      }
    } catch (error) {
      console.error("Error fetching sale details:", error);
      toast.error("Error de conexión");
      setIsReturnModalOpen(false);
    } finally {
      setFetchingSaleDetails(false);
    }
  };

  const handleReturnSubmit = async () => {
    if (!selectedSaleForReturn) return;
    
    const itemsToReturn = Object.entries(returnQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([variantId, quantity]) => ({ variantId, quantity }));
    
    if (itemsToReturn.length === 0) {
      return toast.error("Debe seleccionar al menos un artículo para devolver");
    }

    setProcessingReturn(true);
    try {
      const res = await fetch(`${API}/sales/${selectedSaleForReturn.id}/return`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          items: itemsToReturn,
          reason: returnReason
        })
      });

      if (res.ok) {
        toast.success("Devolución procesada correctamente");
        setIsReturnModalOpen(false);
        // Refresh history
        const hRes = await fetch(`${API}/sales`, { headers });
        const hData = await hRes.json();
        setSalesHistory(Array.isArray(hData) ? hData : []);
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al procesar la devolución");
      }
    } finally {
      setProcessingReturn(false);
    }
  };

  const fetchWaitlist = async () => {
    setLoadingWaitlist(true);
    try {
      const res = await fetch(`${API}/products/waitlist/all`, { headers });
      if (res.ok) {
        const data = await res.json();
        setWaitlist(data);
      } else {
        toast.error("Error al obtener lista de espera");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setLoadingWaitlist(false);
    }
  };

  const addWaitlistItemToCart = (item: ProductWaitlist) => {
    setCart(prev => {
      const existing = prev.find(ci => ci.product.waitlistId === item.id);
      if (existing) {
        return prev.map(ci => 
          ci.product.waitlistId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      const uiProduct: CartProduct = {
        id: `waitlist-${item.id}`,
        waitlistId: item.id,
        name: item.name + " (En Espera)",
        price: item.price,
        stock: 999, // Infinite virtual stock
        barcode: item.barcode,
      };
      return [...prev, { product: uiProduct, quantity: 1 }];
    });
    toast.success(`${item.name} añadido al carrito`);
  };

  const parkTicket = () => {
    if (cart.length === 0) return toast.error("El carrito está vacío");
    const newTicket = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      cart: [...cart],
      selectedClientId,
      clientDocSearch,
      parkedAt: new Date().toISOString(),
    };
    setParkedTickets(prev => [newTicket, ...prev]);
    setCart([]);
    setSelectedClientId("consumidor-final");
    setClientDocSearch("");
    toast.success("Ticket puesto en espera", {
      description: `ID: ${newTicket.id}`
    });
  };

  const resumeTicket = (ticket: any) => {
    if (cart.length > 0) {
      return toast.error("Vacíe o pause el ticket actual antes de recuperar uno en espera.");
    }
    setCart(ticket.cart);
    setSelectedClientId(ticket.selectedClientId);
    setClientDocSearch(ticket.clientDocSearch || "");
    setParkedTickets(prev => prev.filter(t => t.id !== ticket.id));
    setIsParkedModalOpen(false);
    toast.success("Ticket recuperado");
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
          <BranchSwitcher disabled={!!activeShift} />
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
          <BranchSwitcher disabled={!!activeShift} />
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
        
        {/* SECCIÓN IZQUIERDA: CONTENIDO PRINCIPAL (PRODUCTOS O HISTORIAL) */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          
          {/* BARRA DE CONTROLES SUPERIOR */}
          <div className="flex items-center justify-between gap-4 shrink-0">
            {/* Buscador (Solo en vista POS) */}
            <div className={cn(
              "flex items-center gap-3 bg-background border rounded-md px-3 h-10 flex-1 shadow-sm transition-all",
              view === 'history' && "opacity-50 pointer-events-none grayscale"
            )}>
              <IconSearch className="text-muted-foreground size-4 shrink-0" />
              <Input 
                placeholder="Buscar productos por nombre o SKU..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-full p-0"
                disabled={view === 'history'}
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

            {/* Toggle Historial */}
            <Button 
              variant={view === "history" ? "secondary" : "outline"} 
              className="h-10 px-4 gap-2 border shadow-sm shrink-0"
              onClick={async () => {
                if (view === 'pos') {
                  setView('history');
                  setHistoryLoading(true);
                  try {
                    const res = await fetch(`${API}/sales`, { 
                      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } 
                    });
                    const data = await res.json();
                    setSalesHistory(Array.isArray(data) ? data : []);
                  } catch (e) {
                    console.error("Error fetching sales history", e);
                  } finally {
                    setHistoryLoading(false);
                  }
                } else {
                  setView('pos');
                }
              }}
            >
              <IconHistory size={18} className={view === "history" ? "text-primary" : ""} />
              <span className="font-bold text-xs">Historial</span>
            </Button>

            <Button 
              variant="outline"
              className="h-10 px-4 gap-2 border shadow-sm shrink-0 border-amber-500/30 hover:bg-amber-500/5 text-amber-600"
              onClick={() => {
                fetchWaitlist();
                setIsWaitlistOpen(true);
              }}
            >
              <IconAlertCircle size={18} />
              <span className="text-sm font-medium hidden md:inline">Lista de Espera</span>
              {waitlist.length > 0 && (
                <Badge className="ml-1 px-1 h-4 min-w-4 bg-amber-500 text-[10px] text-white">{waitlist.length}</Badge>
              )}
            </Button>

            <Button 
              variant="outline"
              className="h-10 px-4 gap-2 border shadow-sm shrink-0 border-[#79716b]/20 hover:bg-muted/50 transition-all group text-foreground"
              onClick={() => setIsParkedModalOpen(true)}
            >
              <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <IconPlayerPause size={12} />
              </div>
              <span className="text-sm font-medium hidden md:inline">Tickets en Pausa</span>
              {parkedTickets.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {parkedTickets.length}
                </span>
              )}
            </Button>
          </div>

          {view === "pos" ? (
            <div className="flex-1 overflow-y-auto pr-1">
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="animate-pulse border rounded-md overflow-hidden bg-muted/20 aspect-[3/4]">
                      <div className="h-32 bg-muted/40" />
                      <div className="p-4 space-y-2">
                        <div className="h-4 bg-muted/40 w-3/4 rounded" />
                        <div className="h-4 bg-muted/40 w-1/4 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 pt-20">
                  <IconBox size={60} stroke={1} className="mb-4" />
                  <p className="text-xl font-black uppercase tracking-widest text-center">Sin resultados</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-8">
                  {filteredProducts.map(p => (
                    <div 
                      key={p.id} 
                      className={cn(
                        "cursor-pointer border rounded-md hover:border-primary bg-background overflow-hidden flex flex-col group transition-all h-full",
                        p.totalStock <= 0 && "opacity-50 pointer-events-none"
                      )}
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
                        <div className="flex flex-col h-full">
                          <p className="font-semibold text-[11px] leading-tight line-clamp-2" title={p.name}>{p.name}</p>
                          <div className="flex items-end justify-between mt-auto pt-2">
                             <span className="font-bold text-xs">${(p.variants?.[0]?.price || 0).toFixed(2)}</span>
                             <div className="flex flex-col items-end gap-0.5 mt-1 text-right shrink-0">
                               <p className="text-[9px] font-mono text-muted-foreground uppercase leading-none" title="SKU Interno">
                                 {p.variants?.[0]?.sku || 'S/SKU'}
                               </p>
                               {p.variants?.[0]?.barcode && (
                                 <p className="text-[8.5px] font-mono text-muted-foreground/60 flex items-center justify-end gap-1 leading-none" title="Código de Barras">
                                   <IconBarcode size={10} stroke={1.5} />
                                   {p.variants[0].barcode}
                                 </p>
                               )}
                             </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 bg-background border rounded-lg overflow-hidden flex flex-col shadow-sm">
              <div className="p-4 border-b bg-muted/10 flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <IconReceipt size={16} className="text-primary" /> Historial de Ventas
                  </h2>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Control de actividad de facturación</p>
                </div>
                <div className="flex items-center gap-2">
                   <Button variant="outline" size="sm" className="h-8 text-[10px] uppercase font-bold tracking-widest gap-2" onClick={() => setView('pos')}>
                      Volver al POS
                   </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto bg-muted/5">
                {historyLoading ? (
                  <div className="p-6 space-y-4">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
                  </div>
                ) : salesHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-40 py-20">
                    <IconHistory size={48} stroke={1} className="mb-2" />
                    <p className="text-xs font-bold uppercase tracking-widest">Sin ventas registradas</p>
                  </div>
                ) : (
                  <div className="min-w-full inline-block align-middle">
                    <table className="w-full text-sm">
                      <thead className="bg-background sticky top-0 border-b z-10">
                        <tr>
                          <th className="p-4 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground">ID Venta</th>
                          <th className="p-4 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Fecha / Hora</th>
                          <th className="p-4 text-left font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Cliente</th>
                          <th className="p-4 text-right font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Artículos</th>
                          <th className="p-4 text-right font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Total USD</th>
                          <th className="p-4 text-center font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-background/50">
                        {salesHistory.map((sale) => (
                          <tr key={sale.id} className="hover:bg-muted/10 transition-colors group">
                            <td className="p-4">
                              <code className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded uppercase">
                                #{sale.id.slice(-6)}
                              </code>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-[11px]">{new Date(sale.createdAt).toLocaleDateString()}</span>
                                <span className="text-[10px] text-muted-foreground font-medium">{new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="size-7 rounded-full bg-muted flex items-center justify-center border">
                                  <IconUser size={12} className="text-muted-foreground opacity-70" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-bold group-hover:text-primary transition-colors">{sale.client?.name || "Consumidor Final"}</span>
                                  <span className="text-[9px] text-muted-foreground">{sale.client?.documentId || "No identificado"}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                               <div className="inline-flex flex-col items-end">
                                  <span className="font-bold text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 border text-muted-foreground">
                                    {sale.items?.length || 0} ITEMS
                                  </span>
                               </div>
                            </td>
                            <td className="p-4 text-right font-black text-xs tabular-nums text-foreground/90">
                              ${sale.total?.toFixed(2)}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-3">
                                <Badge className="text-[9px] font-black tracking-widest px-1.5 h-6 bg-emerald-500/10 text-emerald-600 border-none shadow-none">COMPLETA</Badge>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-amber-500 hover:bg-amber-500/10 hover:text-amber-600 transition-colors"
                                  onClick={() => openReturnModal(sale)}
                                  title="Procesar Devolución"
                                >
                                  <IconArrowBackUp size={18} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SECCIÓN DERECHA: CARRITO Y PAGO */}
        <div className="w-full lg:w-[380px] flex flex-col h-full bg-background border rounded-lg overflow-hidden shadow-sm shrink-0">
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
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-blue-600 hover:bg-blue-500/5" 
                  onClick={parkTicket}
                  title="Poner ticket en espera"
                >
                  <IconPlayerPause size={16} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-destructive hover:bg-destructive/5" 
                  onClick={() => setCart([])}
                  title="Vaciar carrito"
                >
                  <IconTrash size={16} />
                </Button>
              </div>
            </div>
            
            <Separator className="mt-4 mb-3" />
            
            <div className="space-y-2">
              <div className="flex justify-between items-center px-0.5">
                <Label className="text-[10px] font-black uppercase text-[#79716b] tracking-widest">Identificación Cliente</Label>
                <button className="text-primary text-[10px] font-bold hover:underline" onClick={() => setIsQuickClientOpen(true)}>
                  + NUEVO
                </button>
              </div>
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
                    <SelectItem key={c.id || (c as any)._id} value={c.id || (c as any)._id}>{c.name} ({c.documentId || 'S/D'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClientId !== "consumidor-final" && (() => {
                const client = clients.find(c => (c.id || (c as any)._id) === selectedClientId);
                if (client && client.walletBalance && client.walletBalance > 0) {
                  return (
                    <div className="flex items-center justify-between mt-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1.5">
                        <IconWallet size={14} /> Saldo a Favor
                      </span>
                      <span className="text-sm font-black text-emerald-600 tabular-nums">
                        ${client.walletBalance.toFixed(2)}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
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
                <div key={item.product.variantId || item.product.id} className="p-3 rounded-lg border bg-muted/5 flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-bold text-[11px] leading-tight flex-1">{item.product.name}</p>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <p className="font-bold text-xs">${(item.product.price * item.quantity).toFixed(2)}</p>
                      <p className="text-[9px] font-mono text-muted-foreground uppercase leading-none">
                        {item.product.sku || 'S/SKU'}
                      </p>
                      {item.product.barcode && (
                        <p className="text-[8.5px] font-mono text-muted-foreground/60 flex items-center gap-1 leading-none">
                          <IconBarcode size={9} stroke={1.5} />
                          {item.product.barcode}
                        </p>
                      )}
                    </div>
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
            <Button 
                size="lg" 
                className="w-full h-12 font-black text-xs uppercase tracking-[0.15em] bg-[#10b981] hover:bg-[#059669] text-white shadow-xl shadow-emerald-900/40 relative group overflow-hidden transition-all duration-300" 
                onClick={() => openPaymentModal("CASH")} 
                disabled={cart.length === 0 || processing}
            >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative flex items-center justify-center gap-3">
                    <IconCash className="size-5" /> 
                    PROCESAR PAGO
                </span>
            </Button>
          </div>
        </div>
      </div>

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
            
            {/* Show Client Wallet Balance in Payment Modal */}
            {selectedClientId !== "consumidor-final" && (() => {
              const client = clients.find(c => (c.id || (c as any)._id) === selectedClientId);
              if (client && client.walletBalance && client.walletBalance > 0) {
                return (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-3 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <IconWallet size={16} className="text-emerald-600" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Saldo a Favor</span>
                        <span className="text-[10px] text-emerald-600/80 font-medium">Disponible en monedero</span>
                      </div>
                    </div>
                    <span className="text-xl font-black text-emerald-600 tabular-nums">
                      ${client.walletBalance.toFixed(2)}
                    </span>
                  </div>
                );
              }
              return null;
            })()}

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
                    {settings?.pagoMovilEnabled && <SelectItem value="PAGO_MOVIL">Pago Móvil</SelectItem>}
                    {settings?.binanceEnabled && <SelectItem value="BINANCE" className="text-yellow-600 dark:text-yellow-500 font-bold">Binance Pay</SelectItem>}
                    {settings?.zinliEnabled && <SelectItem value="ZINLI" className="text-purple-600 dark:text-purple-400 font-bold">Zinli</SelectItem>}
                    {settings?.paypalEnabled && <SelectItem value="PAYPAL" className="text-blue-600 dark:text-blue-500 font-bold">PayPal</SelectItem>}
                  </SelectContent>
                </Select>
                
                {tempPaymentMethod !== "CASH" && (
                  <Input 
                    type="text" 
                    className="flex-1 font-medium text-xs placeholder:text-[10px] uppercase"
                    value={tempReference}
                    onChange={(e) => setTempReference(e.target.value)}
                    placeholder="Últimos 4 o Ref."
                    maxLength={20}
                  />
                )}
                
                <div className="relative w-[110px]">
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

              {/* PAGO MOVIL DATA DISPLAY */}
              {tempPaymentMethod === "PAGO_MOVIL" && settings?.pagoMovilEnabled && (
                <div className="mt-2 p-4 rounded-xl bg-blue-50 border border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/20 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-6 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                      <IconDevices size={14} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">Datos para Pago Móvil</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div className="flex justify-between items-center border-b border-blue-200/30 pb-1.5">
                      <span className="text-muted-foreground/80">Banco</span>
                      <span className="font-bold text-blue-900 dark:text-blue-100">{settings.pagoMovilBank || "No configurado"}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-blue-200/30 pb-1.5">
                      <span className="text-muted-foreground/80">Cédula / RIF</span>
                      <span className="font-bold text-blue-900 dark:text-blue-100">{settings.pagoMovilId || "No configurado"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground/80">Teléfono</span>
                      <span className="font-bold text-blue-900 dark:text-blue-100">{settings.pagoMovilPhone || "No configurado"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* BINANCE DATA DISPLAY */}
              {tempPaymentMethod === "BINANCE" && settings?.binanceEnabled && (
                <div className="mt-2 p-4 rounded-xl bg-yellow-50 border border-yellow-200 dark:bg-yellow-500/10 dark:border-yellow-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-6 rounded-lg bg-yellow-500 flex items-center justify-center text-white">
                      <IconHexagon size={14} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-yellow-700 dark:text-yellow-400">Datos para Binance Pay</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div className="flex justify-between items-center border-b border-yellow-200/50 pb-1.5">
                      <span className="text-muted-foreground/80">Binance ID</span>
                      <span className="font-bold text-yellow-900 dark:text-yellow-200">{settings.binanceId || "No configurado"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground/80">Correo</span>
                      <span className="font-bold text-yellow-900 dark:text-yellow-200">{settings.binanceEmail || "No configurado"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ZINLI DATA DISPLAY */}
              {tempPaymentMethod === "ZINLI" && settings?.zinliEnabled && (
                <div className="mt-2 p-4 rounded-xl bg-purple-50 border border-purple-100 dark:bg-purple-500/10 dark:border-purple-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-6 rounded-lg bg-purple-600 flex items-center justify-center text-white">
                      <IconWorld size={14} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">Datos para Zinli</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground/80">Correo de cuenta</span>
                    <span className="font-bold text-purple-900 dark:text-purple-200">{settings.zinliEmail || "No configurado"}</span>
                  </div>
                </div>
              )}

              {/* PAYPAL DATA DISPLAY */}
              {tempPaymentMethod === "PAYPAL" && settings?.paypalEnabled && (
                <div className="mt-2 p-4 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-800/10 dark:border-blue-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-6 rounded-lg bg-blue-800 flex items-center justify-center text-white">
                      <IconBuilding size={14} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">Datos para PayPal</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground/80">Correo de cuenta</span>
                    <span className="font-bold text-blue-900 dark:text-blue-100">{settings.paypalEmail || "No configurado"}</span>
                  </div>
                </div>
              )}
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
                        <span className="text-sm font-medium">
                          {p.method === 'CASH' ? 'Efectivo' : 
                           p.method === 'CARD' ? 'Tarjeta' : 
                           p.method === 'PAGO_MOVIL' ? 'Pago Móvil' : 
                           p.method === 'BINANCE' ? 'Binance Pay' :
                           p.method === 'ZINLI' ? 'Zinli' :
                           p.method === 'PAYPAL' ? 'PayPal' :
                           'Transferencia'}
                        </span>
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

            {/* Remaining Balance or Change Due */}
            {remainingToPay > 0.001 ? (
              <div className="flex justify-between items-center px-5 py-4 rounded-xl bg-destructive/5 border border-destructive/10 animate-in fade-in duration-300">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-destructive/70">Saldo Pendiente</span>
                    <span className="text-[11px] text-muted-foreground font-mono">Bs {(remainingToPay * currentExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-destructive tabular-nums">${remainingToPay.toFixed(2)}</span>
                  </div>
              </div>
            ) : changeDue > 0.001 ? (
              <div className="flex flex-col gap-4 p-5 rounded-2xl bg-muted/20 border border-border/50 animate-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Vuelto al Cliente</span>
                      </div>
                      <span className="text-4xl font-black tracking-tighter tabular-nums text-foreground">${changeDue.toFixed(2)}</span>
                    </div>
                    <div className="size-12 rounded-2xl bg-background border flex items-center justify-center shadow-sm">
                      <IconCash size={24} className="text-primary" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Separator className="flex-1 opacity-50" />
                    <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest whitespace-nowrap">Conversión</span>
                    <Separator className="flex-1 opacity-50" />
                  </div>

                  <div className="flex justify-between items-end">
                    <span className="text-[11px] font-medium text-muted-foreground">Equivalente en Bolívares</span>
                    <span className="text-xl font-bold tabular-nums text-primary">Bs {changeDueBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {selectedClientId !== "consumidor-final" && (
                    <div className="mt-2 pt-4 border-t border-border/50 flex items-center justify-between animate-in slide-in-from-bottom-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <IconWallet size={14} className="text-primary" />
                          Abonar al Monedero
                        </span>
                        <span className="text-[10px] text-muted-foreground">Guardar vuelto como saldo a favor</span>
                      </div>
                      <Switch 
                        checked={saveChangeToWallet} 
                        onCheckedChange={setSaveChangeToWallet} 
                      />
                    </div>
                  )}
              </div>
            ) : (
              <div className="flex justify-between items-center px-5 py-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <IconCircleCheckFilled size={18} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider">Total Totalmente Cubierto</span>
                  </div>
                  <span className="text-2xl font-black tabular-nums">$0.00</span>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between items-center gap-4 w-full">
            <div className="flex items-center gap-2 self-start sm:self-center">
              <Switch 
                checked={printReceipt} 
                onCheckedChange={setPrintReceipt} 
                id="print-receipt" 
              />
              <Label htmlFor="print-receipt" className="text-xs cursor-pointer font-medium text-muted-foreground hover:text-foreground transition-colors">
                Emitir Recibo Automáticamente
              </Label>
            </div>
            <div className="flex w-full sm:w-auto gap-2">
              <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)} className="flex-1 sm:flex-none">Cancelar</Button>
              <Button 
                  onClick={processSale} 
                  disabled={processing || remainingToPay > 0.01}
                  className="flex-1 sm:flex-none"
              >
                {processing ? "Procesando..." : "Confirmar Venta"}
              </Button>
            </div>
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
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <IconCalculator className="text-primary" size={20} /> Arqueo de Caja Detallado
            </DialogTitle>
            <DialogDescription>
              Ingrese los montos físicos para realizar el cierre de caja. El sistema calculará los sobrantes o faltantes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            
            {/* Expected Totals Summary */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-3 rounded-lg bg-muted/30 border space-y-1">
                <p className="text-muted-foreground text-xs font-medium">Efectivo USD Esperado</p>
                <p className="font-semibold text-base">${activeShift?.expectedTotals?.CASH?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border space-y-1">
                <p className="text-muted-foreground text-xs font-medium">Punto y Pago Móvil</p>
                <p className="font-semibold text-base">Bs {((activeShift?.expectedTotals?.CARD || 0) + (activeShift?.expectedTotals?.PAGO_MOVIL || 0)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <Separator />

            {/* USD Bills Breakdown */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Billetes (USD)</h4>
              <div className="grid grid-cols-3 gap-3">
                {([1, 5, 10, 20, 50, 100] as const).map(bill => (
                  <div key={bill} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">${bill}</Label>
                    <Input 
                      type="number" 
                      min="0"
                      className="h-8" 
                      value={cashBreakdown[`b${bill}` as keyof typeof cashBreakdown] || ''}
                      onChange={e => setCashBreakdown({ ...cashBreakdown, [`b${bill}`]: Number(e.target.value) })}
                      placeholder="Cant."
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Bs Cash and Digital */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Bolívares y Digital</h4>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-3">
                  <Label className="w-1/3 text-xs text-muted-foreground">Efectivo Bs</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">Bs</span>
                    <Input type="number" className="pl-8 h-9" value={cashBs} onChange={e => setCashBs(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-1/3 text-xs text-muted-foreground">Lote Punto Venta</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">Bs</span>
                    <Input type="number" className="pl-8 h-9" value={posBatch} onChange={e => setPosBatch(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-1/3 text-xs text-muted-foreground">Total Pago Móvil</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">Bs</span>
                    <Input type="number" className="pl-8 h-9" value={pagoMovilBatch} onChange={e => setPagoMovilBatch(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Validation Panel */}
            <div className="p-4 rounded-xl bg-muted/50 border space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Efectivo Contado (USD eq):</span>
                <span className="text-base font-bold tabular-nums">
                  ${(
                    cashBreakdown.b1 + (cashBreakdown.b5*5) + (cashBreakdown.b10*10) + 
                    (cashBreakdown.b20*20) + (cashBreakdown.b50*50) + (cashBreakdown.b100*100) + 
                    ((Number(cashBs) || 0) / currentExchangeRate)
                  ).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Total Digital Contado (Bs):</span>
                <span className="tabular-nums">Bs {((Number(posBatch) || 0) + (Number(pagoMovilBatch) || 0)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClosingShift(false)}>Cancelar</Button>
            <Button onClick={handleCloseShift} disabled={isClosingShift && processing} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {processing ? "Procesando..." : "Confirmar Arqueo y Cerrar Caja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: ESCÁNER Y CÁMARA (ESTILO UNIFICADO) */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className={cn("overflow-hidden bg-black/95 border-white/10 shadow-2xl p-0 transition-all duration-300", useCamera ? "sm:max-w-[320px]" : "sm:max-w-md")}>
          <DialogHeader className="sr-only">
             <DialogTitle>Captura de Código de Barras</DialogTitle>
          </DialogHeader>
          
          <Button variant="ghost" size="icon" className="absolute top-3 right-3 size-8 rounded-full bg-black/50 hover:bg-white/10 text-white z-50" onClick={() => setScannerOpen(false)}>
            <IconX size={16} />
          </Button>

          <div className={cn("relative w-full flex flex-col items-center justify-center transition-all duration-300", useCamera ? "h-[320px]" : "h-[360px] sm:h-[400px]")}>
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
                <div className="w-full h-full relative flex flex-col items-center justify-center p-4">
                    <div className={cn(
                        "relative w-full h-full rounded-xl overflow-hidden border shadow-2xl bg-black flex items-center justify-center",
                        isDetected ? "border-green-500" : "border-white/10"
                    )}>
                        {/* the #reader container must be square-ish so the camera stretches nicely */}
                        <div id="reader" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full [&_video]:min-h-full [&_#qr-shaded-region]:hidden"></div>
                        
                        {/* Láser Minimalista (Oscilante) */}
                        <div className={cn(
                            "absolute inset-x-8 z-10 animate-scanline transition-all duration-300 h-0.5 shadow-[0_0_8px_currentColor]",
                            isDetected ? "text-green-500 bg-green-500" : "text-primary bg-primary"
                        )} />
                        
                        {/* Esquinas Rectangulares Transparentes */}
                        <div className="absolute inset-6 z-20 pointer-events-none opacity-40 mix-blend-difference filter drop-shadow-md">
                            <div className={cn("absolute top-0 left-0 size-8 border-t-2 border-l-2 transition-colors duration-500", isDetected ? "border-green-500" : "border-white")} />
                            <div className={cn("absolute top-0 right-0 size-8 border-t-2 border-r-2 transition-colors duration-500", isDetected ? "border-green-500" : "border-white")} />
                            <div className={cn("absolute bottom-0 left-0 size-8 border-b-2 border-l-2 transition-colors duration-500", isDetected ? "border-green-500" : "border-white")} />
                            <div className={cn("absolute bottom-0 right-0 size-8 border-b-2 border-r-2 transition-colors duration-500", isDetected ? "border-green-500" : "border-white")} />
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

      {/* DIALOG: SALE RETURN (DEVOLUCIONES) */}
      <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                <IconArrowBackUp size={24} />
              </div>
              <div className="space-y-1 text-left">
                <DialogTitle className="text-lg font-black uppercase tracking-tight">Procesar Devolución</DialogTitle>
                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {selectedSaleForReturn ? `Venta #${selectedSaleForReturn.id.slice(-8).toUpperCase()}` : "Cargando detalles..."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {fetchingSaleDetails ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
              <IconRefresh size={40} className="animate-spin text-muted-foreground opacity-20" />
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Obteniendo información...</p>
            </div>
          ) : selectedSaleForReturn && (
            <div className="flex-1 flex flex-col overflow-hidden py-4 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between items-end px-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Artículos de la Venta</Label>
                  <span className="text-[9px] font-medium text-muted-foreground italic">Seleccione la cantidad a devolver</span>
                </div>
                
                <div className="border rounded-xl bg-muted/5 divide-y overflow-auto max-h-[300px]">
                  {selectedSaleForReturn.items.map((item: any) => {
                    if (!item.variantId) return null; // Skip waitlist items for now as they have no stock tracking
                    
                    const returnedQty = selectedSaleForReturn.returns?.reduce((acc: number, r: any) => {
                      const returnItem = r.items.find((ri: any) => ri.variantId === item.variantId);
                      return acc + (returnItem?.quantity || 0);
                    }, 0) || 0;
                    
                    const maxAvailable = item.quantity - returnedQty;
                    const currentReturnQty = returnQuantities[item.variantId] || 0;

                    if (maxAvailable <= 0) return null;

                    return (
                      <div key={item.id} className="p-4 flex items-center justify-between gap-4 group hover:bg-muted/10 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold truncate leading-tight">{item.variant?.product?.name || "Producto"} {item.variant?.name !== 'Principal' ? `(${item.variant?.name})` : ''}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">Vendido: {item.quantity}</span>
                            {returnedQty > 0 && <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase">Devuelto: {returnedQty}</span>}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex flex-col items-end gap-1">
                             <span className="text-[10px] font-bold tabular-nums">${item.price.toFixed(2)}</span>
                             <span className="text-[8px] text-muted-foreground font-medium uppercase tracking-tighter">Sub: ${(item.price * currentReturnQty).toFixed(2)}</span>
                          </div>
                          <div className="flex items-center border rounded-lg h-9 bg-background shadow-sm">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-none border-r"
                              onClick={() => setReturnQuantities({...returnQuantities, [item.variantId]: Math.max(0, currentReturnQty - 1)})}
                            >
                              <IconMinus size={12} />
                            </Button>
                            <span className="w-10 text-center text-xs font-black tabular-nums">{currentReturnQty}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-none border-l"
                              onClick={() => setReturnQuantities({...returnQuantities, [item.variantId]: Math.min(maxAvailable, currentReturnQty + 1)})}
                            >
                              <IconPlus size={12} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {selectedSaleForReturn.items.every((it: any) => {
                      const ret = selectedSaleForReturn.returns?.reduce((acc: number, r: any) => {
                        const ri = r.items.find((rii: any) => rii.variantId === it.variantId);
                        return acc + (ri?.quantity || 0);
                      }, 0) || 0;
                      return it.quantity - ret <= 0;
                  }) && (
                    <div className="p-8 text-center text-muted-foreground space-y-2">
                       <IconCircleCheckFilled size={32} className="mx-auto text-emerald-500 opacity-50" />
                       <p className="text-[10px] font-black uppercase tracking-widest">Todos los artículos han sido devueltos</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Motivo de la Devolución</Label>
                  <Input 
                    placeholder="Ej. Producto defectuoso, Error en la compra..." 
                    className="h-10 text-xs"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                  />
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex justify-between items-center">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Total a Reembolsar</span>
                    <span className="text-[9px] text-muted-foreground font-medium italic">Incluye impuestos proporcionales</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-amber-600 tabular-nums">
                      ${(Object.entries(returnQuantities).reduce((acc, [vid, qty]) => {
                        const item = selectedSaleForReturn.items.find((it: any) => it.variantId === vid);
                        return acc + (item ? item.price * qty : 0);
                      }, 0) * (1 + taxRate / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t mt-auto">
            <Button variant="ghost" onClick={() => setIsReturnModalOpen(false)} className="font-bold text-[10px] uppercase">Cancelar</Button>
            <Button 
              onClick={handleReturnSubmit} 
              disabled={processingReturn || !selectedSaleForReturn || Object.values(returnQuantities).every(q => q === 0)}
              className="bg-amber-500 hover:bg-amber-600 h-11 font-black text-[10px] uppercase tracking-widest px-8"
            >
              {processingReturn ? "PROCESANDO..." : "CONFIRMAR DEVOLUCIÓN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: WAITLIST BROWSER */}
      <Dialog open={isWaitlistOpen} onOpenChange={setIsWaitlistOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                <IconAlertCircle size={24} />
              </div>
              <div className="space-y-1 text-left">
                <DialogTitle className="text-lg font-black uppercase tracking-tight">Lista de Espera</DialogTitle>
                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Productos escaneados no registrados en el sistema
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            {loadingWaitlist ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <IconRefresh className="animate-spin text-muted-foreground opacity-20" size={40} />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cargando lista...</p>
              </div>
            ) : waitlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 grayscale opacity-40">
                <IconBox size={60} strokeWidth={1} />
                <p className="text-xs font-bold uppercase tracking-widest">No hay productos en espera</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {waitlist.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-4 rounded-xl border bg-muted/5 hover:bg-muted/10 transition-all cursor-pointer active:scale-[0.98]"
                    onClick={() => {
                      addWaitlistItemToCart(item);
                      setIsWaitlistOpen(false);
                    }}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black uppercase truncate">{item.name}</h4>
                        <Badge variant="outline" className="text-[9px] px-1.5 h-5 font-bold uppercase tracking-tighter bg-background">
                          {item.barcode}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                        <span className="flex items-center gap-1"><IconBuilding size={10} /> {item.branch?.name || "Todas"}</span>
                        <span>•</span>
                        <span>Stock Sugerido: {item.stock}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-black tabular-nums text-foreground">${item.price.toFixed(2)}</p>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Precio Sugerido</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter className="pt-2 border-t">
            <Button variant="ghost" onClick={() => setIsWaitlistOpen(false)} className="font-bold text-[10px] uppercase">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: PARKED TICKETS (REDISEÑADO) */}
      <Dialog open={isParkedModalOpen} onOpenChange={setIsParkedModalOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col overflow-hidden border shadow-2xl p-0">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-primary/10 border flex items-center justify-center text-primary">
                <IconPlayerPause size={24} />
              </div>
              <div className="space-y-1 text-left">
                <DialogTitle className="text-xl font-semibold">Ventas en Suspenso</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Gestión de carritos pausados para facturación posterior
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-6 bg-muted/10 font-sans">
            {parkedTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
                <IconReceiptOff size={80} strokeWidth={1} />
                <p className="text-sm font-medium text-muted-foreground">No hay colas de espera</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {parkedTickets.map((ticket) => (
                  <div key={ticket.id} className="group relative flex flex-col p-5 rounded-2xl border bg-background hover:border-primary/50 hover:shadow-md transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-primary text-primary-foreground">#{ticket.id}</span>
                          <span className="text-xs text-muted-foreground font-medium">{new Date(ticket.parkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <h4 className="text-sm font-semibold">
                          {clients.find(c => (c.id || (c as any)._id) === ticket.selectedClientId)?.name || "Consumidor Final"}
                        </h4>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold tabular-nums">
                          ${ticket.cart.reduce((acc: number, item: any) => acc + (item.product.price * item.quantity), 0).toFixed(2)}
                        </p>
                        <p className="text-xs font-medium text-muted-foreground">{ticket.cart.length} productos</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t">
                      <Button 
                        variant="default"
                        className="flex-1 h-10 font-medium text-sm"
                        onClick={() => resumeTicket(ticket)}
                      >
                        Recuperar Venta
                      </Button>
                      <Button 
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all border-destructive/20"
                        onClick={() => setParkedTickets(prev => prev.filter(t => t.id !== ticket.id))}
                      >
                        <IconTrash size={18} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter className="p-4 border-t bg-muted/30">
            <Button 
              variant="ghost" 
              onClick={() => setIsParkedModalOpen(false)} 
              className="w-full font-medium text-sm"
            >
              Cerrar Ventana
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
