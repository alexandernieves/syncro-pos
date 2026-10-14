"use client";

import { ClientPicker, type DirectoryClient } from "@/components/pos/client-picker";
import { verifySupervisorPin } from "@/lib/supervisor-pin";
import { ClientDataPrompt, clientIsMissingData } from "@/components/pos/client-data-prompt";
import { CreditLimitOverride } from "@/components/pos/credit-limit-override";
import { ReceiptPrinter, type ReceiptData } from "@/components/pos/receipt-printer";
import { normalizeInvoiceDesign } from "@/lib/invoice/design";
import { resolveInvoiceBusiness } from "@/lib/invoice/render";
import { DesktopUpdateBadge } from "@/components/desktop-update-badge";
import { WhatsAppInvoiceError, openInvoiceInWhatsApp, saleToInvoiceData, sendInvoiceWhatsApp } from "@/lib/invoice/whatsapp";
import { SyncroShopBadges } from "@/components/syncro-shop/syncro-shop-badges";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { API_URL } from "@/lib/constants";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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
  IconPlus, IconMinus, IconUser, IconChevronRight, IconChevronDown, IconUserPlus, IconX, IconBox,
  IconArrowLeft, IconLogout, IconDeviceDesktop, IconDevices, IconCalculator, IconRefresh, IconReceiptTax,
  IconEye, IconPencil, IconScan, IconCamera, IconBarcode, IconAlertCircle, IconCircleCheckFilled, IconCheck, IconAlertTriangle,
  IconHexagon, IconWorld, IconBuilding, IconHistory, IconReceipt, IconFilter, IconArrowBackUp,
  IconPlayerPause, IconReceiptOff, IconList, IconFingerprint, IconCalendar as IconCalendarTabler, IconKeyboard,
  IconPackage, IconScale, IconLock, IconDiscount, IconInfoCircle, IconShieldCheck, IconShieldLock, IconBuildingStore, IconBrandWhatsapp
} from "@tabler/icons-react";
import { formatWhatsAppNumber } from "@/lib/phone-countries";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import { useSync } from "@/hooks/useSync";
import { useCurrency } from "@/context/CurrencyContext";
import { FinanceWidget, categoryOf } from "@/components/finance-widget";
import { type Currency as CashCurrency, CURRENCY_META, cashChange, cashDue, formatMoney, fromUsd, toUsd } from "@/lib/currency";

const API = API_URL;

type Product = {
  id: string;
  name: string;
  totalStock: number;
  isPublishedOnSyncroShop?: boolean;
  isFeaturedOnSyncroShop?: boolean;
  variants: Array<{
    id: string;
    name: string;
    price: number;
    stock: number;
    sku: string;
    barcode?: string;
    secondaryBarcodes?: string[];
  }>;
  image?: string;
  category?: { name: string };
  isWeighable?: boolean;
};

type Client = {
  id: string;
  _id?: string;
  name: string;
  documentId?: string;
  phone?: string | null;
  walletBalance?: number;
  creditLimit?: number;
  currentDebt?: number;
  creditScore?: number;
  downPaymentPercentage?: number;
  hasAccount?: boolean;
  isSuspended?: boolean;
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
  discount?: { type: 'pct' | 'amt', value: number };
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

// Credit Status Radial component
const CreditRadial = ({ client }: { client: any }) => {
  const limit = client?.creditLimit || 0;
  const debt = client?.currentDebt || 0;
  const available = Math.max(0, limit - debt);
  const score = client?.creditScore || 0;

  // Calculate percentage (default to 100% if limit is 0)
  const percentage = limit > 0 ? (available / limit) * 100 : 100;

  // SVG circular progress settings
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Determine colors based on available credit percent
  let strokeColor = "stroke-emerald-500 dark:stroke-emerald-400";
  let textColor = "text-emerald-600 dark:text-emerald-400";
  let bgLight = "bg-emerald-500/5 border-emerald-500/10 dark:bg-emerald-500/10 dark:border-emerald-500/20";

  if (percentage < 30) {
    strokeColor = "stroke-red-500 dark:stroke-red-400";
    textColor = "text-red-600 dark:text-red-400";
    bgLight = "bg-red-500/5 border-red-500/10 dark:bg-red-500/10 dark:border-red-500/20";
  } else if (percentage < 75) {
    strokeColor = "stroke-amber-500 dark:stroke-amber-400";
    textColor = "text-amber-600 dark:text-amber-400";
    bgLight = "bg-amber-500/5 border-amber-500/10 dark:bg-amber-500/10 dark:border-amber-500/20";
  }

  return (
    <div className={`p-3 rounded-xl border ${bgLight} flex items-center justify-between gap-3 transition-all duration-300 font-sans shadow-sm`}>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <span className="text-[9px] font-extrabold text-muted-foreground/80 flex items-center gap-1">
          <IconCreditCard size={12} className={textColor} stroke={2.5} /> SyncroCredit activo
        </span>
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold text-muted-foreground/80 leading-none">Cupo disponible:</span>
          <span className="text-base font-black text-foreground tabular-nums mt-0.5">${available.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2.5 mt-1 pt-1.5 border-t border-border/40 text-[9px] font-bold text-muted-foreground/80">
          <div className="flex flex-col">
            <span className="text-[7px] font-medium text-muted-foreground/60 leading-none">Límite</span>
            <span className="text-foreground/95 mt-0.5">${limit.toFixed(2)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7px] font-medium text-muted-foreground/60 leading-none">Deuda</span>
            <span className="text-amber-600/90 mt-0.5">${debt.toFixed(2)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7px] font-medium text-muted-foreground/60 leading-none">Score</span>
            <span className="text-blue-500 mt-0.5">{score.toFixed(0)} pts</span>
          </div>
        </div>
      </div>
      <div className="relative size-16 flex items-center justify-center shrink-0">
        {/* SVG radial progress */}
        <svg className="size-full -rotate-90">
          {/* Background circle */}
          <circle
            cx="32"
            cy="32"
            r={radius}
            className="stroke-muted-foreground/15"
            strokeWidth="5"
            fill="transparent"
          />
          {/* Active progress circle */}
          <circle
            cx="32"
            cy="32"
            r={radius}
            className={`${strokeColor} transition-all duration-500 ease-out`}
            strokeWidth="5"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        {/* Inside circle text */}
        <div className="absolute flex flex-col items-center justify-center text-center w-full px-1">
          <span className="text-[8px] font-extrabold text-foreground tabular-nums leading-none">${available.toFixed(2)}</span>
          <span className="text-[5px] font-extrabold text-muted-foreground leading-none mt-0.5">Disponible</span>
        </div>
      </div>
    </div>
  );
};

// Ticket View for Printing
/** Rounds a money amount to cents (avoids 0.1 + 0.2 style leftovers). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function roundCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function PosNumpad({ onClose, onEnter }: { onClose: () => void, onEnter: (val: string) => void }) {
  const [display, setDisplay] = useState("");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setPosition({ x: window.innerWidth / 2 - 140, y: window.innerHeight / 2 - 200 });
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleNum = (num: string) => setDisplay(prev => prev + num);
  const handleClear = () => setDisplay("");
  const handleBackspace = () => setDisplay(prev => prev.slice(0, -1));
  const handleSubmit = () => {
    if (display) {
      onEnter(display);
      setDisplay("");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        if (e.key === "Escape") onClose();
        return;
      }

      const key = e.key;
      if (/[0-9]/.test(key)) handleNum(key);
      else if (key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
      else if (key === "Escape") onClose();
      else if (key === "Backspace") handleBackspace();
      else if (key === "Delete" || key.toLowerCase() === "c") handleClear();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [display, onClose]);

  return (
    <div
      className="fixed z-[100] w-[280px] bg-background/95 backdrop-blur-md border border-border/50 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden transition-shadow"
      style={{ left: position.x, top: position.y, touchAction: 'none' }}
    >
      <div
        className="h-10 bg-muted/40 w-full cursor-grab active:cursor-grabbing flex items-center justify-between px-4 border-b border-border/30"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <span className="text-xs font-bold text-muted-foreground flex items-center gap-2"><IconKeyboard size={14} /> Teclado numérico</span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
          title="Cerrar (Esc)"
        >
          <IconX size={14} />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div className="bg-muted/30 p-3 rounded-xl text-right overflow-hidden shadow-inner border border-muted/50 flex items-center min-h-[60px]">
          <span className="text-2xl font-mono font-bold tracking-tighter truncate block w-full">{display || "0"}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="h-14 font-bold text-rose-500 bg-rose-500/10 border-none hover:bg-rose-500/20 text-sm shadow-sm" onClick={handleClear}>Cls</Button>
          <Button variant="outline" className="h-14 font-bold bg-muted/50 border-none hover:bg-muted text-lg shadow-sm" onClick={handleBackspace}>←</Button>
          <Button variant="default" className="h-14 font-bold bg-primary text-primary-foreground text-sm shadow-sm" onClick={handleSubmit}>Enter</Button>

          {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(num => (
            <Button key={num} variant="outline" className="h-14 font-bold text-2xl border-none bg-muted/20 hover:bg-muted/50 shadow-sm" onClick={() => handleNum(String(num))}>{num}</Button>
          ))}

          <Button variant="outline" className="h-14 font-bold text-2xl border-none bg-muted/20 hover:bg-muted/50 col-span-2 shadow-sm" onClick={() => handleNum("0")}>0</Button>
          <Button variant="outline" className="h-14 font-bold text-2xl border-none bg-muted/20 hover:bg-muted/50 shadow-sm" onClick={() => handleNum("00")}>00</Button>
        </div>
      </div>
    </div>
  );
}

function PosCalculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setPosition({ x: window.innerWidth / 2 - 192, y: window.innerHeight / 2 - 250 });
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleNum = (num: string) => {
    if (waitingForNewValue) {
      setDisplay(num);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === "0" ? num : display + num);
    }
  };

  const handleOp = (operator: string) => {
    if (op && !waitingForNewValue) {
      calculate();
    } else {
      setPrev(parseFloat(display));
    }
    setOp(operator);
    setWaitingForNewValue(true);
  };

  const calculate = () => {
    if (prev === null || op === null) return;
    const current = parseFloat(display);
    let result = 0;
    switch (op) {
      case "+": result = prev + current; break;
      case "-": result = prev - current; break;
      case "*": result = prev * current; break;
      case "/": result = prev / current; break;
    }
    // Round to 4 decimal places to avoid JS floating point issues
    result = Math.round(result * 10000) / 10000;
    setDisplay(String(result));
    setPrev(result);
    setOp(null);
    setWaitingForNewValue(true);
  };

  const handleClear = () => {
    setDisplay("0");
    setPrev(null);
    setOp(null);
    setWaitingForNewValue(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en algún input (ej. barra de búsqueda)
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        if (e.key === "Escape") onClose();
        return;
      }

      const key = e.key;
      if (/[0-9]/.test(key)) {
        handleNum(key);
      } else if (key === "+" || key === "-") {
        handleOp(key);
      } else if (key === "*" || key.toLowerCase() === "x") {
        handleOp("*");
      } else if (key === "/") {
        e.preventDefault();
        handleOp("/");
      } else if (key === "Enter" || key === "=") {
        e.preventDefault();
        calculate();
      } else if (key === "Escape") {
        onClose();
      } else if (key === "Backspace" || key === "Delete" || key.toLowerCase() === "c") {
        handleClear();
      } else if (key === "." || key === ",") {
        if (!display.includes(".")) handleNum(".");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [display, prev, op, waitingForNewValue, onClose]);


  return (
    <div
      className="fixed z-[100] w-[384px] bg-background/95 backdrop-blur-md border border-border/50 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden transition-shadow"
      style={{ left: position.x, top: position.y, touchAction: 'none' }}
    >
      <div
        className="h-10 bg-muted/40 w-full cursor-grab active:cursor-grabbing flex items-center justify-between px-4 border-b border-border/30"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <span className="text-xs font-bold text-muted-foreground flex items-center gap-2"><IconCalculator size={14} /> Calculadora</span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
          title="Cerrar (Esc)"
        >
          <IconX size={14} />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="bg-muted/30 p-4 rounded-xl text-right overflow-hidden shadow-inner border border-muted/50 flex flex-col justify-end min-h-[80px]">
          <div className="h-4 mb-1 text-xs text-muted-foreground font-semibold">
            {prev !== null && op && `${prev} ${op} ${waitingForNewValue ? '' : display}`}
          </div>
          <span className="text-4xl font-mono font-bold tracking-tighter truncate block">{display}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Button variant="outline" className="h-14 font-bold text-rose-500 bg-rose-500/10 border-none hover:bg-rose-500/20 text-lg shadow-sm" onClick={handleClear}>C</Button>
          <Button variant="outline" className="h-14 font-bold bg-muted/50 border-none hover:bg-muted text-lg shadow-sm" onClick={() => handleOp("/")}>/</Button>
          <Button variant="outline" className="h-14 font-bold bg-muted/50 border-none hover:bg-muted text-lg shadow-sm" onClick={() => handleOp("*")}>x</Button>
          <Button variant="outline" className="h-14 font-bold bg-muted/50 border-none hover:bg-muted text-xl shadow-sm" onClick={() => { setDisplay(display.includes("-") ? display.replace("-", "") : "-" + display) }}>±</Button>

          {[7, 8, 9].map(num => (
            <Button key={num} variant="outline" className="h-14 font-bold text-xl border-none bg-muted/20 hover:bg-muted/50 shadow-sm" onClick={() => handleNum(String(num))}>{num}</Button>
          ))}
          <Button variant="outline" className="h-14 font-bold bg-muted/50 border-none hover:bg-muted text-2xl shadow-sm" onClick={() => handleOp("-")}>-</Button>

          {[4, 5, 6].map(num => (
            <Button key={num} variant="outline" className="h-14 font-bold text-xl border-none bg-muted/20 hover:bg-muted/50 shadow-sm" onClick={() => handleNum(String(num))}>{num}</Button>
          ))}
          <Button variant="outline" className="h-14 font-bold bg-muted/50 border-none hover:bg-muted text-2xl shadow-sm" onClick={() => handleOp("+")}>+</Button>

          {[1, 2, 3].map(num => (
            <Button key={num} variant="outline" className="h-14 font-bold text-xl border-none bg-muted/20 hover:bg-muted/50 shadow-sm" onClick={() => handleNum(String(num))}>{num}</Button>
          ))}
          <Button variant="default" className="h-full row-span-2 font-black text-2xl rounded-xl shadow-md bg-primary hover:bg-primary/90 text-primary-foreground" onClick={calculate}>=</Button>

          <Button variant="outline" className="h-14 font-bold text-xl border-none bg-muted/20 hover:bg-muted/50 col-span-2 shadow-sm" onClick={() => handleNum("0")}>0</Button>
          <Button variant="outline" className="h-14 font-bold text-xl border-none bg-muted/20 hover:bg-muted/50 shadow-sm" onClick={() => { if (!display.includes(".")) handleNum(".") }}>.</Button>
        </div>
      </div>
    </div>
  );
}

export default function POSPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("consumidor-final");

  const selectedClient = clients.find(c => (c.id || (c as any)._id) === selectedClientId);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const [taxRate, setTaxRate] = useState(16);
  const [isSaleSuccessModalOpen, setIsSaleSuccessModalOpen] = useState(false);

  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [openingBalance, setOpeningBalance] = useState<string>("0");
  const [initialCashRows, setInitialCashRows] = useState<Array<{ id: string; amount: string; currency: CashCurrency }>>([
    { id: "1", amount: "", currency: "USD" },
  ]);

  // The branch's currencies (Táchira adds COP); read at render time, after the currency context
  const CURRENCY_LABELS: Record<CashCurrency, string> = { USD: "USD ($)", VES: "VES (Bs)", EUR: "EUR (€)", COP: "COP (pesos)" };
  const allCurrencies = () => branchCurrencyList.map((code) => ({ code, label: CURRENCY_LABELS[code] }));

  const getAvailableCurrenciesForRow = (rowId: string) => {
    const selectedInOtherRows = new Set(
      initialCashRows.filter((r) => r.id !== rowId).map((r) => r.currency)
    );
    return allCurrencies().filter((c) => !selectedInOtherRows.has(c.code));
  };

  const calculateTotalOpeningBalance = (rows: Array<{ id: string; amount: string; currency: CashCurrency }>) => {
    let totalUSD = 0;
    rows.forEach((row) => {
      const val = parseFloat(row.amount) || 0;
      if (val <= 0) return;
      totalUSD += toUsd(val, row.currency, cashRates);
    });
    return totalUSD;
  };

  const handleAddCashRow = () => {
    const usedCurrencies = new Set(initialCashRows.map((r) => r.currency));
    const nextAvailable = allCurrencies().find((c) => !usedCurrencies.has(c.code));
    if (!nextAvailable) return;

    const newRow = {
      id: Math.random().toString(36).substring(2, 9),
      amount: "",
      currency: nextAvailable.code,
    };
    const updated = [...initialCashRows, newRow];
    setInitialCashRows(updated);
  };

  const handleRemoveCashRow = (id: string) => {
    if (initialCashRows.length <= 1) return;
    const updated = initialCashRows.filter((r) => r.id !== id);
    setInitialCashRows(updated);
    const total = calculateTotalOpeningBalance(updated);
    setOpeningBalance(total > 0 ? total.toFixed(2) : "0");
  };

  const handleCashRowChange = (id: string, field: "amount" | "currency", value: string) => {
    const updated = initialCashRows.map((r) => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    });
    setInitialCashRows(updated);
    const total = calculateTotalOpeningBalance(updated);
    setOpeningBalance(total > 0 ? total.toFixed(2) : "0");
  };
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [closingBalance, setClosingBalance] = useState<string>("0");
  const [closeSummary, setCloseSummary] = useState<{ expected: number; reported: number; difference: number; isBlind?: boolean; rows?: { currency: CashCurrency; expected: number; counted: number }[] } | null>(null);
  const [isCloseSummaryOpen, setIsCloseSummaryOpen] = useState(false);
  const [cashBreakdown, setCashBreakdown] = useState({ b1: 0, b5: 0, b10: 0, b20: 0, b50: 0, b100: 0 });
  const [posBatch, setPosBatch] = useState<string>("0");
  const [pagoMovilBatch, setPagoMovilBatch] = useState<string>("0");
  const [cashBs, setCashBs] = useState<string>("0");
  // Cash counted per currency at the close ("" = not counted yet)
  const [countedCash, setCountedCash] = useState<Record<string, string>>({});
  const [countBills, setCountBills] = useState(false);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD">("CASH");
  const [amountReceived, setAmountReceived] = useState<string>("0");

  // Abono Modal State
  const [isPaymentModalAbonoOpen, setIsPaymentModalAbonoOpen] = useState(false);
  const [abonoAmount, setAbonoAmount] = useState<string>("");
  const [abonoPaymentMethod, setAbonoPaymentMethod] = useState<string>("CASH");
  const [abonoNotes, setAbonoNotes] = useState<string>("");
  const [isSubmittingAbono, setIsSubmittingAbono] = useState(false);

  // Quick Client State
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", documentId: "", phone: "" });
  const [savingClient, setSavingClient] = useState(false);

  // Client document search
  const [clientDocSearch, setClientDocSearch] = useState("");
  const [searchingClient, setSearchingClient] = useState(false);

  // Advanced Payment State
  const [addedPayments, setAddedPayments] = useState<any[]>([]);
  const [showSplitPaymentForm, setShowSplitPaymentForm] = useState(false);
  const [tempPaymentMethod, setTempPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER" | "PAGO_MOVIL" | "BINANCE" | "ZINLI" | "PAYPAL" | "WALLET" | "CREDIT">("CASH");
  const [saveChangeToWallet, setSaveChangeToWallet] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(true);
  // Send the invoice to the client's WhatsApp after the sale (remembered on this device)
  const [sendWhatsAppInvoice, setSendWhatsAppInvoice] = useState(true);
  useEffect(() => {
    try {
      setSendWhatsAppInvoice(localStorage.getItem("syncro-send-invoice-whatsapp") !== "off");
    } catch {}
  }, []);
  const toggleSendWhatsAppInvoice = (value: boolean) => {
    setSendWhatsAppInvoice(value);
    try {
      localStorage.setItem("syncro-send-invoice-whatsapp", value ? "on" : "off");
    } catch {}
  };
  // Animated ticket shown after a sale when "Imprimir factura" is on
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [generatingPwaCode, setGeneratingPwaCode] = useState(false);
  const [creditType, setCreditType] = useState<"traditional" | "syncrocredit">("traditional");
  const [togglingSuspension, setTogglingSuspension] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [updatingLimit, setUpdatingLimit] = useState(false);
  const [showPwaCodeModal, setShowPwaCodeModal] = useState(false);
  const [generatedPwaCode, setGeneratedPwaCode] = useState("");
  // The code goes to the client's WhatsApp; the POS only sees where it was sent
  const [pwaCodeSentTo, setPwaCodeSentTo] = useState<string | null>(null);
  const [pwaCodeFallbackReason, setPwaCodeFallbackReason] = useState<string | null>(null);
  const [pwaClientName, setPwaClientName] = useState("");
  const [pwaClientDocument, setPwaClientDocument] = useState("");
  const [selectedFrequencyDays, setSelectedFrequencyDays] = useState<number>(15);
  const [showPinAuthModal, setShowPinAuthModal] = useState(false);
  const [generatedPinCode, setGeneratedPinCode] = useState<string | null>(null);
  const [isGeneratingPin, setIsGeneratingPin] = useState(false);
  const [isPollingPin, setIsPollingPin] = useState(false);
  const [pendingSaleData, setPendingSaleData] = useState<any>(null);
  const [checkingActivation, setCheckingActivation] = useState(false);
  const [tempAmount, setTempAmount] = useState<string>("0");
  const [tempReference, setTempReference] = useState<string>("");
  const [syncingBcv, setSyncingBcv] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const { currency, setCurrency, exchangeRate: bcvRate, eurExchangeRate: bcvEurRate, bcvDate, refreshRates, formatPrice, currencies: branchCurrencyList, cashRates } = useCurrency();
  const [baseCurrency, setBaseCurrency] = useState<"USD" | "EUR">("USD");
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [tempCurrency, setTempCurrency] = useState<CashCurrency>("USD");
  // Currency the change is handed back in (null = the one of the last cash payment)
  const [changeCurrency, setChangeCurrency] = useState<CashCurrency | null>(null);

  // Sync global currency with POS base currency
  useEffect(() => {
    if (currency === "EUR") setBaseCurrency("EUR");
    else setBaseCurrency("USD");
  }, [currency]);

  useEffect(() => {
    if (isPaymentModalOpen) {
      setCreditType("traditional");
      const limit = selectedClient?.creditLimit || 0;
      const debt = selectedClient?.currentDebt || 0;
      const available = limit - debt;
      const isBlocked = selectedClient?.hasAccount && (available <= 0.01 && debt > 0);
      if (isBlocked && tempPaymentMethod === 'CREDIT') {
        setTempPaymentMethod('CASH');
      }
    }
  }, [isPaymentModalOpen, selectedClient, tempPaymentMethod]);

  // Alerta de selección de cliente bloqueado
  useEffect(() => {
    if (selectedClientId && selectedClientId !== "consumidor-final") {
      const client = clients.find(c => (c.id || (c as any)._id) === selectedClientId);
      if (client) {
        const available = (client.creditLimit || 0) - (client.currentDebt || 0);
        if (client.hasAccount && available <= 0.01 && (client.currentDebt || 0) > 0) {
          toast.warning(
            `El cliente ${client.name} tiene el cupo de crédito agotado y deudas activas. No se le permite fiar, por favor realice un abono a su deuda.`,
            { duration: 5000 }
          );
        }
      }
    }
  }, [selectedClientId, clients]);

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
  const [historySearchTerm, setHistorySearchTerm] = useState("");

  const filteredSalesHistory = React.useMemo(() => {
    const query = historySearchTerm.toLowerCase().trim();
    if (!query) return salesHistory;
    return salesHistory.filter((sale) => {
      return (
        sale.id?.toLowerCase().includes(query) ||
        sale.client?.name?.toLowerCase().includes(query) ||
        (sale.client?.documentId && sale.client.documentId.toLowerCase().includes(query)) ||
        (typeof sale.client === "string" && sale.client.toLowerCase().includes(query))
      );
    });
  }, [salesHistory, historySearchTerm]);

  // Payment confirmation states
  const [isConfirmPaymentOpen, setIsConfirmPaymentOpen] = useState(false);
  const [paymentConfirmationSummary, setPaymentConfirmationSummary] = useState("");
  const [paymentConfirmationWarning, setPaymentConfirmationWarning] = useState("");
  const [paymentsToProcess, setPaymentsToProcess] = useState<any[] | null>(null);

  // Calculator State
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // Numpad State
  const [isNumpadOpen, setIsNumpadOpen] = useState(false);

  // Weighable Product State
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);

  // Discount State
  const [globalDiscount, setGlobalDiscount] = useState<{ type: 'pct' | 'amt', value: number } | null>(null);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  // targetDiscountId === 'GLOBAL' (discount ticket) o targetDiscountId === 'product_id' (discount item)
  const [targetDiscountId, setTargetDiscountId] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<'pct' | 'amt'>('pct');
  const [discountValueInput, setDiscountValueInput] = useState('');

  // PIN Verification State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinCallback, setPinCallback] = useState<((pinUsed?: string) => void) | null>(null);
  const pinInputRef = React.useRef<HTMLInputElement>(null);

  const openPinVerification = (onSuccess: (pinUsed?: string) => void) => {
    if (!settings?.hasDiscountPin) {
      // No PIN configured, allow directly
      onSuccess();
      return;
    }
    setPinInput("");
    setPinError("");
    setPinCallback(() => onSuccess);
    setIsPinModalOpen(true);
    setTimeout(() => pinInputRef.current?.focus(), 100);
  };

  const handlePinConfirm = async () => {
    // Checked on the server: the PIN never reaches the browser
    let valid = false;
    try { valid = await verifySupervisorPin(pinInput); } catch (e) { setPinError((e as Error).message); return; }
    if (valid) {
      const pinUsed = pinInput;
      setIsPinModalOpen(false);
      setPinInput("");
      setPinError("");
      pinCallback?.(pinUsed);
      setPinCallback(null);
    } else {
      setPinError("PIN incorrecto. Inténtelo de nuevo.");
      setPinInput("");
    }
  };

  const handleApplyDiscount = () => {
    const val = parseFloat(discountValueInput);
    if (isNaN(val) || val < 0) {
      toast.error('Ingrese un valor válido');
      return;
    }
    if (discountType === 'pct' && val > 100) {
      toast.error('El porcentaje no puede ser mayor a 100');
      return;
    }

    if (targetDiscountId === 'GLOBAL') {
      if (val === 0) {
        setGlobalDiscount(null);
      } else {
        setGlobalDiscount({ type: discountType, value: val });
      }
    } else if (targetDiscountId) {
      setCart(prev => prev.map(item => {
        if (item.product.id === targetDiscountId) {
          if (val === 0) {
            const { discount, ...rest } = item;
            return rest;
          }
          return { ...item, discount: { type: discountType, value: val } };
        }
        return item;
      }));
    }
    setIsDiscountModalOpen(false);
    setDiscountValueInput('');
  };
  const [weighableProduct, setWeighableProduct] = useState<Product | null>(null);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [editingCartItemPrice, setEditingCartItemPrice] = useState<number>(0);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'ud'>('ud');
  const [editingCartItemName, setEditingCartItemName] = useState<string>("");
  const [weightValue, setWeightValue] = useState("");
  const weightInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isWeightModalOpen) {
      setTimeout(() => weightInputRef.current?.focus(), 100);
    }
  }, [isWeightModalOpen]);

  const handleConfirmWeight = () => {
    const weight = parseFloat(weightValue);
    if (isNaN(weight) || weight <= 0) {
      toast.error("Ingrese un peso o cantidad válida");
      return;
    }

    if (editingCartItemId) {
      setCart(prev => prev.map(item => {
        if (item.product.id === editingCartItemId) {
          return { ...item, quantity: weight };
        }
        return item;
      }));
      setIsWeightModalOpen(false);
      setWeightValue("");
      setEditingCartItemId(null);
      setEditingCartItemName("");
    } else if (weighableProduct) {
      addToCart(weighableProduct, weight);
      setIsWeightModalOpen(false);
      setWeightValue("");
      setWeighableProduct(null);
    }
  };

  // Función helper para comparar códigos de barras de forma inteligente (resuelve discrepancias de ceros o dígitos iniciales como EAN-13 vs UPC-A)
  const matchBarcodes = (barcodeA: string | undefined, barcodeB: string) => {
    if (!barcodeA || !barcodeB) return false;
    const cleanA = barcodeA.trim().replace(/^0+/, ''); // Quitar ceros a la izquierda
    const cleanB = barcodeB.trim().replace(/^0+/, ''); // Quitar ceros a la izquierda
    if (cleanA === cleanB) return true;

    // Si uno de los códigos tiene 12 dígitos y el otro 13 (ej. EAN-13 vs UPC-A),
    // o si uno es sufijo del otro por diferencia de dígitos de control/país.
    if (cleanA.length >= 12 && cleanB.length >= 12) {
      return cleanA.endsWith(cleanB) || cleanB.endsWith(cleanA);
    }
    return false;
  };

  const handleNumpadEnter = (code: string) => {
    const product = products.find(p =>
      p.variants?.some(v =>
        matchBarcodes(v.barcode, code) ||
        v.sku === code ||
        v.secondaryBarcodes?.some(sb => matchBarcodes(sb, code))
      )
    );
    if (product) {
      // addToCart is declared later, we will handle it in a useEffect or ensure it's available. 
      // Actually addToCart is defined below in the file, we can call it here because of hoisting or closure behavior in React components.
      addToCart(product);
      toast.success(`Agregado al carrito: ${product.name}`);
    } else {
      toast.error(`Producto no encontrado con el código: ${code}`);
    }
  };

  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string>("");
  const [user, setUser] = useState<any>(null);

  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState<any>(null);

  // Order Detail Modal State
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [clientHistory, setClientHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Helper to format raw sale objects from POS backend
  const formatSaleObject = (s: any) => {
    if (!s) return null;
    return {
      id: s.id,
      client: s.client?.name || "Consumidor Final",
      clientId: s.clientId,
      clientDocument: s.client?.documentId || null,
      total: s.total,
      subtotal: s.subtotal,
      taxAmount: s.taxAmount,
      igtfAmount: s.igtfAmount,
      discountAmt: s.discountAmt,
      status: s.status || "COMPLETED",
      branch: s.branch?.name || "N/A",
      date: s.createdAt,
      seller: s.user?.name || "Desconocido",
      payments: (s.payments || []).map((p: any) => ({
        method: p.method,
        amount: p.amount
      })),
      items: (s.items || []).map((item: any) => ({
        id: item.id,
        name: item.variant?.product?.name || item.description || "Producto Desconocido",
        variantName: item.variant?.name || "",
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal
      }))
    };
  };

  // Fetch client history when selectedSale changes
  useEffect(() => {
    if (!selectedSale || !selectedSale.clientId) {
      setClientHistory([]);
      return;
    }

    const fetchClientHistory = async () => {
      setLoadingHistory(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/clients/${selectedSale.clientId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const clientData = await res.json();
          const salesHistory = (clientData.sales || []).map((s: any) => ({
            id: s.id,
            client: clientData.name || "Consumidor Final",
            clientId: s.clientId || clientData.id,
            clientDocument: clientData.documentId || null,
            total: s.total,
            subtotal: s.subtotal,
            taxAmount: s.taxAmount,
            igtfAmount: s.igtfAmount,
            discountAmt: s.discountAmt,
            status: s.status || "COMPLETED",
            branch: s.branch?.name || "N/A",
            date: s.createdAt,
            payments: s.payments.map((p: any) => ({
              method: p.method,
              amount: p.amount
            })),
            items: s.items.map((item: any) => ({
              id: item.id,
              name: item.variant?.product?.name || item.description || "Producto Desconocido",
              variantName: item.variant?.name || "",
              quantity: item.quantity,
              price: item.price,
              subtotal: item.subtotal
            }))
          }));
          setClientHistory(salesHistory);
        }
      } catch (err) {
        console.error("Error loading client history", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchClientHistory();
  }, [selectedSale?.clientId]);
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
  const [promisedPaymentDate, setPromisedPaymentDate] = useState<Date | undefined>(new Date());
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);

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

  const isDesktop = typeof window !== 'undefined' && 'electron' in window;
  const canAccessDashboard = user?.permissions?.includes("dashboard") || user?.role === "ownerpos" || user?.role === "admin";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const currentExchangeRate = baseCurrency === "USD" ? bcvRate : bcvEurRate;

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

  // Notification for due payments
  useEffect(() => {
    if (clients.length > 0 && activeShift) {
      const today = new Date().toISOString().split('T')[0];
      const dueClients = clients.filter((c: any) => {
        if (!c.nextPaymentDate || (c.currentDebt || 0) <= 0) return false;
        const dueDate = new Date(c.nextPaymentDate).toISOString().split('T')[0];
        return dueDate <= today;
      });

      if (dueClients.length > 0) {
        toast.info(`Cobranza pendiente: ${dueClients.length} clientes deben pagar hoy.`, {
          description: "Revise el módulo de clientes para más detalles.",
          duration: 10000,
          icon: <IconAlertCircle className="text-amber-500" />
        });
      }
    }
  }, [clients, activeShift]);

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
        if (sData && sData.taxRate !== undefined && sData.taxRate !== null) {
          setTaxRate(Number(sData.taxRate));
        }
      } catch (e) { }
    }

    setLoading(false);
  }, [pullRemoteData, products.length]);

  // SyncroCredit limit policy: the owner's initial limit, or another one with the supervisor PIN
  const [showLimitOverride, setShowLimitOverride] = useState(false);
  const [showManageLimit, setShowManageLimit] = useState(false);
  const isOwnerUser = ["ownerpos", "owner", "admin", "superadmin"].includes(String(user?.role || "").toLowerCase());

  const activateSyncroCredit = async (customLimit?: number, supervisorPin?: string) => {
    if (!selectedClientId || selectedClientId === "consumidor-final") return;
    setGeneratingPwaCode(true);
    try {
      const res = await fetch(`${API}/clients/${selectedClientId}/activation-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(customLimit ? { creditLimit: customLimit, supervisorPin } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data.message || "No se pudo activar SyncroCredit");
      setGeneratedPwaCode(data.activationCode || "");
      setPwaCodeSentTo(data.sent ? data.sentTo : null);
      setPwaCodeFallbackReason(data.sent ? null : data.reason || null);
      setPwaClientName(selectedClient?.name || "Cliente");
      setPwaClientDocument(selectedClient?.documentId || "");
      setShowPwaCodeModal(true);
      setShowLimitOverride(false);
      toast.success(data.sent ? "Código enviado al WhatsApp del cliente" : "Código de activación generado");
    } catch {
      toast.error("Error de conexión al activar SyncroCredit");
    } finally {
      setGeneratingPwaCode(false);
    }
  };

  const updateClientLimit = async (newLimit: number, supervisorPin?: string) => {
    if (newLimit < 0) return;
    setUpdatingLimit(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/${selectedClientId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ creditLimit: newLimit, supervisorPin })
      });
      if (res.ok) {
        const updatedClient = await res.json();
        setClients(prev => prev.map(c => c.id === updatedClient.id ? { ...c, ...updatedClient } : c));
        // Save to IndexedDB
        await db.clients.put({ ...updatedClient, _id: updatedClient.id });
        toast.success(`Límite de crédito actualizado a $${newLimit}`);
      } else {
        toast.error("Error al actualizar límite de crédito");
      }
    } catch (err) {
      toast.error("Error de conexión");
    } finally {
      setUpdatingLimit(false);
    }
  };

  const clientMissingData = selectedClientId !== "consumidor-final" && clientIsMissingData(selectedClient);

  const handleClientDataSaved = (patch: { phone?: string; documentId?: string }, updated: any) => {
    setClients(prev => prev.map(c => ((c.id || (c as any)._id) === selectedClientId ? { ...c, ...updated, ...patch } : c)));
    db.clients.put({ ...updated, ...patch, _id: updated.id }).catch(() => {});
  };

  const refreshSelectedClient = async () => {
    if (!selectedClientId || selectedClientId === "consumidor-final") return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/${selectedClientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const updatedClient = await res.json();
        setClients(prev => prev.map(c => c.id === updatedClient.id ? { ...c, ...updatedClient } : c));
        // Save to IndexedDB
        await db.clients.put({ ...updatedClient, _id: updatedClient.id });
      }
    } catch (e) {
      console.error("Error refreshing client", e);
    }
  };

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
      router.push("/login");
    }
  }, [mounted, token, checkShift, router]);

  useEffect(() => {
    if (activeShift) {
      loadData();
      fetchWaitlist();
    }
  }, [activeShift, loadData]);

  // BARCODE SCANNER GLOBAL LISTENER

  // ── Laser scanner as a keyboard ─────────────────────────────────────────
  // A barcode scanner "types" the whole code in a few milliseconds and ends with Enter.
  // "Escáner siempre activo" reads it anywhere (also over the payment summary and inside
  // inputs, restoring the input afterwards); otherwise only when no field is focused.
  const [scannerAlwaysOn, setScannerAlwaysOn] = useState(false);
  useEffect(() => {
    try { setScannerAlwaysOn(localStorage.getItem("syncro-scanner-always-on") === "1"); } catch {}
  }, []);
  const toggleScannerAlwaysOn = (value: boolean) => {
    setScannerAlwaysOn(value);
    try { localStorage.setItem("syncro-scanner-always-on", value ? "1" : "0"); } catch {}
    toast.success(value ? "Escáner siempre activo: puedes escanear sin abrir esta ventana" : "Escáner siempre activo desactivado");
  };
  const processBarcodeRef = useRef<(code: string) => void>(() => {});
  const scanBuffer = useRef({ chars: "", first: 0, last: 0, field: null as HTMLInputElement | HTMLTextAreaElement | null, fieldValue: "" });

  useEffect(() => {
    const MAX_GAP_MS = 50; // between keys of the same scan
    const MAX_AVG_MS = 35; // average per character for a real scanner
    const onKeyDown = (e: KeyboardEvent) => {
      if (scannerOpen) return; // the scanner window reads it itself
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const field = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target : null;
      if (field && !scannerAlwaysOn) return;
      const buf = scanBuffer.current;
      const now = performance.now();

      if (e.key.length === 1) {
        if (now - buf.last > MAX_GAP_MS) {
          buf.chars = "";
          buf.first = now;
          buf.field = field;
          buf.fieldValue = field?.value ?? "";
        }
        buf.chars += e.key;
        buf.last = now;
        return;
      }
      if (e.key === "Enter") {
        const fast = buf.chars.length >= 4 && (buf.last - buf.first) / Math.max(1, buf.chars.length - 1) < MAX_AVG_MS && now - buf.last < 100;
        if (fast) {
          e.preventDefault();
          e.stopPropagation();
          // The scanner typed into a field: put back what the person had written
          if (buf.field) {
            const proto = buf.field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(buf.field, buf.fieldValue);
            buf.field.dispatchEvent(new Event("input", { bubbles: true }));
          }
          processBarcodeRef.current(buf.chars);
        }
        buf.chars = "";
        buf.last = 0;
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [scannerOpen, scannerAlwaysOn]);

  // Calculaciones de Totales
  const originalSubtotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const subtotalWithItemDiscounts = cart.reduce((acc, item) => {
    let itemTotal = item.product.price * item.quantity;
    if (item.discount) {
      if (item.discount.type === 'pct') {
        itemTotal -= itemTotal * (item.discount.value / 100);
      } else {
        itemTotal -= item.discount.value;
      }
    }
    return acc + Math.max(0, itemTotal);
  }, 0);

  let globalDiscountAmt = 0;
  if (globalDiscount) {
    if (globalDiscount.type === 'pct') {
      globalDiscountAmt = subtotalWithItemDiscounts * (globalDiscount.value / 100);
    } else {
      globalDiscountAmt = globalDiscount.value;
    }
  }

  const subtotalAfterGlobalDiscount = Math.max(0, subtotalWithItemDiscounts - globalDiscountAmt);
  const totalItemDiscounts = originalSubtotal - subtotalWithItemDiscounts;
  const totalDiscountAmt = totalItemDiscounts + globalDiscountAmt;

  // Para propósitos de retrocompatibilidad con referencias a `subtotal`
  const subtotal = originalSubtotal;

  // Every amount the cashier sees or charges is rounded to cents, so what is
  // paid and what is pending always add up (in USD and in Bs).
  const taxAmount = roundCents(subtotalAfterGlobalDiscount * (taxRate / 100));
  const updatedTotal = roundCents(subtotalAfterGlobalDiscount + taxAmount);

  // IGTF: only on foreign currency cash (dollars, euros, pesos), never on bolívares, and only
  // on the part that pays the sale, not on the change. Same rule as the server.
  const isForeignCash = (p: any) => p.method === "CASH" && (!p.currency || ["USD", "EUR", "COP"].includes(p.currency));
  const igtfRateVal = settings?.igtfRate !== undefined && settings?.igtfRate !== null ? Number(settings.igtfRate) : 3;

  // Calculate Wallet Deduction
  const availableWallet = selectedClient?.walletBalance || 0;
  const availableCredit = (selectedClient?.creditLimit || 0) - (selectedClient?.currentDebt || 0);
  const walletDeduction = useWalletBalance ? roundCents(Math.min(availableWallet, updatedTotal)) : 0;

  const foreignCashPaid = addedPayments.filter(isForeignCash).reduce((acc, p) => acc + p.amount, 0);
  const otherPaid = addedPayments.filter((p) => !isForeignCash(p)).reduce((acc, p) => acc + p.amount, 0) + walletDeduction;
  const igtfBase = Math.min(foreignCashPaid, Math.max(0, updatedTotal - otherPaid));
  const igtfAmount = roundCents(igtfBase * (igtfRateVal / 100));
  const totalBeforeWallet = roundCents(updatedTotal + igtfAmount);

  const finalTotalWithIgtf = roundCents(totalBeforeWallet - walletDeduction);
  const totalPaid = roundCents(addedPayments.reduce((acc, p) => acc + p.amount, 0));
  const remainingToPay = Math.max(0, roundCents(finalTotalWithIgtf - totalPaid));
  const changeDue = Math.max(0, roundCents(totalPaid - finalTotalWithIgtf));
  const changeDueBs = changeDue * currentExchangeRate;

  // Auto-switch tempPaymentMethod and update tempAmount when addedPayments changes
  useEffect(() => {
    if (!isPaymentModalOpen) return;

    const allMethods = ["CASH", "CARD", "TRANSFER", "PAGO_MOVIL", "BINANCE", "ZINLI", "PAYPAL", "WALLET", "CREDIT"];
    const addedMethods = addedPayments.map(p => p.method);

    // Automatically set the tempAmount to remaining to pay, in the currency picked
    // (pesos in cash rounded up to the next 100)
    const inCurrency = fromUsd(remainingToPay, tempCurrency, cashRates);
    setTempAmount(tempCurrency === "USD" ? remainingToPay.toFixed(2) : String(tempPaymentMethod === "CASH" ? cashDue(inCurrency, tempCurrency) : inCurrency));

    // Switch to first available method if current is already added
    if (addedMethods.includes(tempPaymentMethod)) {
      const available = allMethods.find(m => {
        if (m === "PAGO_MOVIL" && !settings?.pagoMovilEnabled) return false;
        if (m === "BINANCE" && !settings?.binanceEnabled) return false;
        if (m === "ZINLI" && !settings?.zinliEnabled) return false;
        if (m === "PAYPAL" && !settings?.paypalEnabled) return false;
        return !addedMethods.includes(m);
      });
      if (available) {
        setTempPaymentMethod(available as any);
      }
    }
  }, [addedPayments, remainingToPay, isPaymentModalOpen, settings, tempCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

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
            audio.play().catch(() => { });
            processBarcode(decodedText);
            setTimeout(() => {
              setScannerOpen(false);
              setUseCamera(false);
              setIsDetected(false);
            }, 800);
          },
          () => { }
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
        cleanup().catch(() => { });
      }
    };
  }, [useCamera, scannerOpen]);

  const processBarcode = (code: string) => {
    console.log("Processing Barcode:", code);
    const found = products.find(p =>
      p.variants?.some(v =>
        matchBarcodes(v.barcode, code) ||
        v.sku === code ||
        v.secondaryBarcodes?.some(sb => matchBarcodes(sb, code))
      )
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

  processBarcodeRef.current = processBarcode;

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

      if (openingBalance === undefined || openingBalance === null || Number(openingBalance) < 0) {
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
          // What's in the drawer, per currency
          openingCash: Object.fromEntries(initialCashRows.filter((r) => (parseFloat(r.amount) || 0) > 0).map((r) => [r.currency, parseFloat(r.amount)])),
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

  // USD counted by bills when the cashier uses the bill counter
  const billsUsd = cashBreakdown.b1 + (cashBreakdown.b5 * 5) + (cashBreakdown.b10 * 10) + (cashBreakdown.b20 * 20) + (cashBreakdown.b50 * 50) + (cashBreakdown.b100 * 100);
  const shiftCurrencies: CashCurrency[] = ((activeShift as any)?.currencies as CashCurrency[]) || branchCurrencyList;
  const shiftRates = ((activeShift as any)?.rates as Record<CashCurrency, number>) || cashRates;
  const countedValue = (c: CashCurrency) => (c === "USD" && countBills ? billsUsd : Number((countedCash[c] || "").replace(",", ".")) || 0);
  const countedOk = shiftCurrencies.every((c) => (c === "USD" && countBills) || (countedCash[c] ?? "").trim() === "" || /^\d+([.,]\d{1,2})?$/.test((countedCash[c] ?? "").trim()));
  const countedUsd = shiftCurrencies.reduce((t, c) => t + toUsd(countedValue(c), c, shiftRates), 0);

  const handleCloseShift = async () => {
    if (!activeShift) return;
    try {
      if (!activeShift.id) {
        toast.error("ID de turno no encontrado");
        return;
      }
      if (!countedOk) return toast.error("Revisa los montos contados: solo números, con hasta 2 decimales");

      const counted = Object.fromEntries(shiftCurrencies.map((c) => [c, countedValue(c)]));
      const expectedCash = ((activeShift as any).expectedCash || {}) as Partial<Record<CashCurrency, number>>;

      const isCashier = user?.role === "pos";
      const isBlindClose = isCashier && (settings?.blindShiftClose !== false);

      const res = await fetch(`${API}/shifts/close/${activeShift.id}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          closingBalance: countedUsd,
          countedCash: counted,
          cashBreakdown: countBills ? cashBreakdown : undefined,
          declaredDetails: {
            cashUsd: countedValue("USD"),
            cashBs: countedValue("VES"),
            posBatch: Number(posBatch) || 0,
            pagoMovilBatch: Number(pagoMovilBatch) || 0,
            isBlindClose,
          }
        }),
      });
      if (res.ok) {
        const closed = await res.json();
        setCloseSummary({
          expected: closed.expectedBalance,
          reported: closed.closingBalance,
          difference: closed.difference,
          isBlind: isBlindClose,
          rows: shiftCurrencies.map((c) => ({ currency: c, expected: Number(closed.expectedCash?.[c] ?? expectedCash[c] ?? 0), counted: countedValue(c) })),
        });
        setIsCloseSummaryOpen(true);
        setIsClosingShift(false);
        setCountedCash({});
        setCountBills(false);
        toast.success("Caja cerrada correctamente");
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al cerrar caja");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const addToCart = (product: Product, customQuantity?: number) => {
    if (product.isWeighable && customQuantity === undefined) {
      setWeighableProduct(product);
      setWeightValue("");
      setIsWeightModalOpen(true);
      return;
    }

    const variant = product.variants?.[0]; // Default to first variant for now
    const qtyToAdd = customQuantity || 1;

    if (!variant || variant.stock < qtyToAdd) {
      toast.error("Producto sin stock suficiente");
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.variantId === variant.id);
      if (existing) {
        if (existing.quantity + qtyToAdd > variant.stock) {
          toast.error("No hay más stock disponible");
          return prev;
        }
        return prev.map(item =>
          item.product.variantId === variant.id ? { ...item, quantity: item.quantity + qtyToAdd } : item
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
      return [...prev, { product: uiProduct, quantity: qtyToAdd }];
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

  const openPaymentModal = (method: "CASH" | "CARD") => {
    if (clientMissingData) return toast.error("Completa los datos del cliente para procesar el pago");
    setPaymentMethod(method);
    setAddedPayments([]); setChangeCurrency(null); // Start fresh for mixed payment logic if needed, or just keep it
    setShowSplitPaymentForm(false);
    setTempPaymentMethod(method);
    setTempAmount(finalTotalWithIgtf.toFixed(2));
    setIsPaymentModalOpen(true);
  };

  const handleSyncBcv = async () => {
    setSyncingBcv(true);
    try {
      const res = await fetch(`${API}/settings/sync-bcv`, {
        method: "POST",
        headers,
        body: JSON.stringify({ target: "pos" })
      });
      if (res.ok) {
        await refreshRates();
        toast.success(`Tasas BCV (punto de venta) actualizadas`);
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

  const handleRegisterAbono = async () => {
    if (isSubmittingAbono) return;
    if (!abonoAmount || parseFloat(abonoAmount) <= 0) {
      toast.error("Monto inválido");
      return;
    }

    setIsSubmittingAbono(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/clients/${selectedClientId}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(abonoAmount),
          notes: abonoNotes || `Abono en ${abonoPaymentMethod}`
        })
      });

      if (res.ok) {
        toast.success("Pago registrado y deuda actualizada");
        setIsPaymentModalAbonoOpen(false);
        setAbonoNotes("");
        setAbonoAmount("");

        // Reload clients to update debt visually
        const updatedRes = await fetch(`${API}/clients`, { headers: { Authorization: `Bearer ${token}` } });
        if (updatedRes.ok) {
          const data = await updatedRes.json();
          setClients(data);
          await db.clients.clear();
          await db.clients.bulkAdd(data.map((c: any) => ({ ...c, _id: c.id })));
        }
      } else {
        toast.error("Error al registrar pago");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setIsSubmittingAbono(false);
    }
  };

  const cancelPinAuthorization = async (pin: string) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API}/sales/pending-credit/reject/${pin}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error("Error canceling pending purchase:", err);
    } finally {
      setIsPollingPin(false);
      setGeneratedPinCode(null);
      setShowPinAuthModal(false);
    }
  };

  const initiatePinAuthorization = async (overriddenPayments?: any[] | null) => {
    if (isGeneratingPin) return;
    if (cart.length === 0) return toast.error("El carrito está vacío");

    const currentBranchId = localStorage.getItem("currentBranchId");
    if (!currentBranchId) {
      return toast.error("Seleccione una sucursal primero");
    }

    const paymentsToEvaluate = overriddenPayments || addedPayments;
    const creditPayments = paymentsToEvaluate.filter((p: any) => p.method === 'CREDIT');
    const creditTotal = creditPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

    if (creditTotal <= 0) {
      return toast.error("No hay ningún pago a crédito para autorizar");
    }

    setIsGeneratingPin(true);
    setShowPinAuthModal(true);
    setGeneratedPinCode(null);

    try {
      const saleData = {
        branchId: currentBranchId,
        promisedPaymentDate: promisedPaymentDate ? promisedPaymentDate.toISOString() : null,
        items: cart.map(item => {
          let itemTotal = item.product.price * item.quantity;
          let discountAmt = 0;
          let discountPct = 0;
          if (item.discount) {
            if (item.discount.type === 'pct') {
              discountPct = item.discount.value;
              discountAmt = itemTotal * (discountPct / 100);
            } else {
              discountAmt = item.discount.value;
            }
            itemTotal = Math.max(0, itemTotal - discountAmt);
          }
          return {
            variantId: (item as any).waitlistId ? null : item.product.variantId,
            waitlistId: (item as any).waitlistId || null,
            quantity: item.quantity,
            price: item.product.price,
            subtotal: itemTotal,
            discountAmt: discountAmt,
            discountPct: discountPct
          };
        }),
        discountAmt: globalDiscountAmt,
        discountPct: globalDiscount?.type === 'pct' ? globalDiscount.value : 0,
        payments: useWalletBalance && walletDeduction > 0
          ? [...paymentsToEvaluate, { method: "WALLET", amount: walletDeduction, amountLocal: 0, exchangeRate: 1 }]
          : paymentsToEvaluate,
        clientId: selectedClientId === "consumidor-final" ? null : selectedClientId,
        saveChangeToWallet: saveChangeToWallet ? changeDue : 0,
        ...(changeCurrency && { changeCurrency }),
      };

      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/sales/pending-credit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          clientId: selectedClientId,
          amount: creditTotal,
          cartData: saleData
        })
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedPinCode(data.pinCode);
        setIsPollingPin(true);
      } else {
        const err = await res.json();
        toast.error(err.message || "Error al iniciar autorización");
        setShowPinAuthModal(false);
      }
    } catch (err) {
      toast.error("Error de conexión al iniciar autorización");
      setShowPinAuthModal(false);
    } finally {
      setIsGeneratingPin(false);
    }
  };

  // PIN polling logic
  useEffect(() => {
    if (!isPollingPin || !generatedPinCode) return;

    let active = true;
    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/sales/pending-credit/status/${generatedPinCode}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok && active) {
          const data = await res.json();
          if (data.status === 'APPROVED') {
            setIsPollingPin(false);
            setShowPinAuthModal(false);
            setGeneratedPinCode(null);
            clearInterval(interval);
            toast.success("Venta autorizada por el cliente con éxito");
            finishSale(buildReceipt(data.saleId || generatedPinCode || `PIN-${Date.now()}`, addedPayments));

            // Clean up cart and finalize POS side
            setCart([]);
            setAddedPayments([]); setChangeCurrency(null);
            setSaveChangeToWallet(false);
            setUseWalletBalance(false);
            setSelectedClientId("consumidor-final");
            setIsPaymentModalOpen(false);

            // Reload clients to update debt visually
            const clientsRes = await fetch(`${API}/clients`, { headers: { Authorization: `Bearer ${token}` } });
            if (clientsRes.ok) {
              const clientsData = await clientsRes.json();
              setClients(clientsData);
              await db.clients.clear();
              await db.clients.bulkAdd(clientsData.map((c: any) => ({ ...c, _id: c.id })));
            }

          } else if (data.status === 'REJECTED') {
            setIsPollingPin(false);
            setShowPinAuthModal(false);
            setGeneratedPinCode(null);
            clearInterval(interval);
            toast.error("La compra fue rechazada por el cliente.");
          }
        }
      } catch (err) {
        console.error("Error polling PIN status:", err);
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isPollingPin, generatedPinCode, printReceipt]);

  const invoiceDesign = useMemo(() => normalizeInvoiceDesign(settings?.invoiceDesign, settings ?? undefined), [settings]);
  const invoiceBusiness = useMemo(() => resolveInvoiceBusiness(settings, invoiceDesign, user?.companyName), [settings, invoiceDesign, user]);

  /** Snapshot of the sale for the ticket, taken before the cart is cleared. */
  const buildReceipt = (saleId: string, payments: any[], pending = false): ReceiptData => ({
    saleId,
    date: new Date(),
    businessName: settings?.businessName || user?.companyName || "SYNCRO POS",
    businessAddress: settings?.businessAddress || settings?.address || null,
    businessPhone: settings?.businessPhone || settings?.phone || null,
    businessRif: settings?.ruc || null,
    clientName: selectedClient?.name || "Consumidor final",
    clientDocument: selectedClient?.documentId || null,
    clientPhone: selectedClient?.phone || null,
    cashierName: user?.name || null,
    items: cart.map((item) => {
      const gross = item.product.price * item.quantity;
      const discount = !item.discount ? 0 : item.discount.type === "pct" ? gross * (item.discount.value / 100) : item.discount.value;
      return {
        name: item.product.name,
        code: item.product.barcode || item.product.sku || null,
        quantity: item.quantity,
        price: item.product.price,
        discount: roundCents(Math.min(gross, discount)),
        subtotal: Math.max(0, gross - discount),
      };
    }),
    subtotal: subtotal,
    discount: totalDiscountAmt,
    taxRate,
    tax: taxAmount,
    igtf: igtfAmount,
    total: finalTotalWithIgtf,
    exchangeRate: currentExchangeRate,
    payments: [
      ...payments.map((p: any) => ({ method: p.method, amount: p.amount, reference: p.reference, currency: p.currency ?? null, amountCurrency: p.amountCurrency ?? null })),
      ...(useWalletBalance && walletDeduction > 0 ? [{ method: "WALLET", amount: walletDeduction }] : []),
    ],
    change: saveChangeToWallet ? 0 : changeDue,
    ...(() => {
      // Same default as the server: the currency of the last cash payment
      const cur = (changeCurrency ?? ([...payments].reverse().find((p: any) => p.method === "CASH") as any)?.currency ?? "USD") as CashCurrency;
      return { changeCurrency: cur, changeAmount: cashChange(changeDue * cashRates[cur], cur) };
    })(),
    pending,
  });

  /** Closes every sale-related window so the next customer can be served right away. */
  const resetAfterSale = useCallback(() => {
    setReceipt(null);
    setIsSaleSuccessModalOpen(false);
    setIsPaymentModalOpen(false);
    setIsConfirmPaymentOpen(false);
    setShowPinAuthModal(false);
    setIsDiscountModalOpen(false);
    setIsNumpadOpen(false);
    setIsCalculatorOpen(false);
    setIsQuickClientOpen(false);
    setIsWeightModalOpen(false);
  }, []);

  /** After a sale: animated ticket if printing is on, otherwise the success message. */
  const finishSale = (snapshot: ReceiptData) => {
    setIsConfirmPaymentOpen(false);
    setIsPaymentModalOpen(false);
    if (printReceipt) setReceipt(snapshot);
    else setIsSaleSuccessModalOpen(true);
    // Only sales saved on the server have an id the WhatsApp record can point to
    const phone = snapshot.clientPhone?.trim();
    if (sendWhatsAppInvoice && phone && !snapshot.pending && UUID_RE.test(snapshot.saleId)) {
      deliverInvoiceWhatsApp(snapshot.saleId, phone, snapshot);
    }
  };

  /** Sends the invoice in the background; the cashier keeps working. */
  const deliverInvoiceWhatsApp = async (saleId: string, phone: string, data: ReceiptData) => {
    const toastId = toast.loading(`Enviando factura por WhatsApp a ${data.clientName}…`);
    try {
      const result = await sendInvoiceWhatsApp(saleId, phone, data, invoiceDesign, invoiceBusiness);
      setSalesHistory((prev) => prev.map((s) => (s.id === saleId ? { ...s, ...result } : s)));
      toast.success(`Factura enviada por WhatsApp a ${data.clientName}`, { id: toastId });
    } catch (e) {
      const notConnected = e instanceof WhatsAppInvoiceError && e.notConnected;
      setSalesHistory((prev) => prev.map((s) => (s.id === saleId ? { ...s, whatsappInvoiceStatus: "FAILED" } : s)));
      toast.error(notConnected ? "El WhatsApp del negocio no está conectado" : "No se pudo enviar la factura por WhatsApp", {
        id: toastId,
        description: notConnected ? "Conéctalo en el módulo de chat, o envíala desde tu WhatsApp con el botón." : (e as Error).message,
        action: { label: "Abrir WhatsApp", onClick: () => openInvoiceInWhatsApp(phone, data, invoiceDesign, invoiceBusiness) },
        duration: 10000,
      });
    }
  };

  /** From the history: rebuilds the invoice of a saved sale and sends it again. */
  const resendInvoiceWhatsApp = (sale: any) => {
    const phone = sale.client?.phone?.trim();
    if (!phone) return toast.error("Este cliente no tiene WhatsApp registrado");
    deliverInvoiceWhatsApp(sale.id, phone, saleToInvoiceData(sale, settings));
  };

  const processSale = async (overriddenPayments?: any[]) => {
    if (processing || isProcessingRef.current) return;
    if (cart.length === 0) return toast.error("El carrito está vacío");

    const paymentsToEvaluate = overriddenPayments || addedPayments;
    const totalPaidEval = paymentsToEvaluate.reduce((acc: number, p: any) => acc + p.amount, 0) + (useWalletBalance ? walletDeduction : 0);
    const remainingToPayEval = Math.max(0, finalTotalWithIgtf - totalPaidEval);

    if (remainingToPayEval > 0.01) return toast.error("Aún falta saldo por cubrir");

    isProcessingRef.current = true;
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
        promisedPaymentDate: promisedPaymentDate ? promisedPaymentDate.toISOString() : null,
        items: cart.map(item => {
          let itemTotal = item.product.price * item.quantity;
          let discountAmt = 0;
          let discountPct = 0;
          if (item.discount) {
            if (item.discount.type === 'pct') {
              discountPct = item.discount.value;
              discountAmt = itemTotal * (discountPct / 100);
            } else {
              discountAmt = item.discount.value;
            }
            itemTotal = Math.max(0, itemTotal - discountAmt);
          }
          return {
            variantId: (item as any).waitlistId ? null : item.product.variantId,
            waitlistId: (item as any).waitlistId || null,
            quantity: item.quantity,
            price: item.product.price, // Ensure price is sent
            subtotal: itemTotal,
            discountAmt: discountAmt,
            discountPct: discountPct
          };
        }),
        discountAmt: globalDiscountAmt,
        discountPct: globalDiscount?.type === 'pct' ? globalDiscount.value : 0,
        payments: useWalletBalance && walletDeduction > 0
          ? [...paymentsToEvaluate, { method: "WALLET", amount: walletDeduction, amountLocal: 0, exchangeRate: 1 }]
          : paymentsToEvaluate,
        clientId: selectedClientId === "consumidor-final" ? null : selectedClientId,
        saveChangeToWallet: saveChangeToWallet ? changeDue : 0,
        ...(changeCurrency && { changeCurrency }),
      };

      // OFFLINE MODE: If offline, queue the sale
      if (!navigator.onLine) {
        await db.pendingSales.add({
          data: saleData,
          status: "pending",
          createdAt: Date.now()
        });

        toast.success("Venta guardada localmente (pendiente de sincronizar)", {
          description: "La venta se subirá al sistema automáticamente cuando se recupere la conexión.",
          duration: 6000
        });

        finishSale(buildReceipt(`OFFLINE-${Date.now()}`, paymentsToEvaluate, true));
        setCart([]);
        setSelectedClientId("consumidor-final");
        setIsPaymentModalOpen(false);
        setProcessing(false);

        return;
      }

      // ONLINE MODE: Direct POST
      const res = await fetch(`${API}/sales`, {
        method: "POST", headers, body: JSON.stringify(saleData),
      });

      if (res.ok) {
        const createdSale = await res.json();
        toast.success("Venta realizada con éxito");
        finishSale(buildReceipt(createdSale?.id || `VENTA-${Date.now()}`, paymentsToEvaluate));

        if (createdSale && createdSale.pwaCode) {
          setGeneratedPwaCode(createdSale.pwaCode);
          setPwaClientName(selectedClient ? selectedClient.name : "Cliente");
          setShowPwaCodeModal(true);
        }
        setCart([]);
        setAddedPayments([]); setChangeCurrency(null);
        setSaveChangeToWallet(false);
        setUseWalletBalance(false);
        setSelectedClientId("consumidor-final");
        setPromisedPaymentDate(new Date());
        setIsPaymentModalOpen(false);
        loadData(); // Refresh stock
        checkShift(); // Refresh active shift expected totals
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
      finishSale(buildReceipt(`OFFLINE-${Date.now()}`, overriddenPayments || addedPayments, true));

      setCart([]);
      setSelectedClientId("consumidor-final");
      setIsPaymentModalOpen(false);
    } finally {
      isProcessingRef.current = false;
      setProcessing(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClient.name.trim()) return toast.error("El nombre es obligatorio");
    if (!newClient.documentId.trim()) return toast.error("La cédula / RIF es obligatoria");
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

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.variants?.some(v =>
        v.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
      );

    if (showOnlyInStock) {
      return matchesSearch && p.totalStock > 0;
    }
    return matchesSearch;
  });

  // Keyboard: arrows move through the product grid, Enter adds the selected one to the cart.
  // From the search box, arrow down enters the grid.
  const [gridIndex, setGridIndex] = useState(-1);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridState = useRef({ products: filteredProducts, index: gridIndex, add: (_p: any) => {} });
  gridState.current = { products: filteredProducts, index: gridIndex, add: (p: any) => addToCart(p) };
  useEffect(() => { setGridIndex(-1); }, [searchTerm]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('[role=dialog][data-state=open], [role=alertdialog][data-state=open], [role=menu][data-state=open]')) return;
      const grid = gridRef.current;
      const { products: list, index, add } = gridState.current;
      if (!grid || !list.length) return;
      const el = document.activeElement as HTMLElement | null;
      const inSearch = !!el?.matches('input[placeholder^="Buscar productos"]');
      if (el && !inSearch && el.matches("input, textarea, select, [contenteditable=true]")) return;
      const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length);
      const move = (to: number) => {
        e.preventDefault();
        const next = Math.max(0, Math.min(list.length - 1, to));
        setGridIndex(next);
        grid.children[next]?.scrollIntoView({ block: "nearest" });
      };
      if (inSearch) {
        if (e.key === "ArrowDown") { el!.blur(); move(index < 0 ? 0 : index); }
        return;
      }
      if (e.key === "ArrowRight") move(index + 1);
      else if (e.key === "ArrowLeft") move(index < 0 ? 0 : index - 1);
      else if (e.key === "ArrowDown") move(index < 0 ? 0 : index + cols);
      else if (e.key === "ArrowUp") {
        // From the first row, back to the search box
        if (index >= 0 && index < cols) { e.preventDefault(); setGridIndex(-1); document.querySelector<HTMLInputElement>('input[placeholder^="Buscar productos"]')?.focus(); }
        else move(index < 0 ? 0 : index - cols);
      } else if (e.key === "Enter" && index >= 0 && list[index]) { e.preventDefault(); add(list[index]); }
      else if (e.key === "Escape" && index >= 0) setGridIndex(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      <div className="h-screen w-full flex flex-col bg-[#E9E6E0]">
        {/* Header for opening screen */}
        <header className="h-14 bg-[#E9E6E0] border-b border-[#DAD5CC] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center">
            {canAccessDashboard && (
              <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="h-8 w-8 mr-4 text-[#16140F]">
                <IconArrowLeft className="size-4" />
              </Button>
            )}
            <h1 className="font-bold text-lg tracking-tight text-[#16140F]">Syncro CRM</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* FECHA VALOR STACKED */}
            <div className="hidden sm:flex flex-col items-end mr-1">
              <p className="text-[10px] text-[#6B665B] font-bold tracking-tight leading-none opacity-60">Fecha valor</p>
              <p className="text-[12px] font-bold text-[#16140F] leading-none mt-1 capitalize">
                {bcvDate && bcvDate !== "No disponible"
                  ? bcvDate
                  : format(new Date(), "EEEE, d MMMM yyyy", { locale: es })}
              </p>
            </div>

            {/* BASE CURRENCY DROPDOWN PILL: [ USD ⌄ ] */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 px-3 gap-1.5 font-bold text-xs bg-[#FAF7F2] border-[#DAD5CC] text-[#16140F] hover:bg-[#F5F1E8] rounded-lg transition-all shadow-xs">
                  {currency} <IconChevronDown size={14} className="text-[#6B665B]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-24 border-none shadow-2xl rounded-xl p-1 bg-white">
                {(["USD", "VES", "EUR"] as const).map((c) => (
                  <DropdownMenuItem 
                    key={c} 
                    onClick={() => setCurrency(c)}
                    className="text-[11px] font-bold py-2 rounded-lg cursor-pointer hover:bg-[#FAF7F2]"
                  >
                    {c}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* REFRESH BCV BUTTON PILL: [ 🔄 BCV: 853.50 ] */}
            <Button 
              variant="outline" 
              disabled={syncingBcv}
              onClick={async () => {
                setSyncingBcv(true);
                try {
                  const token = localStorage.getItem("token");
                  const res = await fetch(`${API_URL}/settings/sync-bcv`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ target: "pos" }),
                  });
                  await refreshRates();
                  if (res.ok) {
                    toast.success("Tasa BCV sincronizada correctamente");
                  } else {
                    toast.success("Tasa BCV actualizada");
                  }
                } catch {
                  await refreshRates();
                  toast.error("Error al sincronizar la tasa BCV");
                } finally {
                  setSyncingBcv(false);
                }
              }}
              className="h-9 px-3.5 gap-2 font-bold text-xs bg-[#FAF7F2] border-[#DAD5CC] text-[#16140F] hover:bg-[#F5F1E8] rounded-lg transition-all shadow-xs disabled:opacity-50"
            >
              <IconRefresh size={14} className={cn("text-primary", syncingBcv && "animate-spin")} />
              <span>BCV: {(currency === 'EUR' ? bcvEurRate : currentExchangeRate)?.toFixed(2)}</span>
            </Button>

            <BranchSwitcher disabled={!!activeShift} />
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-6 bg-[#FAF7F2] border border-[#E8E4DC] p-8 rounded-2xl shadow-xs">
            <div className="space-y-2 text-center">
              <div className="size-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <IconCalculator className="size-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight leading-none text-[#16140F]">Terminal de venta</h1>
              <p className="text-sm text-[#6B665B] mt-1.5">
                Inicie su turno de trabajo estableciendo el fondo de caja inicial.
              </p>
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-3 p-3 border border-[#E5E1D9] rounded-xl bg-[#F7F5F0]">
                <IconUser className="size-5 text-[#6B665B]" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-[#6B665B]">Cajero</span>
                  <span className="text-sm font-semibold leading-none text-[#16140F]">{user?.name || "Administrador"}</span>
                </div>
              </div>

              {/* Dynamic Currency Breakdown Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-[#16140F]">Efectivo inicial en caja</Label>
                </div>

                <div className="space-y-2.5">
                  {initialCashRows.map((row) => (
                    <div key={row.id} className="flex items-center gap-2">
                      {/* Unified Input + Currency Selector Box */}
                      <div className="relative flex-1 flex items-center border border-[#E5E1D9] rounded-xl bg-white overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 shadow-xs">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00"
                          value={row.amount}
                          onChange={(e) => handleCashRowChange(row.id, "amount", e.target.value)}
                          className="h-10 text-sm font-semibold bg-transparent border-none focus-visible:ring-0 pl-3 pr-2 shadow-none flex-1"
                        />
                        <div className="relative flex items-center h-10 border-l border-[#E5E1D9] bg-[#FAF7F2] hover:bg-[#F5F1E8] transition-colors group">
                          <select
                            value={row.currency}
                            onChange={(e) => handleCashRowChange(row.id, "currency", e.target.value as CashCurrency)}
                            className="h-full pl-3 pr-7 bg-transparent text-xs font-bold text-[#16140F] focus:outline-none cursor-pointer appearance-none z-10"
                            style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                          >
                            {getAvailableCurrenciesForRow(row.id).map((c) => (
                              <option key={c.code} value={c.code} className="bg-white text-[#16140F] font-semibold py-1">
                                {c.label}
                              </option>
                            ))}
                          </select>
                          <IconChevronDown size={13} strokeWidth={2.5} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#6B665B] group-hover:text-[#16140F] transition-colors" />
                        </div>
                      </div>
                      {initialCashRows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveCashRow(row.id)}
                          className="h-10 w-10 text-destructive hover:bg-destructive/10 rounded-xl shrink-0"
                          title="Eliminar esta moneda"
                        >
                          <IconTrash className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {initialCashRows.length < allCurrencies().length && (
                  <button
                    type="button"
                    onClick={handleAddCashRow}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 mt-1 transition-all"
                  >
                    ＋ Agregar otra moneda
                  </button>
                )}
              </div>

              {/* Calculated Total Box */}
              <div className="p-3.5 border border-[#E5E1D9] rounded-xl bg-[#F7F5F0] flex items-center justify-between">
                <span className="text-xs font-bold text-[#6B665B]">Total monto inicial:</span>
                <div className="text-right space-y-0.5">
                  <span className="text-lg font-extrabold text-[#16140F] tabular-nums block">
                    $ {Number(openingBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <div className="text-[11px] text-[#6B665B] font-medium flex items-center justify-end gap-1.5 flex-wrap">
                    {currentExchangeRate && currentExchangeRate > 0 && (
                      <span>~ Bs. {(Number(openingBalance || 0) * currentExchangeRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    )}
                    <span className="text-[#A8A299]">·</span>
                    <span>
                      ~ € {(
                        (Number(openingBalance || 0) * (currentExchangeRate || 1)) /
                        (bcvEurRate && bcvEurRate > 0 ? bcvEurRate : ((currentExchangeRate || 1) * 1.08))
                      ).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <Button
                  onClick={handleOpenShift}
                  className="w-full h-11 text-sm font-semibold rounded-xl bg-primary text-white hover:bg-primary/90 shadow-xs"
                >
                  Abrir caja registradora
                </Button>

                <div className="flex flex-col gap-1">
                  {canAccessDashboard ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-9 text-[#6B665B] hover:text-[#16140F] gap-2 rounded-xl"
                      onClick={() => router.push("/dashboard")}
                    >
                      <IconArrowLeft className="size-3.5" /> Regresar al dashboard
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-9 text-destructive hover:bg-destructive/5 rounded-xl"
                      onClick={() => {
                        toast.info("Sesión cerrada");
                        localStorage.clear();
                        router.push("/login");
                      }}
                    >
                      <IconLogout className="size-4 mr-2" /> Cerrar sesión
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5E1D9] text-center">
              <p className="text-[10px] font-medium text-[#6B665B] leading-none">
                Syncro CRM • {new Date().toLocaleDateString()}
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

      {/* Animated ticket after the sale */}
      <ReceiptPrinter receipt={receipt} design={invoiceDesign} business={invoiceBusiness} onDone={resetAfterSale} />

      <header className="h-13 bg-[#FAF7F2] border-b border-[#E8E4DC] px-4 flex items-center justify-between sticky top-0 z-10 shrink-0 print:hidden text-xs shadow-xs">
        <div className="flex items-center gap-3">
          {canAccessDashboard && (
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="h-8 w-8 rounded-lg hover:bg-[#F5F1E8]">
              <IconArrowLeft className="size-4 text-[#16140F]" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm tracking-tight whitespace-nowrap text-[#16140F]">Syncro CRM</h1>
            <Badge variant="outline" className={cn(
              "hidden sm:inline-flex text-[9px] h-4.5 py-0 px-1.5 font-bold rounded-md",
              isOnline ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"
            )}>
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>

          <Separator orientation="vertical" className="h-5 mx-1 bg-[#DAD5CC]" />

          {/* Cajero & Date Info moved to the left */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex flex-col justify-center">
              <span className="text-[9px] text-[#6B665B] font-bold leading-none">Cajero</span>
              <span className="text-xs font-bold text-[#16140F] leading-none mt-0.5">{user?.name || "Administrador"}</span>
            </div>
            {settings?.bcvUpdateDate && (
              <div className="flex flex-col justify-center border-l border-[#DAD5CC]/60 pl-3">
                <span className="text-[9px] text-[#6B665B] font-bold leading-none">Fecha</span>
                <span className="text-xs font-semibold text-[#6B665B] leading-none mt-0.5">{settings.bcvUpdateDate}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DesktopUpdateBadge />
          {/* Base Currency Select Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-8 px-2.5 gap-1.5 font-bold text-xs bg-[#FAF7F2] border-[#DAD5CC] text-[#16140F] hover:bg-[#F5F1E8] rounded-lg transition-all shadow-xs">
                {baseCurrency} <IconChevronDown size={13} strokeWidth={2.5} className="text-[#6B665B]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-24 border border-[#DAD5CC] shadow-xl rounded-xl p-1 bg-white">
              {(["USD", "EUR"] as const).map((c) => (
                <DropdownMenuItem
                  key={c}
                  onClick={() => setBaseCurrency(c)}
                  className="text-xs font-bold py-1.5 rounded-lg cursor-pointer hover:bg-[#FAF7F2]"
                >
                  {c}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* BCV Sync Button */}
          <Button variant="outline" size="sm" className="h-8 border-[#DAD5CC] bg-[#FAF7F2] hover:bg-[#F5F1E8] text-[#16140F] gap-1.5 px-2.5 rounded-lg font-bold text-xs shadow-xs" onClick={handleSyncBcv} disabled={syncingBcv}>
            <IconRefresh size={13} className={cn("text-primary", syncingBcv && "animate-spin")} />
            <span>BCV: {currentExchangeRate.toFixed(2)}</span>
          </Button>

          <BranchSwitcher disabled={!!activeShift} />

          {/* Larger Cerrar Turno Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 gap-1.5 font-bold text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-lg shadow-xs transition-all ml-1"
            onClick={() => {
              checkShift();
              setIsClosingShift(true);
            }}
          >
            <IconCash size={15} />
            <span>Cerrar turno</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-4 p-4 lg:p-6 pb-2">

        {/* SECCIÓN IZQUIERDA: CONTENIDO PRINCIPAL (PRODUCTOS O HISTORIAL) */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">

          {/* BARRA DE CONTROLES SUPERIOR */}
          <div className="flex items-center justify-between gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Buscador (Solo en vista POS) */}
            <div className={cn(
              "flex items-center gap-2 bg-[#FAF7F2] border border-[#E8E4DC] rounded-xl px-3 h-11 flex-1 shadow-xs transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20",
              view === 'history' && "opacity-50 pointer-events-none grayscale"
            )}>
              <IconSearch className="text-[#6B665B] size-4 shrink-0" />
              <Input
                placeholder="Buscar productos por nombre o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-full p-0 text-sm font-semibold placeholder:text-[#9E988D] text-[#16140F]"
                disabled={view === 'history'}
              />
              {searchTerm && (
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-[#E8E4DC]" onClick={() => setSearchTerm("")}>
                  <IconX size={14} className="text-[#6B665B]" />
                </Button>
              )}
              <div className="flex items-center gap-2 mr-1 ml-1">
                <Switch
                  id="stock-filter"
                  checked={showOnlyInStock}
                  onCheckedChange={setShowOnlyInStock}
                  className="scale-90 data-[state=checked]:bg-primary"
                />
                <Label htmlFor="stock-filter" className="text-xs font-bold text-[#6B665B] whitespace-nowrap cursor-pointer select-none">
                  Stock
                </Label>
              </div>
              <Separator orientation="vertical" className="h-5 mx-1 bg-[#DAD5CC]" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                onClick={() => setIsNumpadOpen(true)}
                title="Teclado numérico"
              >
                <IconKeyboard size={18} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("relative h-8 w-8 rounded-lg text-primary hover:bg-primary/10 transition-colors", scannerAlwaysOn && "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15")}
                onClick={() => setScannerOpen(true)}
                title={scannerAlwaysOn ? "Escáner siempre activo (abrir para usar la cámara)" : "Escanear producto"}
              >
                <IconScan size={18} />
                {scannerAlwaysOn && (
                  <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-emerald-500" />
                )}
              </Button>
            </div>

            {/* Toggle Historial */}
            <Button
              variant={view === "history" ? "secondary" : "outline"}
              className="h-11 px-3.5 gap-2 rounded-xl border-[#DAD5CC] bg-[#FAF7F2] hover:bg-[#F5F1E8] text-[#16140F] shadow-xs shrink-0 font-bold text-xs"
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
              <IconHistory size={17} className={view === "history" ? "text-primary" : "text-[#6B665B]"} />
              <span>Historial</span>
            </Button>

            <Button
              variant="outline"
              className="h-11 px-3.5 gap-2 rounded-xl border-blue-500/30 bg-blue-50/50 hover:bg-blue-100/50 text-blue-700 shadow-xs shrink-0 font-bold text-xs"
              onClick={() => setIsCalculatorOpen(true)}
            >
              <IconCalculator size={17} />
              <span className="hidden md:inline">Calculadora</span>
            </Button>

            <Button
              variant="outline"
              className="h-11 px-3.5 gap-2 rounded-xl border-amber-500/30 bg-amber-50/50 hover:bg-amber-100/50 text-amber-700 shadow-xs shrink-0 font-bold text-xs"
              onClick={() => {
                fetchWaitlist();
                setIsWaitlistOpen(true);
              }}
            >
              <IconAlertCircle size={17} />
              <span className="hidden md:inline">Lista de espera</span>
              {waitlist.length > 0 && (
                <Badge className="ml-0.5 px-1.5 h-4 min-w-4 bg-amber-500 text-[9px] text-white flex items-center justify-center font-bold rounded-full">{waitlist.length}</Badge>
              )}
            </Button>

            <Button
              variant="outline"
              className="h-11 px-3.5 gap-2 rounded-xl border-[#DAD5CC] bg-[#FAF7F2] hover:bg-[#F5F1E8] text-[#16140F] shadow-xs shrink-0 font-bold text-xs"
              onClick={() => setIsParkedModalOpen(true)}
            >
              <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-primary transition-colors">
                <IconPlayerPause size={12} />
              </div>
              <span className="hidden md:inline">Tickets en pausa</span>
              {parkedTickets.length > 0 && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
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
                  <p className="text-xl font-black text-center">Sin resultados</p>
                </div>
              ) : (
                <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-8">
                  {filteredProducts.map((p, i) => (
                    <Card
                      key={p.id}
                      className={cn(
                        "group overflow-hidden rounded-xl border-none bg-card hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer shadow-sm relative",
                        p.totalStock <= 0 && "opacity-60 grayscale-[0.5]",
                        i === gridIndex && "ring-2 ring-primary"
                      )}
                      onMouseEnter={() => gridIndex >= 0 && setGridIndex(-1)}
                      onClick={() => addToCart(p)}
                    >
                      {/* Badge de Agotado superpuesto */}
                      {p.totalStock <= 0 && (
                        <div className="absolute top-2 right-2 z-10">
                          <Badge variant="destructive" className="text-[8px] font-bold px-1.5 h-4">Agotado</Badge>
                        </div>
                      )}
                      {/* Syncro Shop Tag Badge */}
                      <SyncroShopBadges
                        published={p.isPublishedOnSyncroShop}
                        featured={p.isFeaturedOnSyncroShop}
                        tone="solid"
                        className="absolute top-2 left-2 z-10 flex-col items-start"
                      />
                      <div className="aspect-square relative overflow-hidden bg-muted/30">
                        {p.image ? (
                          <img src={p.image} alt={p.name} loading="lazy" decoding="async" className="object-cover w-full h-full transition-transform group-hover:scale-105" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
                            <IconBox size={40} stroke={1} />
                          </div>
                        )}
                      </div>
                      <div className="p-2 flex flex-col flex-1 justify-between gap-1">
                        <div className="flex flex-col h-full">
                          <p className="font-semibold text-[11px] leading-tight line-clamp-2" title={p.name}>{p.name}</p>
                          <div className="flex items-end justify-between mt-auto pt-2">
                            <span className="font-bold text-xs">${(p.variants?.[0]?.price || 0).toFixed(2)}</span>
                            <div className="flex flex-col items-end gap-0.5 mt-1 text-right shrink-0">
                              <p className="text-[9px] font-mono text-muted-foreground leading-none" title="SKU interno">
                                {p.variants?.[0]?.sku || 'S/SKU'}
                              </p>
                              {p.variants?.[0]?.barcode && (
                                <p className="text-[8.5px] font-mono text-muted-foreground/60 flex items-center justify-end gap-1 leading-none" title="Código de barras">
                                  <IconBarcode size={10} stroke={1.5} />
                                  {p.variants[0].barcode}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 bg-background border rounded-lg overflow-hidden flex flex-col shadow-sm">
              <div className="p-4 border-b bg-muted/10 flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <IconReceipt size={16} className="text-primary" /> Historial de ventas
                  </h2>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Control de actividad de facturación</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative w-60">
                    <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
                    <Input
                      placeholder="Buscar por cliente o cédula..."
                      className="pl-7 h-7 text-[11px] w-full bg-background/50 border-muted-foreground/25 focus-visible:ring-emerald-500/50"
                      value={historySearchTerm}
                      onChange={(e) => setHistorySearchTerm(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold gap-2" onClick={() => setView('pos')}>
                    Volver al POS
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-muted/5">
                {historyLoading ? (
                  <div className="p-6 space-y-4">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
                  </div>
                ) : filteredSalesHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-40 py-20">
                    <IconHistory size={48} stroke={1} className="mb-2" />
                    <p className="text-xs font-bold">Sin ventas registradas</p>
                  </div>
                ) : (
                  <div className="min-w-full inline-block align-middle">
                    <table className="w-full text-sm">
                      <thead className="bg-background sticky top-0 border-b z-10">
                        <tr>
                          <th className="p-4 text-left font-bold text-[10px] text-muted-foreground">ID venta</th>
                          <th className="p-4 text-left font-bold text-[10px] text-muted-foreground">Fecha / hora</th>
                          <th className="p-4 text-left font-bold text-[10px] text-muted-foreground">Cliente</th>
                          <th className="p-4 text-left font-bold text-[10px] text-muted-foreground">Cajero</th>
                          <th className="p-4 text-right font-bold text-[10px] text-muted-foreground">Artículos</th>
                          <th className="p-4 text-right font-bold text-[10px] text-muted-foreground">Total USD</th>
                          <th className="p-4 text-center font-bold text-[10px] text-muted-foreground">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-background/50">
                        {filteredSalesHistory.map((sale) => (
                          <tr
                            key={sale.id}
                            className="hover:bg-muted/10 transition-colors group cursor-pointer"
                            onClick={() => {
                              setSelectedSale(formatSaleObject(sale));
                              setIsDetailModalOpen(true);
                            }}
                          >
                            <td className="p-4">
                              <code className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded">
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
                                  <span className="text-[11px] font-bold group-hover:text-primary transition-colors">{sale.client?.name || "Consumidor final"}</span>
                                  <span className="text-[9px] text-muted-foreground">{sale.client?.documentId || "No identificado"}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-xs font-semibold text-zinc-300">
                              {sale.user?.name || "Desconocido"}
                            </td>
                            <td className="p-4 text-right">
                              <div className="inline-flex flex-col items-end">
                                <span className="font-bold text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 border text-muted-foreground">
                                  {sale.items?.length || 0} items
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-right font-black text-xs tabular-nums text-foreground/90">
                              ${sale.total?.toFixed(2)}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-3">
                                <Badge className="text-[9px] font-black px-1.5 h-6 bg-emerald-500/10 text-emerald-600 border-none shadow-none">Completa</Badge>
                                {sale.client?.phone && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      "h-8 w-8 transition-colors",
                                      sale.whatsappInvoiceStatus === "SENT" ? "text-emerald-600 hover:bg-emerald-500/10" : sale.whatsappInvoiceStatus === "FAILED" ? "text-rose-500 hover:bg-rose-500/10" : "text-muted-foreground hover:bg-muted",
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      resendInvoiceWhatsApp(sale);
                                    }}
                                    title={
                                      sale.whatsappInvoiceStatus === "SENT"
                                        ? `Factura enviada a ${sale.whatsappInvoiceTo || sale.client.phone}. Toca para reenviarla`
                                        : sale.whatsappInvoiceStatus === "FAILED"
                                          ? `No se pudo enviar${sale.whatsappInvoiceError ? `: ${sale.whatsappInvoiceError}` : ""}. Toca para reintentar`
                                          : "Enviar factura por WhatsApp"
                                    }
                                  >
                                    <IconBrandWhatsapp size={18} />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-500 hover:bg-amber-500/10 hover:text-amber-600 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openReturnModal(sale);
                                  }}
                                  title="Procesar devolución"
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
        <div className="w-full lg:w-[390px] xl:w-[410px] flex flex-col h-full bg-[#FAF7F2] border border-[#E8E4DC] rounded-2xl overflow-hidden shadow-xs shrink-0">
          <div className="p-4 border-b border-[#E8E4DC] bg-[#FAF7F2] shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-sm font-bold text-[#16140F] flex items-center gap-2">
                  <IconShoppingCart className="text-primary size-4" /> Ticket actual
                </h2>
                <p className="text-xs text-[#6B665B] mt-0.5 font-medium">
                  {cart.length} productos • {new Date().toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-blue-600 hover:bg-blue-500/10 rounded-lg transition-colors"
                  onClick={parkTicket}
                  title="Poner ticket en espera"
                >
                  <IconPlayerPause size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  onClick={() => setCart([])}
                  title="Vaciar carrito"
                >
                  <IconTrash size={16} />
                </Button>
              </div>
            </div>

            <Separator className="mt-3 mb-3 bg-[#E8E4DC]" />

            <div className="space-y-2">
              <div className="flex justify-between items-center px-0.5">
                <Label className="text-[10px] font-bold text-[#6B665B]">Identificación cliente</Label>
                <button className="text-primary text-[10px] font-bold hover:underline" onClick={() => setIsQuickClientOpen(true)}>
                  + Nuevo
                </button>
              </div>
              <div className="relative">
                <Input
                  placeholder="Buscar por cédula / RIF... (Enter)"
                  value={clientDocSearch}
                  onChange={e => setClientDocSearch(e.target.value)}
                  onKeyDown={handleClientDocSearch}
                  className="h-9 text-xs font-semibold pr-8 bg-white border-[#DAD5CC] rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                  disabled={searchingClient}
                />
                {searchingClient && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <IconRefresh size={12} className="animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setClientPickerOpen(true)}
                className="flex h-9.5 w-full items-center justify-between gap-2 rounded-xl border border-[#DAD5CC] bg-white px-3 text-left text-xs font-semibold text-[#16140F] transition-colors hover:border-primary/40"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <IconUser size={14} className="shrink-0 text-[#9A9488]" />
                  <span className="truncate">
                    {selectedClientId === "consumidor-final" ? "Consumidor final" : selectedClient?.name ?? "Cliente seleccionado"}
                  </span>
                  {selectedClientId !== "consumidor-final" && selectedClient?.documentId && (
                    <span className="shrink-0 font-mono text-[10px] font-normal text-[#9A9488]">{selectedClient.documentId}</span>
                  )}
                </span>
                <span className="shrink-0 text-[10px] font-medium text-primary">Buscar</span>
              </button>
              <ClientPicker
                open={clientPickerOpen}
                onOpenChange={setClientPickerOpen}
                selectedClientId={selectedClientId}
                offlineClients={clients as DirectoryClient[]}
                onCreateNew={() => setIsQuickClientOpen(true)}
                onSelect={(client) => {
                  if (!client) return setSelectedClientId("consumidor-final");
                  // Keep it in the local list: wallet, debt and credit read from there
                  // Keep the freshest data (phone, cédula) from the directory over the local copy
                  setClients((prev) =>
                    prev.some((c) => (c.id || (c as any)._id) === client.id)
                      ? prev.map((c) => ((c.id || (c as any)._id) === client.id ? { ...c, ...(client as Client) } : c))
                      : [...prev, client as Client],
                  );
                  setSelectedClientId(client.id);
                }}
              />
              {clientMissingData && selectedClient && (
                <ClientDataPrompt client={selectedClient} knownClients={clients} onSaved={handleClientDataSaved} country={settings?.country || user?.country} className="mt-2" />
              )}
              {selectedClientId !== "consumidor-final" && (() => {
                const c = clients.find(cl => (cl.id || (cl as any)._id) === selectedClientId) as any;
                if (c) {
                  return (
                    <div className="space-y-2 mt-2">
                      {/* Wallet Balance */}
                      {(c.walletBalance || 0) > 0 && (
                        <div className="flex items-center justify-between px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1.5">
                            <IconWallet size={14} /> Saldo a favor
                          </span>
                          <span className="text-sm font-black text-emerald-600 tabular-nums">
                            ${(c.walletBalance || 0).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Current Debt & Abono */}
                      {(c.currentDebt || 0) > 0 && (() => {
                        const available = (c.creditLimit || 0) - (c.currentDebt || 0);
                        const isBlocked = c.hasAccount && (available <= 0.01);
                        return (
                          <div className={cn(
                            "flex flex-col gap-2 p-3 rounded-xl border",
                            isBlocked
                              ? "bg-rose-500/10 border-rose-500/20 text-rose-600 animate-in shake duration-300"
                              : "bg-amber-500/10 border-amber-500/20 text-amber-600"
                          )}>
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-[10px] font-bold flex items-center gap-1.5",
                                isBlocked ? "text-rose-600 animate-pulse" : "text-amber-600"
                              )}>
                                {isBlocked ? <IconAlertTriangle size={14} /> : <IconHistory size={14} />}
                                {isBlocked ? "Crédito bloqueado" : "Deuda activa"}
                              </span>
                              <span className={cn(
                                "text-sm font-black tabular-nums",
                                isBlocked ? "text-rose-600" : "text-amber-600"
                              )}>
                                ${(c.currentDebt || 0).toFixed(2)}
                              </span>
                            </div>
                            {isBlocked && (
                              <p className="text-[9px] text-muted-foreground font-semibold leading-normal text-left">
                                El cupo está agotado. Debe realizar un abono para volver a activar las compras a crédito.
                              </p>
                            )}
                            <Button
                              variant={isBlocked ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "w-full h-7 text-[10px] font-bold",
                                isBlocked
                                  ? "bg-rose-600 hover:bg-rose-500 text-white border-none"
                                  : "border-amber-500/30 text-amber-700 dark:text-amber-500 hover:bg-amber-500/20"
                              )}
                              onClick={() => {
                                setAbonoAmount(c.currentDebt.toString());
                                setIsPaymentModalAbonoOpen(true);
                              }}
                            >
                              Abonar a deuda
                            </Button>
                          </div>
                        );
                      })()}

                      {/* SyncroCredit Radial (shows if they have a registered account) */}
                      {c.hasAccount && (
                        <div className="animate-in fade-in duration-300">
                          <CreditRadial client={c} />
                        </div>
                      )}
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
                <p className="text-xs font-bold">Carrito vacío</p>
              </div>
            ) : (
              cart.map(item => (
                <div
                  key={item.product.variantId || item.product.id}
                  className="p-3.5 rounded-xl border border-[#E8E4DC] bg-white flex flex-col gap-2.5 relative group hover:border-primary/50 transition-colors shadow-2xs"
                >
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-bold text-xs text-[#16140F] leading-tight flex-1 group-hover:text-primary transition-colors">{item.product.name}</p>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <div className="flex flex-col items-end">
                        {item.discount ? (
                          <>
                            <p className="font-bold text-xs text-rose-500 line-through opacity-70">${(item.product.price * item.quantity).toFixed(2)}</p>
                            <p className="font-extrabold text-sm text-emerald-600">
                              ${(Math.max(0, (item.product.price * item.quantity) - (item.discount.type === 'pct' ? (item.product.price * item.quantity) * (item.discount.value / 100) : item.discount.value))).toFixed(2)}
                            </p>
                          </>
                        ) : (
                          <p className="font-extrabold text-sm text-[#16140F]">${(item.product.price * item.quantity).toFixed(2)}</p>
                        )}
                      </div>
                      <p className="text-[9.5px] font-mono text-[#6B665B] leading-none font-semibold">
                        {item.product.sku || 'S/SKU'}
                      </p>
                      {item.product.barcode && (
                        <p className="text-[9px] font-mono text-[#6B665B]/70 flex items-center gap-1 leading-none">
                          <IconBarcode size={10} stroke={1.5} />
                          {item.product.barcode}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center border border-[#DAD5CC] rounded-lg h-8 bg-[#FAF7F2]">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none border-r border-[#DAD5CC] hover:bg-[#F5F1E8]" onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, -1); }}>
                        <IconMinus size={12} />
                      </Button>
                      <span className="w-9 text-center text-xs font-bold text-[#16140F]">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none border-l border-[#DAD5CC] hover:bg-[#F5F1E8]" onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, 1); }}>
                        <IconPlus size={12} />
                      </Button>
                    </div>
                    <div className="flex gap-1 items-center">
                      <Button variant="ghost" size="icon" title="Editar cantidad / peso" className="h-7 w-7 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-500/10" onClick={(e) => {
                        e.stopPropagation();
                        setEditingCartItemId(item.product.id);
                        setEditingCartItemName(item.product.name);
                        setEditingCartItemPrice(item.product.price);
                        setWeightValue(String(item.quantity));
                        setWeightUnit('ud');
                        setIsWeightModalOpen(true);
                      }}>
                        <IconScale size={15} />
                      </Button>
                      <Button variant="ghost" size="icon" title="Aplicar descuento" className="h-7 w-7 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10" onClick={(e) => {
                        e.stopPropagation();
                        openPinVerification(() => {
                          setTargetDiscountId(item.product.id);
                          setDiscountType('pct');
                          setDiscountValueInput('');
                          setIsDiscountModalOpen(true);
                        });
                      }}>
                        <IconDiscount size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); removeFromCart(item.product.id); }}>
                        <IconTrash size={14} />
                      </Button>
                    </div>
                  </div>
                  {item.discount && (
                    <div className="flex justify-start">
                      <Badge variant="outline" className="text-[9.5px] h-4.5 px-1.5 py-0 border-emerald-500/30 text-emerald-600 bg-emerald-500/10 flex items-center gap-1 cursor-pointer rounded-md font-bold" onClick={(e) => {
                        e.stopPropagation();
                        setCart(prev => prev.map(c => c.product.id === item.product.id ? { ...c, discount: undefined } : c));
                      }}>
                        <IconDiscount size={10} />
                        {item.discount.type === 'pct' ? `${item.discount.value}%` : `$${item.discount.value}`} off
                        <IconX size={10} className="ml-1" />
                      </Badge>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-[#E8E4DC] bg-[#FAF7F2] shrink-0 space-y-3">
            <div className="space-y-1.5 px-1">
              <div className="flex justify-between text-xs font-semibold text-[#6B665B] group relative cursor-pointer" onClick={() => {
                openPinVerification(() => {
                  setTargetDiscountId('GLOBAL');
                  setDiscountType('pct');
                  setDiscountValueInput('');
                  setIsDiscountModalOpen(true);
                });
              }}>
                <span className="flex items-center gap-1 border-b border-dashed border-[#6B665B]/30 hover:border-emerald-600 hover:text-emerald-600 transition-colors">
                  <IconDiscount size={13} /> Descuento global
                </span>
                <span className={cn("tabular-nums font-bold", totalDiscountAmt > 0 ? "text-emerald-600" : "")}>
                  {totalDiscountAmt > 0 ? `-$${totalDiscountAmt.toFixed(2)}` : '$0.00'}
                </span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-[#6B665B]">
                <span>Subtotal (neto)</span>
                <span className="tabular-nums font-bold text-[#16140F]">${subtotalAfterGlobalDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-[#6B665B]">
                <span>IVA ({taxRate}%)</span>
                <span className="tabular-nums font-bold text-[#16140F]">${taxAmount.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-[#E8E4DC]">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-[#16140F]">Total checkout</span>
                <span className="text-xs text-[#6B665B] font-bold tabular-nums">~ Bs {(updatedTotal * currentExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <span className="text-2xl font-black tracking-tight text-[#16140F] tabular-nums">${updatedTotal.toFixed(2)}</span>
            </div>
            <Button
              size="lg"
              className="w-full h-12 font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md relative group overflow-hidden transition-all duration-200 rounded-xl"
              onClick={() => openPaymentModal("CASH")}
              disabled={cart.length === 0 || processing || clientMissingData}
              title={clientMissingData ? "Completa los datos del cliente para continuar" : undefined}
            >
              <span className="relative flex items-center justify-center gap-2">
                <IconCash className="size-5" />
                Procesar pago
              </span>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-5xl lg:max-w-6xl gap-0 p-0 overflow-hidden border shadow-2xl rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-12 h-full max-h-[90vh]">

            {/* LEFT COLUMN: ORDER SUMMARY */}
            <div className="md:col-span-5 bg-muted/20 border-r flex flex-col overflow-hidden">
              <div className="p-5 border-b bg-background/50">
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <IconList className="size-4 text-primary" /> Resumen de compra
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{cart.length} productos en el carrito</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 rounded-md bg-background border border-border/50 shadow-sm transition-all hover:border-primary/20">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-semibold text-foreground truncate max-w-[220px]">{item.product.name}</span>
                      <span className="text-[11px] text-muted-foreground font-medium">{item.quantity} x ${item.product.price.toFixed(2)}</span>
                    </div>
                    <div className="text-right flex flex-col">
                      <span className="text-[13px] font-bold text-foreground">${(item.quantity * item.product.price).toFixed(2)}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">Bs {((item.quantity * item.product.price) * currentExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-5 bg-background border-t space-y-2">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="text-xs font-medium">Subtotal</span>
                  <span className="text-sm font-semibold text-foreground/80">${subtotal.toFixed(2)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span className="text-xs font-medium">IVA ({taxRate}%)</span>
                    <span className="text-sm font-semibold text-foreground/80">${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-[13px] font-semibold text-foreground">Total bruto</span>
                  <span className="text-lg font-bold text-foreground">${updatedTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: PAYMENT PROCESSING */}
            <div className="md:col-span-7 flex flex-col overflow-hidden bg-background">
              <div className="p-5 border-b flex justify-between items-center h-[69px]">
                <div>
                  <DialogTitle className="text-base font-semibold tracking-tight text-foreground">Procesar pago</DialogTitle>
                  <p className="text-[11px] text-muted-foreground font-medium">Complete la información de pago</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 mr-6 rounded-full bg-muted/40 border">
                  <IconUser size={14} className="text-muted-foreground" />
                  <span className="text-[11px] font-semibold truncate max-w-[150px]" title={selectedClient ? selectedClient.name : "Consumidor final"}>
                    {selectedClient ? selectedClient.name : "Consumidor final"}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* Total Display */}
                <div className="p-6 rounded-lg bg-primary/5 border border-primary/20 flex flex-col gap-3">
                  <p className="text-xs font-semibold text-primary/70 tracking-tight">Monto total a pagar</p>
                  <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1">
                    <p className="text-4xl font-bold tracking-tight text-primary">${finalTotalWithIgtf.toFixed(2)}</p>
                    <p className="text-3xl font-bold tracking-tight text-primary/50 tabular-nums">Bs {(finalTotalWithIgtf * currentExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  {igtfAmount > 0 && <p className="text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 self-start px-2 py-0.5 rounded">+ IGTF (3%) incluido</p>}
                </div>

                {/* Wallet Toggle */}
                {selectedClientId !== "consumidor-final" && availableWallet > 0 && (
                  <div className={cn(
                    "flex items-center justify-between p-4 rounded-lg border transition-all",
                    useWalletBalance ? "bg-emerald-500/5 border-emerald-500/30" : "bg-muted/30 border-transparent opacity-80"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-md",
                        useWalletBalance ? "bg-emerald-500 text-white" : "bg-background text-muted-foreground"
                      )}>
                        <IconWallet size={18} stroke={2} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold text-foreground">Saldo a favor</span>
                        <span className="text-[11px] text-muted-foreground font-medium">Disponible: ${availableWallet.toFixed(2)}</span>
                      </div>
                    </div>
                    <Switch checked={useWalletBalance} onCheckedChange={setUseWalletBalance} />
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="text-xs font-semibold text-muted-foreground tracking-tight">Métodos de pago</h4>
                  </div>

                  {/* Payment Entry Form: Dynamic Grid based on method */}
                  {remainingToPay > 0.001 && (addedPayments.length === 0 || showSplitPaymentForm) && (
                    <>
                      <div className="grid grid-cols-12 gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className={cn(tempPaymentMethod === "CASH" ? "col-span-4" : tempPaymentMethod === "CREDIT" ? "col-span-6" : "col-span-3")}>
                          <Select value={tempPaymentMethod} onValueChange={(v: any) => setTempPaymentMethod(v)}>
                            <SelectTrigger className="h-10 rounded-md font-medium text-[13px] border-border/60">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CASH" disabled={addedPayments.some(p => p.method === "CASH")}>Efectivo</SelectItem>
                              <SelectItem value="CARD" disabled={addedPayments.some(p => p.method === "CARD")}>Tarjeta (punto)</SelectItem>
                              <SelectItem value="TRANSFER" disabled={addedPayments.some(p => p.method === "TRANSFER")}>Transferencia</SelectItem>
                              {settings?.pagoMovilEnabled && <SelectItem value="PAGO_MOVIL" disabled={addedPayments.some(p => p.method === "PAGO_MOVIL")}>Pago móvil</SelectItem>}
                              {settings?.binanceEnabled && <SelectItem value="BINANCE" disabled={addedPayments.some(p => p.method === "BINANCE")}>Binance pay</SelectItem>}
                              {settings?.zinliEnabled && <SelectItem value="ZINLI" disabled={addedPayments.some(p => p.method === "ZINLI")}>Zinli</SelectItem>}
                              {settings?.paypalEnabled && <SelectItem value="PAYPAL" disabled={addedPayments.some(p => p.method === "PAYPAL")}>PayPal</SelectItem>}
                              <SelectItem value="WALLET" disabled={addedPayments.some(p => p.method === "WALLET")}>Monedero</SelectItem>
                              <SelectItem
                                value="CREDIT"
                                disabled={
                                  addedPayments.some(p => p.method === "CREDIT") ||
                                  (selectedClient?.hasAccount && ((selectedClient?.creditLimit || 0) - (selectedClient?.currentDebt || 0) <= 0.01 && (selectedClient?.currentDebt || 0) > 0))
                                }
                              >
                                {(selectedClient?.hasAccount && ((selectedClient?.creditLimit || 0) - (selectedClient?.currentDebt || 0) <= 0.01 && (selectedClient?.currentDebt || 0) > 0))
                                  ? "Crédito / fiado (bloqueado)"
                                  : "Crédito / fiado"
                                }
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          {tempPaymentMethod === "CREDIT" && (selectedClientId === "consumidor-final" || !selectedClient?.hasAccount || creditType === "traditional") && (
                            <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
                              <div className="space-y-2 px-1">
                                <label className="text-[10px] font-black text-muted-foreground ml-0.5">
                                  Fecha promesa de pago
                                </label>
                                <Popover>
                                  <PopoverTrigger asChild disabled={selectedClientId === "consumidor-final"}>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "w-full h-10 justify-start text-left font-bold text-[13px] rounded-lg border-border/40 bg-muted/20 hover:bg-muted/30 hover:border-primary/30 transition-all duration-300 shadow-sm px-3",
                                        (!promisedPaymentDate || selectedClientId === "consumidor-final") && "text-muted-foreground"
                                      )}
                                    >
                                      <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center mr-2.5 text-primary shrink-0">
                                        <IconCalendarTabler size={16} stroke={2.5} />
                                      </div>
                                      <span className="flex-1 whitespace-nowrap overflow-hidden">
                                        {selectedClientId === "consumidor-final"
                                          ? "Seleccione un cliente para fiar"
                                          : promisedPaymentDate ? format(promisedPaymentDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                                      </span>
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="end">
                                    <div className="bg-gradient-to-br from-card to-muted/50 p-1">
                                      <Calendar
                                        mode="single"
                                        selected={promisedPaymentDate}
                                        onSelect={setPromisedPaymentDate}
                                        initialFocus
                                        locale={es}
                                        className="rounded-xl border-none"
                                      />
                                    </div>
                                  </PopoverContent>
                                </Popover>
                                {selectedClientId !== "consumidor-final" ? (
                                  <p className="text-[10px] text-muted-foreground/60 italic ml-1 flex items-center gap-1">
                                    <IconAlertCircle size={10} /> El sistema notificará automáticamente este día.
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-destructive font-bold italic ml-1 flex items-center gap-1">
                                    <IconAlertCircle size={10} /> No se puede fiar al consumidor final.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {tempPaymentMethod === "WALLET" && selectedClientId !== "consumidor-final" && (
                            <div className="mt-1 flex items-center gap-1.5 px-1 animate-in fade-in slide-in-from-top-1 duration-300">
                              <div className="size-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                              <span className="text-[9px] font-bold text-blue-600 tracking-tight">Saldo: ${availableWallet.toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        {tempPaymentMethod !== "CASH" && tempPaymentMethod !== "CREDIT" && (
                          <div className="col-span-3">
                            <Input
                              className="h-10 rounded-md text-[13px] font-medium border-border/60"
                              value={tempReference}
                              onChange={(e) => setTempReference(e.target.value)}
                              placeholder="Referencia"
                            />
                          </div>
                        )}

                        {tempPaymentMethod !== "CREDIT" && (
                          <div className={cn(tempPaymentMethod === "CASH" ? "col-span-6" : "col-span-4", "relative group")}>
                            <button
                              type="button"
                              onClick={() => setTempCurrency(branchCurrencyList[(branchCurrencyList.indexOf(tempCurrency) + 1) % branchCurrencyList.length])}
                              title="Cambiar moneda"
                              className={cn(
                                "absolute left-1.5 top-1.5 size-7 rounded flex items-center justify-center text-[11px] font-bold transition-all z-10 shadow-sm",
                                tempCurrency === "USD" ? "bg-primary text-primary-foreground" : tempCurrency === "VES" ? "bg-emerald-500 text-white" : tempCurrency === "EUR" ? "bg-sky-600 text-white" : "bg-amber-600 text-white"
                              )}
                            >
                              {tempCurrency === "USD" ? "$" : tempCurrency === "VES" ? "Bs" : tempCurrency === "EUR" ? "€" : "COP"}
                            </button>
                            <Input
                              type="number"
                              className="pl-10 h-10 rounded-md text-[13px] font-semibold border-border/60 tracking-tight"
                              value={tempAmount}
                              onChange={(e) => setTempAmount(e.target.value)}
                              placeholder="0.00"
                              onFocus={(e) => e.target.select()}
                            />
                          </div>
                        )}

                        {tempPaymentMethod === "CREDIT" && selectedClient && (selectedClient.currentDebt || 0) > 0 && (
                          <div className="col-span-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2">
                              <IconHistory className="text-amber-600 size-5" />
                              <span className="text-[12px] font-semibold text-amber-700 dark:text-amber-500 tracking-tight">Deuda previa abierta</span>
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-[10px] font-bold text-amber-600/80">Libreta actual</span>
                              <span className="text-sm font-black text-amber-600 tabular-nums">${(selectedClient.currentDebt || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        )}

                        {tempPaymentMethod !== "CREDIT" && (
                          <div className="col-span-2">
                            <Button
                              className="w-full h-10 rounded-md text-xs font-semibold"
                              onClick={() => {
                                const amountNum = Number(tempAmount);
                                if (isNaN(amountNum) || amountNum <= 0) return;
                                if (!(cashRates[tempCurrency] > 0)) return toast.error("Falta la tasa del peso colombiano: configúrala en el panel, botón COP");
                                // Amounts are kept in dollars; the currency and its amount say what came in
                                const usdAmount = Math.round(toUsd(amountNum, tempCurrency, cashRates) * 10000) / 10000;
                                setAddedPayments([...addedPayments, {
                                  method: tempPaymentMethod,
                                  amount: usdAmount,
                                  amountLocal: Math.round(usdAmount * cashRates.VES * 100) / 100,
                                  exchangeRate: cashRates.VES,
                                  reference: tempReference,
                                  currency: tempCurrency,
                                  amountCurrency: amountNum,
                                } as any]);
                                setTempAmount("0");
                                setTempReference("");
                                setShowSplitPaymentForm(false);
                              }}
                            >
                              Añadir
                            </Button>
                          </div>
                        )}
                      </div>

                      {tempPaymentMethod === "PAGO_MOVIL" && (
                        <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-md flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-2">
                            <IconDevices className="text-blue-500 size-5" />
                            <span className="text-[11px] font-bold text-blue-600 hidden sm:block">Datos pago móvil</span>
                          </div>
                          <div className="flex gap-4">
                            <div className="flex flex-col text-right">
                              <span className="text-[9px] font-bold text-muted-foreground">Banco</span>
                              <span className="text-xs font-semibold">{settings?.pagoMovilBank || "-"}</span>
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-[9px] font-bold text-muted-foreground">Cédula/RIF</span>
                              <span className="text-xs font-semibold">{settings?.pagoMovilId || "-"}</span>
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-[9px] font-bold text-muted-foreground">Teléfono</span>
                              <span className="text-xs font-semibold">{settings?.pagoMovilPhone || "-"}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {tempPaymentMethod === "BINANCE" && (
                        <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-md flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-2">
                            <IconHexagon className="text-yellow-600 size-5" />
                            <span className="text-[11px] font-bold text-yellow-600 hidden sm:block">Datos Binance pay</span>
                          </div>
                          <div className="flex gap-4">
                            <div className="flex flex-col text-right">
                              <span className="text-[9px] font-bold text-muted-foreground">Binance ID</span>
                              <span className="text-xs font-semibold">{settings?.binanceId || "-"}</span>
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-[9px] font-bold text-muted-foreground">Correo</span>
                              <span className="text-xs font-semibold">{settings?.binanceEmail || "-"}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {tempPaymentMethod === "ZINLI" && (
                        <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-md flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-2">
                            <IconWorld className="text-purple-600 size-5" />
                            <span className="text-[11px] font-bold text-purple-600 hidden sm:block">Datos Zinli</span>
                          </div>
                          <div className="flex gap-4">
                            <div className="flex flex-col text-right">
                              <span className="text-[9px] font-bold text-muted-foreground">Correo Zinli</span>
                              <span className="text-xs font-semibold">{settings?.zinliEmail || "-"}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {tempPaymentMethod === "PAYPAL" && (
                        <div className="p-3 bg-blue-700/5 border border-blue-700/20 rounded-md flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-2">
                            <IconBuilding className="text-blue-800 size-5" />
                            <span className="text-[11px] font-bold text-blue-800 hidden sm:block">Datos PayPal</span>
                          </div>
                          <div className="flex gap-4">
                            <div className="flex flex-col text-right">
                              <span className="text-[9px] font-bold text-muted-foreground">Correo PayPal</span>
                              <span className="text-xs font-semibold">{settings?.paypalEmail || "-"}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* List of Added Payments (Locked Rows) */}
                  {addedPayments.length > 0 && (
                    <div className="space-y-3">
                      {addedPayments.map((p, i) => {
                        const isCash = p.method === "CASH";
                        const isCredit = p.method === "CREDIT";
                        const hasRef = !isCash && !isCredit;

                        const methodNames: Record<string, string> = {
                          CASH: "Efectivo",
                          CARD: "Tarjeta (Punto)",
                          TRANSFER: "Transferencia",
                          PAGO_MOVIL: "Pago Móvil",
                          BINANCE: "Binance Pay",
                          ZINLI: "Zinli",
                          PAYPAL: "PayPal",
                          WALLET: "Monedero",
                          CREDIT: "Crédito / Fiado"
                        };

                        return (
                          <div key={i} className="grid grid-cols-12 gap-3 items-center p-3 rounded-lg border border-border/50 bg-muted/20 relative group transition-all duration-300">
                            {/* Payment Method Select (Locked/Disabled) */}
                            <div className={cn(isCash ? "col-span-4" : isCredit ? "col-span-6" : "col-span-3")}>
                              <Select value={p.method} disabled>
                                <SelectTrigger className="h-10 rounded-md font-semibold text-[13px] border-border/60 bg-muted/30 text-foreground/80 opacity-95 cursor-not-allowed">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <IconLock size={12} className="text-muted-foreground shrink-0" />
                                    <SelectValue />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={p.method}>{methodNames[p.method] || p.method}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Reference Input (Locked/Disabled) */}
                            {hasRef && (
                              <div className="col-span-3">
                                <Input
                                  className="h-10 rounded-md text-[13px] font-medium border-border/60 bg-muted/30 text-foreground/80 opacity-95 cursor-not-allowed"
                                  value={p.reference || ""}
                                  disabled
                                  placeholder="Referencia"
                                />
                              </div>
                            )}

                            {/* Amount Input (Locked/Disabled) */}
                            {!isCredit && (
                              <div className={cn(isCash ? "col-span-6" : "col-span-4", "relative")}>
                                {(p as any).currency && (p as any).currency !== "USD" ? (
                                  <div className="flex h-10 items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 text-[13px] font-semibold tabular-nums text-foreground/80">
                                    <span>{formatMoney((p as any).amountCurrency ?? 0, (p as any).currency)}</span>
                                    <span className="text-[11px] font-medium text-muted-foreground">${p.amount.toFixed(2)}</span>
                                  </div>
                                ) : (
                                  <>
                                    <span className="absolute left-3 top-2.5 text-[11px] font-bold text-muted-foreground/80">$</span>
                                    <Input
                                      className="pl-6 h-10 rounded-md text-[13px] font-semibold border-border/60 bg-muted/30 text-foreground/80 opacity-95 cursor-not-allowed tracking-tight"
                                      value={p.amount.toFixed(2)}
                                      disabled
                                    />
                                  </>
                                )}
                              </div>
                            )}

                            {isCredit && (
                              <div className="col-span-4 flex items-center justify-end px-2">
                                <span className="text-[11px] font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full">
                                  Por cobrar en libreta
                                </span>
                              </div>
                            )}

                            {/* Delete Button */}
                            <div className="col-span-2 flex justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-full rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-dashed border-border/60 hover:border-destructive/30"
                                onClick={() => {
                                  setAddedPayments(addedPayments.filter((_, idx) => idx !== i));
                                  setShowSplitPaymentForm(false);
                                }}
                                title="Eliminar este pago"
                              >
                                <IconTrash size={16} />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Another Payment Method Button */}
                  {remainingToPay > 0.001 && addedPayments.length > 0 && !showSplitPaymentForm && (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full py-6 border-dashed border-primary/30 hover:border-primary text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 rounded-xl font-bold text-xs"
                        onClick={() => setShowSplitPaymentForm(true)}
                      >
                        <IconPlus size={16} />
                        Agregar otro método de pago
                      </Button>
                    </div>
                  )}

                  {/* Status Display Area */}
                  <div className="pt-2">
                    {remainingToPay > 0.001 ? (
                      <div className="p-8 rounded-lg bg-amber-500/5 border border-amber-500/20 flex flex-col items-center gap-2 shadow-sm">
                        <span className="text-[12px] font-semibold text-amber-600 tracking-tight">Pendiente por cobrar</span>
                        <div className="flex flex-col items-center gap-1 text-center">
                          <span className="text-5xl font-bold text-amber-500 tabular-nums tracking-tighter leading-none">${remainingToPay.toFixed(2)}</span>
                          <span className="text-4xl font-bold text-amber-500/70 tabular-nums tracking-tighter leading-none">
                            Bs {(remainingToPay * currentExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          {branchCurrencyList.includes("COP") && cashRates.COP > 0 && (
                            <span className="text-2xl font-bold text-amber-500/60 tabular-nums tracking-tighter leading-none">
                              ~ {formatMoney(cashDue(fromUsd(remainingToPay, "COP", cashRates), "COP"), "COP")} <span className="text-xs font-semibold">en efectivo</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ) : changeDue > 0.001 ? (
                      <div className="space-y-4">
                        <div className="p-8 rounded-lg bg-blue-500/5 border border-blue-500/20 flex flex-col items-center gap-2 shadow-sm">
                          <span className="text-[12px] font-semibold text-blue-600 tracking-tight">Cambio para el cliente</span>
                          <div className="flex flex-col items-center gap-1 text-center">
                            <span className="text-5xl font-bold text-blue-600 tabular-nums tracking-tighter leading-none">${changeDue.toFixed(2)}</span>
                            <span className="text-4xl font-bold text-blue-600/70 tabular-nums tracking-tighter leading-none">
                              Bs {(changeDue * currentExchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        {!saveChangeToWallet && (
                          <div className="space-y-2 rounded-lg border p-4">
                            <span className="text-xs font-semibold text-foreground/80">¿En qué moneda das el vuelto?</span>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {branchCurrencyList.filter((c) => cashRates[c] > 0 && cashChange(changeDue * cashRates[c], c) > 0).map((c) => {
                                const lastCash = [...addedPayments].reverse().find((x: any) => x.method === "CASH") as any;
                                const selected = (changeCurrency ?? lastCash?.currency ?? "USD") === c;
                                return (
                                  <button key={c} type="button" onClick={() => setChangeCurrency(c)} className={cn("rounded-lg border px-3 py-2 text-left transition", selected ? "border-blue-600 bg-blue-500/10" : "hover:bg-muted")}>
                                    <span className="block text-[11px] text-muted-foreground">{CURRENCY_META[c].label}</span>
                                    <span className="block text-sm font-bold tabular-nums">{formatMoney(cashChange(changeDue * cashRates[c], c), c)}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <span className="block text-[11px] text-muted-foreground">El vuelto sale de la gaveta: el cierre de caja lo descuenta en esa moneda.</span>
                          </div>
                        )}
                        {selectedClientId !== "consumidor-final" && (
                          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-foreground/80">Abonar al monedero</span>
                              <span className="text-[11px] text-muted-foreground font-medium">Guardar el vuelto para futuras compras</span>
                            </div>
                            <Switch checked={saveChangeToWallet} onCheckedChange={setSaveChangeToWallet} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-10 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex flex-col items-center gap-4 shadow-sm">
                        <span className="text-[13px] font-semibold text-emerald-600 tracking-tight">Pago completado</span>
                        <div className="size-16 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                          <IconCircleCheckFilled size={32} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Switch to enable/disable printing receipt */}
                  <label htmlFor="print-receipt-switch" className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border transition-all duration-300 cursor-pointer">
                    <span className="text-lg font-bold text-foreground">Imprimir factura</span>
                    <Switch id="print-receipt-switch" checked={printReceipt} onCheckedChange={setPrintReceipt} />
                  </label>

                  {selectedClientId !== "consumidor-final" && selectedClient?.phone?.trim() && (
                    <label htmlFor="whatsapp-invoice-switch" className="flex items-center justify-between gap-3 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 cursor-pointer">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <IconBrandWhatsapp size={22} className="shrink-0 text-emerald-600" />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-foreground">Enviar factura por WhatsApp</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{formatWhatsAppNumber(selectedClient.phone)}</span>
                        </span>
                      </span>
                      <Switch id="whatsapp-invoice-switch" checked={sendWhatsAppInvoice} onCheckedChange={toggleSendWhatsAppInvoice} />
                    </label>
                  )}

                  {/* SyncroCredit activation: credit chip selector + compact generate button */}
                  {(tempPaymentMethod === 'CREDIT' || addedPayments.some((p: any) => p.method === 'CREDIT')) && selectedClientId !== "consumidor-final" && !selectedClient?.hasAccount && (
                    <div className="flex flex-col gap-2.5 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 transition-all duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Acceso a SyncroCredit</span>
                        <span className="text-[11px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                          Límite inicial ${Number(settings?.syncroCreditInitialLimit ?? 30).toFixed(0)}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        El límite sube solo cada vez que el cliente paga a tiempo, hasta ${Number(settings?.syncroCreditMaxLimit ?? 200).toFixed(0)}.
                      </p>

                      {showLimitOverride ? (
                        <CreditLimitOverride
                          needsPin={!isOwnerUser}
                          busy={generatingPwaCode}
                          submitLabel="Activar con este límite"
                          onSubmit={(amount, pin) => activateSyncroCredit(amount, pin)}
                          onCancel={() => setShowLimitOverride(false)}
                        />
                      ) : (
                        <>
                          <Button
                            type="button"
                            onClick={() => activateSyncroCredit()}
                            disabled={generatingPwaCode}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-[11px] font-bold shadow-sm flex items-center justify-center gap-1.5 h-9 transition-colors"
                          >
                            {generatingPwaCode ? (
                              <><IconRefresh className="animate-spin size-3" /> Activando...</>
                            ) : (
                              <><IconDevices size={14} /> Activar SyncroCredit</>
                            )}
                          </Button>
                          <button type="button" onClick={() => setShowLimitOverride(true)} className="self-center text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                            Asignar otro límite
                          </button>
                        </>
                      )}

                      <div className="pt-2.5 flex items-center justify-between border-t border-emerald-500/10 mt-1">
                        <span className="text-[10px] text-muted-foreground font-semibold">¿Ya se registró en el portal?</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            setCheckingActivation(true);
                            await refreshSelectedClient();
                            setCheckingActivation(false);
                            toast.success("Estado del cliente verificado");
                          }}
                          disabled={checkingActivation}
                          className="h-7 px-2.5 rounded-lg text-[10px] font-bold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-500/10 flex items-center gap-1.5 border border-dashed border-emerald-500/20"
                        >
                          {checkingActivation ? (
                            <><IconRefresh className="animate-spin size-3" /> Verificando...</>
                          ) : (
                            <><IconRefresh size={12} /> Verificar estado</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Selector de Tipo de Fiado: Tradicional vs SyncroCredit */}
                  {(tempPaymentMethod === 'CREDIT' || addedPayments.some((p: any) => p.method === 'CREDIT')) && selectedClientId !== "consumidor-final" && selectedClient?.hasAccount && (
                    <div className="flex flex-col gap-2 p-2 bg-muted/40 border border-border/40 rounded-xl animate-in fade-in duration-200">
                      <span className="text-[10px] font-bold text-muted-foreground px-1">Modalidad de fiado</span>
                      <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted rounded-lg border">
                        <button
                          type="button"
                          onClick={() => setCreditType("traditional")}
                          className={`py-2 rounded-md text-xs font-bold transition-all ${creditType === "traditional"
                              ? "bg-amber-600 text-white shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          Fiado tradicional (libreta)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreditType("syncrocredit")}
                          className={`py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${creditType === "syncrocredit"
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          <IconDevices size={14} /> SyncroCredit (digital)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Informacion de Fiado Tradicional */}
                  {(tempPaymentMethod === 'CREDIT' || addedPayments.some((p: any) => p.method === 'CREDIT')) && selectedClientId !== "consumidor-final" && selectedClient?.hasAccount && creditType === 'traditional' && (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-2.5 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                      <IconInfoCircle className="text-amber-600 shrink-0 size-4 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-500">Fiado directo a libreta</p>
                        <p className="text-[10px] text-muted-foreground font-semibold leading-normal mt-0.5">
                          Este crédito se registrará directamente en la cuenta local del cliente sin requerir código PIN ni cuotas fijas.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* SyncroCredit status for registered clients */}
                  {(tempPaymentMethod === 'CREDIT' || addedPayments.some((p: any) => p.method === 'CREDIT')) && selectedClientId !== "consumidor-final" && selectedClient?.hasAccount && creditType === 'syncrocredit' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 flex flex-col gap-3">
                      <CreditRadial client={selectedClient} />
                    </div>
                  )}

                  {/* Gestión de SyncroCredit (Reset Password, Pause/Reactivate, Delete) */}
                  {(tempPaymentMethod === 'CREDIT' || addedPayments.some((p: any) => p.method === 'CREDIT')) && selectedClientId !== "consumidor-final" && selectedClient?.hasAccount && creditType === 'syncrocredit' && (
                    <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 text-foreground font-bold text-xs tracking-tight border-b pb-2">
                        <IconLock size={15} className="text-emerald-600" />
                        <span>Gestión de SyncroCredit</span>
                      </div>

                      {/* Límite de crédito: sube solo; cambiarlo a mano requiere PIN de supervisor */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border/60">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-muted-foreground leading-none">Límite de crédito</span>
                          <span className="text-xs font-black mt-1">${Number(selectedClient?.creditLimit || 0).toFixed(0)}</span>
                        </div>
                        {!showManageLimit && (
                          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[10px] font-bold gap-1" onClick={() => setShowManageLimit(true)}>
                            <IconLock size={12} /> Cambiar
                          </Button>
                        )}
                      </div>
                      {showManageLimit && (
                        <CreditLimitOverride
                          needsPin={!isOwnerUser}
                          busy={updatingLimit}
                          submitLabel="Guardar límite"
                          onSubmit={async (amount, pin) => { await updateClientLimit(amount, pin); setShowManageLimit(false); }}
                          onCancel={() => setShowManageLimit(false)}
                        />
                      )}

                      <div className="grid grid-cols-1 gap-2">
                        {/* Cambiar Contraseña */}
                        <Button
                          type="button"
                          variant="outline"
                          disabled={generatingPwaCode || togglingSuspension || deletingAccount}
                          onClick={async () => {
                            setGeneratingPwaCode(true);
                            try {
                              const token = localStorage.getItem("token");
                              const res = await fetch(`${API}/clients/${selectedClientId}/activation-code`, {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`
                                },
                                body: JSON.stringify({ purpose: "reset" })
                              });
                              if (res.ok) {
                                const data = await res.json();
                                setGeneratedPwaCode(data.activationCode || "");
                                setPwaCodeSentTo(data.sent ? data.sentTo : null);
                                setPwaCodeFallbackReason(data.sent ? null : data.reason || null);
                                setPwaClientName(selectedClient?.name || "Cliente");
                                setPwaClientDocument(selectedClient?.documentId || "");
                                setShowPwaCodeModal(true);
                                toast.success(data.sent ? "Código enviado al WhatsApp del cliente" : "Código temporal de restablecimiento generado");
                              } else {
                                const err = await res.json();
                                toast.error(err.message || "Error al generar código");
                              }
                            } catch (err) {
                              toast.error("Error de conexión");
                            } finally {
                              setGeneratingPwaCode(false);
                            }
                          }}
                          className="w-full text-[11px] font-bold h-9 flex items-center justify-center gap-1.5"
                        >
                          <IconLock size={13} /> Cambiar contraseña (OTP)
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                          {/* Pausar/Reactivar Cuenta */}
                          <Button
                            type="button"
                            variant="outline"
                            disabled={generatingPwaCode || togglingSuspension || deletingAccount}
                            onClick={async () => {
                              setTogglingSuspension(true);
                              try {
                                const token = localStorage.getItem("token");
                                const res = await fetch(`${API}/clients/${selectedClientId}/toggle-suspension`, {
                                  method: "PATCH",
                                  headers: {
                                    Authorization: `Bearer ${token}`
                                  }
                                });
                                if (res.ok) {
                                  const updatedClient = await res.json();

                                  // Update client in list and DB
                                  setClients(prev => prev.map(c => c.id === updatedClient.id ? { ...c, ...updatedClient } : c));

                                  toast.success(updatedClient.isSuspended ? "Cuenta pausada correctamente" : "Cuenta reactivada correctamente");
                                } else {
                                  toast.error("Error al cambiar estado de suspensión");
                                }
                              } catch (err) {
                                toast.error("Error de conexión");
                              } finally {
                                setTogglingSuspension(false);
                              }
                            }}
                            className={`w-full text-[11px] font-bold h-9 flex items-center justify-center gap-1.5 ${selectedClient?.isSuspended
                                ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border-emerald-500/20"
                                : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border-rose-500/20"
                              }`}
                          >
                            {selectedClient?.isSuspended ? (
                              <><IconLock size={13} /> Reactivar cuenta</>
                            ) : (
                              <><IconLock size={13} /> Pausar cuenta</>
                            )}
                          </Button>

                          {/* Eliminar Cuenta */}
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={generatingPwaCode || togglingSuspension || deletingAccount}
                            onClick={() => {
                              openPinVerification(async (pinUsed) => {
                                setDeletingAccount(true);
                                try {
                                  const token = localStorage.getItem("token");
                                  const res = await fetch(`${API}/clients/${selectedClientId}/delete-account`, {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                      Authorization: `Bearer ${token}`
                                    },
                                    body: JSON.stringify({ securityPin: pinUsed })
                                  });
                                  if (res.ok) {
                                    toast.success("Cuenta de SyncroCredit eliminada exitosamente y deudas reseteadas");

                                    // Refresh clients list
                                    const clientsRes = await fetch(`${API}/clients`, { headers: { Authorization: `Bearer ${token}` } });
                                    if (clientsRes.ok) {
                                      const clientsData = await clientsRes.json();
                                      setClients(clientsData);
                                      await db.clients.clear();
                                      await db.clients.bulkAdd(clientsData.map((c: any) => ({ ...c, _id: c.id })));
                                    }
                                  } else {
                                    const err = await res.json();
                                    toast.error(err.message || "Error al eliminar cuenta");
                                  }
                                } catch (err) {
                                  toast.error("Error de conexión");
                                } finally {
                                  setDeletingAccount(false);
                                }
                              });
                            }}
                            className="w-full text-[11px] font-bold h-9 flex items-center justify-center gap-1.5"
                          >
                            <IconTrash size={13} /> Eliminar cuenta
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 bg-muted/20 border-t flex gap-3">
                <Button variant="outline" className="flex-1 h-12 rounded-md text-xs font-semibold" onClick={() => setIsPaymentModalOpen(false)}>Cancelar</Button>
                <Button
                  className="flex-[2] h-12 rounded-md text-xs font-semibold shadow-sm"
                  disabled={processing || (tempPaymentMethod !== 'CREDIT' && remainingToPay > 0.01)}
                  onClick={() => {
                    if (tempPaymentMethod === 'CREDIT' && selectedClientId === 'consumidor-final') {
                      toast.error("No se puede fiar al consumidor final.");
                      return;
                    }

                    // Build summary of payments
                    let paymentsToUse = [...addedPayments];
                    if (remainingToPay > 0.01 && tempPaymentMethod === 'CREDIT') {
                      paymentsToUse.push({
                        method: "CREDIT",
                        amount: remainingToPay,
                        amountLocal: remainingToPay * currentExchangeRate,
                        exchangeRate: currentExchangeRate,
                        reference: "",
                        promisedPaymentDate
                      });
                    }

                    const summary = paymentsToUse.map(p => {
                      const name = p.method === "CASH" ? "EFECTIVO" : p.method === "CARD" ? "TARJETA" : p.method === "TRANSFER" ? "TRANSFERENCIA" : p.method === "WALLET" ? "MONEDERO" : p.method === "CREDIT" ? "CRÉDITO / FIADO" : p.method;
                      return `${name} ($${p.amount.toFixed(2)} USD)`;
                    }).join(" + ");

                    // Warning details
                    let warning = "";
                    if (selectedClientId !== "consumidor-final") {
                      const creditPayments = paymentsToUse.filter(p => p.method === 'CREDIT');
                      const nonCreditPayments = paymentsToUse.filter(p => p.method !== 'CREDIT');

                      const creditTotal = creditPayments.reduce((sum, p) => sum + p.amount, 0);
                      const nonCreditTotal = nonCreditPayments.reduce((sum, p) => sum + p.amount, 0);

                      if (creditTotal > 0 && nonCreditTotal > 0) {
                        warning = `Se registrará un cobro inmediato de $${nonCreditTotal.toFixed(2)} USD y se sumará $${creditTotal.toFixed(2)} USD a la Libreta (Fiado) de ${selectedClient?.name || "cliente"}.`;
                      } else if (nonCreditTotal > 0) {
                        warning = `Se registrará cobro inmediato para ${selectedClient?.name || "cliente"} en lugar de sumarlo a su Libreta (Fiado).`;
                      }
                    }

                    setPaymentsToProcess(paymentsToUse);
                    setPaymentConfirmationSummary(summary);
                    setPaymentConfirmationWarning(warning);
                    setIsConfirmPaymentOpen(true);
                  }}
                >
                  {processing ? (
                    <span className="flex items-center gap-2">
                      <IconRefresh className="animate-spin size-4" /> Procesando...
                    </span>
                  ) : (tempPaymentMethod === 'CREDIT' && addedPayments.length === 0) ? ((selectedClient?.currentDebt || 0) > 0 ? "Agregar a libreta" : "Confirmar fiado") : "Finalizar venta"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CONFIRMAR FINALIZAR VENTA */}
      <AlertDialog open={isConfirmPaymentOpen} onOpenChange={setIsConfirmPaymentOpen}>
        <AlertDialogContent className="max-w-md border-none shadow-2xl rounded-2xl p-0 overflow-hidden bg-card text-foreground">
          <AlertDialogHeader className="p-6 pb-2 text-center flex flex-col items-center">
            <div className="size-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
              <IconReceipt size={24} />
            </div>
            <AlertDialogTitle className="text-xl font-bold tracking-tight">¿Confirmar método de pago?</AlertDialogTitle>
          </AlertDialogHeader>

          <div className="px-6 py-4 space-y-5 text-center">
            {/* Huge Payment Method */}
            <div className="space-y-1">
              <div className={cn(
                "font-black text-emerald-600 dark:text-emerald-400 tracking-tight break-words leading-none",
                (() => {
                  const name = paymentConfirmationSummary.split(" + ").map(p => p.split(" (")[0]).join(" + ");
                  if (name.length > 15) return "text-3xl";
                  if (name.length > 9) return "text-4xl";
                  return "text-6xl";
                })()
              )}>
                {paymentConfirmationSummary.split(" + ").map(p => p.split(" (")[0]).join(" + ")}
              </div>
            </div>

            {/* Total Amount in smaller font */}
            <div className="py-2.5 px-4 rounded-xl bg-muted/40 border border-border/40 flex justify-between items-center text-sm font-semibold text-muted-foreground">
              <span>Monto total:</span>
              <span className="text-lg font-black text-foreground font-mono">
                ${finalTotalWithIgtf.toFixed(2)} USD
              </span>
            </div>


          </div>

          <AlertDialogFooter className="p-6 pt-2 flex sm:flex-row flex-col gap-3">
            <AlertDialogCancel className="w-full sm:flex-1 rounded-xl h-12 font-bold text-sm border-border hover:bg-muted transition-colors mt-0">
              Revisar pago
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={processing}
              onClick={() => {
                setIsConfirmPaymentOpen(false);
                const hasCredit = paymentsToProcess?.some((p: any) => p.method === 'CREDIT');
                if (hasCredit && selectedClientId !== "consumidor-final" && selectedClient?.hasAccount && creditType === 'syncrocredit') {
                  initiatePinAuthorization(paymentsToProcess);
                } else {
                  if (paymentsToProcess) {
                    processSale(paymentsToProcess);
                  } else {
                    processSale();
                  }
                }
              }}
              className="w-full sm:flex-1 rounded-xl h-12 px-8 font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/10 border-none transition-colors"
            >
              Registrar venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG: AUTORIZACIÓN SYNCOCREDIT POR PIN */}
      <Dialog open={showPinAuthModal} onOpenChange={(open) => {
        if (!open && generatedPinCode) {
          cancelPinAuthorization(generatedPinCode);
        }
      }}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl border-none shadow-2xl p-6 bg-card text-foreground">
          <DialogHeader className="text-center flex flex-col items-center pb-2">
            <div className="size-14 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3">
              <IconLock size={28} />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">Autorización SyncroCredit requerida</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1 flex flex-col items-center gap-0.5">
              <span>El cliente <strong>{selectedClient?.name || "Cliente"}</strong> Debe autorizar el crédito.</span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-6 text-center">
            {isGeneratingPin ? (
              <div className="flex flex-col items-center justify-center gap-3 py-6">
                <IconRefresh className="animate-spin text-blue-500 size-8" />
                <span className="text-xs font-bold text-muted-foreground">Generando PIN...</span>
              </div>
            ) : generatedPinCode ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground">Dicta este PIN al cliente:</span>
                  <div className="text-5xl font-black text-blue-600 font-mono select-all select-none py-3 px-6 bg-blue-500/5 rounded-2xl border border-blue-500/10 shadow-inner">
                    {generatedPinCode}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                    <IconRefresh className="animate-spin text-blue-500 size-3.5" />
                    <span>Esperando confirmación en la app del cliente...</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60">
                    Frecuencia elegida: cada {selectedFrequencyDays} días
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-rose-500 font-bold py-6">
                Error al generar el PIN de autorización.
              </div>
            )}
          </div>

          <DialogFooter className="flex sm:flex-row flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (generatedPinCode) {
                  cancelPinAuthorization(generatedPinCode);
                } else {
                  setShowPinAuthModal(false);
                }
              }}
              className="w-full h-12 rounded-xl text-xs font-black"
            >
              Cancelar operación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CÓDIGO DE ACTIVACIÓN SYNCOCREDIT GENERADO */}
      <Dialog open={showPwaCodeModal} onOpenChange={setShowPwaCodeModal}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl border-none shadow-2xl p-6 bg-card text-foreground">
          <DialogHeader className="text-center flex flex-col items-center pb-2">
            <div className="size-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
              <IconDevices size={28} />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">{pwaCodeSentTo ? "Código enviado por WhatsApp" : "Acceso SyncroCredit generado"}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1 flex flex-col items-center gap-0.5">
              <span>Código de activación para <strong>{pwaClientName}</strong></span>
              {pwaClientDocument && (
                <span className="text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full mt-1.5 font-bold font-mono">
                  Cédula/ID: {pwaClientDocument}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {pwaCodeSentTo ? (
            <div className="py-6 text-center space-y-3">
              <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-emerald-700 dark:text-emerald-400">
                <IconBrandWhatsapp size={18} />
                <span className="text-sm font-bold tabular-nums">{formatWhatsAppNumber(pwaCodeSentTo)}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed px-2">
                El cliente recibió el código y el enlace para activar su cuenta. Por seguridad, el código no se muestra en la caja.
              </p>
            </div>
          ) : (
          <div className="py-6 space-y-6 text-center">
            {pwaCodeFallbackReason && (
              <p className="mx-auto w-fit rounded-lg bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-700">
                {pwaCodeFallbackReason}. Entrégale este código solo al cliente.
              </p>
            )}
            {/* 6-digit OTP code display */}
            <div className="flex justify-center gap-2">
              {generatedPwaCode.split("").map((digit, idx) => (
                <div
                  key={idx}
                  className="size-12 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 flex items-center justify-center text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono shadow-sm animate-in fade-in-50 slide-in-from-bottom-3 duration-350"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {digit}
                </div>
              ))}
            </div>
          </div>
          )}

          <DialogFooter className="flex gap-2 sm:flex-row flex-col">
            {!pwaCodeSentTo && (
            <Button
              onClick={() => {
                navigator.clipboard.writeText(generatedPwaCode);
                toast.success("Código copiado al portapapeles");
              }}
              variant="outline"
              className="w-full sm:flex-1 rounded-xl h-11 font-bold text-xs flex items-center justify-center gap-2"
            >
              Copiar código
            </Button>
            )}
            <Button
              onClick={async () => {
                await refreshSelectedClient();
                setShowPwaCodeModal(false);
              }}
              className="w-full sm:flex-1 rounded-xl h-11 font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors"
            >
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* DIALOG: VENTA PROCESADA EXITOSAMENTE */}
      <Dialog open={isSaleSuccessModalOpen} onOpenChange={(open) => { if (!open) resetAfterSale(); }}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl border-none shadow-2xl p-6 bg-card text-foreground text-center flex flex-col items-center justify-center space-y-4">
          <div className="size-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <IconCheck size={36} stroke={3} />
          </div>
          <DialogHeader className="text-center flex flex-col items-center">
            <DialogTitle className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-500">
              ¡Venta procesada!
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-2 font-medium">
              La transacción ha sido registrada y autorizada con éxito en el sistema. El carrito de compras ha sido limpiado para la siguiente venta.
            </DialogDescription>
          </DialogHeader>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 rounded-xl shadow-lg shadow-emerald-600/20 transition-all duration-300"
            onClick={resetAfterSale}
            autoFocus
          >
            Aceptar
          </Button>
        </DialogContent>
      </Dialog>

      {/* DIALOG: ABONAR A DEUDA */}
      <Dialog open={isPaymentModalAbonoOpen} onOpenChange={setIsPaymentModalAbonoOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <IconHistory size={18} /> Abonar a deuda
            </DialogTitle>
            <DialogDescription>
              Registra un pago para reducir la deuda activa del cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Monto a abonar (USD) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                placeholder="0.00"
                value={abonoAmount}
                onChange={(e) => setAbonoAmount(e.target.value)}
                className="font-mono text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Método de pago</Label>
              <Select value={abonoPaymentMethod} onValueChange={setAbonoPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Efectivo</SelectItem>
                  <SelectItem value="CARD">Punto de venta</SelectItem>
                  <SelectItem value="PAGO_MOVIL">Pago móvil</SelectItem>
                  <SelectItem value="TRANSFER">Transferencia</SelectItem>
                  <SelectItem value="ZELLE">Zelle</SelectItem>
                  <SelectItem value="BINANCE">Binance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Referencia / notas</Label>
              <Input
                placeholder="Opcional"
                value={abonoNotes}
                onChange={(e) => setAbonoNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsPaymentModalAbonoOpen(false)} disabled={isSubmittingAbono}>Cancelar</Button>
            <Button onClick={handleRegisterAbono} disabled={isSubmittingAbono} className="bg-amber-600 hover:bg-amber-700 text-white">
              {isSubmittingAbono ? <IconRefresh className="animate-spin size-4 mr-2" /> : null}
              Registrar abono
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: QUICK CLIENT REGISTRATION */}
      <Dialog open={isQuickClientOpen} onOpenChange={setIsQuickClientOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconUserPlus size={18} className="text-primary" /> Nuevo cliente
            </DialogTitle>
            <DialogDescription>
              Completa los datos para registrar el cliente en el sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre completo <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Juan pérez"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cédula / RIF</Label>
                <Input
                  placeholder="V-12345678"
                  className="tabular-nums"
                  value={newClient.documentId}
                  onChange={(e) => setNewClient({ ...newClient, documentId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  placeholder="0414-0000000"
                  className="tabular-nums"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsQuickClientOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateClient} disabled={savingClient}>
              {savingClient ? "Guardando..." : "Registrar cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CLOSE SHIFT (ARQUEO DE CAJA) */}
      <Dialog open={isClosingShift} onOpenChange={setIsClosingShift}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <IconCalculator className="text-primary" size={20} /> Arqueo de caja detallado
            </DialogTitle>
            <DialogDescription>
              Ingrese los montos físicos para realizar el cierre de caja. El sistema calculará los sobrantes o faltantes.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4 md:grid-cols-2 md:items-start">

            {/* Cash in the drawer, per currency */}
            <div className="min-w-0 space-y-3">
              <div>
                <h4 className="text-sm font-semibold">Efectivo en la gaveta</h4>
                <p className="text-xs text-muted-foreground">Cuenta los billetes de cada moneda. Lo digital va aparte, a la derecha.</p>
              </div>
              {shiftCurrencies.map((c) => {
                const expected = Number(((activeShift as any)?.expectedCash || {})[c] ?? 0);
                const showExpected = !(user?.role === "pos" && settings?.blindShiftClose !== false);
                const v = countedCash[c] ?? "";
                const bad = !(c === "USD" && countBills) && v.trim() !== "" && !/^\d+([.,]\d{1,2})?$/.test(v.trim());
                return (
                  <div key={c} className="rounded-xl border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{CURRENCY_META[c].label}</span>
                      {showExpected && <span className="text-xs text-muted-foreground">Esperado: <span className="font-semibold text-foreground tabular-nums">{formatMoney(expected, c)}</span></span>}
                    </div>
                    {c === "USD" && countBills ? (
                      <div className="grid grid-cols-3 gap-2">
                        {([1, 5, 10, 20, 50, 100] as const).map(bill => (
                          <div key={bill} className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Billetes de ${bill}</Label>
                            <Input inputMode="numeric" className="h-8 tabular-nums" value={cashBreakdown[`b${bill}` as keyof typeof cashBreakdown] || ''} onChange={e => setCashBreakdown({ ...cashBreakdown, [`b${bill}`]: Number(e.target.value.replace(/\D/g, "").slice(0, 5)) || 0 })} placeholder="0" />
                          </div>
                        ))}
                        <p className="col-span-3 text-xs font-semibold tabular-nums">Contado: {formatMoney(billsUsd, "USD")}</p>
                      </div>
                    ) : (
                      <div className={cn("flex h-9 items-center overflow-hidden rounded-md border bg-background focus-within:border-ring", bad && "border-destructive")}>
                        <span className="pl-3 text-xs text-muted-foreground">Contado</span>
                        <input inputMode="decimal" value={v} onChange={(e) => setCountedCash((x) => ({ ...x, [c]: e.target.value.replace(/[^\d.,]/g, "").slice(0, 14) }))} placeholder="0" className="min-w-0 flex-1 bg-transparent px-2 text-right text-sm font-semibold tabular-nums outline-none" />
                        <span className="pr-3 text-xs text-muted-foreground">{CURRENCY_META[c].short}</span>
                      </div>
                    )}
                    {c === "USD" && (
                      <button type="button" onClick={() => setCountBills(!countBills)} className="text-[11px] font-semibold text-primary hover:underline">
                        {countBills ? "Escribir el total en vez de contar billetes" : "Contar por billetes"}
                      </button>
                    )}
                    {bad && <p className="text-[11px] text-destructive">Solo números, con hasta 2 decimales</p>}
                  </div>
                );
              })}
            </div>

            <div className="min-w-0 space-y-6">
            {/* Digital: not in the drawer */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Digital (no va en la gaveta)</h4>
              {!(user?.role === "pos" && settings?.blindShiftClose !== false) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {([["CARD", "Punto de venta"], ["PAGO_MOVIL", "Pago móvil"], ["TRANSFER", "Transferencia"], ["BINANCE", "Binance"], ["ZINLI", "Zinli"], ["PAYPAL", "PayPal"]] as const).filter(([k]) => (activeShift?.expectedTotals?.[k] || 0) > 0).map(([k, label]) => {
                    const usd = activeShift?.expectedTotals?.[k] || 0;
                    return (
                      <div key={k} className="rounded-lg bg-muted/40 px-3 py-2">
                        <p className="text-muted-foreground">{label}</p>
                        <p className="font-semibold tabular-nums">{formatMoney(usd, "USD")} <span className="font-normal text-muted-foreground">· {formatMoney(usd * shiftRates.VES, "VES")}</span></p>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-3">
                  <Label className="w-1/3 text-xs text-muted-foreground">Lote punto venta</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">Bs</span>
                    <Input inputMode="decimal" className="pl-8 h-9" value={posBatch} onChange={e => setPosBatch(e.target.value.replace(/[^\d.]/g, ""))} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-1/3 text-xs text-muted-foreground">Total pago móvil</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">Bs</span>
                    <Input inputMode="decimal" className="pl-8 h-9" value={pagoMovilBatch} onChange={e => setPagoMovilBatch(e.target.value.replace(/[^\d.]/g, ""))} />
                  </div>
                </div>
              </div>
            </div>

            {/* Cash taken from or put in the drawer with the income and expenses button */}
            {!!(activeShift as any)?.movements?.length && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Entradas y salidas de la gaveta</h4>
                {((activeShift as any).movements as any[]).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
                    <span className="min-w-0 truncate">{m.type === "OUT" ? "Salida" : "Entrada"} · {categoryOf(m)}{m.description ? ` · ${m.description}` : ""}<span className="block text-muted-foreground">{m.userName ?? ""}</span></span>
                    <span className={cn("shrink-0 font-semibold tabular-nums", m.type === "OUT" ? "text-rose-600" : "text-emerald-700")}>{m.type === "OUT" ? "−" : "+"}{formatMoney(m.amountCurrency, m.currency)}</span>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">Ya están descontadas o sumadas en lo esperado de cada moneda.</p>
              </div>
            )}

            {/* Validation Panel */}
            <div className="p-4 rounded-xl bg-muted/50 border space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Efectivo contado (en dólares):</span>
                <span className="text-base font-bold tabular-nums">{formatMoney(countedUsd, "USD")}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Cada moneda se cuadra por separado; el total en dólares es a la tasa de hoy.</p>
            </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClosingShift(false)}>Cancelar</Button>
            <Button onClick={handleCloseShift} disabled={isClosingShift && processing} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {processing ? "Procesando..." : "Confirmar arqueo y cerrar caja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CLOSE SHIFT SUMMARY (ARQUEO DE CAJA RESULTADO) */}
      <Dialog open={isCloseSummaryOpen} onOpenChange={setIsCloseSummaryOpen}>
        <DialogContent className="sm:max-w-[420px] p-6 rounded-2xl border-border/80 shadow-xl bg-card">
          <DialogHeader className="space-y-1 text-center sm:text-left">
            <DialogTitle className="flex items-center justify-center sm:justify-start gap-2 text-lg font-bold text-foreground">
              {closeSummary?.isBlind ? (
                <>
                  <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-500">
                    <IconShieldCheck className="size-5" />
                  </div>
                  <span>Arqueo ciego registrado</span>
                </>
              ) : (
                <>
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <IconCheck className="size-5" />
                  </div>
                  <span>Caja cerrada exitosamente</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {closeSummary?.isBlind
                ? "El turno de trabajo ha finalizado y los fondos han sido registrados de forma segura."
                : "Resumen de conciliación del turno actual y auditoría de diferencias."}
            </DialogDescription>
          </DialogHeader>

          {closeSummary?.isBlind ? (
            /* VISTA DE ARQUEO CIEGO PARA CAJEROS (Control Anti-Robo) */
            <div className="space-y-4 py-3">
              <div className="p-4 rounded-xl bg-muted/40 border border-border/80 space-y-3 shadow-2xs">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-medium">Efectivo total declarado:</span>
                  <span className="font-extrabold text-foreground text-base tabular-nums">
                    ${closeSummary?.reported?.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Modo de seguridad:</span>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 font-semibold">
                    <IconShieldLock className="size-3 mr-1" /> Arqueo ciego activo
                  </Badge>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                🛡️ <strong>Comprobante de entrega:</strong> Los fondos contados fueron transferidos al administrador para su verificación. Ya puedes retirar tu gaveta.
              </div>
            </div>
          ) : (
            /* VISTA DE AUDITORÍA COMPLETA PARA DUEÑO / ADMINISTRADOR */
            <div className="space-y-4 py-3">
              <div className="p-4 rounded-xl bg-muted/40 border border-border/80 space-y-3 shadow-2xs">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-medium">Efectivo esperado (sistema):</span>
                  <span className="font-semibold text-foreground tabular-nums">${closeSummary?.expected?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-medium">Efectivo contado (declarado):</span>
                  <span className="font-bold text-foreground tabular-nums">${closeSummary?.reported?.toFixed(2)}</span>
                </div>

                {!!closeSummary?.rows?.length && (
                  <div className="space-y-1.5 rounded-lg bg-background/60 p-2.5">
                    {closeSummary.rows.map((r) => {
                      const diff = Math.round((r.counted - r.expected) * 100) / 100;
                      return (
                        <div key={r.currency} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
                          <span className="text-muted-foreground">{CURRENCY_META[r.currency].label}: esperado {formatMoney(r.expected, r.currency)} · contado {formatMoney(r.counted, r.currency)}</span>
                          <span className={cn("font-bold tabular-nums", diff < -0.004 ? "text-rose-500" : diff > 0.004 ? "text-emerald-600" : "text-foreground")}>{diff === 0 ? "Cuadra" : `${diff > 0 ? "+" : "−"}${formatMoney(Math.abs(diff), r.currency)}`}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Diferencia de cuadre:</span>
                  <span className={`text-base font-extrabold tabular-nums ${(closeSummary?.difference || 0) < -0.01
                      ? 'text-rose-500'
                      : (closeSummary?.difference || 0) > 0.01
                        ? 'text-emerald-500'
                        : 'text-foreground'
                    }`}>
                    {((closeSummary?.difference || 0) < -0.01 ? '-$' : '$') + Math.abs(closeSummary?.difference || 0).toFixed(2)}
                    <span className="text-[10px] ml-1 block text-right font-bold">
                      {(closeSummary?.difference || 0) < -0.01
                        ? '(Faltante)'
                        : (closeSummary?.difference || 0) > 0.01
                          ? '(Sobrante)'
                          : '(Cuadrado perfecto)'}
                    </span>
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Auditoría registrada de forma inmutable en el historial de turnos.
              </p>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsCloseSummaryOpen(false);
                setActiveShift(null);
                setOpeningBalance("0");
                setInitialCashRows([{ id: "1", amount: "", currency: "USD" }]);
              }}
              className="w-full"
            >
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Income and expenses that aren't sales (left, so it never covers the cart) */}
      <FinanceWidget placement="left" />

      {/* DIALOG: ESCÁNER Y CÁMARA (ESTILO UNIFICADO) */}
      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent className={cn("overflow-hidden rounded-3xl border border-[#D8D4CB] bg-[#E8E6E0] p-0 shadow-2xl transition-all duration-300 [&>button]:hidden", useCamera ? "sm:max-w-[380px]" : "sm:max-w-md")}>
          <div className="flex items-start justify-between px-6 pt-5">
            <DialogHeader className="space-y-0.5 text-left">
              <DialogTitle className="text-base font-bold text-[#16140F]">Escanear producto</DialogTitle>
              <DialogDescription className="text-xs text-[#6B665C]">
                {useCamera ? "Apunta la cámara al código de barras" : "Pasa el producto por el lector láser"}
              </DialogDescription>
            </DialogHeader>
            <Button variant="ghost" size="icon" className="-mr-2 size-8 rounded-full text-[#6B665C] hover:bg-black/5 hover:text-[#16140F]" onClick={() => setScannerOpen(false)} aria-label="Cerrar">
              <IconX size={16} />
            </Button>
          </div>

          {/* Always-on scanner */}
          <div className="px-6 pt-4">
            <label htmlFor="scanner-always-on" className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-colors", scannerAlwaysOn ? "border-emerald-500/30 bg-emerald-500/5" : "border-[#D8D4CB] bg-[#F4F2EC]")}>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-[#16140F]">
                  {scannerAlwaysOn && <span className="size-2 rounded-full bg-emerald-500" />}
                  Escáner siempre activo
                </span>
                <span className="block text-[11px] text-[#6B665C]">
                  Lee códigos en cualquier momento, también con el resumen de compra abierto, sin abrir esta ventana.
                </span>
              </span>
              <Switch id="scanner-always-on" checked={scannerAlwaysOn} onCheckedChange={toggleScannerAlwaysOn} className="shrink-0 data-[state=checked]:bg-emerald-500" />
            </label>
          </div>

          {/* Mode switch */}
          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#D8D4CB] bg-[#DEDBD3]/60 p-1">
              {([[false, "Lector láser", IconBarcode], [true, "Cámara", IconCamera]] as const).map(([camera, label, Icon]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setUseCamera(camera)}
                  className={cn(
                    "flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-all",
                    useCamera === camera ? "bg-[#F7F5F0] text-[#16140F] shadow-sm" : "text-[#6B665C] hover:text-[#16140F]",
                  )}
                >
                  <Icon size={15} className={useCamera === camera ? "text-primary/80" : ""} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className={cn("relative w-full px-6 pb-6 pt-4 transition-all duration-300", useCamera ? "h-[360px]" : "")}>
            {!useCamera ? (
              <div className="animate-in fade-in zoom-in-95 duration-300">
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
                <div className="relative flex flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl border border-[#D8D4CB] bg-[#F4F2EC] py-12">
                  {/* Subtle scan line */}
                  <div className="pointer-events-none absolute inset-x-10 h-px animate-scanline bg-primary/30 shadow-[0_0_10px_rgba(228,87,46,0.25)]" />
                  <div className="relative">
                    <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/10" />
                    <div className="relative flex size-24 items-center justify-center rounded-2xl border border-[#E2DED5] bg-white text-[#3D3A33] shadow-sm">
                      <IconBarcode size={46} stroke={1.3} />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-center">
                    <p className="text-lg font-semibold tracking-tight text-[#16140F]">Escáner listo</p>
                    <p className="flex items-center justify-center gap-1.5 text-xs text-[#6B665C]">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40" />
                        <span className="relative inline-flex size-2 rounded-full bg-primary/60" />
                      </span>
                      Esperando lector láser…
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative h-full w-full">
                <div className={cn(
                  "relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border-2 bg-[#1F1D19] shadow-inner transition-colors duration-300",
                  isDetected ? "border-emerald-500" : "border-[#D8D4CB]",
                )}>
                  {/* the #reader container must be square-ish so the camera stretches nicely */}
                  <div id="reader" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full [&_video]:min-h-full [&_#qr-shaded-region]:hidden"></div>

                  {/* Scan line */}
                  <div className={cn(
                    "absolute inset-x-8 z-10 h-0.5 animate-scanline transition-all duration-300",
                    isDetected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-primary/50 shadow-[0_0_8px_rgba(228,87,46,0.35)]",
                  )} />

                  {/* Corners */}
                  <div className="pointer-events-none absolute inset-6 z-20">
                    {["top-0 left-0 border-t-2 border-l-2 rounded-tl-lg", "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg", "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg", "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg"].map((pos) => (
                      <div key={pos} className={cn("absolute size-8 transition-colors duration-500", pos, isDetected ? "border-emerald-400" : "border-primary/50")} />
                    ))}
                  </div>

                  {isDetected && (
                    <div className="absolute inset-0 z-10 bg-emerald-500/15 animate-in fade-in zoom-in duration-300" />
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
              El código <strong>{waitlistData.barcode}</strong> No existe. Ingréselo en la lista de espera para poder facturarlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre del producto <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ej. Refresco cola 2l"
                value={waitlistData.name}
                onChange={(e) => setWaitlistData({ ...waitlistData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio Sugerido ($) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={waitlistData.price}
                  onChange={(e) => setWaitlistData({ ...waitlistData, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Stock inicial</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={waitlistData.stock}
                  onChange={(e) => setWaitlistData({ ...waitlistData, stock: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWaitlistOpen(false)}>Cancelar</Button>
            <Button onClick={handleWaitlistSubmit} disabled={savingWaitlist} className="bg-amber-500 hover:bg-amber-600">
              {savingWaitlist ? "Guardando..." : "Agregar a espera y carrito"}
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
                <DialogTitle className="text-lg font-black tracking-tight">Procesar devolución</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground">
                  {selectedSaleForReturn ? `Venta #${selectedSaleForReturn.id.slice(-8).toUpperCase()}` : "Cargando detalles..."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {fetchingSaleDetails ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
              <IconRefresh size={40} className="animate-spin text-muted-foreground opacity-20" />
              <p className="text-xs font-bold text-muted-foreground animate-pulse">Obteniendo información...</p>
            </div>
          ) : selectedSaleForReturn && (
            <div className="flex-1 flex flex-col overflow-hidden py-4 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between items-end px-1">
                  <Label className="text-[10px] font-black text-muted-foreground">Artículos de la venta</Label>
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
                          <p className="text-[11px] font-bold truncate leading-tight">{item.variant?.product?.name || item.description || "Producto"} {item.variant && item.variant?.name !== 'Principal' ? `(${item.variant?.name})` : ''}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Vendido: {item.quantity}</span>
                            {returnedQty > 0 && <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">Devuelto: {returnedQty}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-bold tabular-nums">${item.price.toFixed(2)}</span>
                            <span className="text-[8px] text-muted-foreground font-medium tracking-tighter">Sub: ${(item.price * currentReturnQty).toFixed(2)}</span>
                          </div>
                          <div className="flex items-center border rounded-lg h-9 bg-background shadow-sm">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-none border-r"
                              onClick={() => setReturnQuantities({ ...returnQuantities, [item.variantId]: Math.max(0, currentReturnQty - 1) })}
                            >
                              <IconMinus size={12} />
                            </Button>
                            <span className="w-10 text-center text-xs font-black tabular-nums">{currentReturnQty}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-none border-l"
                              onClick={() => setReturnQuantities({ ...returnQuantities, [item.variantId]: Math.min(maxAvailable, currentReturnQty + 1) })}
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
                        <p className="text-[10px] font-black">Todos los artículos han sido devueltos</p>
                      </div>
                    )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-muted-foreground">Motivo de la devolución</Label>
                  <Input
                    placeholder="Ej. Producto defectuoso, error en la compra..."
                    className="h-10 text-xs"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                  />
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex justify-between items-center">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-black text-amber-600">Total a reembolsar</span>
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
            <Button variant="ghost" onClick={() => setIsReturnModalOpen(false)} className="font-bold text-[10px]">Cancelar</Button>
            <Button
              onClick={handleReturnSubmit}
              disabled={processingReturn || !selectedSaleForReturn || Object.values(returnQuantities).every(q => q === 0)}
              className="bg-amber-500 hover:bg-amber-600 h-11 font-black text-[10px] px-8"
            >
              {processingReturn ? "Procesando..." : "Confirmar devolución"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: ORDER DETAILS & CLIENT HISTORY */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="rounded-2xl p-6 max-w-lg border-[#79716b]/20 bg-[#121110]! text-white">
          <DialogHeader className="border-b border-[#79716b]/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <IconReceipt size={20} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold tracking-tight text-white">Detalle de la orden</DialogTitle>
                <DialogDescription className="text-zinc-500 text-[10px] font-mono mt-0.5">
                  ID: {selectedSale?.id}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Client & Date Info */}
          <div className="grid grid-cols-2 gap-4 py-4 border-b border-[#79716b]/10 text-xs">
            <div className="space-y-1">
              <span className="text-zinc-500 text-[10px] font-bold">Cliente</span>
              <div className="font-bold text-white">{selectedSale?.client || "Consumidor final"}</div>
              {selectedSale?.clientDocument && (
                <div className="text-zinc-500 font-mono text-[10px]">{selectedSale.clientDocument}</div>
              )}
              {selectedSale?.seller && (
                <div className="text-[10px] text-zinc-400 mt-2">
                  <span className="font-semibold text-zinc-500 text-[9px] block">Cajero / vendedor</span>
                  <span className="font-bold text-zinc-200">{selectedSale.seller}</span>
                </div>
              )}
            </div>
            <div className="space-y-1 text-right">
              <span className="text-zinc-500 text-[10px] font-bold">Fecha y hora</span>
              <div className="font-semibold text-zinc-300">
                {selectedSale && format(new Date(selectedSale.date), "dd 'de' MMMM 'de' yyyy, hh:mm a", { locale: es })}
              </div>
              <div className="text-zinc-500 text-[10px] font-bold">Sucursal: {selectedSale?.branch || "N/A"}</div>
            </div>
          </div>

          {/* Products List */}
          <div className="py-4 space-y-3">
            <span className="text-zinc-500 text-[10px] font-bold">Productos comprados</span>
            <div className="rounded-xl border border-[#79716b]/10 overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/30 border-b border-[#79716b]/10">
                  <tr>
                    <th className="h-8 p-2 text-[9px] font-bold text-zinc-400">Producto</th>
                    <th className="h-8 p-2 text-center text-[9px] font-bold text-zinc-400 w-[60px]">Cant.</th>
                    <th className="h-8 p-2 text-right text-[9px] font-bold text-zinc-400 w-[85px]">P. Unit</th>
                    <th className="h-8 p-2 text-right text-[9px] font-bold text-zinc-400 w-[90px]">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#79716b]/5">
                  {!selectedSale?.items || selectedSale.items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="h-16 text-center text-xs text-zinc-500 italic p-2">
                        No hay productos registrados en esta venta
                      </td>
                    </tr>
                  ) : (
                    selectedSale.items.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-muted/10">
                        <td className="p-2 text-xs font-semibold text-zinc-200">
                          {item.name}
                          {item.variantName && (
                            <span className="block text-[9px] font-normal text-zinc-500">
                              Variante: {item.variantName}
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-center text-xs text-zinc-300 font-mono">
                          {item.quantity}
                        </td>
                        <td className="p-2 text-right text-xs text-zinc-300 font-mono">
                          {formatPrice(item.price)}
                        </td>
                        <td className="p-2 text-right text-xs font-bold text-white font-mono">
                          {formatPrice(item.subtotal)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment & Totals */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#79716b]/10">
            <div className="space-y-2">
              <span className="text-zinc-500 text-[10px] font-bold block">Método de pago</span>
              <div className="space-y-1">
                {selectedSale?.payments && selectedSale.payments.length > 0 ? (
                  selectedSale.payments.map((p: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-muted/20 border border-[#79716b]/5">
                      <span className="text-zinc-400 font-medium">
                        {p.method === "CASH" ? "Efectivo" :
                          p.method === "CARD" ? "Tarjeta / punto" :
                            p.method === "TRANSFER" ? "Transferencia" :
                              p.method === "WALLET" ? "Billetera" :
                                p.method === "CREDIT" ? "Fiado" :
                                  p.method === "PAGO_MOVIL" ? "Pago móvil" :
                                    p.method === "BINANCE" ? "Binance" :
                                      p.method === "ZINLI" ? "Zinli" :
                                        p.method === "PAYPAL" ? "PayPal" : p.method}
                      </span>
                      <span className="font-bold text-white font-mono">{formatPrice(p.amount)}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500 italic">No especificado</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-right text-xs">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal:</span>
                <span className="font-mono text-zinc-300">{formatPrice(selectedSale?.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>IVA:</span>
                <span className="font-mono text-zinc-300">{formatPrice(selectedSale?.taxAmount || 0)}</span>
              </div>
              {selectedSale?.discountAmt > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Descuento:</span>
                  <span className="font-mono">-{formatPrice(selectedSale.discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#79716b]/10 pt-2 text-sm font-black">
                <span className="text-zinc-300">TOTAL:</span>
                <span className="text-emerald-400 font-mono text-lg">{formatPrice(selectedSale?.total || 0)}</span>
              </div>
            </div>
          </div>

          {/* Other Purchases Section */}
          {selectedSale?.clientId && (
            <div className="py-4 border-t border-[#79716b]/10 space-y-2.5">
              <span className="text-zinc-500 text-[10px] font-bold block">
                Historial de compras del cliente ({clientHistory.length})
              </span>
              {loadingHistory ? (
                <div className="text-[11px] text-zinc-500 animate-pulse">Cargando historial...</div>
              ) : clientHistory.length <= 1 ? (
                <div className="text-[11px] text-zinc-500 italic">No se registran otras compras para este cliente.</div>
              ) : (
                <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                  {clientHistory.map((histSale) => {
                    const isCurrent = histSale.id === selectedSale.id;
                    const dateFormatted = format(new Date(histSale.date), "dd 'de' MMMM 'de' yyyy, hh:mm a", { locale: es });
                    return (
                      <button
                        key={histSale.id}
                        onClick={() => setSelectedSale(histSale)}
                        className={cn(
                          "w-full text-left px-3.5 py-2.5 rounded-xl border text-[11px] font-bold transition-all tracking-tight cursor-pointer flex items-center justify-between",
                          isCurrent
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                            : "bg-[#121110]/60 border-[#79716b]/20 hover:border-zinc-500 text-zinc-400 hover:text-white"
                        )}
                      >
                        <span className="truncate font-semibold">{dateFormatted}</span>
                        <span className="font-black text-right min-w-[75px]">{formatPrice(histSale.total)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
                <DialogTitle className="text-lg font-black tracking-tight">Lista de espera</DialogTitle>
                <DialogDescription className="text-[10px] font-bold text-muted-foreground">
                  Productos escaneados no registrados en el sistema
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            {loadingWaitlist ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <IconRefresh className="animate-spin text-muted-foreground opacity-20" size={40} />
                <p className="text-[10px] font-black text-muted-foreground">Cargando lista...</p>
              </div>
            ) : waitlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 grayscale opacity-40">
                <IconBox size={60} strokeWidth={1} />
                <p className="text-xs font-bold">No hay productos en espera</p>
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
                        <h4 className="text-sm font-black truncate">{item.name}</h4>
                        <Badge variant="outline" className="text-[9px] px-1.5 h-5 font-bold tracking-tighter bg-background">
                          {item.barcode}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium tracking-tight">
                        <span className="flex items-center gap-1"><IconBuilding size={10} /> {item.branch?.name || "Todas"}</span>
                        <span>•</span>
                        <span>Stock sugerido: {item.stock}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-black tabular-nums text-foreground">${item.price.toFixed(2)}</p>
                        <p className="text-[8px] font-bold text-muted-foreground">Precio sugerido</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button variant="ghost" onClick={() => setIsWaitlistOpen(false)} className="font-bold text-[10px]">Cerrar</Button>
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
                <DialogTitle className="text-xl font-semibold">Ventas en suspenso</DialogTitle>
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
                          {clients.find(c => (c.id || (c as any)._id) === ticket.selectedClientId)?.name || "Consumidor final"}
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
                        Recuperar venta
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
              Cerrar ventana
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── PIN Authorization Modal ─── */}
      <Dialog open={isPinModalOpen} onOpenChange={(open) => {
        if (!open) { setIsPinModalOpen(false); setPinInput(''); setPinError(''); setPinCallback(null); }
      }}>
        <DialogContent className="max-w-[340px] w-[calc(100%-2rem)] p-0 overflow-hidden gap-0">
          <div className="px-6 pt-6 pb-5 border-b bg-muted/20" style={{ paddingRight: '3.5rem' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <IconLock size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold leading-snug">Verificación requerida</DialogTitle>
                <p className="text-xs text-muted-foreground">Ingrese el PIN del propietario para continuar.</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">PIN de 4 dígitos</Label>
              <Input
                ref={pinInputRef}
                type="password"
                maxLength={4}
                inputMode="numeric"
                placeholder="••••"
                value={pinInput}
                onChange={e => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(''); }}
                className={cn("text-center font-mono text-2xl h-14", pinError ? "border-destructive" : "")}
                onKeyDown={e => { if (e.key === 'Enter') handlePinConfirm(); }}
              />
              {pinError && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <IconAlertCircle size={12} /> {pinError}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((k, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={k === ''}
                  onClick={() => {
                    if (k === '⌫') { setPinInput(p => p.slice(0, -1)); setPinError(''); }
                    else if (k !== '') { const next = (pinInput + k).slice(0, 4); setPinInput(next); setPinError(''); }
                  }}
                  className={cn(
                    "h-12 rounded-xl font-bold text-lg transition-all",
                    k === '' ? "invisible" : "bg-muted/40 hover:bg-muted border border-border/40 active:scale-95",
                    k === '⌫' ? "text-muted-foreground text-base" : ""
                  )}
                >{k}</button>
              ))}
            </div>
            <Button
              className="w-full h-11 font-semibold"
              disabled={pinInput.length !== 4}
              onClick={handlePinConfirm}
            >
              Verificar PIN
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Discount Modal ─── */}
      <Dialog open={isDiscountModalOpen} onOpenChange={open => {
        setIsDiscountModalOpen(open);
        if (!open) { setDiscountValueInput(''); setTargetDiscountId(null); }
      }}>
        <DialogContent className="max-w-[340px] w-[calc(100%-2rem)] p-0 overflow-hidden gap-0">
          <div className="px-6 pt-6 pb-5 border-b bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <IconDiscount size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold leading-snug">Aplicar descuento</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {targetDiscountId === 'GLOBAL' ? 'A toda la compra' : 'Al producto seleccionado'}
                </p>
              </div>
            </div>
          </div>
          <div className="px-6 py-6 space-y-5">
            <div className="flex bg-muted p-1 rounded-xl">
              <button
                type="button"
                className={cn("flex-1 h-9 rounded-lg text-sm font-semibold transition-all", discountType === 'pct' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
                onClick={() => { setDiscountType('pct'); setDiscountValueInput(''); }}
              >
                Porcentaje (%)
              </button>
              <button
                type="button"
                className={cn("flex-1 h-9 rounded-lg text-sm font-semibold transition-all", discountType === 'amt' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
                onClick={() => { setDiscountType('amt'); setDiscountValueInput(''); }}
              >
                Monto Fijo ($)
              </button>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">
                Valor del descuento
              </Label>
              <div className="relative">
                {discountType === 'amt' && (
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">$</span>
                )}
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={discountValueInput}
                  onChange={e => setDiscountValueInput(e.target.value)}
                  className={cn("h-14 font-semibold text-lg", discountType === 'amt' ? "pl-8" : "pr-8")}
                  onKeyDown={e => { if (e.key === 'Enter') handleApplyDiscount(); }}
                />
                {discountType === 'pct' && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">%</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Deje en 0 para eliminar el descuento actual.</p>
            </div>
            <Button
              className="w-full h-11 font-semibold bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={handleApplyDiscount}
            >
              Aplicar descuento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Weight / Quantity Modal — Redesigned */}
      <Dialog open={isWeightModalOpen} onOpenChange={(open) => {
        setIsWeightModalOpen(open);
        if (!open) { setEditingCartItemId(null); setEditingCartItemName(''); setWeighableProduct(null); }
      }}>
        <DialogContent className="max-w-[420px] w-[calc(100%-2rem)] p-0 overflow-hidden gap-0">
          {/* Header */}
          <div className="px-6 pt-6 pb-5 border-b bg-muted/20" style={{ paddingRight: '3.5rem' }}>
            <div className="space-y-1.5">
              <DialogTitle className="text-base font-semibold leading-snug">
                {editingCartItemId ? 'Editar cantidad / peso' : 'Ingresar peso'}
              </DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm text-muted-foreground font-medium truncate max-w-[220px]">
                  {editingCartItemId ? editingCartItemName : weighableProduct?.name}
                </p>
                <Badge variant="outline" className="shrink-0 text-[10px] font-bold border-primary/30 text-primary bg-primary/5 flex items-center gap-1">
                  {weightUnit === 'kg' ? <><IconScale size={11} /> Por peso</> : <><IconPackage size={11} /> Por unidad</>}
                </Badge>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 space-y-5">
            {/* Unit selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Tipo de medida</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setWeightUnit('ud')}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all text-sm font-semibold gap-1.5",
                    weightUnit === 'ud'
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/20"
                  )}
                >
                  <IconPackage size={22} stroke={1.5} />
                  <span>Unidades</span>
                  <span className="text-[10px] font-normal opacity-70">Piezas, bultos, etc.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWeightUnit('kg')}
                  className={cn(
                    "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all text-sm font-semibold gap-1.5",
                    weightUnit === 'kg'
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/20"
                  )}
                >
                  <IconScale size={22} stroke={1.5} />
                  <span>Kilogramos</span>
                  <span className="text-[10px] font-normal opacity-70">Fracciones decimales</span>
                </button>
              </div>
            </div>

            {/* Input */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">
                {weightUnit === 'kg' ? 'Peso (kg)' : 'Cantidad (unidades)'}
              </Label>
              <div className="relative">
                <Input
                  ref={weightInputRef}
                  type="number"
                  step={weightUnit === 'kg' ? '0.001' : '1'}
                  min={0}
                  value={weightValue}
                  onChange={(e) => setWeightValue(e.target.value)}
                  placeholder={weightUnit === 'kg' ? 'Ej: 1.250' : 'Ej: 5'}
                  className="h-14 text-2xl font-mono font-bold pr-14 text-right tabular-nums"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmWeight(); }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                  {weightUnit === 'kg' ? 'Kg' : 'Ud'}
                </span>
              </div>
              {weightUnit === 'kg' && (
                <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0"></span>
                  Ingrese el peso exacto mostrado en la balanza (Ej: 0.750 = 750 gramos)
                </p>
              )}
            </div>

            {/* Preview */}
            {weightValue && parseFloat(weightValue) > 0 && (
              <div className="rounded-xl bg-muted/30 border border-border/50 px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground">Vista previa</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {parseFloat(weightValue || '0').toFixed(weightUnit === 'kg' ? 3 : 0)} {weightUnit === 'kg' ? 'Kg' : 'Ud'} × ${editingCartItemPrice > 0 ? editingCartItemPrice.toFixed(2) : (weighableProduct?.variants?.[0]?.price || 0).toFixed(2)}
                  </span>
                  <span className="text-base font-bold text-foreground tabular-nums">
                    ${((parseFloat(weightValue || '0')) * (editingCartItemPrice > 0 ? editingCartItemPrice : (weighableProduct?.variants?.[0]?.price || 0))).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <Button
              onClick={handleConfirmWeight}
              className="w-full h-11 font-semibold text-sm"
            >
              Confirmar {weightUnit === 'kg' ? 'Peso' : 'Cantidad'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isCalculatorOpen && <PosCalculator onClose={() => setIsCalculatorOpen(false)} />}
      {isNumpadOpen && <PosNumpad onClose={() => setIsNumpadOpen(false)} onEnter={handleNumpadEnter} />}
    </div>
  );
}
