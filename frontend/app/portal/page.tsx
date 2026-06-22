"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { API_URL } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
    IconCreditCard, IconHistory, IconUser, IconCash, IconAlertCircle, 
    IconCopy, IconCoins, IconCheck, IconDeviceMobile, IconLock, 
    IconCalendar, IconChevronRight, IconGift, IconMapPin, IconInfoCircle,
    IconShoppingBag, IconChevronLeft, IconSearch, IconBuildingStore, IconPhone,
    IconCamera, IconClock, IconTruck, IconCircleCheck, IconCircleX,
    IconWallet, IconBrandPaypal
} from "@tabler/icons-react";

import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { 
    PolarGrid, PolarRadiusAxis, PolarAngleAxis, RadialBar, RadialBarChart, Label as RechartsLabel 
} from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

const API = API_URL;
const MAPBOX_TOKEN = "pk.eyJ1Ijoic3luY3JvcG9zIiwiYSI6ImNtcW80eHJoazF0MjQycXB6b2Q2c3loc3UifQ.RuEyWvPOieOxbOXf9Rq8rQ";

// --- Custom Hand-Drawn Sketch Styles for Login (Sharpie/Marker style) ---

const SplatterQuote = () => {
    return (
        <svg 
            className="inline-block w-8 h-8 ml-1 align-middle select-none text-zinc-900" 
            viewBox="0 0 32 32" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ transform: "rotate(4deg)", stroke: "currentColor" }}
        >
            {/* Ink Splatter / Drops */}
            <circle cx="6" cy="22" r="1.5" fill="currentColor" />
            <circle cx="26" cy="10" r="1.8" fill="currentColor" />
            <circle cx="29" cy="24" r="1.0" fill="currentColor" />
            <circle cx="14" cy="27" r="1.3" fill="currentColor" />
            
            {/* Little splatter sprays */}
            <path d="M 5,8 L 7,10 M 8,7 L 6,9" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 28,15 L 30,17 M 30,14 L 28,17" strokeWidth="1.0" strokeLinecap="round" opacity="0.8" />
            <path d="M 12,2 L 14,4 M 14,2 L 12,4" strokeWidth="1.2" strokeLinecap="round" />

            {/* Double quote marks - thick sharpie strokes */}
            {/* Quote 1 */}
            <path 
                d="M 9,7 C 11,11 11,16 9,20" 
                strokeWidth="5.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
            />
            {/* Quote 2 */}
            <path 
                d="M 19,6 C 21,10 21,15 19,19" 
                strokeWidth="5.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
            />
        </svg>
    );
};

const MarkerHighlight = ({ 
    children, 
    className = "", 
    color = "#fbbf24", 
    opacity = 0.88,
    style = {}
}: { 
    children: React.ReactNode; 
    className?: string; 
    color?: string; 
    opacity?: number;
    style?: React.CSSProperties;
}) => {
    return (
        <span className={`relative inline-block ${className}`} style={style}>
            <svg
                aria-hidden="true"
                className="absolute inset-x-[-12px] inset-y-[-4px] w-[calc(100%+24px)] h-[calc(100%+8px)] pointer-events-none select-none"
                preserveAspectRatio="none"
                viewBox="0 0 200 50"
                xmlns="http://www.w3.org/2000/svg"
                style={{ zIndex: 0 }}
            >
                {/* Overlapping stroke 1: top half (thicker marker stroke) */}
                <path
                    d="M 5,18 C 50,12 100,16 150,14 C 175,13 190,17 195,15"
                    fill="none"
                    stroke={color}
                    strokeWidth="19"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={opacity}
                />
                {/* Overlapping stroke 2: bottom half (thicker marker stroke) */}
                <path
                    d="M 8,32 C 55,36 110,30 160,34 C 175,35 188,31 193,33"
                    fill="none"
                    stroke={color}
                    strokeWidth="21"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={opacity * 0.9}
                />
                {/* Overlapping stroke 3: middle connecting */}
                <path
                    d="M 12,24 C 60,20 120,26 170,22 C 182,21 191,25 196,23"
                    fill="none"
                    stroke={color}
                    strokeWidth="15"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={opacity * 0.7}
                />
                {/* Edge scribble starts/ends to show ink pooling */}
                <path
                    d="M 4,12 C 6,18 5,28 3,36"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    opacity="0.5"
                />
                <path
                    d="M 194,15 C 196,22 195,30 193,38"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    opacity="0.5"
                />
            </svg>
            <span className="relative z-10">{children}</span>
        </span>
    );
};

const SharpieCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
    return (
        <div className={`relative p-8 mt-2 w-full ${className}`}>
            {/* Hand-drawn ruled card */}
            <svg
                aria-hidden="true"
                className="absolute inset-0 w-full h-full pointer-events-none select-none z-0"
                preserveAspectRatio="none"
                viewBox="0 0 200 200"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Page background fill */}
                <path
                    d="M 5,8 Q 100,5 195,8 T 192,192 Q 100,195 8,192 Z"
                    fill="#ffffff"
                />
                {/* Main black Sharpie border (Thicker fine tip marker) */}
                <path
                    d="M 6,7 Q 100,4 194,7 T 193,193 Q 100,196 7,193 Z"
                    fill="none"
                    stroke="#1c1917"
                    strokeWidth="4.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* Secondary thin sketch line (Thicker fine tip marker) */}
                <path
                    d="M 4,9 Q 100,6 196,9 T 191,190 Q 100,194 9,190 Z"
                    fill="none"
                    stroke="#1c1917"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.4"
                />
                {/* Pink left-margin notebook line */}
                <path
                    d="M 32,4 L 32,196"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity="0.65"
                />
                {/* Blue ruled lines */}
                <path
                    d="M 8,30 L 192,30 M 8,50 L 192,50 M 8,70 L 192,70 M 8,90 L 192,90 M 8,110 L 192,110 M 8,130 L 192,130 M 8,150 L 192,150 M 8,170 L 192,170"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    opacity="0.18"
                />
            </svg>
            <div className="relative z-10 flex flex-col gap-4">
                {children}
            </div>
        </div>
    );
};

export default function ClientPortal() {
    const [idSearch, setIdSearch] = useState("");
    const [client, setClient] = useState<any>(null);
    const [loans, setLoans] = useState<any[]>([]);
    const [debts, setDebts] = useState<any[]>([]);
    const [rewards, setRewards] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [mySubmissions, setMySubmissions] = useState<any[]>([]);
    const [selectedDebtForPayment, setSelectedDebtForPayment] = useState<any | null>(null);
    const [paymentStep, setPaymentStep] = useState<"details" | "pago_movil" | "binance" | "zinli" | "paypal" | "upload" | "pending">("details");
    const [paymentAmount, setPaymentAmount] = useState<string>(""); // always USD
    const [paymentAmountBs, setPaymentAmountBs] = useState<string>(""); // only for pago_movil (Bs)
    const [selectedInstallmentOption, setSelectedInstallmentOption] = useState<number | "custom" | null>(null);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    const [receiptReference, setReceiptReference] = useState<string>("");
    const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

    // Profile Edit States
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editAddress, setEditAddress] = useState("");
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isCancellingOrder, setIsCancellingOrder] = useState(false);
    const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [view, setView] = useState<"login" | "dashboard">("login");
    const [activeTab, setActiveTab] = useState<"home" | "payments" | "rewards" | "profile" | "auth-purchase">("home");
    
    // Credit Purchase PIN Authentication states
    const [authPin, setAuthPin] = useState("");
    const [pendingPurchase, setPendingPurchase] = useState<any | null>(null);
    const [pendingPurchasePin, setPendingPurchasePin] = useState<string | null>(null);
    const [isLoadingPendingPurchase, setIsLoadingPendingPurchase] = useState(false);
    const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
    const [selectedFrequency, setSelectedFrequency] = useState<number>(15);
    const [submittingApproval, setSubmittingApproval] = useState(false);
    const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
    const [showCancelledScreen, setShowCancelledScreen] = useState(false);
    
    // Currency converter state
    const [usdAmount, setUsdAmount] = useState<string>("10");

    // Request Loan States
    const [requestLoanView, setRequestLoanView] = useState<boolean>(false);
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [submittingRequest, setSubmittingRequest] = useState<boolean>(false);

    // Branches state
    const [branches, setBranches] = useState<any[]>([]);
    const [isBranchesModalOpen, setIsBranchesModalOpen] = useState(false);

    // Payment calendar state
    const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());
    const [calYear, setCalYear] = useState<number>(new Date().getFullYear());

    // Selected payment tab and collapse states
    const [selectedMonthTab, setSelectedMonthTab] = useState<string | null>(null);
    const [txSearchQuery, setTxSearchQuery] = useState("");
    const [isTotalCollapsed, setIsTotalCollapsed] = useState(false);

    // Shop / Catalog states
    const [portalBusinesses, setPortalBusinesses] = useState<any[]>([]);
    const [selectedBusinessForShop, setSelectedBusinessForShop] = useState<any | null>(null);
    const [businessBranchesForShop, setBusinessBranchesForShop] = useState<any[]>([]);
    const [loadingBranchesForShop, setLoadingBranchesForShop] = useState(false);
    const [selectedBranchForShop, setSelectedBranchForShop] = useState<any | null>(null);
    const [shopProducts, setShopProducts] = useState<any[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [productSearchQuery, setProductSearchQuery] = useState("");
    const [onlyInStock, setOnlyInStock] = useState(true);
    const [businessSearchQuery, setBusinessSearchQuery] = useState("");

    // E-commerce Shopping Cart states
    const [selectedProductForDetail, setSelectedProductForDetail] = useState<any | null>(null);
    const [cart, setCart] = useState<{ product: any; quantity: number }[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [checkoutItems, setCheckoutItems] = useState<{ product: any; quantity: number }[]>([]);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [checkoutFrequency, setCheckoutFrequency] = useState(15);
    const [checkoutInstallments, setCheckoutInstallments] = useState(2);
    const [purchaseSuccessData, setPurchaseSuccessData] = useState<{ pin: string; amount: number; items: any[] } | null>(null);

    const [businessSettings, setBusinessSettings] = useState<any | null>(null);
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [activeDeliveryOrder, setActiveDeliveryOrder] = useState<any | null>(null);
    const [deliveryAddress, setDeliveryAddress] = useState("");
    const [deliveryNote, setDeliveryNote] = useState("");
    const [deliveryPhone, setDeliveryPhone] = useState("");
    const [deliveryCoordinates, setDeliveryCoordinates] = useState<{ lat: number; lng: number } | null>(null);
    const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);
    const [mapboxLoaded, setMapboxLoaded] = useState(false);
    const [isMapMoving, setIsMapMoving] = useState(false);

    // Multiple orders support
    const [portalDeliveryOrders, setPortalDeliveryOrders] = useState<any[]>([]);
    const [isOrdersListOpen, setIsOrdersListOpen] = useState(false);
    const [isLoadingOrdersList, setIsLoadingOrdersList] = useState(false);
    const [hasDismissedActiveTracking, setHasDismissedActiveTracking] = useState(false);
    const [isTrackingOpen, setIsTrackingOpen] = useState(false);

    const checkoutMapContainerRef = useRef<HTMLDivElement | null>(null);
    const trackingMapContainerRef = useRef<HTMLDivElement | null>(null);
    const geolocateControlRef = useRef<any>(null);
    const checkoutMapRef = useRef<any>(null);
    const trackingMapRef = useRef<any>(null);
    const trackingMarkerRef = useRef<any>(null);
    const [isGeolocating, setIsGeolocating] = useState(false);
    const [addressSearch, setAddressSearch] = useState("");
    const [addressResults, setAddressResults] = useState<any[]>([]);
    const [isSearchingAddress, setIsSearchingAddress] = useState(false);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchBusinessBranches = useCallback(async (businessId: string) => {
        const token = localStorage.getItem("client_token");
        if (!token) return;
        setLoadingBranchesForShop(true);
        try {
            const res = await fetch(`${API}/clients/portal/businesses/${businessId}/branches`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setBusinessBranchesForShop(await res.json());
            } else {
                toast.error("Error al cargar sucursales");
            }
        } catch (err) {
            console.error("Error fetching business branches", err);
            toast.error("Error al conectar con el servidor");
        } finally {
            setLoadingBranchesForShop(false);
        }
    }, []);

    const fetchShopProducts = useCallback(async (branchId: string) => {
        const token = localStorage.getItem("client_token");
        if (!token) return;
        setLoadingProducts(true);
        try {
            const res = await fetch(`${API}/clients/portal/products?branchId=${branchId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setShopProducts(await res.json());
            } else {
                toast.error("Error al cargar productos");
            }
        } catch (err) {
            console.error("Error fetching shop products", err);
            toast.error("Error al conectar con el servidor");
        } finally {
            setLoadingProducts(false);
        }
    }, []);

    useEffect(() => {
        if (selectedBranchForShop?.businessId) {
            fetchBusinessBranches(selectedBranchForShop.businessId);
        } else {
            setBusinessBranchesForShop([]);
        }
    }, [selectedBranchForShop?.businessId, fetchBusinessBranches]);

    useEffect(() => {
        if (selectedBranchForShop) {
            fetchShopProducts(selectedBranchForShop.id);
        }
    }, [selectedBranchForShop, fetchShopProducts]);

    // E-commerce Cart Helper Functions
    const addToCart = (product: any) => {
        const existingIdx = cart.findIndex(item => item.product.id === product.id);
        const currentQty = existingIdx > -1 ? cart[existingIdx].quantity : 0;
        if (currentQty >= product.totalStock) {
            toast.error("Lo sentimos, no hay más stock disponible de este producto.");
            return;
        }
        if (existingIdx > -1) {
            const updated = [...cart];
            updated[existingIdx].quantity += 1;
            setCart(updated);
        } else {
            setCart([...cart, { product, quantity: 1 }]);
        }
        toast.success(`¡${product.name} agregado al carrito!`);
    };

    const updateCartQuantity = (productId: string, delta: number) => {
        const idx = cart.findIndex(item => item.product.id === productId);
        if (idx === -1) return;
        const updated = [...cart];
        const newQty = updated[idx].quantity + delta;
        const product = updated[idx].product;
        if (newQty > product.totalStock) {
            toast.error("No hay más stock disponible de este producto.");
            return;
        }
        if (newQty <= 0) {
            updated.splice(idx, 1);
            toast.info(`¡${product.name} eliminado del carrito!`);
        } else {
            updated[idx].quantity = newQty;
        }
        setCart(updated);
    };

    const handleCheckout = async (items: { product: any; quantity: number }[]) => {
        if (items.length === 0) return;
        setCheckoutItems(items);
        setIsCartOpen(false);
        setSelectedProductForDetail(null);
        setIsCheckoutOpen(true);

        const token = localStorage.getItem("client_token");
        if (token && selectedBranchForShop?.businessId) {
            setLoadingSettings(true);
            try {
                const res = await fetch(`${API}/clients/portal/businesses/${selectedBranchForShop.businessId}/settings`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setBusinessSettings(data);
                    const maxInst = data?.syncroCreditMaxInstallments || 3;
                    setCheckoutInstallments(Math.min(2, maxInst));
                    setCheckoutFrequency(data?.syncroCreditFrequencyDays || 15);
                }
            } catch (err) {
                console.error("Error fetching business settings", err);
            } finally {
                setLoadingSettings(false);
            }
        }

        if (client) {
            setDeliveryPhone(client.phone || "");
            setDeliveryAddress(client.address || "");
        }
    };

    const handleSubmitDeliveryRequest = async () => {
        if (!deliveryCoordinates) {
            toast.error("Por favor selecciona tu ubicación en el mapa");
            return;
        }

        if (!deliveryNote || !deliveryNote.trim()) {
            toast.error("El detalle adicional (edificio, apto, piso, referencia) es obligatorio");
            return;
        }

        if (!deliveryPhone || !deliveryPhone.trim()) {
            toast.error("El teléfono de contacto es obligatorio");
            return;
        }

        const token = localStorage.getItem("client_token");
        if (!token) return;

        setIsSubmittingDelivery(true);
        try {
            const total = checkoutItems.reduce((sum, item) => {
                const firstVariant = item.product.variants?.[0];
                const price = firstVariant?.promoPrice || firstVariant?.price || 0;
                return sum + price * item.quantity;
            }, 0);

            const productsPayload = checkoutItems.map(item => {
                const firstVariant = item.product.variants?.[0];
                return {
                    productId: item.product.id,
                    quantity: item.quantity,
                    variantId: firstVariant?.id || null,
                    name: item.product.name,
                    price: firstVariant?.promoPrice || firstVariant?.price || 0
                };
            });

            const res = await fetch(`${API}/clients/portal/delivery-orders`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    businessId: selectedBranchForShop.businessId,
                    branchId: selectedBranchForShop.id,
                    products: productsPayload,
                    total,
                    lat: deliveryCoordinates.lat,
                    lng: deliveryCoordinates.lng,
                    address: deliveryNote ? `${deliveryAddress} — ${deliveryNote}` : deliveryAddress,
                    phone: deliveryPhone
                })
            });

            if (res.ok) {
                const order = await res.json();
                toast.success("¡Solicitud de delivery enviada con éxito!");
                setActiveDeliveryOrder(order);
                setIsTrackingOpen(true);
                setActiveTab("rewards");
                setIsCheckoutOpen(false);
                setDeliveryNote(""); // Clear note
                setCart([]); // Clear cart
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(err.message || "Error al crear la solicitud de delivery");
            }
        } catch (err) {
            console.error("Error creating delivery order", err);
            toast.error("Error de conexión");
        } finally {
            setIsSubmittingDelivery(false);
        }
    };

    const handleConfirmPurchase = () => {
        setIsCheckoutOpen(false);
    };

    // Secure Login / Registration states
    const [loginStep, setLoginStep] = useState<"document" | "password" | "register">("document");
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [activationCode, setActivationCode] = useState("");
    const [clientName, setClientName] = useState("");
    const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);

    useEffect(() => {
        setActivationCode(otpDigits.join(""));
    }, [otpDigits]);

    const handleOtpChange = (index: number, value: string) => {
        const cleanVal = value.replace(/[^0-9]/g, "");
        if (!cleanVal) {
            const newDigits = [...otpDigits];
            newDigits[index] = "";
            setOtpDigits(newDigits);
            return;
        }

        const newDigits = [...otpDigits];
        newDigits[index] = cleanVal.charAt(cleanVal.length - 1);
        setOtpDigits(newDigits);

        if (index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
            if (!otpDigits[index] && index > 0) {
                const prevInput = document.getElementById(`otp-${index - 1}`);
                if (prevInput) {
                    prevInput.focus();
                    const newDigits = [...otpDigits];
                    newDigits[index - 1] = "";
                    setOtpDigits(newDigits);
                }
            } else {
                const newDigits = [...otpDigits];
                newDigits[index] = "";
                setOtpDigits(newDigits);
            }
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").trim().replace(/[^0-9]/g, "");
        if (pastedData.length === 6) {
            const newDigits = pastedData.split("");
            setOtpDigits(newDigits);
            const lastInput = document.getElementById(`otp-5`);
            if (lastInput) lastInput.focus();
        }
    };

    const loadPortalData = useCallback(async (token: string) => {
        try {
            const profileRes = await fetch(`${API}/clients/portal/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (profileRes.ok) {
                setClient(await profileRes.json());
            } else if (profileRes.status === 401) {
                // Inline logout to avoid stale closure issues with useCallback
                localStorage.removeItem("client_token");
                setClient(null);
                setLoans([]);
                setRewards([]);
                setSettings(null);
                setView("login");
                setLoginStep("document");
                return;
            }

            const settingsRes = await fetch(`${API}/clients/portal/settings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (settingsRes.ok) {
                try {
                    const settingsData = await settingsRes.json();
                    if (settingsData) setSettings(settingsData);
                } catch {
                    // settings not available, continue
                }
            }

            const loansRes = await fetch(`${API}/clients/portal/loans`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (loansRes.ok) {
                setLoans(await loansRes.json());
            }

            const debtsRes = await fetch(`${API}/clients/portal/debts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (debtsRes.ok) {
                setDebts(await debtsRes.json());
            }

            const submissionsRes = await fetch(`${API}/clients/portal/payments/submissions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (submissionsRes.ok) {
                setMySubmissions(await submissionsRes.json());
            }

            const rewardsRes = await fetch(`${API}/clients/portal/rewards`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (rewardsRes.ok) {
                setRewards(await rewardsRes.json());
            }

            const branchesRes = await fetch(`${API}/branches`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (branchesRes.ok) {
                setBranches(await branchesRes.json());
            }

            const portalBusinessesRes = await fetch(`${API}/clients/portal/businesses`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (portalBusinessesRes.ok) {
                setPortalBusinesses(await portalBusinessesRes.json());
            }

            try {
                const activeDeliveryRes = await fetch(`${API}/clients/portal/delivery-orders/active`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (activeDeliveryRes.ok) {
                    const text = await activeDeliveryRes.text();
                    const activeOrder = text ? JSON.parse(text) : null;
                    setActiveDeliveryOrder(activeOrder);
                }
            } catch (err) {
                console.error("Error fetching active delivery order", err);
            }
        } catch (error) {
            console.error("Error loading portal data", error);
            toast.error("Error al sincronizar datos");
        }
    }, []);

    const fetchPortalDeliveryOrders = useCallback(async () => {
        const token = localStorage.getItem("client_token");
        if (!token) return;
        setIsLoadingOrdersList(true);
        try {
            const res = await fetch(`${API}/clients/portal/delivery-orders`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setPortalDeliveryOrders(await res.json());
            }
        } catch (err) {
            console.error("Error fetching delivery orders", err);
        } finally {
            setIsLoadingOrdersList(false);
        }
    }, []);

    useEffect(() => {
        let interval: any;
        if (isOrdersListOpen) {
            fetchPortalDeliveryOrders();
            interval = setInterval(fetchPortalDeliveryOrders, 10000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isOrdersListOpen, fetchPortalDeliveryOrders]);

    useEffect(() => {
        const token = typeof window !== "undefined" ? localStorage.getItem("client_token") : null;
        if (token) {
            setView("dashboard");
            loadPortalData(token).finally(() => {
                setIsInitializing(false);
            });
        } else {
            setView("login");
            setIsInitializing(false);
        }
    }, [loadPortalData]);

    useEffect(() => {
        if (view !== "dashboard") return;
        const interval = setInterval(() => {
            const token = localStorage.getItem("client_token");
            if (token && document.visibilityState === "visible") {
                loadPortalData(token);
            }
        }, 30000);

        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                const token = localStorage.getItem("client_token");
                if (token) loadPortalData(token);
            }
        };

        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [view, loadPortalData]);

    // Mapbox CDN loader (including Geocoder plugin)
    useEffect(() => {
        if ((window as any).mapboxgl && (window as any).MapboxGeocoder) {
            setMapboxLoaded(true);
            return;
        }

        // Mapbox GL Core Styles
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.css";
        document.head.appendChild(link);

        // Geocoder plugin Styles
        const geocoderLink = document.createElement("link");
        geocoderLink.rel = "stylesheet";
        geocoderLink.href = "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.css";
        geocoderLink.type = "text/css";
        document.head.appendChild(geocoderLink);

        const script = document.createElement("script");
        script.src = "https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.js";
        script.async = true;
        script.onload = () => {
            // Once Mapbox core loads, load the Geocoder plugin
            const geocoderScript = document.createElement("script");
            geocoderScript.src = "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.min.js";
            geocoderScript.async = true;
            geocoderScript.onload = () => {
                setMapboxLoaded(true);
            };
            document.head.appendChild(geocoderScript);
        };
        document.head.appendChild(script);
    }, []);

    // Polling active delivery order status
    useEffect(() => {
        let interval: any;
        const token = localStorage.getItem("client_token");
        if (token && activeDeliveryOrder && (
            activeDeliveryOrder.status === 'PENDING' || 
            activeDeliveryOrder.status === 'APPROVED' || 
            activeDeliveryOrder.status === 'SHIPPED' || 
            activeDeliveryOrder.status === 'ON_THE_WAY'
        )) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`${API}/clients/portal/delivery-orders`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const text = await res.text();
                        const orders = text ? JSON.parse(text) : [];
                        if (Array.isArray(orders)) {
                            const data = orders.find((o: any) => o.id === activeDeliveryOrder.id);
                            if (data) {
                                if (data.status === 'APPROVED' && activeDeliveryOrder.status === 'PENDING') {
                                    toast.success("¡Tu envío ha sido aprobado por el comercio!");
                                }
                                if (data.status === 'SHIPPED' && (activeDeliveryOrder.status === 'APPROVED' || activeDeliveryOrder.status === 'PENDING')) {
                                    toast.success("¡Tu pedido ha salido de la tienda!");
                                }
                                if (data.status === 'ON_THE_WAY' && (activeDeliveryOrder.status === 'SHIPPED' || activeDeliveryOrder.status === 'APPROVED' || activeDeliveryOrder.status === 'PENDING')) {
                                    toast.success("¡Tu repartidor va en camino!");
                                }
                                
                                setActiveDeliveryOrder(data);

                                if (data.status === 'DELIVERED') {
                                    toast.success("¡Tu pedido ha sido entregado!");
                                    setTimeout(() => {
                                        setActiveDeliveryOrder(null);
                                        loadPortalData(token);
                                    }, 5000);
                                } else if (data.status === 'REJECTED') {
                                    toast.error("La solicitud de delivery ha sido rechazada por el comercio.");
                                    setTimeout(() => {
                                        setActiveDeliveryOrder(null);
                                        loadPortalData(token);
                                    }, 5000);
                                } else if (data.status === 'CANCELLED') {
                                    toast.error("El pedido ha sido cancelado.");
                                    setTimeout(() => {
                                        setActiveDeliveryOrder(null);
                                        loadPortalData(token);
                                    }, 5000);
                                }
                            } else {
                                setActiveDeliveryOrder(null);
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error polling active delivery status", err);
                }
            }, 10000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeDeliveryOrder, loadPortalData]);



    // Initialize/Render Checkout Map
    useEffect(() => {
        if (!isCheckoutOpen || !mapboxLoaded || !checkoutMapContainerRef.current) return;

        const mapboxgl = (window as any).mapboxgl;
        if (!mapboxgl) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;

        let mapInstance: any = null;
        let resizeListener: any = null;

        const reverseGeocode = async (lng: number, lat: number) => {
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
                    {
                        headers: {
                            'Accept-Language': 'es'
                        }
                    }
                );
                if (res.ok) {
                    const data = await res.json();
                    const addr = data.address || {};
                    
                    // Compose detailed Venezuelan style address: "Calle/Avenida [Number], Urb./Sector, Ciudad"
                    const streetName = addr.road || addr.pedestrian || addr.path || '';
                    const streetNumber = addr.house_number || '';
                    const neighborhood = addr.neighbourhood || addr.suburb || addr.quarter || addr.hamlet || '';
                    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
                    
                    const streetPart = [streetName, streetNumber].filter(Boolean).join(' ');
                    const areaPart = neighborhood || '';
                    const cityPart = city || '';
                    
                    const parts = [streetPart, areaPart, cityPart].filter(Boolean);
                    const address = parts.length > 0 ? parts.join(', ') : data.display_name;

                    setDeliveryAddress(address);
                }
            } catch (error) {
                console.error("Error reverse geocoding:", error);
            }
        };

        // Do not auto-fetch location on load. Start at Caracas default.
        initializeMap(-66.9036, 10.4806);
        reverseGeocode(-66.9036, 10.4806);

        function initializeMap(startLng: number, startLat: number) {
            if (!checkoutMapContainerRef.current) return;

            const map = new mapboxgl.Map({
                container: checkoutMapContainerRef.current,
                style: "mapbox://styles/mapbox/streets-v11",
                center: [startLng, startLat],
                zoom: 17.5,
                padding: { top: 0, bottom: 400, left: 0, right: 0 }
            });
            mapInstance = map;
            checkoutMapRef.current = map;

            setDeliveryCoordinates({ lat: startLat, lng: startLng });

            // Listen to map pan/move events to center location coordinates in real-time (inDrive style)
            map.on('movestart', () => {
                setIsMapMoving(true);
            });

            map.on('move', () => {
                const center = map.getCenter();
                setDeliveryCoordinates({ lat: center.lat, lng: center.lng });
            });

            map.on('moveend', () => {
                setIsMapMoving(false);
                const center = map.getCenter();
                setDeliveryCoordinates({ lat: center.lat, lng: center.lng });
                reverseGeocode(center.lng, center.lat);
            });

            map.on('click', (e: any) => {
                map.easeTo({ center: [e.lngLat.lng, e.lngLat.lat] });
            });

            // Add navigation controls (zoom, compass) at bottom-right
            map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

            // Add geolocate control to track user position at bottom-right
            const geolocate = new mapboxgl.GeolocateControl({
                positionOptions: {
                    enableHighAccuracy: true
                },
                trackUserLocation: true,
                showUserHeading: true
            });
            map.addControl(geolocate, 'bottom-right');
            geolocateControlRef.current = geolocate;

            geolocate.on('geolocate', (e: any) => {
                const lon = e.coords.longitude;
                const lat = e.coords.latitude;
                map.flyTo({ center: [lon, lat], zoom: 17.5 });
                setIsGeolocating(false);
            });

            geolocate.on('error', () => {
                setIsGeolocating(false);
            });

            // Geocoder is handled by the custom search bar in the bottom sheet, not as a map control

            // Resize the map once the sliding animation finishes to fill the container 100%
            setTimeout(() => {
                map.resize();
            }, 400);

            // Keep the map resized if window size changes
            resizeListener = () => {
                map.resize();
            };
            window.addEventListener('resize', resizeListener);
        }

        return () => {
            if (resizeListener) {
                window.removeEventListener('resize', resizeListener);
            }
            if (mapInstance) {
                mapInstance.remove();
            }
        };
    }, [isCheckoutOpen, mapboxLoaded]);

    // Keep latest active order ref for Mapbox initialization without triggering re-runs
    const activeOrderRef = useRef<any>(null);
    useEffect(() => {
        activeOrderRef.current = activeDeliveryOrder;
    }, [activeDeliveryOrder]);

    // Initialize/Render Tracking Map (Effect 1: Mount/Unmount tracking view)
    useEffect(() => {
        if (!isTrackingOpen || !mapboxLoaded || !trackingMapContainerRef.current) {
            return;
        }

        const mapboxgl = (window as any).mapboxgl;
        if (!mapboxgl) return;

        mapboxgl.accessToken = MAPBOX_TOKEN;

        const lng = activeOrderRef.current?.lng ?? -72.2520;
        const lat = activeOrderRef.current?.lat ?? 7.8221;

        const map = new mapboxgl.Map({
            container: trackingMapContainerRef.current,
            style: "mapbox://styles/mapbox/streets-v11",
            center: [lng, lat],
            zoom: 15,
        });

        const marker = new mapboxgl.Marker({ color: "#e11d48" })
            .setLngLat([lng, lat])
            .addTo(map);

        trackingMapRef.current = map;
        trackingMarkerRef.current = marker;

        // Trigger a resize on Mapbox to fit container after transitions settle
        const resizeTimeout = setTimeout(() => {
            if (trackingMapRef.current) {
                trackingMapRef.current.resize();
            }
        }, 350);

        return () => {
            clearTimeout(resizeTimeout);
            if (trackingMapRef.current) {
                trackingMapRef.current.remove();
                trackingMapRef.current = null;
                trackingMarkerRef.current = null;
            }
        };
    }, [isTrackingOpen, mapboxLoaded]);

    // Smoothly update coordinates without recreating map (Effect 2: Value changes during poll)
    useEffect(() => {
        if (!trackingMapRef.current || !activeDeliveryOrder) return;
        const lng = activeDeliveryOrder.lng;
        const lat = activeDeliveryOrder.lat;

        try {
            trackingMapRef.current.setCenter([lng, lat]);
            if (trackingMarkerRef.current) {
                trackingMarkerRef.current.setLngLat([lng, lat]);
            }
        } catch (err) {
            console.error("Error smoothly updating tracking map coordinates:", err);
        }
    }, [activeDeliveryOrder?.lng, activeDeliveryOrder?.lat]);

    const handleCheckStatus = async () => {
        if (!idSearch.trim()) {
            toast.error("Por favor ingresa tu número de identificación.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API}/auth/client-check-status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentId: idSearch })
            });

            if (res.ok) {
                const data = await res.json();
                setClientName(data.name);
                setIsResettingPassword(false);
                if (data.hasPassword) {
                    setLoginStep("password");
                } else {
                    setLoginStep("register");
                }
            } else {
                const err = await res.json();
                toast.error(err.message || "Identificación no encontrada en el sistema.");
            }
        } catch (error) {
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    const handleLoginWithPassword = async () => {
        if (!password.trim()) {
            toast.error("Por favor ingresa tu contraseña.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API}/auth/client-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentId: idSearch, password })
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem("client_token", data.access_token);
                await loadPortalData(data.access_token);
                setView("dashboard");
                toast.success("Sesión iniciada");
            } else {
                const err = await res.json();
                toast.error(err.message || "Contraseña incorrecta.");
            }
        } catch (error) {
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterPassword = async () => {
        if (!activationCode.trim()) {
            toast.error("Por favor ingresa el código de activación.");
            return;
        }
        if (!password.trim()) {
            toast.error("Por favor ingresa la nueva contraseña.");
            return;
        }
        if (password !== confirmPassword) {
            toast.error("Las contraseñas no coinciden.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API}/auth/client-register-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    documentId: idSearch, 
                    activationCode: activationCode.trim(), 
                    password 
                })
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem("client_token", data.access_token);
                await loadPortalData(data.access_token);
                setView("dashboard");
                toast.success("Contraseña registrada y sesión iniciada");
            } else {
                const err = await res.json();
                toast.error(err.message || "Error al registrar contraseña.");
            }
        } catch (error) {
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("client_token");
        setClient(null);
        setLoans([]);
        setRewards([]);
        setSettings(null);
        setView("login");
        setLoginStep("document");
        setPassword("");
        setConfirmPassword("");
        setActivationCode("");
        setClientName("");
        setOtpDigits(["", "", "", "", "", ""]);
    };

    const handleStartEditProfile = () => {
        setEditName(client?.name || "");
        setEditEmail(client?.email || "");
        setEditPhone(client?.phone || "");
        setEditAddress(client?.address || "");
        setIsEditingProfile(true);
    };

    const handleSaveProfile = async () => {
        if (!editName.trim()) {
            toast.error("El nombre no puede estar vacío");
            return;
        }
        setIsSavingProfile(true);
        try {
            const token = localStorage.getItem("client_token");
            const res = await fetch(`${API}/clients/portal/profile`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: editName,
                    email: editEmail,
                    phone: editPhone,
                    address: editAddress
                })
            });
            if (res.ok) {
                const updatedClient = await res.json();
                setClient(updatedClient);
                setIsEditingProfile(false);
                toast.success("Perfil actualizado con éxito");
            } else {
                const err = await res.json();
                toast.error(err.message || "Error al actualizar perfil");
            }
        } catch (error) {
            console.error("Error saving profile", error);
            toast.error("Error de red al actualizar perfil");
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!activeDeliveryOrder) return;
        // Modal confirmation is handled externally — this function runs the actual cancellation
        setShowCancelConfirmModal(false);
        setIsCancellingOrder(true);
        try {
            const token = localStorage.getItem("client_token");
            const res = await fetch(`${API}/clients/portal/delivery-orders/${activeDeliveryOrder.id}/cancel`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.ok) {
                toast.success("Tu pedido ha sido cancelado con éxito.");
                setActiveDeliveryOrder(null);
                setIsTrackingOpen(false);
                if (token) loadPortalData(token);
            } else {
                const data = await res.json();
                toast.error(data.message || "Error al cancelar el pedido.");
            }
        } catch (err) {
            console.error("Error cancelling order", err);
            toast.error("Error de conexión al intentar cancelar el pedido.");
        } finally {
            setIsCancellingOrder(false);
        }
    };

    const handleRedeem = async (rewardId: string) => {
        const token = localStorage.getItem("client_token");
        if (!token) return;

        try {
            const res = await fetch(`${API}/clients/portal/rewards/${rewardId}/redeem`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success("¡Premio canjeado! Retíralo en caja.");
                await loadPortalData(token);
            } else {
                const err = await res.json();
                toast.error(err.message || "Error al canjear el premio");
            }
        } catch (error) {
            toast.error("Error al procesar el canje");
        }
    };

    const handleRequestLoan = async () => {
        if (!selectedAmount) return;
        setSubmittingRequest(true);
        const token = localStorage.getItem("client_token");
        if (!token) return;

        try {
            const res = await fetch(`${API}/clients/portal/loans/request`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ amount: selectedAmount })
            });

            if (res.ok) {
                toast.success("Solicitud de préstamo enviada con éxito");
                setSelectedAmount(null);
                await loadPortalData(token);
            } else {
                const err = await res.json();
                toast.error(err.message || "Error al enviar la solicitud");
            }
        } catch (error) {
            toast.error("Error de conexión");
        } finally {
            setSubmittingRequest(false);
        }
    };

    const handleFetchPendingPurchase = async (pin: string) => {
        if (!pin.trim() || pin.length !== 6) {
            toast.error("Por favor ingresa un PIN válido de 6 dígitos");
            return;
        }
        setIsLoadingPendingPurchase(true);
        const token = localStorage.getItem("client_token");
        if (!token) return;

        try {
            const res = await fetch(`${API}/sales/pending-credit/${pin}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setPendingPurchase(data);
                setPendingPurchasePin(pin);
                setSelectedInstallments(1);
                
                const limit = client?.syncroCreditFrequencyDays || settings?.syncroCreditFrequencyDays || data.frequencyDays || 15;
                const baseFrequencies = [5, 10, 15, 30];
                const filtered = baseFrequencies.filter(f => f <= limit);
                if (limit > 0 && !filtered.includes(limit)) {
                    filtered.push(limit);
                }
                filtered.sort((a, b) => a - b);
                const defaultFreq = filtered.length > 0 ? filtered[filtered.length - 1] : 15;
                setSelectedFrequency(defaultFreq);
            } else {
                const err = await res.json();
                toast.error(err.message || "Error al buscar la compra");
            }
        } catch (error) {
            toast.error("Error de conexión");
        } finally {
            setIsLoadingPendingPurchase(false);
        }
    };

    const handleApprovePendingPurchase = async () => {
        if (!pendingPurchase || !authPin) return;
        setSubmittingApproval(true);
        const token = localStorage.getItem("client_token");
        if (!token) return;

        try {
            const res = await fetch(`${API}/sales/pending-credit/${authPin}/approve`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    installmentsCount: selectedInstallments,
                    frequencyDays: selectedFrequency
                })
            });

            if (res.ok) {
                setPendingPurchasePin(null);
                setShowApprovalSuccess(true);
                setTimeout(async () => {
                    setPendingPurchase(null);
                    setAuthPin("");
                    setShowApprovalSuccess(false);
                    setActiveTab("home");
                    await loadPortalData(token);
                }, 2500);
            } else {
                const err = await res.json();
                toast.error(err.message || "Error al autorizar el crédito");
            }
        } catch (error) {
            toast.error("Error de conexión");
        } finally {
            setSubmittingApproval(false);
        }
    };

    // Poll status of the pending purchase while client is viewing the summary
    useEffect(() => {
        if (!pendingPurchasePin || !pendingPurchase || showApprovalSuccess) return;

        let active = true;
        const interval = setInterval(async () => {
            try {
                const token = localStorage.getItem("client_token");
                if (!token) return;
                const res = await fetch(`${API}/sales/pending-credit/status/${pendingPurchasePin}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok && active) {
                    const data = await res.json();
                    if (data.status === 'REJECTED') {
                        clearInterval(interval);
                        setPendingPurchase(null);
                        setPendingPurchasePin(null);
                        setAuthPin("");
                        setShowCancelledScreen(true);
                    }
                }
            } catch (err) {
                // silent - connection error while polling
            }
        }, 2000);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [pendingPurchasePin, pendingPurchase, showApprovalSuccess]);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copiado`);
    };

    const getClientLevel = (score: number = 50) => {
        if (score >= 95) return { 
            name: "Máximo", 
            level: 4, 
            color: "bg-purple-50/60 text-purple-700 border-purple-200", 
            chartColor: "#8b5cf6",
            image: "/Nivel-4-Máximo.png" 
        };
        if (score >= 85) return { 
            name: "Consolidación", 
            level: 3, 
            color: "bg-amber-50/60 text-amber-700 border-amber-200", 
            chartColor: "#eab308",
            image: "/Nivel-3-Consolidación.png" 
        };
        if (score >= 70) return { 
            name: "Crecimiento", 
            level: 2, 
            color: "bg-cyan-50/60 text-cyan-700 border-cyan-200", 
            chartColor: "#06b6d4",
            image: "/Nivel-2-Crecimiento.png" 
        };
        return { 
            name: "Semilla", 
            level: 1, 
            color: "bg-orange-50/60 text-orange-700 border-orange-200", 
            chartColor: "#f97316",
            image: "/Nivel-1-Semilla.png" 
        };
    };

    const levelInfo = getClientLevel(client?.creditScore || 50);

    const availableCredit = Math.max(0, (client?.creditLimit || 0) - (client?.currentDebt || 0));
    const creditLimit = client?.creditLimit || 0;
    const percentAvailable = creditLimit > 0 ? (availableCredit / creditLimit) * 100 : 0;
    const usedPercentage = client?.creditLimit > 0 ? (client.currentDebt / client.creditLimit) * 100 : 0;
    const rateUsdToVes = settings?.exchangeRate || 40.0;
    const rateUsdToCop = 4000;

    const pendingRequestLoan = loans.find(l => l.status === 'REQUESTED');
    const approvedRequestLoan = loans.find(l => l.status === 'APPROVED_PENDING_DISBURSEMENT');
    const activeLoan = loans.find(l => l.status === 'PENDING' || l.status === 'OVERDUE');

    const chartData = [
        { name: "Disponible", value: percentAvailable, fill: levelInfo.chartColor }
    ];

    const chartConfig = {
        value: {
            label: "Crédito Disponible",
        }
    } satisfies ChartConfig;

    // Custom floating keyframes for slow, smooth, elegant float
    const animationStyle = (
        <style>{`
            html, body {
                background-color: ${view === "login" ? "#fffdf5" : "#faf9f5"} !important;
                background: ${view === "login" ? "#fffdf5" : "#faf9f5"} !important;
            }
            @keyframes softFloat {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                50% { transform: translateY(-10px) rotate(1deg); }
            }
            .animate-soft-float {
                animation: softFloat 4.8s ease-in-out infinite;
            }
            @keyframes softFloatCheese {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                50% { transform: translateY(-8px) rotate(-2deg); }
            }
            .animate-soft-float-cheese {
                animation: softFloatCheese 5.4s ease-in-out infinite;
            }
            .text-shadow-contrast {
                text-shadow: 0 1px 3px rgba(255, 255, 255, 0.95), 0 0 12px rgba(255, 255, 255, 0.75);
            }
            
            /* Mapbox Geocoder Custom Styles */
            .mapboxgl-ctrl-geocoder {
                min-width: 160px !important;
                max-width: 200px !important;
                height: 36px !important;
                border-radius: 9999px !important;
                border: 1px solid rgba(228, 228, 231, 0.9) !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
                background-color: #ffffff !important;
                margin-top: 10px !important;
                margin-left: 10px !important;
                z-index: 50 !important;
            }
            .mapboxgl-ctrl-geocoder--input {
                height: 34px !important;
                padding: 6px 36px !important;
                font-size: 11px !important;
                font-weight: 700 !important;
                color: #27272a !important;
                background-color: transparent !important;
            }
            .mapboxgl-ctrl-geocoder--icon-search {
                top: 8px !important;
                left: 12px !important;
                width: 16px !important;
                height: 16px !important;
                fill: #71717a !important;
            }
            .mapboxgl-ctrl-geocoder--icon-close {
                margin-top: 2px !important;
                width: 14px !important;
                height: 14px !important;
            }
            .mapboxgl-ctrl-geocoder--button {
                top: 6px !important;
                background: transparent !important;
            }
            .mapboxgl-ctrl-geocoder .suggestions {
                border-radius: 16px !important;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08) !important;
                border: 1px solid rgba(228, 228, 231, 0.6) !important;
                overflow: hidden !important;
                background-color: #ffffff !important;
                font-size: 11px !important;
                z-index: 100 !important;
            }
            .mapboxgl-ctrl-geocoder .suggestions > li > a {
                padding: 8px 12px !important;
                font-weight: 600 !important;
                color: #3f3f46 !important;
            }
            .mapboxgl-ctrl-geocoder .suggestions > .active > a,
            .mapboxgl-ctrl-geocoder .suggestions > li > a:hover {
                background-color: #fef3c7 !important;
                color: #78350f !important;
            }

            /* Stacking Context overlays control container above center pin */
            .mapboxgl-control-container {
                position: relative;
                z-index: 40 !important;
            }

            /* Hide geocoder powered-by attribution branding */
            .mapboxgl-ctrl-geocoder--powered-by,
            .powered-by-mapbox {
                display: none !important;
            }

            /* Floating Pin animations (inDrive style) */
            .custom-center-pin {
                transform: translate(-50%, -100%) translateY(0);
                transition: transform 0.22s cubic-bezier(0.25, 1, 0.5, 1);
            }
            .custom-center-pin.moving {
                transform: translate(-50%, -100%) translateY(-14px);
            }
            .custom-pin-shadow {
                width: 12px;
                height: 4px;
                background: rgba(0, 0, 0, 0.22);
                border-radius: 50%;
                transition: transform 0.22s ease, opacity 0.22s ease;
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
            }
            .custom-pin-shadow.moving {
                transform: translate(-50%, -50%) scale(0.35);
                opacity: 0.25;
            }

            /* Hide Mapbox logo and attribution */
            .mapboxgl-ctrl-logo,
            .mapboxgl-ctrl-attrib {
                display: none !important;
            }

            /* Hide native Mapbox geolocate & navigation controls (replaced by custom button) */
            .mapboxgl-ctrl-geolocate,
            .mapboxgl-ctrl-zoom-in,
            .mapboxgl-ctrl-zoom-out,
            .mapboxgl-ctrl-compass {
                display: none !important;
            }
        `}</style>
    );

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-[#faf9f5] text-zinc-800 font-sans-ui pb-28 relative overflow-x-clip">
                {animationStyle}

                {/* Header Skeleton */}
                <div className="px-6 pt-4 pb-0 flex items-center justify-between z-50 relative">
                    <div className="h-9 w-36 bg-zinc-200/80 rounded-lg animate-pulse" />
                    <div className="h-8 w-8 bg-zinc-200/80 rounded-full animate-pulse" />
                </div>

                <main className="max-w-md mx-auto px-6 space-y-4 pt-1">
                    {activeTab === "home" && (
                        <>
                            {/* Radial Chart Skeleton */}
                            <div className="w-full flex flex-col items-center justify-center text-center pt-1 pb-3 relative">
                                <div className="size-[280px] rounded-full border-[18px] border-zinc-200/40 flex flex-col items-center justify-center animate-pulse bg-white/50 shadow-inner">
                                    <div className="h-3.5 w-28 bg-zinc-200/80 rounded mb-3" />
                                    <div className="h-10 w-24 bg-zinc-300/80 rounded" />
                                </div>
                            </div>

                            {/* Stats Grid Skeleton */}
                            <div className="grid grid-cols-3 gap-2 mt-4 w-full">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="rounded-2xl bg-white border border-zinc-100 shadow-sm p-3 flex flex-col items-center gap-2 animate-pulse">
                                        <div className="h-2.5 w-10 bg-zinc-200/80 rounded" />
                                        <div className="h-5 w-12 bg-zinc-300/80 rounded" />
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Title Skeleton */}
                            <div className="flex items-center justify-between pt-2">
                                <div className="h-6 w-36 bg-zinc-200/80 rounded animate-pulse" />
                                <div className="flex gap-2">
                                    <div className="h-7 w-7 bg-zinc-200/80 rounded-full animate-pulse" />
                                    <div className="h-7 w-20 bg-zinc-200/80 rounded-full animate-pulse" />
                                    <div className="h-7 w-7 bg-zinc-200/80 rounded-full animate-pulse" />
                                </div>
                            </div>

                            {/* Calendar Days Slider Skeleton */}
                            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none w-full">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="min-w-[90px] h-[100px] rounded-xl bg-white border border-zinc-100 p-3 flex flex-col items-center justify-center gap-2.5 animate-pulse shrink-0">
                                        <div className="h-3 w-10 bg-zinc-200/80 rounded" />
                                        <div className="h-8 w-8 bg-zinc-300/80 rounded-lg" />
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {activeTab === "payments" && (
                        <div className="space-y-4">
                            {/* Month navigation slider skeleton */}
                            <div className="flex gap-5 border-b border-zinc-100 pb-1 mb-2 overflow-x-auto scrollbar-none">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="pb-2 relative shrink-0 w-20 space-y-1 animate-pulse">
                                        <div className="h-3 w-16 bg-zinc-200/80 rounded" />
                                        <div className="h-2 w-10 bg-zinc-150/70 rounded" />
                                    </div>
                                ))}
                            </div>

                            {/* Total collapsible card skeleton */}
                            <div className="rounded-2xl bg-white border border-zinc-100 p-5 shadow-sm space-y-2.5 animate-pulse">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2.5">
                                        <div className="size-8 rounded-full bg-zinc-200/80" />
                                        <div className="h-3.5 w-32 bg-zinc-200/80 rounded" />
                                    </div>
                                    <div className="h-5 w-16 bg-zinc-300/80 rounded" />
                                </div>
                            </div>

                            {/* Detailed Debts List skeleton */}
                            <div className="space-y-4">
                                {[1, 2].map((i) => (
                                    <div key={i} className="rounded-2xl bg-white border border-zinc-100 p-5 space-y-4 shadow-sm animate-pulse">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-2">
                                                <div className="h-4 w-32 bg-zinc-200/80 rounded" />
                                                <div className="h-3 w-24 bg-zinc-150/70 rounded" />
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5">
                                                <div className="h-4 w-12 bg-zinc-200/80 rounded-full" />
                                                <div className="h-3 w-14 bg-zinc-150/70 rounded" />
                                                <div className="h-4 w-16 bg-zinc-300/80 rounded" />
                                            </div>
                                        </div>
                                        <div className="pt-3 border-t border-zinc-50 flex justify-between items-center">
                                            <div className="h-3 w-28 bg-zinc-200/80 rounded" />
                                            <div className="h-3.5 w-20 bg-zinc-200/80 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === "rewards" && (
                        <div className="space-y-5 animate-pulse">
                            <div className="border-b border-zinc-100 pb-3 space-y-1.5">
                                <div className="h-4 w-36 bg-zinc-200/80 rounded" />
                                <div className="h-3 w-48 bg-zinc-150/70 rounded" />
                            </div>
                            
                            {/* Search input skeleton */}
                            <div className="h-11 bg-white border border-zinc-200 rounded-xl w-full" />
                            
                            {/* Available businesses skeleton */}
                            <div className="grid grid-cols-2 gap-3.5 mt-2">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="rounded-2xl bg-white border border-zinc-100 p-4 space-y-3 flex flex-col justify-between h-40">
                                        <div className="space-y-2">
                                            <div className="size-10 rounded-xl bg-zinc-200/80" />
                                            <div className="h-3.5 w-24 bg-zinc-200/80 rounded" />
                                        </div>
                                        <div className="h-3 w-16 bg-zinc-150/70 rounded" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === "profile" && (
                        <div className="space-y-5 animate-pulse">
                            {/* Profile Header Skeleton */}
                            <div className="flex flex-col items-center text-center space-y-3">
                                <div className="size-20 rounded-full bg-zinc-200/80 border-4 border-white shadow-md" />
                                <div className="space-y-1">
                                    <div className="h-5 w-28 bg-zinc-250/70 rounded mx-auto" />
                                    <div className="h-3 w-20 bg-zinc-150/70 rounded mx-auto" />
                                </div>
                            </div>

                            {/* Details Fields Skeleton */}
                            <div className="bg-white border border-zinc-100 rounded-2xl p-5 space-y-4 shadow-sm">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="flex justify-between items-center py-1">
                                        <div className="space-y-1">
                                            <div className="h-2.5 w-16 bg-zinc-150/70 rounded" />
                                            <div className="h-3.5 w-32 bg-zinc-200/80 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === "auth-purchase" && (
                        <div className="space-y-5 animate-pulse">
                            <div className="text-center space-y-2">
                                <div className="h-5 w-40 bg-zinc-300/85 rounded mx-auto" />
                                <div className="h-3 w-48 bg-[#fffbeb] rounded mx-auto" />
                            </div>

                            {/* PIN Code Boxes Skeleton */}
                            <div className="flex justify-center gap-2">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i} className="size-10 rounded-xl bg-white border border-zinc-200" />
                                ))}
                            </div>

                            {/* Floating details box skeleton */}
                            <div className="rounded-2xl bg-white border border-zinc-150 p-5 space-y-4 shadow-sm text-center">
                                <div className="h-14 w-full bg-zinc-150/70 rounded-xl" />
                            </div>
                        </div>
                    )}
                </main>

                {/* Fixed bottom navigation (static rendering for skeleton) */}
                <div className="fixed bottom-6 left-6 right-6 h-16 max-w-sm mx-auto z-50 filter drop-shadow-[0_8px_20px_rgba(139,92,26,0.12)]">
                    <div className="absolute inset-0 w-full h-full bg-white rounded-full opacity-90" />
                    <div className="absolute w-[84px] h-[84px] bg-white rounded-full -top-[30px] left-1/2 -translate-x-1/2 opacity-90" />
                    <div className="absolute inset-0 w-full h-full flex justify-around items-center px-4">
                        <div className="flex-1 flex flex-col items-center justify-center gap-1 opacity-40">
                            <div className="size-5 bg-zinc-300 rounded-full animate-pulse" />
                            <div className="h-2 w-8 bg-zinc-200 rounded animate-pulse" />
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center gap-1 opacity-40">
                            <div className="size-5 bg-zinc-300 rounded-full animate-pulse" />
                            <div className="h-2 w-8 bg-zinc-200 rounded animate-pulse" />
                        </div>
                        <div className="relative w-[84px] h-full flex items-center justify-center shrink-0">
                            <div className="absolute -top-[22px] size-14 rounded-full bg-zinc-200/80 animate-pulse border-4 border-[#faf9f5]" />
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center gap-1 opacity-40">
                            <div className="size-5 bg-zinc-300 rounded-full animate-pulse" />
                            <div className="h-2 w-8 bg-zinc-200 rounded animate-pulse" />
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center gap-1 opacity-40">
                            <div className="size-5 bg-zinc-300 rounded-full animate-pulse" />
                            <div className="h-2 w-8 bg-zinc-200 rounded animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#fffdf0] via-white to-[#fffdf0] flex flex-col items-center justify-center p-6 font-sans-ui text-zinc-800 animate-in fade-in duration-300 relative overflow-hidden">
                {animationStyle}
                
                {/* Background Curves & Waves in Pastel Colors */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-gradient-to-b from-[#fffdf0] via-white to-[#fffdf0] select-none">
                    <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-[#fef3c7]/20 blur-3xl animate-pulse" />
                </div>

                <div className="relative flex flex-col items-center justify-center space-y-6 z-10 text-center">
                    {/* Cheese & Grater - floating & scaling loading animation */}
                    <div className="relative w-[180px] h-[180px] animate-soft-float-cheese select-none">
                        <img 
                            src="/cheese.png" 
                            alt="Cargando..." 
                            className="w-full h-full object-contain mix-blend-multiply" 
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-lg font-black text-zinc-800 tracking-tight">Procesando...</h2>
                        <p className="text-xs text-zinc-450 font-bold max-w-[200px] leading-tight">Preparando tu cuenta de Syncro...</p>
                    </div>
                    
                    {/* Minimal loading dot line */}
                    <div className="flex gap-1.5 justify-center pt-2">
                        <span className="size-2 rounded-full bg-[#fef3c7] animate-bounce [animation-delay:-0.3s]" />
                        <span className="size-2 rounded-full bg-[#fde68a] animate-bounce [animation-delay:-0.15s]" />
                        <span className="size-2 rounded-full bg-amber-400 animate-bounce" />
                    </div>
                </div>
            </div>
        );
    }

    // Safety: if loading is done but we are in dashboard view without a client, redirect to login
    if (view === "dashboard" && !client) {
        // This will be caught in the next render cycle after setView fires in loadPortalData,
        // but as an extra safety net, clear token and show login
        localStorage.removeItem("client_token");
        setView("login");
        return null;
    }

    if (view === "login") {
        const textStrokeStyle = {
            WebkitTextStroke: "1.4px #1c1917",
            fontWeight: "bold" as const,
        };

        return (
            <div className="min-h-screen bg-[#fffdf5] flex flex-col justify-between p-0 font-sans-ui text-zinc-800 animate-in fade-in duration-700 relative overflow-hidden">
                {animationStyle}

                {/* Background blobs */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
                    <div className="absolute -top-24 -right-24 w-[320px] h-[320px] rounded-full bg-amber-100/40 blur-3xl" />
                    <div className="absolute bottom-0 -left-16 w-[280px] h-[280px] rounded-full bg-amber-50/60 blur-3xl" />

                    {/* ——— Sharpie-drawn coins (Static, no float animation) ——— */}

                    {/* Coin top-right — large */}
                    <svg className="absolute top-8 right-5 w-20 h-20" style={{ transform: "rotate(15deg)" }} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Fill */}
                        <path d="M40,5 C56,4 75,20 75,40 C75,60 58,76 39,75 C20,75 5,59 5,40 C5,21 23,6 40,5 Z" fill="#fde68a" />
                        {/* Outer border (Double drawn) (Thicker borders) */}
                        <path d="M40,5 C56,4 75,20 75,40 C75,60 58,76 39,75 C20,75 5,59 5,40 C5,21 23,6 40,5 Z" stroke="#1c1917" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M40,6 C55,5 73,21 73,40 C73,59 57,74 39,73 C21,73 7,58 7,40 C7,22 22,7 40,6 Z" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round" opacity="0.5"/>
                        {/* Dollar sign sketched */}
                        <path d="M40,15 L40,65" stroke="#1c1917" strokeWidth="4.2" strokeLinecap="round"/>
                        <path d="M30,26 C30,21 34,18 40,18 C46,18 51,22 51,28 C51,34 46,37 40,39 C34,41 29,44 29,50 C29,56 33,60 40,60 C47,60 51,57 51,52" stroke="#1c1917" strokeWidth="4.2" fill="none" strokeLinecap="round"/>
                        {/* Hatching/shading on bottom left */}
                        <path d="M14,50 L20,53 M18,44 L25,48 M23,39 L30,43 M29,35 L36,39 M35,32 L42,36" stroke="#1c1917" strokeWidth="2.0" strokeLinecap="round" opacity="0.65"/>
                        {/* Shine reflection strokes on top right */}
                        <path d="M52,18 C60,23 66,31 67,40" stroke="#ffffff" strokeWidth="3.0" strokeLinecap="round" opacity="0.9"/>
                    </svg>

                    {/* Coin bottom-right — small tilted */}
                    <svg className="absolute bottom-32 right-8 w-12 h-12" style={{ transform: "rotate(-20deg)" }} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M30,4 C43,3 57,16 57,30 C57,45 44,57 30,57 C16,58 3,45 3,30 C2,16 16,5 30,4 Z" fill="#fde68a" />
                        <path d="M30,4 C43,3 57,16 57,30 C57,45 44,57 30,57 C16,58 3,45 3,30 C2,16 16,5 30,4 Z" stroke="#1c1917" strokeWidth="3.8" strokeLinecap="round"/>
                        <path d="M29,5 C41,4 55,17 55,30 C55,43 42,55 29,55 C16,56 5,43 5,30 C4,17 16,6 29,5 Z" stroke="#1c1917" strokeWidth="1.8" strokeLinecap="round" opacity="0.4"/>
                        <path d="M30,13 L30,47" stroke="#1c1917" strokeWidth="3.8" strokeLinecap="round"/>
                        <path d="M22,21 C22,17 25,14 30,14 C36,14 39,18 39,23 C39,28 35,30 30,31 C25,32 21,35 21,40 C21,45 24,47 30,47 C36,47 39,44 39,40" stroke="#1c1917" strokeWidth="3.8" fill="none" strokeLinecap="round"/>
                        {/* Hatching/shading on bottom left */}
                        <path d="M10,38 L15,41 M13,33 L19,36 M17,29 L23,32" stroke="#1c1917" strokeWidth="1.8" strokeLinecap="round" opacity="0.6"/>
                        {/* Shine reflection */}
                        <path d="M41,13 C47,17 51,23 52,30" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
                    </svg>

                    {/* Coin top-left — medium */}
                    <svg className="absolute top-20 -left-2 w-14 h-14" style={{ transform: "rotate(8deg)" }} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M30,3 C44,2 58,15 58,30 C58,46 44,58 29,58 C14,58 2,45 2,30 C1,15 15,4 30,3 Z" fill="#fef3c7" />
                        <path d="M30,3 C44,2 58,15 58,30 C58,46 44,58 29,58 C14,58 2,45 2,30 C1,15 15,4 30,3 Z" stroke="#1c1917" strokeWidth="3.8" strokeLinecap="round"/>
                        <path d="M29,4 C42,3 55,16 55,30 C55,44 42,56 28,56 C14,56 4,44 4,30 C3,16 15,5 29,4 Z" stroke="#1c1917" strokeWidth="1.8" strokeLinecap="round" opacity="0.4"/>
                        <path d="M30,13 L30,47" stroke="#1c1917" strokeWidth="3.8" strokeLinecap="round"/>
                        <path d="M22,21 C22,17 25,14 30,14 C36,14 39,18 39,23 C39,28 35,30 30,31 C25,32 21,35 21,40 C21,45 24,47 30,47 C36,47 39,44 39,40" stroke="#1c1917" strokeWidth="3.8" fill="none" strokeLinecap="round"/>
                        {/* Hatching/shading on bottom left */}
                        <path d="M10,38 L15,41 M13,33 L19,36 M17,29 L23,32" stroke="#1c1917" strokeWidth="1.8" strokeLinecap="round" opacity="0.6"/>
                        {/* Shine reflection */}
                        <path d="M41,13 C47,17 51,23 52,30" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
                    </svg>

                    {/* Coin scatter bottom-left — tiny */}
                    <svg className="absolute bottom-16 left-6 w-9 h-9" style={{ transform: "rotate(-10deg)" }} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M25,3 C36,2 48,13 48,25 C48,37 37,48 25,48 C13,49 2,38 2,25 C1,12 13,4 25,3 Z" fill="#fde68a" />
                        <path d="M25,3 C36,2 48,13 48,25 C48,37 37,48 25,48 C13,49 2,38 2,25 C1,12 13,4 25,3 Z" stroke="#1c1917" strokeWidth="3.8" strokeLinecap="round"/>
                        <path d="M24,4 C34,3 45,13 45,25 C45,36 35,46 24,46 C13,47 4,36 4,25 C3,13 13,5 24,4 Z" stroke="#1c1917" strokeWidth="1.6" strokeLinecap="round" opacity="0.4"/>
                        <path d="M25,11 L25,39" stroke="#1c1917" strokeWidth="3.8" strokeLinecap="round"/>
                        <path d="M18,18 C18,15 21,12 25,12 C30,12 32,16 32,20 C32,24 28,26 25,26 C22,27 17,29 17,33 C17,37 20,39 25,39 C30,39 32,36 32,33" stroke="#1c1917" strokeWidth="3.8" fill="none" strokeLinecap="round"/>
                        {/* Hatching/shading on bottom left */}
                        <path d="M8,31 L12,34 M10,27 L15,30 M13,23 L18,26" stroke="#1c1917" strokeWidth="1.6" strokeLinecap="round" opacity="0.6"/>
                    </svg>

                    {/* Stars / sparkles */}
                    <svg className="absolute top-36 right-14 w-6 h-6" style={{ transform: "rotate(15deg)" }} viewBox="0 0 24 24" fill="none">
                        <path d="M12,2 L13.5,8 L20,8 L14.5,12 L16.5,18 L12,14 L7.5,18 L9.5,12 L4,8 L10.5,8 Z" stroke="#1c1917" strokeWidth="2.2" fill="#fbbf24" strokeLinejoin="round"/>
                    </svg>
                    <svg className="absolute bottom-44 right-16 w-4 h-4" style={{ transform: "rotate(-10deg)" }} viewBox="0 0 24 24" fill="none">
                        <path d="M12,2 L13.5,8 L20,8 L14.5,12 L16.5,18 L12,14 L7.5,18 L9.5,12 L4,8 L10.5,8 Z" stroke="#1c1917" strokeWidth="2.2" fill="#fef3c7" strokeLinejoin="round"/>
                    </svg>
                </div>

                {/* Main content */}
                <div className="flex-1 flex flex-col justify-center px-7 pt-14 pb-6 z-10 w-full relative">
                    <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-8">

                        {/* Sharpie / Marker headline — centered, bolder pen stroke */}
                        <div className="space-y-4 w-full text-center flex flex-col items-center">
                            <h1 className="leading-[1.1] text-zinc-900 tracking-tight text-center">
                                {loginStep === "register" ? (
                                    <>
                                        <span className="block font-handwritten text-[3.8rem] text-zinc-900 leading-none" style={{ transform: "rotate(-1.5deg) translateY(-2px)", transformOrigin: "center", ...textStrokeStyle }}>
                                            Activa tu
                                        </span>
                                        <div className="mt-1 flex justify-center w-full">
                                            <MarkerHighlight className="font-handwritten text-[4.0rem]" color="#fbbf24" style={{ transform: "rotate(2deg)", display: "inline-flex", alignItems: "center", transformOrigin: "center", ...textStrokeStyle }}>
                                                cuenta
                                                <SplatterQuote />
                                            </MarkerHighlight>
                                        </div>
                                    </>
                                ) : loginStep === "password" ? (
                                    <>
                                        <span className="block font-handwritten text-[3.8rem] text-zinc-900 leading-none" style={{ transform: "rotate(1.5deg) translateY(-2px)", transformOrigin: "center", ...textStrokeStyle }}>
                                            ¡Bienvenido
                                        </span>
                                        <div className="mt-1 flex justify-center w-full">
                                            <MarkerHighlight className="font-handwritten text-[4.0rem]" color="#fbbf24" style={{ transform: "rotate(-1.5deg)", display: "inline-flex", alignItems: "center", transformOrigin: "center", ...textStrokeStyle }}>
                                                de vuelta!
                                                <SplatterQuote />
                                            </MarkerHighlight>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex justify-center w-full" style={{ transform: "rotate(-2deg)", transformOrigin: "center" }}>
                                            <span className="font-handwritten text-[3.8rem] text-zinc-900 leading-none inline-flex items-center gap-3" style={textStrokeStyle}>
                                                <MarkerHighlight color="#fbbf24">
                                                    Compra
                                                </MarkerHighlight>
                                                hoy,
                                            </span>
                                        </div>
                                        <div className="mt-1 flex justify-center w-full">
                                            <span className="font-handwritten text-[4.0rem] inline-flex items-center gap-3" style={{ transform: "rotate(2deg)", transformOrigin: "center", ...textStrokeStyle }}>
                                                paga{" "}
                                                <span className="relative inline-block">
                                                    después
                                                    {/* Blue sharpie underline — curved, shorter, hand-drawn feel */}
                                                    <svg
                                                        aria-hidden="true"
                                                        className="absolute pointer-events-none select-none"
                                                        style={{ bottom: "-10px", left: "5%", width: "88%", height: "20px" }}
                                                        viewBox="0 0 180 20"
                                                        preserveAspectRatio="none"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                    >
                                                        {/* Main sweeping arc — starts mid-left, dips down, lifts back */}
                                                        <path
                                                            d="M 8,8 C 35,14 75,16 110,12 C 135,9 158,7 172,10"
                                                            stroke="#38bdf8"
                                                            strokeWidth="6.5"
                                                            strokeLinecap="round"
                                                            fill="none"
                                                            opacity="0.9"
                                                        />
                                                        {/* Shadow stroke — slightly offset, gives depth */}
                                                        <path
                                                            d="M 10,10 C 38,15 78,17 112,13 C 137,11 159,9 171,12"
                                                            stroke="#0284c7"
                                                            strokeWidth="3"
                                                            strokeLinecap="round"
                                                            fill="none"
                                                            opacity="0.35"
                                                        />
                                                    </svg>
                                                </span>!
                                            </span>
                                        </div>
                                    </>
                                )}
                            </h1>

                            <p
                                className="font-handwritten text-[1.45rem] text-zinc-550 leading-snug text-center"
                                style={{ transform: "rotate(-0.5deg)", transformOrigin: "center", ...textStrokeStyle }}
                            >
                                {loginStep === "register"
                                    ? (isResettingPassword ? "Restablece tu contraseña" : "Ingresa tu código de activación")
                                    : loginStep === "password"
                                    ? "Ingresa tu contraseña para continuar"
                                    : "Tu línea de crédito digital, sin complicaciones."}
                            </p>
                        </div>

                        {/* Separator wavy line (Thicker outlines) */}
                        <div className="w-full flex justify-center" style={{ transform: "rotate(-1deg)", transformOrigin: "center" }}>
                            <svg viewBox="0 0 280 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[220px]">
                                <path d="M 2,9 C 18,3 36,14 58,7 C 78,1 98,13 118,7 C 138,2 158,13 178,7 C 198,2 218,13 240,7 C 258,2 272,11 278,7" stroke="#1c1917" strokeWidth="4.5" strokeLinecap="round" fill="none"/>
                                <path d="M 4,11 C 19,6 37,15 57,9 C 78,3 97,14 117,9 C 137,4 157,14 177,9 C 197,4 217,15 239,9 C 257,4 271,12 276,9" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.4"/>
                            </svg>
                        </div>

                        {/* Form Steps */}
                        <div className="w-full">
                            {loginStep === "document" && (
                                <div className="space-y-4 w-full">
                                    <Input 
                                        placeholder="Cédula de Identidad (ej. V12345678)" 
                                        className="h-13 px-5 rounded-[1.25rem] bg-white border-zinc-200 text-sm font-semibold focus-visible:ring-amber-300 text-zinc-850 placeholder:text-zinc-450 transition-all duration-300 shadow-inner"
                                        value={idSearch}
                                        onChange={(e) => setIdSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleCheckStatus()}
                                    />
                                    <Button 
                                        onClick={handleCheckStatus}
                                        disabled={loading}
                                        className="w-full h-13 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none"
                                    >
                                        Ingresar
                                    </Button>
                                </div>
                            )}

                            {loginStep === "password" && (
                                <div className="space-y-4 w-full animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="text-left px-1 mb-1">
                                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Cliente detectado</p>
                                        <p className="text-sm font-black text-zinc-850">{clientName}</p>
                                    </div>
                                    <Input 
                                        type="password"
                                        placeholder="Contraseña" 
                                        className="h-13 px-5 rounded-[1.25rem] bg-white border-zinc-200 text-sm font-semibold focus-visible:ring-amber-300 text-zinc-850 placeholder:text-zinc-450 transition-all duration-300 shadow-inner"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleLoginWithPassword()}
                                    />
                                    <Button 
                                        onClick={handleLoginWithPassword}
                                        disabled={loading}
                                        className="w-full h-13 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none"
                                    >
                                        Ingresar
                                    </Button>
                                    <div className="flex flex-col gap-1.5 w-full mt-1.5 pt-1">
                                        <button 
                                            onClick={() => {
                                                setLoginStep("register");
                                                setIsResettingPassword(true);
                                                setPassword("");
                                                setConfirmPassword("");
                                                setActivationCode("");
                                                setOtpDigits(["", "", "", "", "", ""]);
                                            }}
                                            className="w-full text-center text-sm text-[#854d0e] hover:text-amber-950 font-handwritten underline bg-transparent border-none outline-none cursor-pointer py-1"
                                        >
                                            Olvidé mi contraseña
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setLoginStep("document");
                                                setPassword("");
                                            }}
                                            className="w-full text-center text-sm text-zinc-500 hover:text-zinc-700 font-handwritten underline bg-transparent border-none outline-none cursor-pointer py-1"
                                        >
                                            Ingresar otra Cédula
                                        </button>
                                    </div>
                                </div>
                            )}

                            {loginStep === "register" && (
                                <div className="space-y-4 w-full animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between gap-1.5 w-full px-1 py-1">
                                            {otpDigits.map((digit, idx) => (
                                                <input
                                                    key={idx}
                                                    id={`otp-${idx}`}
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    maxLength={1}
                                                    value={digit}
                                                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                                                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                                    onPaste={handleOtpPaste}
                                                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white border border-zinc-200 text-center font-black text-lg focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none transition-all duration-200 shadow-inner text-zinc-850"
                                                />
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider text-center pt-1">{isResettingPassword ? "Código de Restablecimiento" : "Código de Activación"}</p>
                                    </div>
                                    <Input 
                                        type="password"
                                        placeholder="Nueva Contraseña" 
                                        className="h-12 px-5 rounded-[1.25rem] bg-white border-zinc-200 text-sm font-semibold focus-visible:ring-amber-300 text-zinc-850 placeholder:text-zinc-450 transition-all duration-300 shadow-inner"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <Input 
                                        type="password"
                                        placeholder="Confirmar Contraseña" 
                                        className="h-12 px-5 rounded-[1.25rem] bg-white border-zinc-200 text-sm font-semibold focus-visible:ring-amber-300 text-zinc-850 placeholder:text-zinc-450 transition-all duration-300 shadow-inner"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleRegisterPassword()}
                                    />
                                    <Button 
                                        onClick={handleRegisterPassword}
                                        disabled={loading}
                                        className="w-full h-13 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none"
                                    >
                                        {isResettingPassword ? "Restablecer" : "Activar Cuenta"}
                                    </Button>
                                    <button 
                                        onClick={() => {
                                            setLoginStep("document");
                                            setPassword("");
                                            setConfirmPassword("");
                                            setActivationCode("");
                                            setOtpDigits(["", "", "", "", "", ""]);
                                        }}
                                        className="w-full text-center text-sm text-zinc-500 hover:text-zinc-700 font-handwritten underline bg-transparent border-none outline-none cursor-pointer py-1"
                                    >
                                        Ingresar otra Cédula
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="w-full text-center pb-8 z-10 relative">
                    <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5">
                        <IconLock size={11} /> Conexión encriptada
                    </p>
                </div>
            </div>
        );
    }

    if (view === "dashboard" && client?.isSuspended) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#fff5f5] via-white to-[#fff5f5] flex flex-col items-center justify-center p-6 text-center font-sans-ui text-zinc-800 animate-in fade-in duration-500 relative overflow-hidden">
                {animationStyle}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
                    <div className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full bg-rose-100/30 blur-2xl" />
                    <div className="absolute bottom-10 -left-20 w-[260px] h-[260px] rounded-full bg-rose-50/20 blur-3xl" />
                </div>

                <div className="relative max-w-sm w-full bg-white border border-rose-100 rounded-[2rem] p-8 shadow-sm space-y-6 z-10 flex flex-col items-center">
                    <div className="relative w-[150px] h-[150px] select-none">
                        <img 
                            src="/mascot.png" 
                            alt="Mascota Arepa Triste" 
                            className="w-full h-full object-contain grayscale opacity-80" 
                        />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-rose-700 tracking-tight">Cuenta Pausada</h2>
                        <p className="text-zinc-650 text-sm font-bold max-w-xs mx-auto leading-snug">
                            Tu cuenta de SyncroCredit ha sido pausada temporalmente.
                        </p>
                        <p className="text-zinc-400 text-xs font-semibold leading-relaxed pt-2">
                            Por favor, comunícate con el comercio o acércate a la caja para más información sobre tu límite de crédito y reactivación.
                        </p>
                    </div>
                    
                    <Button 
                        onClick={handleLogout}
                        className="w-full h-12 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-sm shadow-sm transition-all border-none"
                    >
                        Cerrar Sesión
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#faf9f5] text-zinc-800 font-sans-ui pb-28 animate-in fade-in duration-500 relative overflow-x-clip">
            {animationStyle}

            {/* Header */}
            {!isOrdersListOpen && !isTrackingOpen && (
                <div className="px-6 pt-4 pb-0 mb-4 flex items-center z-50 relative">
                    <span className="text-zinc-850 text-4xl font-handwritten select-none leading-none tracking-normal">
                        {activeTab === "home" && `¡Hola${client ? `, ${client.name.split(" ")[0]}` : ""}!`}
                        {activeTab === "payments" && `¡Aquí tus pagos${client ? `, ${client.name.split(" ")[0]}` : ""}!`}
                        {activeTab === "rewards" && `¡Compra en nuestras tiendas${client ? `, ${client.name.split(" ")[0]}` : ""}!`}
                        {activeTab === "profile" && `¡Tu perfil${client ? `, ${client.name.split(" ")[0]}` : ""}!`}
                        {activeTab === "auth-purchase" && `¡Autoriza tu compra${client ? `, ${client.name.split(" ")[0]}` : ""}!`}
                    </span>
                </div>
            )}

            <main className="max-w-md mx-auto px-6 space-y-4 pt-1">
                
                {/* BANNER MORA */}
                {client?.isSuspended && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl flex items-start gap-3">
                        <IconAlertCircle size={20} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-sm">Pago pendiente</p>
                            <p className="text-xs text-rose-500/80">Tu cuenta está suspendida temporalmente por mora.</p>
                        </div>
                    </div>
                )}

                {requestLoanView ? (
                    <div className="space-y-5 animate-in slide-in-from-right duration-500">
                        {/* Go Back Header */}
                        <div className="flex items-center justify-between pb-2">
                            <Button
                                variant="ghost"
                                onClick={() => setRequestLoanView(false)}
                                className="text-xs text-[#854d0e] hover:text-amber-850 font-extrabold h-8 px-3 rounded-full bg-amber-50 hover:bg-amber-100/60 border border-amber-200/50 flex items-center gap-1 transition-all duration-300"
                            >
                                ← Volver
                            </Button>
                            <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">Solicitud</span>
                        </div>

                        {pendingRequestLoan ? (
                            <div className="bg-white border border-amber-100 rounded-2xl p-6 text-center space-y-5 shadow-sm">
                                <div className="flex justify-center">
                                    <div className="relative flex items-center justify-center size-20 rounded-full bg-amber-50 text-amber-500">
                                        <span className="absolute size-20 rounded-full bg-amber-100 animate-ping opacity-30" />
                                        <IconAlertCircle size={40} className="relative z-10" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-black text-zinc-800">Solicitud en revisión</h3>
                                    <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                                        Tu solicitud de préstamo por <strong className="text-amber-850">${pendingRequestLoan.amount} USD</strong> está siendo evaluada por el comercio.
                                    </p>
                                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-3">
                                        Te notificaremos aquí una vez sea aprobada.
                                    </p>
                                </div>
                                <div className="bg-zinc-50 border border-zinc-150/60 rounded-xl p-4 text-[10px] space-y-1.5 text-left text-zinc-500">
                                    <div className="flex justify-between">
                                        <span>Monto Solicitado:</span>
                                        <span className="font-extrabold text-zinc-700">${pendingRequestLoan.amount.toFixed(2)} USD</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Interés Estimado:</span>
                                        <span className="font-extrabold text-zinc-700">${(pendingRequestLoan.totalToPay - pendingRequestLoan.amount).toFixed(2)} USD</span>
                                    </div>
                                    <div className="flex justify-between border-t border-zinc-200 pt-1.5 mt-1 text-xs">
                                        <span className="font-black text-zinc-800">Total a pagar:</span>
                                        <span className="font-black text-amber-800">${pendingRequestLoan.totalToPay.toFixed(2)} USD</span>
                                    </div>
                                </div>
                            </div>
                        ) : approvedRequestLoan ? (
                            <div className="bg-white border border-emerald-100 rounded-2xl p-6 text-center space-y-5 shadow-sm">
                                <div className="flex justify-center">
                                    <div className="relative flex items-center justify-center size-20 rounded-full bg-emerald-50 text-emerald-500">
                                        <span className="absolute size-20 rounded-full bg-emerald-100 animate-ping opacity-30" />
                                        <IconCheck size={40} className="relative z-10" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-black text-zinc-800">¡Préstamo Aprobado!</h3>
                                    <p className="text-xs text-zinc-550 leading-relaxed font-semibold">
                                        Tu préstamo por <strong className="text-emerald-750">${approvedRequestLoan.amount} USD</strong> ha sido aprobado.
                                    </p>
                                    <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-xl p-4 text-xs font-semibold text-emerald-800 space-y-2 mt-3 leading-tight text-left">
                                        <p>📍 Por favor acércate al negocio o sucursal para desembolsar el dinero en efectivo.</p>
                                        <p>🤝 En la sucursal coordinaremos a cuántas cuotas pagarás tu préstamo y en qué días.</p>
                                    </div>
                                </div>
                                <div className="bg-zinc-50 border border-zinc-150/60 rounded-xl p-4 text-[10px] space-y-1.5 text-left text-zinc-500">
                                    <div className="flex justify-between">
                                        <span>Monto a Entregar:</span>
                                        <span className="font-extrabold text-zinc-700">${approvedRequestLoan.amount.toFixed(2)} USD</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Intereses Semanales (20%):</span>
                                        <span className="font-extrabold text-zinc-700">${(approvedRequestLoan.totalToPay - approvedRequestLoan.amount).toFixed(2)} USD</span>
                                    </div>
                                    <div className="flex justify-between border-t border-zinc-200 pt-1.5 mt-1 text-xs">
                                        <span className="font-black text-zinc-800">Total a devolver:</span>
                                        <span className="font-black text-emerald-700">${approvedRequestLoan.totalToPay.toFixed(2)} USD</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-black text-zinc-850">¿Cuánto dinero necesitas?</h3>
                                    <p className="text-xs text-zinc-400 font-bold max-w-xs mx-auto leading-tight">
                                        Como cliente Nivel 1, puedes solicitar préstamos rápidos en efectivo.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {[20, 30, 40, 50].map((amt) => {
                                        const interest = amt * 0.20;
                                        const total = amt + interest;
                                        const isSelected = selectedAmount === amt;
                                        return (
                                            <div
                                                key={amt}
                                                onClick={() => setSelectedAmount(amt)}
                                                className={`rounded-2xl p-5 border text-center cursor-pointer transition-all duration-300 flex flex-col justify-between space-y-3 ${
                                                    isSelected
                                                        ? 'bg-gradient-to-b from-white to-amber-50/15 border-amber-400 shadow-md shadow-amber-500/5'
                                                        : 'bg-white border-zinc-150 hover:border-zinc-200'
                                                }`}
                                            >
                                                <div className="space-y-1">
                                                    <p className="text-xs text-zinc-450 font-bold uppercase tracking-wider">Monto</p>
                                                    <p className="text-3xl font-black text-zinc-850">${amt}</p>
                                                </div>
                                                <div className="border-t border-zinc-100 pt-2.5 space-y-1 text-[9px] text-zinc-400 font-bold text-left">
                                                    <div className="flex justify-between">
                                                        <span>Interés (20%):</span>
                                                        <span className="text-zinc-650">${interest.toFixed(0)} USD</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] font-extrabold text-amber-805">
                                                        <span>Total:</span>
                                                        <span>${total.toFixed(0)} USD</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="bg-[#fffdf4] border border-amber-100/60 p-4 rounded-xl flex items-start gap-3">
                                    <IconInfoCircle size={18} className="text-amber-700 shrink-0 mt-0.5" />
                                    <div className="space-y-0.5 text-[10px] text-zinc-500 leading-normal font-semibold">
                                        <p className="font-bold text-[#854d0e] uppercase tracking-wider">Información Importante</p>
                                        <p>• Los préstamos se entregan en efectivo dólares (USD) en la sucursal.</p>
                                        <p>• La tasa cobrada es del 20% semanal.</p>
                                        <p>• Al retirar acordarás el número de cuotas y fechas de pago.</p>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleRequestLoan}
                                    disabled={!selectedAmount || submittingRequest}
                                    className="w-full h-13 rounded-full bg-[#fef3c7] hover:bg-[#fde68a] text-[#854d0e] font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none mt-2"
                                >
                                    {submittingRequest ? "Enviando solicitud..." : `Solicitar $${selectedAmount} USD`}
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* TAB 1: HOME */}
                        {activeTab === "home" && (
                    <div className="space-y-5 animate-in slide-in-from-bottom duration-500">
                        
                        {/* PREMIUM CREDITO CARD */}
                        <div className="w-full flex flex-col items-center justify-center text-center pt-1 pb-3 relative">
                            <div className="z-10 relative w-full flex flex-col items-center justify-center">
                                <ChartContainer
                                    config={chartConfig}
                                    className="mx-auto aspect-square w-full max-w-[360px]"
                                >
                                    <RadialBarChart
                                        data={chartData}
                                        startAngle={90}
                                        endAngle={-270}
                                        innerRadius={130}
                                        outerRadius={155}
                                    >
                                        <PolarGrid
                                            gridType="circle"
                                            radialLines={false}
                                            stroke="none"
                                            className="first:fill-zinc-200 last:fill-[#faf9f5]"
                                            polarRadius={[155, 130]}
                                        />
                                        <PolarAngleAxis
                                            type="number"
                                            domain={[0, 100]}
                                            tick={false}
                                        />
                                        <RadialBar dataKey="value" background={false} cornerRadius={18} />
                                        <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                                            <RechartsLabel
                                                content={({ viewBox }) => {
                                                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                                        return (
                                                            <text
                                                                x={viewBox.cx}
                                                                y={viewBox.cy}
                                                                textAnchor="middle"
                                                                dominantBaseline="middle"
                                                            >
                                                                <tspan
                                                                    x={viewBox.cx}
                                                                    y={viewBox.cy - 18}
                                                                    className="fill-zinc-400 text-[11px] font-black uppercase tracking-wider"
                                                                >
                                                                    Crédito Disponible
                                                                </tspan>
                                                                <tspan
                                                                    x={viewBox.cx}
                                                                    y={(viewBox.cy || 0) + 18}
                                                                    className="fill-zinc-800 text-4xl font-black"
                                                                >
                                                                    ${availableCredit.toFixed(2)}
                                                                </tspan>
                                                            </text>
                                                        )
                                                    }
                                                }}
                                            />
                                        </PolarRadiusAxis>
                                    </RadialBarChart>
                                </ChartContainer>
                                {/* Credit info strip below radial — premium cards */}
                                <div className="grid grid-cols-3 gap-2 mt-4 w-full">
                                    <div className="rounded-2xl bg-white border border-zinc-100 shadow-sm p-3 flex flex-col items-center gap-0.5">
                                        <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest">Límite</p>
                                        <p className="text-lg font-black text-zinc-800">${creditLimit.toFixed(0)}</p>
                                    </div>
                                    <div className="rounded-2xl bg-white border border-zinc-100 shadow-sm p-3 flex flex-col items-center gap-0.5">
                                        <p className="text-[8px] text-rose-500/90 font-black uppercase tracking-widest">Usado</p>
                                        <p className="text-lg font-black text-rose-600">${(client?.currentDebt || 0).toFixed(0)}</p>
                                    </div>
                                    <div className="rounded-2xl bg-white border border-zinc-100 shadow-sm p-3 flex flex-col items-center gap-0.5">
                                        <p className="text-[8px] text-emerald-500/90 font-black uppercase tracking-widest">Libre</p>
                                        <p className="text-lg font-black text-emerald-600">${availableCredit.toFixed(0)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PAYMENT CALENDAR SLIDER */}
                        {client?.currentDebt > 0 && (() => {
                            const allDueDates: Date[] = (debts || [])
                                .flatMap((debt: any) =>
                                    (debt.installments || []).filter((i: any) => i.status === 'PENDING').map((i: any) => new Date(i.dueDate))
                                )
                                .sort((a: Date, b: Date) => a.getTime() - b.getTime());

                            const today = new Date();

                            const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                            const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

                            const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                            const dueDaySet = new Set(
                                allDueDates
                                    .filter(d => d.getMonth() === calMonth && d.getFullYear() === calYear)
                                    .map(d => d.getDate())
                            );

                            const prevMonth = () => {
                                if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                                else setCalMonth(m => m - 1);
                            };
                            const nextMonth = () => {
                                if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                                else setCalMonth(m => m + 1);
                            };

                            const days = Array.from({ length: daysInMonth }, (_, i) => {
                                const dayNum = i + 1;
                                const date = new Date(calYear, calMonth, dayNum);
                                const dayName = dayNames[date.getDay()];
                                const isPay = dueDaySet.has(dayNum);
                                const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                const isToday = date.toDateString() === today.toDateString();
                                return { dayNum, dayName, isPay, isPast, isToday };
                            });

                            return (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <p className="text-base font-black text-zinc-800">Tus próximos pagos</p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={prevMonth}
                                                className="size-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-amber-50 hover:border-amber-200 transition-all duration-200 text-sm font-black"
                                            >‹</button>
                                            <span className="text-sm font-black text-zinc-700 min-w-[90px] text-center">{monthNames[calMonth]} {calYear}</span>
                                            <button
                                                onClick={nextMonth}
                                                className="size-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-amber-50 hover:border-amber-200 transition-all duration-200 text-sm font-black"
                                            >›</button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto pb-3" style={{scrollbarWidth:'none'}}>
                                        <div className="flex gap-3" style={{width: 'max-content'}}>
                                            {days.map(({ dayNum, dayName, isPay, isPast, isToday }) => (
                                                <div
                                                    key={dayNum}
                                                    className={`flex flex-col items-center justify-center rounded-xl min-w-[90px] h-[100px] px-3 gap-1 transition-all duration-200 select-none ${
                                                        isPay
                                                            ? isPast
                                                                ? 'bg-rose-50 border-2 border-rose-400 shadow-md shadow-rose-100'
                                                                : 'bg-amber-50 border-2 border-amber-400 shadow-md shadow-amber-100'
                                                            : isToday
                                                            ? 'bg-zinc-800 shadow-md'
                                                            : 'bg-white border border-zinc-100 shadow-sm'
                                                    }`}
                                                >
                                                    <span className={`text-xs font-black uppercase tracking-widest ${
                                                        isPay
                                                            ? isPast ? 'text-rose-400' : 'text-amber-500'
                                                            : isToday ? 'text-white/70' : 'text-zinc-400'
                                                    }`}>{dayName}</span>
                                                    <span className={`text-4xl font-black leading-none ${
                                                        isPay
                                                            ? isPast ? 'text-rose-500' : 'text-amber-600'
                                                            : isToday ? 'text-white' : isPast ? 'text-zinc-200' : 'text-zinc-700'
                                                    }`}>{dayNum}</span>
                                                    {isPay && (
                                                        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                            isPast ? 'bg-rose-100 text-rose-500' : 'bg-amber-200 text-amber-700'
                                                        }`}>
                                                            {isPast ? 'Vencida' : 'Cuota'}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {dueDaySet.size === 0 && (
                                        <p className="text-center text-xs text-zinc-400 font-bold py-2">Sin pagos en {monthNames[calMonth]}</p>
                                    )}
                                </div>
                            );
                        })()}

                        {/* ACTIVE LOANS — hidden (cash loans paused) */}
                        {/* loans feature commented until re-enabled */}
                    </div>
                )}

                {/* TAB 2: PAYMENTS */}
                {activeTab === "payments" && (
                    selectedDebtForPayment ? (
                        <div className="space-y-5 animate-in slide-in-from-right duration-500">
                            {/* Go Back Header */}
                            <div className="flex items-center justify-between pb-2">
                                <button
                                    onClick={() => {
                                        setSelectedDebtForPayment(null);
                                        setPaymentStep("details");
                                    }}
                                    className="text-xs text-[#854d0e] hover:text-amber-850 font-extrabold h-8 px-3 rounded-full bg-amber-50 hover:bg-amber-100/60 border border-amber-200/50 flex items-center gap-1 transition-all duration-300"
                                >
                                    ← Volver
                                </button>
                                <span className="text-xs font-black uppercase text-zinc-400 tracking-wider">
                                    {paymentStep === "details" && "Detalles de Deuda"}
                                    {paymentStep === "pago_movil" && "Pago Móvil"}
                                    {paymentStep === "binance" && "Binance Pay"}
                                    {paymentStep === "zinli" && "Zinli"}
                                    {paymentStep === "paypal" && "PayPal"}
                                    {paymentStep === "upload" && "Comprobante"}
                                    {paymentStep === "pending" && "Estado de Abono"}
                                </span>
                            </div>

                            {/* STEP 1: DETAILS */}
                            {paymentStep === "details" && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl bg-white border border-zinc-100 p-5 space-y-4 shadow-sm animate-in fade-in duration-300">
                                        <div className="flex justify-between items-start border-b border-zinc-50 pb-3">
                                            <div>
                                                <h3 className="text-sm font-black text-zinc-805">
                                                    {selectedDebtForPayment.description || "Compra a crédito"}
                                                </h3>
                                                <p className="text-[10px] text-zinc-400 font-bold">
                                                    Realizada el {new Date(selectedDebtForPayment.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-zinc-400 font-bold">Monto Pendiente</p>
                                                <p className="text-xl font-black text-zinc-950 font-mono">${selectedDebtForPayment.remainingBalance.toFixed(2)}</p>
                                            </div>
                                        </div>

                                        {selectedDebtForPayment.items && selectedDebtForPayment.items.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[9px] font-bold text-zinc-450 uppercase tracking-wider">Productos adquiridos</p>
                                                <div className="space-y-1.5">
                                                    {selectedDebtForPayment.items.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between items-center text-xs text-zinc-650">
                                                            <span>{item.quantity}x {item.name}</span>
                                                            <span className="font-bold text-zinc-700">${(item.price * item.quantity).toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Selector de Cuotas a Pagar */}
                                    <div className="space-y-3 animate-in fade-in duration-300">
                                        <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">¿Cuánto deseas abonar?</h4>
                                        <div className="space-y-2.5">
                                            {(() => {
                                                const pendingInsts = (selectedDebtForPayment.installments && selectedDebtForPayment.installments.length > 0)
                                                    ? (selectedDebtForPayment.installments || [])
                                                        .filter((i: any) => i.status === 'PENDING')
                                                        .map((i: any) => ({
                                                            ...i,
                                                            remaining: i.remaining !== undefined ? i.remaining : (i.amount - i.paidAmount)
                                                        }))
                                                        .filter((i: any) => i.remaining > 0)
                                                    : [{
                                                        id: `virtual-${selectedDebtForPayment.loanId}`,
                                                        number: 1,
                                                        dueDate: selectedDebtForPayment.nextPaymentDate || selectedDebtForPayment.createdAt,
                                                        amount: selectedDebtForPayment.remainingBalance,
                                                        paidAmount: 0,
                                                        remaining: selectedDebtForPayment.remainingBalance,
                                                        status: 'PENDING'
                                                    }];

                                                const sortedPendingInsts = [...pendingInsts].sort((a, b) => {
                                                    if (a.number !== b.number) return a.number - b.number;
                                                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                                                });

                                                const options = [];
                                                const limit = sortedPendingInsts.length;
                                                let accumulatedAmount = 0;
                                                for (let k = 1; k <= limit; k++) {
                                                    accumulatedAmount += sortedPendingInsts[k - 1].remaining;
                                                    options.push({
                                                        type: k,
                                                        label: `Pagar ${k} cuota${k > 1 ? "s" : ""}`,
                                                        amount: accumulatedAmount
                                                    });
                                                }

                                                return (
                                                    <>
                                                        {options.map((opt) => {
                                                            const isSelected = selectedInstallmentOption === opt.type;
                                                            return (
                                                                <div
                                                                    key={opt.type}
                                                                    onClick={() => {
                                                                        setSelectedInstallmentOption(opt.type);
                                                                        setPaymentAmount(opt.amount.toFixed(2));
                                                                    }}
                                                                    className={`rounded-2xl p-4 border cursor-pointer transition-all duration-300 flex justify-between items-center ${
                                                                        isSelected
                                                                            ? "bg-[#fffdf4] border-amber-400 shadow-sm text-zinc-900 font-extrabold"
                                                                            : "bg-white border-zinc-100 hover:border-zinc-200 text-zinc-700 font-medium"
                                                                    }`}
                                                                >
                                                                    <div className="flex flex-col text-left">
                                                                        <span className="text-xs font-black uppercase tracking-tight">{opt.label}</span>
                                                                        <span className="text-[10px] text-zinc-400 font-bold mt-0.5">
                                                                            Abono de cuotas pendientes
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-sm font-black font-mono text-zinc-800">${opt.amount.toFixed(2)}</span>
                                                                </div>
                                                            );
                                                        })}

                                                        {/* Custom option */}
                                                        <div
                                                            onClick={() => {
                                                                setSelectedInstallmentOption("custom");
                                                                setPaymentAmount("");
                                                            }}
                                                            className={`rounded-2xl p-4 border cursor-pointer transition-all duration-300 flex justify-between items-center ${
                                                                selectedInstallmentOption === "custom"
                                                                    ? "bg-[#fffdf4] border-amber-400 shadow-sm text-zinc-900 font-extrabold"
                                                                    : "bg-white border-zinc-100 hover:border-zinc-200 text-zinc-700 font-medium"
                                                            }`}
                                                        >
                                                            <div className="flex flex-col text-left">
                                                                <span className="text-xs font-black uppercase tracking-tight">Otro monto</span>
                                                                <span className="text-[10px] text-zinc-400 font-bold mt-0.5">
                                                                    Ingresa una cantidad personalizada
                                                                </span>
                                                            </div>
                                                            <span className="text-xs font-bold text-amber-700">Editar →</span>
                                                        </div>

                                                        {/* Custom Amount Input field */}
                                                        {selectedInstallmentOption === "custom" && (
                                                            <div className="rounded-2xl bg-white border border-zinc-150 p-4 space-y-3 animate-in slide-in-from-top duration-300 text-center">
                                                                <p className="text-[10px] font-black uppercase text-zinc-450 tracking-wider">Monto Personalizado (USD)</p>
                                                                <div className="relative max-w-[180px] mx-auto">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-black text-zinc-400">$</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min="0.01"
                                                                        max={selectedDebtForPayment.remainingBalance}
                                                                        value={paymentAmount}
                                                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                                                        placeholder="0.00"
                                                                        className="w-full text-center text-2xl font-black text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl h-11 pl-7 focus-visible:outline-none focus-visible:border-amber-300 font-mono"
                                                                    />
                                                                </div>
                                                                {(() => {
                                                                    const amt = parseFloat(paymentAmount) || 0;
                                                                    if (amt <= 0 && paymentAmount !== "") {
                                                                        return <p className="text-[9px] text-rose-600 font-bold">El monto debe ser mayor a 0</p>;
                                                                    }
                                                                    if (amt > selectedDebtForPayment.remainingBalance + 0.005) {
                                                                        return <p className="text-[9px] text-rose-600 font-bold">No puede superar la deuda de ${selectedDebtForPayment.remainingBalance.toFixed(2)}</p>;
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Select Payment Method */}
                                    {(() => {
                                        const amt = parseFloat(paymentAmount) || 0;
                                        const isSelectionValid = selectedInstallmentOption !== null && 
                                            (selectedInstallmentOption !== "custom" || (amt > 0 && amt <= selectedDebtForPayment.remainingBalance + 0.005));
                                        
                                        if (!isSelectionValid) return null;

                                        const enabledMethods = [
                                            settings?.pagoMovilEnabled && {
                                                key: "pago_movil",
                                                label: "Pago Móvil",
                                                desc: "Transferencia interbancaria rápida (Bs)",
                                                icon: <IconDeviceMobile size={22} />,
                                                color: "amber",
                                                iconBg: "bg-amber-500/10 text-amber-700",
                                                border: "border-amber-200/60 hover:border-amber-300",
                                                arrow: "text-amber-700",
                                                bg: "bg-gradient-to-br from-[#fffdf4] via-[#fffbeb] to-amber-50/30",
                                            },
                                            settings?.binanceEnabled && {
                                                key: "binance",
                                                label: "Binance Pay",
                                                desc: "Pago con criptomonedas (USDT)",
                                                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L8.5 5.5 10.5 7.5 12 6l1.5 1.5 2-2L12 2zm-4 4L6 8l2 2 2-2-2-2zm8 0l-2 2 2 2 2-2-2-2zM12 10l-2 2 2 2 2-2-2-2zm-4 4l-2 2 2 2 2-2-2-2zm8 0l-2 2 2 2 2-2-2-2zM12 18l-1.5 1.5-2-2L12 22l3.5-4.5-2 2L12 18z"/></svg>,
                                                color: "yellow",
                                                iconBg: "bg-yellow-400/10 text-yellow-600",
                                                border: "border-yellow-200/60 hover:border-yellow-300",
                                                arrow: "text-yellow-600",
                                                bg: "bg-gradient-to-br from-[#fffef4] via-[#fefce8] to-yellow-50/30",
                                            },
                                            settings?.zinliEnabled && {
                                                key: "zinli",
                                                label: "Zinli",
                                                desc: "Billetera digital panameña (USD)",
                                                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
                                                color: "purple",
                                                iconBg: "bg-purple-500/10 text-purple-600",
                                                border: "border-purple-200/60 hover:border-purple-300",
                                                arrow: "text-purple-600",
                                                bg: "bg-gradient-to-br from-[#fdf4ff] via-[#faf5ff] to-purple-50/30",
                                            },
                                            settings?.paypalEnabled && {
                                                key: "paypal",
                                                label: "PayPal",
                                                desc: "Pagos internacionales en USD",
                                                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 0 0-.794.68l-.04.22-.63 3.993-.032.17a.804.804 0 0 1-.794.679H7.72a.483.483 0 0 1-.477-.558L7.418 21h1.518l.95-6.02h1.385c4.678 0 7.75-2.203 8.796-6.502zm-2.96-5.09c.762.868.983 1.81.73 3.138C17 10.325 14.913 12 11.589 12H9.52a.805.805 0 0 0-.795.68l-.217 1.375H6.862a.483.483 0 0 1-.476-.557l1.3-8.25A.805.805 0 0 1 8.48 4.57h5.057c1.174 0 2.152.313 2.57.818z"/></svg>,
                                                color: "blue",
                                                iconBg: "bg-blue-600/10 text-blue-700",
                                                border: "border-blue-200/60 hover:border-blue-300",
                                                arrow: "text-blue-700",
                                                bg: "bg-gradient-to-br from-[#f4f8ff] via-[#eff6ff] to-blue-50/30",
                                            },
                                        ].filter(Boolean) as any[];

                                        if (enabledMethods.length === 0) return (
                                            <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-5 text-center animate-in fade-in duration-300">
                                                <p className="text-xs text-zinc-500 font-semibold">No hay métodos de pago disponibles en este momento.</p>
                                            </div>
                                        );

                                        return (
                                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom duration-300">
                                                <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Selecciona Método de Pago</h4>
                                                {enabledMethods.map((method) => (
                                                    <button
                                                        key={method.key}
                                                        onClick={() => {
                                                            if (method.key === "pago_movil") {
                                                                // Pre-fill Bs amount from current USD amount
                                                                const rate = settings?.exchangeRate || 1;
                                                                const bsPre = (parseFloat(paymentAmount) || 0) * rate;
                                                                setPaymentAmountBs(bsPre > 0 ? bsPre.toFixed(2) : "");
                                                            }
                                                            setPaymentStep(method.key);
                                                        }}
                                                        className={`w-full flex items-center justify-between p-4 rounded-2xl ${method.bg} border ${method.border} shadow-sm transition-all text-left`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`size-10 rounded-xl ${method.iconBg} flex items-center justify-center`}>
                                                                {method.icon}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-zinc-800 uppercase tracking-tight">{method.label}</p>
                                                                <p className="text-[10px] text-zinc-500 font-medium mt-0.5">{method.desc}</p>
                                                            </div>
                                                        </div>
                                                        <IconChevronRight size={18} className={method.arrow} />
                                                    </button>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* STEP 2: PAGO MOVIL */}
                            {paymentStep === "pago_movil" && (
                                <div className="space-y-4">
                                    {/* Business Pago Movil Card */}
                                    <div className="rounded-2xl bg-gradient-to-br from-[#fffdf4] via-[#fffbeb] to-amber-50/30 border border-amber-200/50 p-5 space-y-4 shadow-sm animate-in fade-in duration-300">
                                        <div className="flex items-center gap-2 border-b border-zinc-100/60 pb-3">
                                            <IconDeviceMobile size={18} className="text-amber-700" />
                                            <h3 className="text-xs font-black uppercase text-zinc-700 tracking-wider">Pago Móvil del Comercio</h3>
                                        </div>
                                        {settings?.pagoMovilEnabled ? (
                                            <div className="grid grid-cols-2 gap-4 text-xs">
                                                <div>
                                                    <p className="text-zinc-455 text-[9px] font-bold uppercase tracking-wider">Banco</p>
                                                    <p className="font-extrabold text-zinc-700 mt-0.5">{settings.pagoMovilBank}</p>
                                                </div>
                                                <div>
                                                    <p className="text-zinc-455 text-[9px] font-bold uppercase tracking-wider">Cédula / RIF</p>
                                                    <div className="flex items-center gap-1 cursor-pointer mt-0.5" onClick={() => copyToClipboard(settings.pagoMovilId, "Cédula")}>
                                                        <p className="font-extrabold text-amber-700">{settings.pagoMovilId}</p>
                                                        <IconCopy size={12} className="text-zinc-400" />
                                                    </div>
                                                </div>
                                                <div className="col-span-2">
                                                    <p className="text-zinc-455 text-[9px] font-bold uppercase tracking-wider">Teléfono de Pago</p>
                                                    <div className="flex items-center gap-1 cursor-pointer mt-0.5" onClick={() => copyToClipboard(settings.pagoMovilPhone, "Teléfono")}>
                                                        <p className="font-black text-amber-700 text-base">{settings.pagoMovilPhone}</p>
                                                        <IconCopy size={12} className="text-zinc-400" />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-zinc-455 font-bold text-center py-2">
                                                El comercio no tiene habilitado Pago Móvil actualmente.
                                            </p>
                                        )}
                                    </div>

                                    {/* Amount in Bs (primary) with USD conversion */}
                                    <div className="rounded-2xl bg-white border border-zinc-100 p-5 space-y-4 shadow-sm text-center animate-in fade-in duration-300">
                                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Monto a Transferir (Bs)</p>
                                        <div className="relative max-w-[220px] mx-auto">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-black text-zinc-400">Bs</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                value={paymentAmountBs}
                                                onChange={(e) => {
                                                    const bsVal = e.target.value;
                                                    setPaymentAmountBs(bsVal);
                                                    // Derive USD from Bs for submission/validation
                                                    const rate = settings?.exchangeRate || 1;
                                                    const usdDerived = parseFloat(bsVal) / rate;
                                                    setPaymentAmount(isNaN(usdDerived) ? "" : usdDerived.toFixed(4));
                                                }}
                                                className="w-full text-center text-3xl font-black text-zinc-800 bg-zinc-50 border border-zinc-100 rounded-xl h-14 pl-10 focus-visible:outline-none focus-visible:border-amber-300 font-mono"
                                            />
                                        </div>
                                        {/* USD equivalent & rate info */}
                                        {(() => {
                                            const bsAmt = parseFloat(paymentAmountBs) || 0;
                                            const rate = settings?.exchangeRate || 1;
                                            const usdAmt = bsAmt / rate;
                                            return (
                                                <div className="space-y-1">
                                                    <p className="text-[11px] text-amber-800 font-black bg-amber-50 border border-amber-100/50 px-3 py-1.5 rounded-full inline-block">
                                                        Tasa BCV: {rate.toFixed(2)} Bs = $1 USD
                                                    </p>
                                                    {bsAmt > 0 && (
                                                        <p className="text-[11px] text-zinc-500 font-semibold">
                                                            Equivalente: <strong className="text-zinc-700">${usdAmt.toFixed(2)} USD</strong>
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* Validation error msg */}
                                        {(() => {
                                            const bsAmt = parseFloat(paymentAmountBs) || 0;
                                            const rate = settings?.exchangeRate || 1;
                                            const usdAmt = bsAmt / rate;
                                            if (bsAmt <= 0 && paymentAmountBs !== "") {
                                                return <p className="text-[10px] text-rose-600 font-bold">El monto debe ser mayor a 0</p>;
                                            }
                                            if (bsAmt > 0 && usdAmt > selectedDebtForPayment.remainingBalance + 0.005) {
                                                const maxBs = selectedDebtForPayment.remainingBalance * rate;
                                                return <p className="text-[10px] text-rose-600 font-bold">El máximo es {maxBs.toFixed(2)} Bs (${selectedDebtForPayment.remainingBalance.toFixed(2)} USD)</p>;
                                            }
                                            return null;
                                        })()}

                                        <Button
                                            onClick={() => setPaymentStep("upload")}
                                            disabled={(() => {
                                                const bsAmt = parseFloat(paymentAmountBs) || 0;
                                                const rate = settings?.exchangeRate || 1;
                                                const usdAmt = bsAmt / rate;
                                                return !paymentAmountBs || bsAmt <= 0 || usdAmt > selectedDebtForPayment.remainingBalance + 0.005;
                                            })()}
                                            className="w-full h-12 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none mt-2"
                                        >
                                            Ya pagué
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2b: BINANCE PAY */}
                            {paymentStep === "binance" && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl bg-gradient-to-br from-[#fffef4] via-[#fefce8] to-yellow-50/30 border border-yellow-200/50 p-5 space-y-4 shadow-sm animate-in fade-in duration-300">
                                        <div className="flex items-center gap-2 border-b border-zinc-100/60 pb-3">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-600"><path d="M12 2L8.5 5.5 10.5 7.5 12 6l1.5 1.5 2-2L12 2zm-4 4L6 8l2 2 2-2-2-2zm8 0l-2 2 2 2 2-2-2-2zM12 10l-2 2 2 2 2-2-2-2zm-4 4l-2 2 2 2 2-2-2-2zm8 0l-2 2 2 2 2-2-2-2zM12 18l-1.5 1.5-2-2L12 22l3.5-4.5-2 2L12 18z"/></svg>
                                            <h3 className="text-xs font-black uppercase text-zinc-700 tracking-wider">Datos de Binance Pay</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 text-xs">
                                            {settings?.binanceId && (
                                                <div>
                                                    <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">Binance ID</p>
                                                    <div className="flex items-center gap-1 cursor-pointer mt-0.5" onClick={() => copyToClipboard(settings.binanceId, "Binance ID")}>
                                                        <p className="font-extrabold text-yellow-700">{settings.binanceId}</p>
                                                        <IconCopy size={12} className="text-zinc-400" />
                                                    </div>
                                                </div>
                                            )}
                                            {settings?.binanceEmail && (
                                                <div>
                                                    <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">Correo de la Cuenta</p>
                                                    <div className="flex items-center gap-1 cursor-pointer mt-0.5" onClick={() => copyToClipboard(settings.binanceEmail, "Correo Binance")}>
                                                        <p className="font-extrabold text-yellow-700">{settings.binanceEmail}</p>
                                                        <IconCopy size={12} className="text-zinc-400" />
                                                    </div>
                                                </div>
                                            )}
                                            {!settings?.binanceId && !settings?.binanceEmail && (
                                                <p className="text-xs text-zinc-500 font-bold text-center py-2">El comercio no ha configurado sus datos de Binance Pay.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Editable Amount */}
                                    <div className="rounded-2xl bg-white border border-zinc-100 p-5 space-y-4 shadow-sm text-center animate-in fade-in duration-300">
                                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Monto a Abonar (USD)</p>
                                        <div className="relative max-w-[200px] mx-auto">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-black text-zinc-400">$</span>
                                            <input
                                                type="number" step="0.01" min="0.01"
                                                max={selectedDebtForPayment.remainingBalance}
                                                value={paymentAmount}
                                                onChange={(e) => setPaymentAmount(e.target.value)}
                                                className="w-full text-center text-3xl font-black text-zinc-800 bg-zinc-50 border border-zinc-100 rounded-xl h-14 pl-8 focus-visible:outline-none focus-visible:border-yellow-300 font-mono"
                                            />
                                        </div>
                                        {(() => {
                                            const amt = parseFloat(paymentAmount) || 0;
                                            if (amt <= 0) return <p className="text-[10px] text-rose-600 font-bold">El monto debe ser mayor a 0</p>;
                                            if (amt > selectedDebtForPayment.remainingBalance + 0.005) return <p className="text-[10px] text-rose-600 font-bold">El monto no puede superar la deuda de ${selectedDebtForPayment.remainingBalance.toFixed(2)}</p>;
                                            return null;
                                        })()}
                                        <Button
                                            onClick={() => setPaymentStep("upload")}
                                            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > selectedDebtForPayment.remainingBalance + 0.005}
                                            className="w-full h-12 rounded-full bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none mt-2"
                                        >
                                            Ya pagué
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2c: ZINLI */}
                            {paymentStep === "zinli" && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl bg-gradient-to-br from-[#fdf4ff] via-[#faf5ff] to-purple-50/30 border border-purple-200/50 p-5 space-y-4 shadow-sm animate-in fade-in duration-300">
                                        <div className="flex items-center gap-2 border-b border-zinc-100/60 pb-3">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                            <h3 className="text-xs font-black uppercase text-zinc-700 tracking-wider">Datos de Zinli</h3>
                                        </div>
                                        <div className="text-xs">
                                            {settings?.zinliEmail ? (
                                                <div>
                                                    <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">Correo Zinli</p>
                                                    <div className="flex items-center gap-1 cursor-pointer mt-0.5" onClick={() => copyToClipboard(settings.zinliEmail, "Correo Zinli")}>
                                                        <p className="font-black text-purple-700 text-base">{settings.zinliEmail}</p>
                                                        <IconCopy size={12} className="text-zinc-400" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-zinc-500 font-bold text-center py-2">El comercio no ha configurado su correo de Zinli.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Editable Amount */}
                                    <div className="rounded-2xl bg-white border border-zinc-100 p-5 space-y-4 shadow-sm text-center animate-in fade-in duration-300">
                                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Monto a Abonar (USD)</p>
                                        <div className="relative max-w-[200px] mx-auto">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-black text-zinc-400">$</span>
                                            <input
                                                type="number" step="0.01" min="0.01"
                                                max={selectedDebtForPayment.remainingBalance}
                                                value={paymentAmount}
                                                onChange={(e) => setPaymentAmount(e.target.value)}
                                                className="w-full text-center text-3xl font-black text-zinc-800 bg-zinc-50 border border-zinc-100 rounded-xl h-14 pl-8 focus-visible:outline-none focus-visible:border-purple-300 font-mono"
                                            />
                                        </div>
                                        {(() => {
                                            const amt = parseFloat(paymentAmount) || 0;
                                            if (amt <= 0) return <p className="text-[10px] text-rose-600 font-bold">El monto debe ser mayor a 0</p>;
                                            if (amt > selectedDebtForPayment.remainingBalance + 0.005) return <p className="text-[10px] text-rose-600 font-bold">El monto no puede superar la deuda de ${selectedDebtForPayment.remainingBalance.toFixed(2)}</p>;
                                            return null;
                                        })()}
                                        <Button
                                            onClick={() => setPaymentStep("upload")}
                                            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > selectedDebtForPayment.remainingBalance + 0.005}
                                            className="w-full h-12 rounded-full bg-purple-500 hover:bg-purple-600 text-white font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none mt-2"
                                        >
                                            Ya pagué
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2d: PAYPAL */}
                            {paymentStep === "paypal" && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl bg-gradient-to-br from-[#f4f8ff] via-[#eff6ff] to-blue-50/30 border border-blue-200/50 p-5 space-y-4 shadow-sm animate-in fade-in duration-300">
                                        <div className="flex items-center gap-2 border-b border-zinc-100/60 pb-3">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-blue-700"><path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 0 0-.794.68l-.04.22-.63 3.993-.032.17a.804.804 0 0 1-.794.679H7.72a.483.483 0 0 1-.477-.558L7.418 21h1.518l.95-6.02h1.385c4.678 0 7.75-2.203 8.796-6.502zm-2.96-5.09c.762.868.983 1.81.73 3.138C17 10.325 14.913 12 11.589 12H9.52a.805.805 0 0 0-.795.68l-.217 1.375H6.862a.483.483 0 0 1-.476-.557l1.3-8.25A.805.805 0 0 1 8.48 4.57h5.057c1.174 0 2.152.313 2.57.818z"/></svg>
                                            <h3 className="text-xs font-black uppercase text-zinc-700 tracking-wider">Datos de PayPal</h3>
                                        </div>
                                        <div className="text-xs">
                                            {settings?.paypalEmail ? (
                                                <div>
                                                    <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">Correo PayPal</p>
                                                    <div className="flex items-center gap-1 cursor-pointer mt-0.5" onClick={() => copyToClipboard(settings.paypalEmail, "Correo PayPal")}>
                                                        <p className="font-black text-blue-700 text-base">{settings.paypalEmail}</p>
                                                        <IconCopy size={12} className="text-zinc-400" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-zinc-500 font-bold text-center py-2">El comercio no ha configurado su correo de PayPal.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Editable Amount */}
                                    <div className="rounded-2xl bg-white border border-zinc-100 p-5 space-y-4 shadow-sm text-center animate-in fade-in duration-300">
                                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Monto a Abonar (USD)</p>
                                        <div className="relative max-w-[200px] mx-auto">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-black text-zinc-400">$</span>
                                            <input
                                                type="number" step="0.01" min="0.01"
                                                max={selectedDebtForPayment.remainingBalance}
                                                value={paymentAmount}
                                                onChange={(e) => setPaymentAmount(e.target.value)}
                                                className="w-full text-center text-3xl font-black text-zinc-800 bg-zinc-50 border border-zinc-100 rounded-xl h-14 pl-8 focus-visible:outline-none focus-visible:border-blue-300 font-mono"
                                            />
                                        </div>
                                        {(() => {
                                            const amt = parseFloat(paymentAmount) || 0;
                                            if (amt <= 0) return <p className="text-[10px] text-rose-600 font-bold">El monto debe ser mayor a 0</p>;
                                            if (amt > selectedDebtForPayment.remainingBalance + 0.005) return <p className="text-[10px] text-rose-600 font-bold">El monto no puede superar la deuda de ${selectedDebtForPayment.remainingBalance.toFixed(2)}</p>;
                                            return null;
                                        })()}
                                        <Button
                                            onClick={() => setPaymentStep("upload")}
                                            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > selectedDebtForPayment.remainingBalance + 0.005}
                                            className="w-full h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none mt-2"
                                        >
                                            Ya pagué
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: UPLOAD RECEIPT */}
                            {paymentStep === "upload" && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl bg-white border border-zinc-100 p-5 space-y-4 shadow-sm text-center animate-in fade-in duration-300">
                                        <h3 className="text-sm font-black text-zinc-800">Cargar Comprobante de Pago</h3>
                                        <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
                                            Sube una captura de pantalla o foto del comprobante de pago para verificar tu transacción de <strong className="text-zinc-700">${parseFloat(paymentAmount).toFixed(2)} USD</strong>.
                                        </p>

                                        {/* Dropzone/File input area */}
                                        <div className="relative border-2 border-dashed border-zinc-200 rounded-xl p-6 hover:border-amber-400 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer bg-zinc-50/50">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setReceiptFile(file);
                                                        setReceiptPreview(URL.createObjectURL(file));
                                                    }
                                                }}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                            {receiptPreview ? (
                                                <div className="space-y-2 w-full">
                                                    <img src={receiptPreview} alt="Comprobante" className="max-h-48 mx-auto rounded-lg object-contain border border-zinc-100" />
                                                    <p className="text-[10px] text-zinc-400 font-bold truncate">{receiptFile?.name}</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="size-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-700">
                                                        <IconCamera size={20} />
                                                    </div>
                                                    <p className="text-xs font-black text-zinc-655">Subir foto del comprobante</p>
                                                    <p className="text-[10px] text-zinc-450 font-bold">Formatos permitidos: JPG, PNG</p>
                                                </>
                                            )}
                                        </div>

                                        {/* Reference Number Input */}
                                        <div className="w-full space-y-1 text-left">
                                            <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">N° de Referencia (opcional)</label>
                                            <input
                                                type="text"
                                                value={receiptReference}
                                                onChange={(e) => setReceiptReference(e.target.value)}
                                                placeholder="Ej. 00123456"
                                                className="w-full h-10 rounded-xl bg-zinc-50 border border-zinc-200 px-3 text-sm font-bold font-mono text-zinc-800 focus-visible:outline-none focus-visible:border-amber-400 placeholder:text-zinc-300 placeholder:font-normal"
                                            />
                                        </div>

                                        <Button
                                            onClick={async () => {
                                                if (!receiptFile) return;
                                                setIsSubmittingPayment(true);
                                                try {
                                                    const formData = new FormData();
                                                    formData.append("file", receiptFile);
                                                    formData.append("folder", "receipts");

                                                    const uploadRes = await fetch(`${API}/upload`, {
                                                        method: "POST",
                                                        body: formData
                                                    });
                                                    if (!uploadRes.ok) throw new Error("Upload failed");
                                                    const { url } = await uploadRes.json();

                                                    const token = localStorage.getItem("client_token");
                                                    const submitRes = await fetch(`${API}/clients/portal/payments/submit`, {
                                                        method: "POST",
                                                        headers: {
                                                            "Content-Type": "application/json",
                                                            Authorization: `Bearer ${token}`
                                                        },
                                                        body: JSON.stringify({
                                                            debtId: selectedDebtForPayment.loanId,
                                                            loanId: selectedDebtForPayment.loanId.startsWith("legacy-") ? undefined : selectedDebtForPayment.loanId,
                                                            amount: parseFloat(paymentAmount),
                                                            receiptUrl: url,
                                                            referenceNumber: receiptReference || undefined
                                                        })
                                                    });

                                                    if (submitRes.ok) {
                                                        setPaymentStep("pending");
                                                        if (token) loadPortalData(token);
                                                    } else {
                                                        const errData = await submitRes.json();
                                                        toast.error(errData.message || "Error al registrar el abono");
                                                    }
                                                } catch (err) {
                                                    console.error("Error submitting payment", err);
                                                    toast.error("Error al conectar con el servidor");
                                                } finally {
                                                    setIsSubmittingPayment(false);
                                                }
                                            }}
                                            disabled={!receiptFile || isSubmittingPayment}
                                            className="w-full h-12 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none mt-2"
                                        >
                                            {isSubmittingPayment ? "Registrando abono..." : "Enviar Comprobante"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: PENDING CONFIRMATION */}
                            {paymentStep === "pending" && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl bg-white border border-zinc-100 p-6 shadow-sm text-center space-y-5 animate-in scale-in-95 duration-300">
                                        <div className="flex justify-center">
                                            <div className="relative flex items-center justify-center size-20 rounded-full bg-amber-50 text-amber-505">
                                                <span className="absolute size-20 rounded-full bg-amber-100 animate-ping opacity-30" />
                                                <IconClock size={40} className="relative z-10" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-lg font-black text-zinc-800">¡Abono en Validación!</h3>
                                            <p className="text-xs text-zinc-550 leading-relaxed font-semibold">
                                                Su orden está pendiente en ser abonada
                                            </p>
                                            <p className="text-[10px] text-zinc-400 font-bold leading-normal px-2">
                                                Hemos recibido tu comprobante de Pago Móvil por <strong className="text-zinc-700">${parseFloat(paymentAmount).toFixed(2)} USD</strong>. El comercio validará la transacción a la brevedad y aplicará el saldo a tu cuenta.
                                            </p>
                                        </div>

                                        <Button
                                            onClick={() => {
                                                setSelectedDebtForPayment(null);
                                                setPaymentStep("details");
                                            }}
                                            className="w-full h-12 rounded-full bg-zinc-800 hover:bg-zinc-900 text-white font-black text-sm shadow-sm transition-all border-none mt-2"
                                        >
                                            Entendido
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-5 animate-in slide-in-from-bottom duration-500">


                        {/* MIS CUOTAS PENDIENTES */}
                        <div className="space-y-4">
                             {(() => {
                                const pendingDebts = (debts || []).filter((d: any) => d.remainingBalance > 0);

                                if (pendingDebts.length === 0) {
                                    return (
                                        <div className="rounded-xl bg-white/60 border border-zinc-150/80 p-6 text-center text-zinc-400 font-bold text-xs">
                                            No tienes deudas pendientes de pago.
                                        </div>
                                    );
                                }

                                const monthNamesAbbr = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
                                const monthNamesFull = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

                                // Extract all pending installments (explicit or virtual)
                                const pendingInstallments: any[] = [];
                                pendingDebts.forEach((debt) => {
                                    const insts = (debt.installments || []).filter((i: any) => i.status === 'PENDING' && (i.remaining !== undefined ? i.remaining : (i.amount - i.paidAmount)) > 0);
                                    if (insts.length > 0) {
                                        insts.forEach((inst: any) => {
                                            pendingInstallments.push({
                                                ...inst,
                                                remaining: inst.remaining !== undefined ? inst.remaining : (inst.amount - inst.paidAmount),
                                                debt
                                            });
                                        });
                                    } else {
                                        // Virtual single installment
                                        pendingInstallments.push({
                                            id: `virtual-${debt.loanId}`,
                                            number: 1,
                                            dueDate: debt.nextPaymentDate || debt.createdAt,
                                            amount: debt.remainingBalance,
                                            paidAmount: 0,
                                            remaining: debt.remainingBalance,
                                            status: 'PENDING',
                                            debt
                                        });
                                    }
                                });

                                // Map to groups by installment due date's month and year
                                const groupsMap: { [key: string]: { month: number; year: number; label: string; installmentsList: any[] } } = {};

                                pendingInstallments.forEach((inst) => {
                                    const d = inst.dueDate ? new Date(inst.dueDate) : new Date();
                                    const m = d.getMonth();
                                    const y = d.getFullYear();
                                    const key = `${y}-${m}`;
                                    if (!groupsMap[key]) {
                                        groupsMap[key] = {
                                            month: m,
                                            year: y,
                                            label: `${monthNamesAbbr[m]} ${y}`,
                                            installmentsList: []
                                        };
                                    }
                                    groupsMap[key].installmentsList.push(inst);
                                });

                                // Sort groups chronologically
                                const sortedGroups = Object.values(groupsMap).sort((a, b) => {
                                    if (a.year !== b.year) return a.year - b.year;
                                    return a.month - b.month;
                                });

                                const activeGroupKey = selectedMonthTab || (sortedGroups.length > 0 ? `${sortedGroups[0].year}-${sortedGroups[0].month}` : null);
                                const activeGroup = sortedGroups.find(g => `${g.year}-${g.month}` === activeGroupKey);

                                return (
                                    <div className="space-y-4">
                                        {/* Month navigation tabs */}
                                        <div className="flex gap-5 border-b border-zinc-100 pb-1 mb-2 overflow-x-auto scrollbar-none">
                                            {sortedGroups.map((group) => {
                                                const key = `${group.year}-${group.month}`;
                                                const isActive = activeGroupKey === key;
                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() => setSelectedMonthTab(key)}
                                                        className={`pb-2 text-left transition-all duration-300 relative shrink-0 ${
                                                            isActive ? "text-zinc-900" : "text-zinc-450 hover:text-zinc-600"
                                                        }`}
                                                    >
                                                        <p className="text-[11px] font-black tracking-wider">{monthNamesFull[group.month]} {group.year}</p>
                                                        <p className="text-[9px] font-bold text-zinc-400 mt-0.5">
                                                            {group.installmentsList.length} cuota{group.installmentsList.length > 1 ? "s" : ""}
                                                        </p>
                                                        {isActive && (
                                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {activeGroup && (() => {
                                            const totalAmount = activeGroup.installmentsList.reduce((sum, inst) => sum + inst.remaining, 0);
                                            const q1Amount = activeGroup.installmentsList.filter(inst => new Date(inst.dueDate).getDate() <= 15).reduce((sum, inst) => sum + inst.remaining, 0);
                                            const q2Amount = activeGroup.installmentsList.filter(inst => new Date(inst.dueDate).getDate() > 15).reduce((sum, inst) => sum + inst.remaining, 0);

                                            // Extract unique debts that have active installments in this month
                                            const activeGroupDebtsMap = new Map();
                                            activeGroup.installmentsList.forEach(inst => {
                                                if (!activeGroupDebtsMap.has(inst.debt.loanId)) {
                                                    activeGroupDebtsMap.set(inst.debt.loanId, inst.debt);
                                                }
                                            });
                                            const activeGroupDebts = Array.from(activeGroupDebtsMap.values());

                                            return (
                                                <div className="space-y-4">
                                                    {/* Total card (always expanded, not collapsible) */}
                                                    <div className="rounded-2xl bg-white border border-zinc-100 p-4 shadow-sm space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="size-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                                                                    <IconCoins size={18} />
                                                                </div>
                                                                <p className="text-xs font-black text-zinc-800">Total a pagar este mes</p>
                                                            </div>
                                                            <span className="text-base font-black text-zinc-950">${totalAmount.toFixed(2)}</span>
                                                        </div>

                                                        {(q1Amount > 0 || q2Amount > 0) && (
                                                            <div className="pt-2.5 border-t border-zinc-50 space-y-2 text-xs font-semibold text-zinc-500 animate-in fade-in duration-200">
                                                                {q1Amount > 0 && (
                                                                    <div className="flex justify-between items-center px-1">
                                                                        <span>Primera quincena</span>
                                                                        <span className="font-bold text-zinc-700">${q1Amount.toFixed(2)}</span>
                                                                    </div>
                                                                )}
                                                                {q2Amount > 0 && (
                                                                    <div className="flex justify-between items-center px-1">
                                                                        <span>Segunda quincena</span>
                                                                        <span className="font-bold text-zinc-700">${q2Amount.toFixed(2)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Detailed Debts List */}
                                                    <div className="space-y-4">
                                                        {activeGroupDebts.map((debt) => {
                                                            const nextPaymentDate = debt.nextPaymentDate ? new Date(debt.nextPaymentDate) : null;
                                                            const daysLeft = nextPaymentDate 
                                                                ? Math.ceil((nextPaymentDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                                                                : null;
                                                            const isOverdue = daysLeft !== null && daysLeft < 0;
                                                            const pendingSubmission = mySubmissions.find((s: any) => s.debtId === debt.loanId && s.status === 'PENDING');

                                                            return (
                                                                <div 
                                                                    key={debt.loanId} 
                                                                    onClick={() => {
                                                                        setSelectedDebtForPayment(debt);
                                                                        setPaymentStep("details");
                                                                        setPaymentAmount(debt.remainingBalance.toFixed(2));
                                                                        setSelectedInstallmentOption(null);
                                                                        setReceiptFile(null);
                                                                        setReceiptPreview(null);
                                                                    }}
                                                                    className="rounded-2xl bg-white border border-zinc-100 p-5 space-y-4 shadow-sm hover:border-zinc-200 hover:shadow-md cursor-pointer transition-all duration-200"
                                                                >
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="space-y-1">
                                                                            <h4 className="text-sm font-black text-zinc-850">
                                                                                {debt.description || "Compra a crédito"}
                                                                            </h4>
                                                                            {pendingSubmission && (
                                                                                <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100/50 mt-1 flex items-center gap-1 w-fit">
                                                                                    <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                                                    Abono de ${pendingSubmission.amount.toFixed(2)} pendiente
                                                                                </span>
                                                                            )}
                                                                            <p className="text-[10px] text-zinc-400 font-bold">
                                                                                Realizada el {new Date(debt.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex flex-col items-end gap-1">
                                                                            {isOverdue ? (
                                                                                <span className="text-[9px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100/50">
                                                                                    Vencida
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100/50">
                                                                                    Al día
                                                                                </span>
                                                                            )}
                                                                            <span className="text-[10px] text-zinc-450 font-bold mt-1">Monto restante</span>
                                                                            <span className="text-base font-black text-zinc-950 font-mono">${debt.remainingBalance.toFixed(2)}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="pt-3 border-t border-zinc-100/50 flex justify-between items-center text-xs">
                                                                        {debt.installments && debt.installments.length > 0 ? (
                                                                            <details 
                                                                                className="group"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                <summary className="list-none flex items-center gap-1 text-[10px] font-bold text-amber-500 cursor-pointer select-none">
                                                                                    <span>Ver plan de cuotas ({debt.installments.length})</span>
                                                                                    <IconChevronRight size={12} className="text-amber-500 transition-transform group-open:rotate-90" />
                                                                                </summary>
                                                                                <div className="mt-3 space-y-2 pl-2 border-l-2 border-amber-100 animate-in fade-in duration-200">
                                                                                    {debt.installments.map((inst: any) => {
                                                                                        const instDate = new Date(inst.dueDate);
                                                                                        const isInstOverdue = instDate < new Date() && inst.status === 'PENDING';
                                                                                        const instRemaining = inst.remaining !== undefined ? inst.remaining : (inst.amount - inst.paidAmount);
                                                                                        return (
                                                                                            <div key={inst.id} className="flex justify-between items-center text-[11px] w-[260px]">
                                                                                                <div className="space-y-0.5 text-left">
                                                                                                    <p className="font-bold text-zinc-700">Cuota {inst.number}</p>
                                                                                                    <p className="text-[9px] text-zinc-400">Vence: {instDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                                                                </div>
                                                                                                <div className="text-right">
                                                                                                    <span className={`font-mono font-bold ${isInstOverdue ? 'text-rose-650' : 'text-zinc-700'}`}>
                                                                                                        ${instRemaining.toFixed(2)}
                                                                                                    </span>
                                                                                                    <p className={`text-[8px] font-black uppercase tracking-wider ${inst.status === 'PAID' ? 'text-emerald-600' : 'text-amber-500'}`}>
                                                                                                        {inst.status === 'PAID' ? 'Pagado' : 'Pendiente'}
                                                                                                    </p>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </details>
                                                                        ) : (
                                                                            <div />
                                                                        )}

                                                                        <div className="text-xs font-black text-amber-700 flex items-center gap-1 hover:text-amber-800 transition-colors">
                                                                            <span>Pagar ahora</span>
                                                                            <IconChevronRight size={14} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* HISTORIAL TRANSACCIONES */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Historial de Transacciones</h3>
                            
                            {client?.creditTransactions && client.creditTransactions.length > 0 && (
                                <div className="relative">
                                    <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                    <Input
                                        type="text"
                                        placeholder="Buscar transacciones..."
                                        value={txSearchQuery}
                                        onChange={(e) => setTxSearchQuery(e.target.value)}
                                        className="pl-10 h-10 bg-white border-zinc-200 focus-visible:ring-amber-400 rounded-xl font-bold text-xs"
                                    />
                                </div>
                            )}

                            {client?.creditTransactions.length === 0 ? (
                                <div className="rounded-xl bg-white/60 backdrop-blur-md border border-zinc-150/80 p-8 text-center text-zinc-455 font-bold">
                                    Aún no tienes movimientos registrados.
                                </div>
                            ) : (
                                (() => {
                                    const filteredTxs = (client?.creditTransactions || []).filter((tx: any) => {
                                        const isDebt = tx.type === 'DEBT';
                                        const notes = (tx.notes || (isDebt ? "Compra a crédito" : "Abono realizado")).toLowerCase();
                                        const amountStr = tx.amount.toString();
                                        const dateStr = new Date(tx.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toLowerCase();
                                        
                                        const query = txSearchQuery.toLowerCase();
                                        return notes.includes(query) || amountStr.includes(query) || dateStr.includes(query);
                                    });

                                    if (filteredTxs.length === 0) {
                                        return (
                                            <div className="rounded-xl bg-white/60 border border-dashed border-zinc-200 p-8 text-center text-zinc-450 font-bold text-xs">
                                                No se encontraron transacciones con esa búsqueda.
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="space-y-2.5">
                                            {filteredTxs.map((tx: any) => {
                                                const isDebt = tx.type === 'DEBT';
                                                return (
                                                    <div key={tx.id} className="rounded-xl bg-gradient-to-r from-white to-amber-50/10 border border-zinc-100/80 p-4 flex justify-between items-center text-xs transition-all duration-300">
                                                        <div className="space-y-0.5">
                                                            <p className="font-bold text-zinc-700">{tx.notes || (isDebt ? "Compra a crédito" : "Abono realizado")}</p>
                                                            <p className="text-[10px] text-zinc-400 font-medium">
                                                                {new Date(tx.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                        <span className={`font-black text-sm px-3 py-1 rounded-full ${
                                                            isDebt 
                                                                ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                                                                : 'bg-amber-50 text-amber-500 border border-amber-100'
                                                        }`}>
                                                            {isDebt ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()
                            )}
                        </div>
                    </div>
                    )
                )}

                {activeTab === "rewards" && (
                    <div className="space-y-5 animate-in slide-in-from-bottom duration-500">
                        {isCheckoutOpen ? (
                            // InDrive-style Full-Screen Map + Bottom Sheet
                            <div className="fixed inset-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 animate-in slide-in-from-right duration-300">

                                {/* Full-screen map underneath everything */}
                                <div className="absolute inset-0 bg-zinc-100">
                                    {!mapboxLoaded && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-50 z-10">
                                            <span className="size-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-[10px] text-zinc-400 font-semibold">Cargando mapa...</span>
                                        </div>
                                    )}
                                    <div ref={checkoutMapContainerRef} className="w-full h-full" />
                                </div>

                                {/* Floating back button - top left */}
                                <div className="absolute top-5 left-4 z-30">
                                    <button
                                        onClick={() => setIsCheckoutOpen(false)}
                                        className="size-10 rounded-full bg-white shadow-lg border border-zinc-200/60 flex items-center justify-center text-zinc-700 hover:bg-zinc-50 active:scale-95 transition-all duration-200 cursor-pointer"
                                    >
                                        <IconChevronLeft size={20} />
                                    </button>
                                </div>

                                {/* Floating geolocation button - bottom right above sheet */}
                                <div
                                    className="absolute right-4 z-30 transition-all duration-350"
                                    style={{ bottom: isMapMoving ? '48px' : 'calc(65vh + 12px)' }}
                                >
                                    <button
                                        onClick={() => {
                                            if (geolocateControlRef.current) {
                                                setIsGeolocating(true);
                                                geolocateControlRef.current.trigger();
                                            }
                                        }}
                                        className="size-12 rounded-full bg-white shadow-xl border border-zinc-200/50 flex items-center justify-center active:scale-90 transition-all duration-200 cursor-pointer"
                                        style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                                    >
                                        {isGeolocating ? (
                                            <span className="size-5 border-2 border-zinc-300 border-t-zinc-800 rounded-full animate-spin" />
                                        ) : (
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M3 11L21 3L13 21L11 13L3 11Z" fill="#1a1a1a" stroke="#1a1a1a" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
                                            </svg>
                                        )}
                                    </button>
                                </div>

                                {/* Center location pin + tooltip (inDrive style) */}
                                {mapboxLoaded && (
                                    <>
                                        {/* Pin floats exactly in center of map, above the bottom sheet */}
                                        <div
                                            className={`custom-center-pin absolute left-1/2 z-20 pointer-events-none`}
                                            style={{ top: 'calc(50% - 200px)', marginTop: '-4px' }}
                                        >
                                            <div className="relative flex flex-col items-center">
                                                {/* Tooltip bubble */}
                                                <div className="relative bg-zinc-950/95 backdrop-blur-md text-white text-[10px] px-3.5 py-2 rounded-2xl shadow-xl border border-zinc-800 select-none transition-all duration-300 max-w-[220px] mb-2 text-center">
                                                    {isMapMoving ? (
                                                        <span className="flex items-center justify-center py-0.5">
                                                            <span className="size-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
                                                        </span>
                                                    ) : (
                                                        <span className="font-semibold text-zinc-100 leading-snug line-clamp-2">
                                                            {deliveryAddress || 'Fijar ubicación...'}
                                                        </span>
                                                    )}
                                                    {/* Tail */}
                                                    <div className="absolute top-[100%] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-zinc-950/95 border-r border-b border-zinc-800 rotate-45 -mt-1.5" />
                                                </div>

                                                {/* Pin SVG */}
                                                <div className={`drop-shadow-[0_8px_20px_rgba(245,158,11,0.4)] transition-transform duration-200 ${isMapMoving ? 'scale-110' : 'scale-100'}`}>
                                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path
                                                            d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z"
                                                            fill="url(#indrivePin)"
                                                            stroke="#ffffff"
                                                            strokeWidth="1.5"
                                                            strokeLinejoin="round"
                                                        />
                                                        <circle cx="12" cy="9" r="3.2" fill="#ffffff" />
                                                        <defs>
                                                            <linearGradient id="indrivePin" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                                                                <stop stopColor="#fbbf24" />
                                                                <stop offset="1" stopColor="#d97706" />
                                                            </linearGradient>
                                                        </defs>
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Pin ground shadow */}
                                        <div
                                            className={`custom-pin-shadow absolute left-1/2 z-20 pointer-events-none ${isMapMoving ? 'moving' : ''}`}
                                            style={{ top: 'calc(50% - 200px)' }}
                                        />
                                    </>
                                )}

                                {/* Bottom Sheet — collapses when map is being dragged */}
                                <div
                                    className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.12)] border-t border-zinc-100/60"
                                    style={{
                                        transform: isMapMoving ? 'translateY(calc(100% - 36px))' : 'translateY(0)',
                                        transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
                                    }}
                                >
                                    {/* Drag handle */}
                                    <div className="flex justify-center pt-3 pb-1">
                                        <div className={`h-1 rounded-full transition-all duration-300 ${isMapMoving ? 'w-14 bg-amber-400' : 'w-10 bg-zinc-200'}`} />
                                    </div>

                                    {/* Collapsible content */}
                                    <div
                                        style={{
                                            overflow: 'hidden',
                                            maxHeight: isMapMoving ? '0px' : '65vh',
                                            transition: 'max-height 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
                                        }}
                                    >
                                    <div className="px-5 pb-8 pt-2 space-y-4 overflow-y-auto no-scrollbar">

                                        {/* Title row */}
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-black text-zinc-900">Confirmar Delivery</h3>
                                            <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                                                {checkoutItems.length} {checkoutItems.length === 1 ? 'artículo' : 'artículos'}
                                            </span>
                                        </div>

                                        {/* Big search bar (InDrive style) */}
                                        <div className="relative">
                                            <div className="flex items-center gap-3 bg-zinc-100 rounded-2xl px-4 h-14 border border-zinc-200/60 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all duration-200">
                                                {isSearchingAddress ? (
                                                    <span className="size-5 border-2 border-zinc-400 border-t-zinc-800 rounded-full animate-spin shrink-0" />
                                                ) : (
                                                    <IconSearch size={20} className="text-zinc-400 shrink-0" />
                                                )}
                                                <input
                                                    type="text"
                                                    placeholder="Buscar dirección..."
                                                    value={addressSearch}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setAddressSearch(val);
                                                        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                                                        if (!val.trim()) { setAddressResults([]); return; }
                                                        setIsSearchingAddress(true);
                                                        searchDebounceRef.current = setTimeout(async () => {
                                                            try {
                                                                    const res = await fetch(
                                                                        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&addressdetails=1&countrycodes=ve&accept-language=es`
                                                                    );
                                                                    if (res.ok) {
                                                                        const data = await res.json();
                                                                        const features = (data || []).map((item: any) => ({
                                                                            id: item.place_id,
                                                                            text: item.address?.road || item.address?.pedestrian || (item.display_name || '').split(',')[0],
                                                                            place_name: item.display_name || '',
                                                                            geometry: {
                                                                                coordinates: [parseFloat(item.lon || '0'), parseFloat(item.lat || '0')]
                                                                            }
                                                                        }));
                                                                        setAddressResults(features);
                                                                    }
                                                                } catch (err) {
                                                                    console.error("Error searching address:", err);
                                                                } finally {
                                                                    setIsSearchingAddress(false);
                                                                }
                                                        }, 400);
                                                    }}
                                                    className="flex-1 bg-transparent text-sm font-semibold text-zinc-900 placeholder-zinc-400 outline-none"
                                                />
                                                {addressSearch && (
                                                    <button
                                                        onClick={() => { setAddressSearch(''); setAddressResults([]); }}
                                                        className="size-5 rounded-full bg-zinc-300 flex items-center justify-center shrink-0 cursor-pointer"
                                                    >
                                                        <IconCircleX size={16} className="text-zinc-600" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Results dropdown */}
                                            {addressResults.length > 0 && (
                                                <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden z-50">
                                                    {addressResults.map((result: any) => (
                                                        <button
                                                            key={result.id}
                                                            onClick={() => {
                                                                const [lng, lat] = result.geometry.coordinates;
                                                                if (checkoutMapRef.current) {
                                                                    checkoutMapRef.current.flyTo({ center: [lng, lat], zoom: 16 });
                                                                }
                                                                setDeliveryAddress(result.place_name);
                                                                setDeliveryCoordinates({ lat, lng });
                                                                setAddressSearch('');
                                                                setAddressResults([]);
                                                            }}
                                                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 active:bg-zinc-100 transition-colors text-left border-b border-zinc-50 last:border-0 cursor-pointer"
                                                        >
                                                            <IconMapPin size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-bold text-zinc-900 line-clamp-1">{result.text}</p>
                                                                <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{result.place_name}</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Address display row (shows current pinned address) */}
                                        <div className="flex items-start gap-3 bg-zinc-50 border border-zinc-100 rounded-2xl p-3.5">
                                            <div className="size-8 rounded-xl bg-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                                                <IconMapPin size={16} className="text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider block">Ubicación de entrega</span>
                                                <p className="text-xs font-bold text-zinc-800 mt-0.5 leading-snug line-clamp-2">
                                                    {isMapMoving
                                                        ? <span className="text-zinc-400 animate-pulse font-mono text-[9px]">{deliveryCoordinates ? `${deliveryCoordinates.lat.toFixed(5)}, ${deliveryCoordinates.lng.toFixed(5)}` : 'Moviendo...'}</span>
                                                        : (deliveryAddress || 'Mueve el mapa o busca una dirección')
                                                    }
                                                </p>
                                            </div>
                                        </div>

                                        {/* Order Items Summary */}
                                        <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-3.5 space-y-2">
                                            <h4 className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Artículos</h4>
                                            <div className="space-y-1.5 max-h-[80px] overflow-y-auto pr-1">
                                                {checkoutItems.map((item, idx) => {
                                                    const firstVariant = item.product.variants?.[0];
                                                    const price = firstVariant?.promoPrice || firstVariant?.price || 0;
                                                    return (
                                                        <div key={idx} className="flex justify-between text-xs font-semibold text-zinc-700">
                                                            <span className="truncate max-w-[200px]">{item.quantity}× {item.product.name}</span>
                                                            <span className="font-mono font-bold text-zinc-900 ml-2">${(price * item.quantity).toFixed(2)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="pt-2 border-t border-zinc-150 flex justify-between items-baseline">
                                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Total</span>
                                                <span className="text-base font-black text-zinc-900 font-mono">
                                                    ${checkoutItems.reduce((sum, item) => {
                                                        const firstVariant = item.product.variants?.[0];
                                                        const price = firstVariant?.promoPrice || firstVariant?.price || 0;
                                                        return sum + price * item.quantity;
                                                    }, 0).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Notes / Extra address detail */}
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Detalle adicional (apto, piso, ref.) <span className="text-rose-500 font-bold ml-0.5">*</span></Label>
                                            <Input
                                                type="text"
                                                placeholder="Ej. Edif. Centro, Apto 4B, frente a la farmacia"
                                                value={deliveryNote}
                                                onChange={(e) => setDeliveryNote(e.target.value)}
                                                className="h-10 rounded-xl border-zinc-200 bg-zinc-50 text-xs font-semibold focus-visible:ring-amber-400"
                                            />
                                        </div>

                                        {/* Phone */}
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Teléfono de contacto <span className="text-rose-500 font-bold ml-0.5">*</span></Label>
                                            <Input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="Ej. 584121234567"
                                                value={deliveryPhone}
                                                onChange={(e) => setDeliveryPhone(e.target.value.replace(/[^0-9]/g, ""))}
                                                className="h-10 rounded-xl border-zinc-200 bg-zinc-50 text-xs font-semibold focus-visible:ring-amber-400"
                                            />
                                        </div>

                                        {/* CTA button */}
                                        <Button
                                            onClick={handleSubmitDeliveryRequest}
                                            disabled={isSubmittingDelivery || !deliveryCoordinates}
                                            className="w-full h-13 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-[0.98] text-amber-950 font-black text-sm border-none shadow-lg shadow-amber-400/20 transition-all duration-200"
                                        >
                                            {isSubmittingDelivery ? (
                                                <span className="flex items-center gap-2">
                                                    <span className="size-4 border-2 border-amber-900/40 border-t-amber-900 rounded-full animate-spin" />
                                                    Enviando solicitud...
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-2">
                                                    <IconTruck size={18} />
                                                    Solicitar Envío
                                                </span>
                                            )}
                                        </Button>
                                    </div>
                                    </div>{/* end collapsible wrapper */}
                                </div>{/* end bottom sheet */}
                            </div>
                        ) : selectedProductForDetail !== null ? (
                            // View 3: Product Detail View
                            (() => {
                                const product = selectedProductForDetail;
                                const inStock = product.totalStock > 0;
                                const firstVariant = product.variants?.[0];
                                const price = firstVariant?.price || 0;
                                const promoPrice = firstVariant?.promoPrice;
                                return (
                                    <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#faf9f5] z-50 overflow-y-auto px-6 pt-8 pb-28 flex flex-col space-y-5 animate-in slide-in-from-right duration-300">
                                        {/* Back Header */}
                                        <div className="flex items-center justify-between pb-1.5">
                                            <button
                                                onClick={() => setSelectedProductForDetail(null)}
                                                className="text-xs text-[#854d0e] hover:text-amber-850 font-extrabold h-8 px-3 rounded-full bg-amber-50 hover:bg-amber-100/60 border border-amber-200/50 flex items-center gap-1 transition-all duration-300 cursor-pointer"
                                            >
                                                <IconChevronLeft size={14} />
                                                <span>Volver</span>
                                            </button>
                                            <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-950 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                                                Detalle de Producto
                                            </span>
                                        </div>

                                        {/* Premium Product Detail Card */}
                                        <div className="rounded-2xl bg-white border border-zinc-100/90 p-5 space-y-5 shadow-[0_10px_35px_-5px_rgba(0,0,0,0.02)]">
                                               {product.image ? (
                                                <img 
                                                    src={product.image} 
                                                    alt={product.name} 
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="w-full max-h-72 object-contain bg-zinc-50/50 rounded-xl border border-zinc-100/80 shadow-sm animate-in zoom-in-95 duration-200" 
                                                />
                                            ) : (
                                                <div className="w-full h-64 bg-gradient-to-br from-zinc-50 to-zinc-100/50 flex items-center justify-center rounded-xl border border-zinc-100 text-zinc-300">
                                                    <IconShoppingBag size={54} className="opacity-30" />
                                                </div>
                                            )}

                                            <div className="space-y-3.5">
                                                {product.category && (
                                                    <span className="inline-block text-[9px] bg-zinc-100/80 text-zinc-550 font-extrabold uppercase px-2.5 py-0.5 rounded-md tracking-wider">
                                                        {product.category.name}
                                                    </span>
                                                )}
                                                <h3 className="text-lg font-black text-zinc-900 leading-tight">
                                                    {product.name}
                                                </h3>
                                                {product.description && (
                                                    <p className="text-xs text-zinc-650 leading-relaxed font-semibold">
                                                        {product.description}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="pt-4 border-t border-zinc-100 flex justify-between items-center">
                                                <div className="flex items-baseline gap-2">
                                                    {promoPrice ? (
                                                        <>
                                                            <span className="text-amber-500 font-black text-2xl font-mono">
                                                                ${promoPrice.toFixed(2)}
                                                            </span>
                                                            <span className="text-zinc-400 line-through text-xs font-bold font-mono">
                                                                ${price.toFixed(2)}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-zinc-850 font-black text-2xl font-mono">
                                                            ${price.toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>

                                                <span className={`inline-flex items-center justify-center text-[10px] font-extrabold px-3 py-1 rounded-full ${
                                                    inStock 
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/40' 
                                                        : 'bg-rose-50 text-rose-600 border border-rose-100/40'
                                                }`}>
                                                    {inStock ? `En Stock (${product.totalStock})` : "Agotado"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Large Action Buttons */}
                                        <div className="grid grid-cols-2 gap-3.5 pt-2">
                                            <Button
                                                onClick={() => {
                                                    addToCart(product);
                                                    setSelectedProductForDetail(null);
                                                }}
                                                disabled={!inStock}
                                                className="h-14 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-850 font-black text-xs transition-colors border-none active:scale-[0.98] cursor-pointer"
                                            >
                                                Agregar al carrito
                                            </Button>
                                            <Button
                                                onClick={() => handleCheckout([{ product, quantity: 1 }])}
                                                disabled={!inStock}
                                                className="h-14 rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-xs transition-all duration-200 border-none active:scale-[0.98] cursor-pointer shadow-md shadow-amber-400/10"
                                            >
                                                Comprar
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })()
                        ) : selectedBranchForShop === null ? (
                            <div className="space-y-4">
                                <div className="border-b border-zinc-100 pb-4.5 flex flex-col gap-4">
                                    <div>
                                        <h3 className="text-base font-black text-zinc-800">Comercios Disponibles</h3>
                                        <p className="text-xs text-zinc-400 font-semibold mt-0.5">
                                            Selecciona una tienda para ver su catálogo de productos.
                                        </p>
                                    </div>
                                    <Button
                                        onClick={() => setIsOrdersListOpen(true)}
                                        className="w-full rounded-2xl bg-amber-400 hover:bg-amber-500 text-amber-955 font-black text-xs h-11 border-none shadow-md shadow-amber-450/20 flex items-center justify-center gap-2 active:scale-[0.97] transition-all duration-200 cursor-pointer animate-in fade-in"
                                    >
                                        <IconTruck size={18} />
                                        <span>Mis Pedidos</span>
                                    </Button>
                                </div>

                                {/* Search Businesses */}
                                <div className="sticky top-0 z-40 bg-[#faf9f5] py-3 -mx-6 px-6 border-b border-zinc-150/40 shadow-sm">
                                    <div className="relative">
                                        <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                        <Input
                                            type="text"
                                            placeholder="Buscar comercios..."
                                            value={businessSearchQuery}
                                            onChange={(e) => setBusinessSearchQuery(e.target.value)}
                                            className="pl-10 h-11 bg-white border-zinc-200 focus-visible:ring-amber-400 rounded-xl font-bold text-xs"
                                        />
                                    </div>
                                </div>

                                {portalBusinesses.length === 0 ? (
                                    <div className="rounded-2xl bg-white/60 border border-dashed border-zinc-200 p-8 text-center text-zinc-450 font-bold text-xs">
                                        No hay tiendas disponibles en este momento.
                                    </div>
                                ) : (
                                    (() => {
                                        const filteredBusinesses = portalBusinesses.filter((branch: any) => 
                                            branch.name.toLowerCase().includes(businessSearchQuery.toLowerCase()) ||
                                            (branch.business?.name && branch.business.name.toLowerCase().includes(businessSearchQuery.toLowerCase())) ||
                                            (branch.location && branch.location.toLowerCase().includes(businessSearchQuery.toLowerCase()))
                                        );

                                        if (filteredBusinesses.length === 0) {
                                            return (
                                                <div className="rounded-2xl bg-white/60 border border-dashed border-zinc-200 p-8 text-center text-zinc-450 font-bold text-xs">
                                                    No se encontraron comercios con esa búsqueda.
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="grid grid-cols-1 gap-3.5">
                                                {filteredBusinesses.map((branch: any) => (
                                                    <div
                                                        key={branch.id}
                                                        onClick={() => { setSelectedBranchForShop(branch); setProductSearchQuery(""); setBusinessSearchQuery(""); }}
                                                        className="rounded-2xl bg-white border border-zinc-100 p-4.5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)] hover:border-amber-200/50 transition-all duration-300 active:scale-[0.99] cursor-pointer flex justify-between items-center group animate-in fade-in duration-300"
                                                    >
                                                        <div className="flex items-center gap-4 max-w-[80%]">
                                                            {branch.business?.logo ? (
                                                                <img src={branch.business.logo} alt={branch.name} loading="lazy" decoding="async" className="size-13 rounded-2xl object-cover border border-zinc-100 shrink-0 shadow-sm" />
                                                            ) : (
                                                                <div className="size-13 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/40 text-amber-500 flex items-center justify-center shrink-0 shadow-sm">
                                                                    <IconBuildingStore size={24} className="text-amber-500" />
                                                                </div>
                                                            )}
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <h4 className="font-extrabold text-sm text-zinc-800 group-hover:text-amber-500 transition-colors leading-tight">
                                                                        {branch.name}
                                                                    </h4>
                                                                    {branch.isMain && (
                                                                        <span className="inline-block text-[8px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm shadow-amber-500/10">
                                                                            Principal
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {branch.business?.name && (
                                                                    <p className="text-[10px] text-zinc-400 font-semibold leading-none">
                                                                        {branch.business.name}
                                                                    </p>
                                                                )}
                                                                {branch.location && (
                                                                    <p className="text-[10px] text-zinc-500 font-medium leading-none flex items-center gap-1 mt-1">
                                                                        <IconMapPin size={11} className="text-zinc-400 shrink-0" />
                                                                        <span className="line-clamp-1">{branch.location}</span>
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100 text-zinc-400 group-hover:bg-amber-50 group-hover:border-amber-100 group-hover:text-amber-500 transition-all shrink-0">
                                                            <IconChevronRight size={16} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()
                                )}
                            </div>
                        ) : (
                            // View 2: Product Catalog for Selected Branch
                            <div className="space-y-5 animate-in slide-in-from-right duration-300">
                                {/* Back Header */}
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={() => { setSelectedBranchForShop(null); setProductSearchQuery(""); }}
                                        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 text-xs font-black transition-colors"
                                    >
                                        <IconChevronLeft size={16} />
                                        <span>Tiendas</span>
                                    </button>
                                    <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-950 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                                        Catálogo
                                    </span>
                                </div>

                                {/* Active Branch details - Premium Glassmorphic style */}
                                <div className="rounded-2xl bg-gradient-to-tr from-white via-white to-amber-50/10 border border-zinc-100 shadow-[0_10px_35px_-5px_rgba(0,0,0,0.03)] p-5 space-y-4">
                                    <div className="flex items-center gap-4">
                                        {selectedBranchForShop.business?.logo ? (
                                            <img 
                                                src={selectedBranchForShop.business.logo} 
                                                alt={selectedBranchForShop.name} 
                                                loading="lazy"
                                                decoding="async"
                                                className="size-14 rounded-2xl object-cover border border-zinc-100 shrink-0 shadow-sm" 
                                            />
                                        ) : (
                                            <div className="size-14 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/40 text-amber-500 flex items-center justify-center shrink-0 shadow-sm">
                                                <IconBuildingStore size={26} className="text-amber-500" />
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-extrabold text-base text-zinc-900 leading-tight">
                                                    {selectedBranchForShop.name}
                                                </h3>
                                                {selectedBranchForShop.isMain && (
                                                    <span className="text-[9px] bg-amber-500 text-white font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm shadow-amber-500/10">
                                                        Principal
                                                    </span>
                                                )}
                                            </div>
                                            {selectedBranchForShop.business?.name && (
                                                <p className="text-xs text-zinc-400 font-semibold">
                                                    {selectedBranchForShop.business.name}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Location and phone as inline horizontal pills (No horizontal divider!) */}
                                    {(selectedBranchForShop.location || selectedBranchForShop.phone) && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {selectedBranchForShop.location && (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] bg-zinc-100/70 border border-zinc-200/30 text-zinc-650 px-3 py-1.5 rounded-full font-bold">
                                                    <IconMapPin size={12} className="text-zinc-400 shrink-0" />
                                                    <span>{selectedBranchForShop.location}</span>
                                                </span>
                                            )}
                                            {selectedBranchForShop.phone && (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] bg-amber-50/70 border border-amber-100/30 text-amber-950 px-3 py-1.5 rounded-full font-bold">
                                                    <IconPhone size={12} className="text-amber-500 shrink-0" />
                                                    <span>{selectedBranchForShop.phone}</span>
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Dynamic Branch Selector (Only shown if this business has multiple branches) */}
                                {loadingBranchesForShop ? (
                                    <div className="space-y-2.5 pointer-events-none select-none">
                                        <div className="h-3.5 w-32 bg-zinc-200/80 rounded animate-pulse" />
                                        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
                                            {[1, 2].map((i) => (
                                                <div key={i} className="h-[34px] w-24 bg-zinc-150/70 rounded-xl animate-pulse shrink-0" />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    businessBranchesForShop.length > 1 && (
                                        <div className="space-y-2">
                                            <span className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">
                                                Sucursales Disponibles
                                            </span>
                                            <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                                                {businessBranchesForShop.map((b) => {
                                                    const isSelected = selectedBranchForShop.id === b.id;
                                                    return (
                                                        <button
                                                            key={b.id}
                                                            onClick={() => { setSelectedBranchForShop(b); }}
                                                            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 ${
                                                                isSelected
                                                                    ? 'bg-amber-400 text-amber-950 shadow-md shadow-amber-400/20 scale-[1.02] border-none'
                                                                    : 'bg-white border border-zinc-150 text-zinc-650 hover:border-amber-200 hover:text-amber-500'
                                                            }`}
                                                        >
                                                            {b.name} {b.isMain && "🏠"}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )
                                )}

                                {/* Search Catalog */}
                                <div className="space-y-4">
                                    <div className="sticky top-0 z-40 bg-[#faf9f5] py-3 -mx-6 px-6 border-b border-zinc-150/40 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="relative flex-1">
                                                <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                                <Input
                                                    type="text"
                                                    placeholder="Buscar productos..."
                                                    value={productSearchQuery}
                                                    onChange={(e) => setProductSearchQuery(e.target.value)}
                                                    className="pl-10 h-11 bg-white border-zinc-200 focus-visible:ring-amber-400 rounded-xl font-bold text-xs"
                                                />
                                            </div>
                                            
                                            <div className="flex flex-col items-center shrink-0 bg-white border border-zinc-150/80 px-2.5 py-1.5 rounded-xl shadow-xs gap-0.5 min-w-[66px]">
                                                <span className="text-[8px] font-black text-zinc-400 uppercase tracking-wider">En Stock</span>
                                                <Switch
                                                    checked={onlyInStock}
                                                    onCheckedChange={setOnlyInStock}
                                                    className="data-[state=checked]:bg-amber-500 scale-[0.8] cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Product list */}
                                    {loadingProducts ? (
                                        <div className="grid grid-cols-2 gap-3.5 pointer-events-none select-none">
                                            {[1, 2, 3, 4].map((i) => (
                                                <div 
                                                    key={i} 
                                                    className="rounded-2xl bg-white border border-zinc-100/80 p-3.5 space-y-4 animate-pulse flex flex-col justify-between"
                                                >
                                                    <div className="space-y-3">
                                                        {/* Image placeholder */}
                                                        <div className="h-28 w-full bg-zinc-100/80 rounded-xl" />
                                                        
                                                        {/* Category badge placeholder */}
                                                        <div className="h-4 w-12 bg-zinc-100/80 rounded-md" />
                                                        
                                                        {/* Product title placeholder */}
                                                        <div className="h-4 w-3/4 bg-zinc-150/70 rounded-md" />
                                                        
                                                        {/* Description placeholder */}
                                                        <div className="space-y-1.5">
                                                            <div className="h-3 w-full bg-zinc-100/80 rounded" />
                                                            <div className="h-3 w-5/6 bg-zinc-100/80 rounded" />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2.5 pt-2 border-t border-zinc-50">
                                                        {/* Price placeholder */}
                                                        <div className="h-5 w-16 bg-zinc-150/70 rounded" />
                                                        
                                                        {/* Stock badge placeholder */}
                                                        <div className="h-6 w-full bg-zinc-100/80 rounded-full" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        (() => {
                                            const filteredProducts = shopProducts.filter((p: any) => {
                                                const matchesSearch = p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                                                    (p.description && p.description.toLowerCase().includes(productSearchQuery.toLowerCase())) ||
                                                    (p.category && p.category.name.toLowerCase().includes(productSearchQuery.toLowerCase()));
                                                const matchesStock = !onlyInStock || p.totalStock > 0;
                                                return matchesSearch && matchesStock;
                                            });

                                            if (filteredProducts.length === 0) {
                                                return (
                                                    <div className="rounded-2xl bg-white/60 border border-dashed border-zinc-200 p-8 text-center text-zinc-450 font-bold text-xs">
                                                        No se encontraron productos disponibles en esta sucursal.
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="grid grid-cols-2 gap-3.5">
                                                    {filteredProducts.map((product: any) => {
                                                        const inStock = product.totalStock > 0;
                                                        const firstVariant = product.variants?.[0];
                                                        const price = firstVariant?.price || 0;
                                                        const promoPrice = firstVariant?.promoPrice;

                                                        return (
                                                            <div 
                                                                key={product.id} 
                                                                onClick={() => setSelectedProductForDetail(product)}
                                                                className="rounded-2xl bg-white border border-zinc-100/80 overflow-hidden flex flex-col justify-between hover:border-amber-250/60 hover:-translate-y-0.5 transition-all duration-300 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_30px_-5px_rgba(0,0,0,0.08)] animate-in zoom-in-95 duration-200 cursor-pointer"
                                                            >
                                                                {product.image ? (
                                                                    <img 
                                                                        src={product.image} 
                                                                        alt={product.name} 
                                                                        loading="lazy"
                                                                        decoding="async"
                                                                        className="h-28 w-full object-contain bg-zinc-50/50 p-1.5 border-b border-zinc-100 shrink-0" 
                                                                    />
                                                                ) : (
                                                                    <div className="h-28 bg-gradient-to-br from-zinc-50 to-zinc-100/50 flex items-center justify-center border-b border-zinc-100 shrink-0 text-zinc-350">
                                                                        <IconShoppingBag size={28} className="opacity-40 text-zinc-400" />
                                                                    </div>
                                                                )}
                                                                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                                                                    <div className="space-y-1.5">
                                                                        {product.category && (
                                                                            <span className="inline-block text-[8px] bg-zinc-100/80 text-zinc-500 font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider">
                                                                                {product.category.name}
                                                                            </span>
                                                                        )}
                                                                        <h4 className="text-xs font-extrabold text-zinc-800 line-clamp-1 leading-tight">
                                                                            {product.name}
                                                                        </h4>
                                                                        {product.description && (
                                                                            <p className="text-[9px] text-zinc-450 line-clamp-2 leading-relaxed">
                                                                                {product.description}
                                                                            </p>
                                                                        )}
                                                                    </div>

                                                                    <div className="space-y-2 pt-2 border-t border-zinc-50 flex flex-col justify-end">
                                                                        <div className="flex items-baseline gap-1.5 flex-wrap">
                                                                            {promoPrice ? (
                                                                                <>
                                                                                    <span className="text-amber-500 font-black text-sm">
                                                                                        ${promoPrice.toFixed(2)}
                                                                                    </span>
                                                                                    <span className="text-zinc-400 line-through text-[9px] font-semibold">
                                                                                        ${price.toFixed(2)}
                                                                                    </span>
                                                                                </>
                                                                            ) : (
                                                                                <span className="text-zinc-800 font-black text-sm">
                                                                                    ${price.toFixed(2)}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        <span className={`inline-flex items-center justify-center text-[8px] font-extrabold px-2 py-1 rounded-full ${
                                                                            inStock 
                                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/40' 
                                                                                : 'bg-rose-50 text-rose-600 border border-rose-100/40'
                                                                        }`}>
                                                                            {inStock ? `En Stock (${product.totalStock})` : "Agotado"}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 4: PROFILE */}
                {activeTab === "profile" && (
                    <div className="space-y-5 animate-in slide-in-from-bottom duration-500">

                        {isEditingProfile ? (
                            <>
                                <div className="rounded-xl bg-gradient-to-br from-[#fffdf4] via-[#fffbeb] to-amber-50/30 border border-amber-200/50 p-6 space-y-4">
                                    <h3 className="text-sm font-black text-zinc-800 border-b border-zinc-150 pb-2">Editar Perfil</h3>
                                    <div className="space-y-3.5">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">Nombre</label>
                                            <Input 
                                                value={editName} 
                                                onChange={(e) => setEditName(e.target.value)} 
                                                className="h-10 rounded-lg text-xs border-zinc-200 bg-white" 
                                                disabled={isSavingProfile}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">Email</label>
                                            <Input 
                                                value={editEmail} 
                                                onChange={(e) => setEditEmail(e.target.value)} 
                                                className="h-10 rounded-lg text-xs border-zinc-200 bg-white" 
                                                disabled={isSavingProfile}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">Teléfono</label>
                                            <Input 
                                                value={editPhone} 
                                                onChange={(e) => setEditPhone(e.target.value)} 
                                                className="h-10 rounded-lg text-xs border-zinc-200 bg-white" 
                                                disabled={isSavingProfile}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">Dirección</label>
                                            <Input 
                                                value={editAddress} 
                                                onChange={(e) => setEditAddress(e.target.value)} 
                                                className="h-10 rounded-lg text-xs border-zinc-200 bg-white" 
                                                disabled={isSavingProfile}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-4">
                                    <Button 
                                        onClick={() => setIsEditingProfile(false)} 
                                        variant="outline" 
                                        className="flex-1 h-12 rounded-xl text-xs font-black text-zinc-500 border-zinc-200 hover:bg-zinc-50"
                                        disabled={isSavingProfile}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button 
                                        onClick={handleSaveProfile} 
                                        className="flex-1 h-12 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-500 text-amber-950 shadow-md border-none"
                                        disabled={isSavingProfile}
                                    >
                                        {isSavingProfile ? "Guardando..." : "Guardar"}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="rounded-xl bg-gradient-to-br from-[#fffdf4] via-[#fffbeb] to-amber-50/30 border border-amber-200/50 p-6 space-y-5">
                                    <div className="flex items-center gap-3.5">
                                        <div className="size-12 rounded-full bg-[#fffbeb] text-amber-950 flex items-center justify-center font-black">
                                            {client?.name ? client.name.charAt(0).toUpperCase() : "A"}
                                        </div>
                                        <div>
                                            <h4 className="font-extrabold text-sm text-zinc-700">{client?.name}</h4>
                                            <p className="text-[10px] text-zinc-400 mt-0.5">ID: {client?.documentId || "No registrada"}</p>
                                        </div>
                                    </div>
                                    <div className="border-t border-zinc-100 pt-4 space-y-3.5 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-zinc-400">Email</span>
                                            <span className="font-semibold text-zinc-700">{client?.email || "No registrado"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-zinc-400">Teléfono</span>
                                            <span className="font-semibold text-zinc-700">{client?.phone || "No registrado"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-zinc-400">Dirección</span>
                                            <span className="font-semibold text-zinc-700 text-right truncate max-w-[200px]">{client?.address || "No registrada"}</span>
                                        </div>
                                    </div>
                                </div>

                                <Button 
                                    variant="outline" 
                                    onClick={handleStartEditProfile} 
                                    className="w-full h-12 rounded-xl text-xs font-black text-amber-950 hover:text-amber-950 border-amber-200 hover:bg-amber-50/50 transition-all duration-300 bg-transparent"
                                >
                                    Editar Perfil
                                </Button>

                                <Button 
                                    variant="outline" 
                                    onClick={handleLogout} 
                                    className="w-full h-12 rounded-xl text-xs font-black text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50/50 transition-all duration-300 bg-transparent"
                                >
                                    Cerrar Sesión
                                </Button>
                            </>
                        )}
                    </div>
                )}
                {/* TAB 5: AUTH PURCHASE (PIN) */}
                {activeTab === "auth-purchase" && (
                    <div className="min-h-[calc(100vh-220px)] flex flex-col justify-center items-center space-y-5 animate-in slide-in-from-bottom duration-500 w-full">
                        {showCancelledScreen ? (
                            <div className="w-full max-w-sm flex flex-col items-center justify-center py-16 text-center space-y-5 animate-in zoom-in-95 duration-500 mx-auto">
                                <div className="size-24 rounded-full bg-rose-100 flex items-center justify-center shadow-lg shadow-rose-200/40">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 6l-12 12" /><path d="M6 6l12 12" />
                                    </svg>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black text-zinc-900">Operación Cancelada</h3>
                                    <p className="text-xs text-zinc-500 max-w-[260px] leading-relaxed">
                                        El cajero ha cancelado esta operación. No se realizó ningún cargo a tu cuenta.
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowCancelledScreen(false);
                                        setActiveTab("home");
                                    }}
                                    className="mt-2 w-full max-w-[220px] h-12 rounded-xl bg-zinc-900 hover:bg-zinc-700 text-white font-black text-xs transition-all duration-300 active:scale-95 shadow-md"
                                >
                                    Ir al Inicio
                                </button>
                            </div>
                        ) : showApprovalSuccess ? (
                            <div className="w-full max-w-sm flex flex-col items-center justify-center py-12 text-center space-y-4 animate-in zoom-in-95 duration-500 mx-auto">
                                <div className="size-20 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                    <IconCheck size={40} stroke={3} />
                                </div>
                                <h3 className="text-lg font-black text-zinc-950">¡Compra Autorizada con Éxito!</h3>
                                <p className="text-xs text-zinc-500 max-w-[280px]">
                                    El crédito ha sido restado de tu cupo y los detalles de tu compra fiada se cargaron.
                                </p>
                            </div>
                        ) : !pendingPurchase ? (
                            <div className="w-full max-w-sm rounded-2xl border border-amber-100 bg-[#fffdfa] p-6 space-y-6 text-center shadow-sm mx-auto">
                                <div className="size-16 rounded-full bg-amber-400/10 text-amber-500 flex items-center justify-center mx-auto">
                                    <IconLock size={32} />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-base font-black text-zinc-900">Autorizar Compra con PIN</h3>
                                    <p className="text-[11px] text-zinc-500 leading-normal max-w-[280px] mx-auto">
                                        Ingresa el PIN de 6 dígitos que te dictó el cajero para cargar el resumen de tu compra fiada.
                                    </p>
                                </div>

                                <div className="space-y-4 max-w-[250px] mx-auto">
                                    <Input 
                                        type="text" 
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        className="h-14 text-center text-2xl font-black tracking-[0.5em] rounded-xl border-amber-200 bg-white"
                                        placeholder="000000"
                                        value={authPin}
                                        onChange={(e) => setAuthPin(e.target.value.replace(/[^0-9]/g, ""))}
                                    />
                                    <Button
                                        onClick={() => handleFetchPendingPurchase(authPin)}
                                        disabled={isLoadingPendingPurchase || authPin.length !== 6}
                                        className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-950 font-black text-xs shadow-sm border-none transition-all duration-350 active:scale-95"
                                    >
                                        {isLoadingPendingPurchase ? "Buscando..." : "Buscar Compra"}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full max-w-sm space-y-4 animate-in zoom-in-95 duration-350 mx-auto">
                                {/* CART SUMMARY CARD */}
                                <div className="rounded-2xl border border-amber-150 bg-white p-5 space-y-4 shadow-sm">
                                    <div className="flex justify-between items-start pb-3 border-b border-zinc-100">
                                        <div className="space-y-0.5">
                                            <span className="text-[9px] font-extrabold uppercase text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100/50">
                                                {pendingPurchase.businessName}
                                            </span>
                                            <h4 className="font-extrabold text-sm text-zinc-800 mt-1">Resumen de Compra</h4>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold text-zinc-400 block uppercase leading-none">Total</span>
                                            <span className="text-lg font-black text-zinc-900 font-mono">${pendingPurchase.amount.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Item List */}
                                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                        {pendingPurchase.items.map((it: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center text-xs text-zinc-600">
                                                <span className="truncate max-w-[180px] font-medium">
                                                    {it.quantity}x {it.name || "Artículo"}
                                                </span>
                                                <span className="font-mono text-zinc-700 font-semibold">
                                                    ${((it.price || 0) * (it.quantity || 1)).toFixed(2)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* FREQUENCY SELECTOR */}
                                    <div className="rounded-2xl border border-amber-150 bg-white p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
                                        <h4 className="font-black text-xs text-zinc-800 uppercase tracking-wider">Elige la frecuencia de pago</h4>
                                        
                                        <div className="grid grid-cols-4 gap-2">
                                            {(() => {
                                                const limit = client?.syncroCreditFrequencyDays || settings?.syncroCreditFrequencyDays || pendingPurchase.frequencyDays || 15;
                                                const baseFrequencies = [5, 10, 15, 30];
                                                const filtered = baseFrequencies.filter(f => f <= limit);
                                                if (limit > 0 && !filtered.includes(limit)) {
                                                    filtered.push(limit);
                                                }
                                                filtered.sort((a, b) => a - b);
                                                return filtered.map((freq) => (
                                                    <button
                                                        key={freq}
                                                        type="button"
                                                        onClick={() => setSelectedFrequency(freq)}
                                                        className={`h-12 rounded-xl text-xs font-extrabold border transition-all duration-150 ${
                                                            selectedFrequency === freq
                                                                ? "bg-amber-400 border-amber-400 text-amber-950 shadow-sm"
                                                                : "bg-[#fffdfb] border-amber-100 text-zinc-700 hover:border-amber-400 hover:text-amber-500"
                                                        }`}
                                                    >
                                                        {freq} días
                                                    </button>
                                                ));
                                            })()}
                                        </div>
                                    </div>

                                    {/* INSTALLMENTS SELECTOR */}
                                    <div className="rounded-2xl border border-amber-150 bg-white p-5 space-y-4 shadow-sm">
                                        <h4 className="font-black text-xs text-zinc-800 uppercase tracking-wider">Elige el número de cuotas</h4>
                                        
                                        <div className="grid grid-cols-3 gap-2">
                                            {Array.from({ length: client?.syncroCreditMaxInstallments || settings?.syncroCreditMaxInstallments || 3 }, (_, i) => i + 1).map((num) => (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    onClick={() => setSelectedInstallments(num)}
                                                    className={`h-12 rounded-xl text-xs font-extrabold border transition-all duration-150 ${
                                                        selectedInstallments === num
                                                            ? "bg-amber-400 border-amber-400 text-amber-950 shadow-sm"
                                                            : "bg-[#fffdfb] border-amber-100 text-zinc-700 hover:border-amber-400 hover:text-amber-500"
                                                    }`}
                                                >
                                                    {num} {num === 1 ? "Cuota" : "Cuotas"}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Installment Calendar Preview */}
                                        <div className="bg-amber-50/20 border border-amber-100/50 rounded-xl p-4 space-y-3">
                                            <span className="text-[9px] font-extrabold uppercase text-amber-700 tracking-wider">Calendario de Pagos Estimado</span>
                                            <div className="space-y-2">
                                                {(() => {
                                                    const preview = [];
                                                    const total = pendingPurchase.amount;
                                                    const baseAmt = parseFloat((total / selectedInstallments).toFixed(2));
                                                    
                                                    for (let i = 1; i <= selectedInstallments; i++) {
                                                        const days = i * selectedFrequency;
                                                        const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
                                                        const formattedDate = date.toLocaleDateString("es-VE", {
                                                            day: "numeric",
                                                            month: "short",
                                                            year: "numeric"
                                                        });
                                                        
                                                        const installmentAmount = i === selectedInstallments
                                                            ? (total - (baseAmt * (selectedInstallments - 1))).toFixed(2)
                                                            : baseAmt.toFixed(2);
                                                        
                                                        preview.push(
                                                            <div key={i} className="flex justify-between items-center text-xs">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-zinc-700">Cuota {i} (en {days} días)</span>
                                                                    <span className="text-[9px] text-zinc-400 font-semibold">{formattedDate}</span>
                                                                </div>
                                                                <span className="font-mono text-zinc-950 font-bold">${installmentAmount} USD</span>
                                                            </div>
                                                        );
                                                    }
                                                    return preview;
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => setPendingPurchase(null)}
                                            className="flex-1 h-12 rounded-xl text-xs font-black"
                                        >
                                            Atrás
                                        </Button>
                                        <Button
                                            onClick={handleApprovePendingPurchase}
                                            disabled={submittingApproval}
                                            className="flex-[2] h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-500/10 border-none transition-all"
                                        >
                                            {submittingApproval ? "Autorizando..." : "Autorizar e Iniciar Crédito"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        
                    </div>
                )}
                </>
                )}
            </main>

            {/* CAPSULE BOTTOM NAV (GOOEY METABALLS DESIGN) */}
            {selectedProductForDetail === null && !isCheckoutOpen && !isCartOpen && (
                <div className="fixed bottom-6 left-6 right-6 h-16 max-w-sm mx-auto z-50 filter drop-shadow-[0_8px_20px_rgba(139,92,26,0.12)] animate-in slide-in-from-bottom duration-300">
                {/* SVG Filter for Gooey Effect */}
                <svg className="absolute w-0 h-0" width="0" height="0" version="1.1" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <filter id="gooey-nav">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
                            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
                            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                        </filter>
                    </defs>
                </svg>

                {/* Gooey Background Shapes */}
                <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ filter: "url(#gooey-nav)" }}>
                    {/* Main Bar Background */}
                    <div className="absolute inset-0 w-full h-full bg-white rounded-full" />
                    {/* Central Bubble Background (Enlarged) */}
                    <div className="absolute w-[84px] h-[84px] bg-white rounded-full -top-[30px] left-1/2 -translate-x-1/2" />
                </div>

                {/* Interactive Foreground Menu */}
                <div className="absolute inset-0 w-full h-full flex justify-around items-center px-4">
                    <button 
                        onClick={() => { 
                            setRequestLoanView(false); 
                            setActiveTab("home"); 
                            setIsOrdersListOpen(false);
                            setIsTrackingOpen(false);
                            setSelectedDebtForPayment(null);
                            setPaymentStep("details");
                            setSelectedInstallmentOption(null);
                            setTxSearchQuery("");
                            setOnlyInStock(true);
                            setSelectedProductForDetail(null);
                            setPurchaseSuccessData(null);
                        }} 
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors duration-300 ${activeTab === "home" && !requestLoanView ? "text-amber-500 font-extrabold" : "text-zinc-400"}`}
                    >
                        <IconCreditCard size={18} />
                        <span>Inicio</span>
                    </button>
                    <button 
                        onClick={() => { 
                            setRequestLoanView(false); 
                            setActiveTab("payments"); 
                            setIsOrdersListOpen(false);
                            setIsTrackingOpen(false);
                            setSelectedDebtForPayment(null);
                            setPaymentStep("details");
                            setSelectedInstallmentOption(null);
                            setTxSearchQuery("");
                            setOnlyInStock(true);
                            setSelectedProductForDetail(null);
                            setPurchaseSuccessData(null);
                        }} 
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors duration-300 ${activeTab === "payments" ? "text-amber-500 font-extrabold" : "text-zinc-400"}`}
                    >
                        <IconHistory size={18} />
                        <span>Pagos</span>
                    </button>

                    {/* Central Large PIN/Pay Button Container (Enlarged) */}
                    <div className="relative w-[84px] h-full flex items-center justify-center shrink-0">
                        <button 
                            onClick={() => { 
                                setRequestLoanView(false); 
                                setActiveTab("auth-purchase"); 
                                setIsOrdersListOpen(false);
                                setIsTrackingOpen(false);
                                setSelectedDebtForPayment(null);
                                setPaymentStep("details");
                                setSelectedInstallmentOption(null);
                                setTxSearchQuery("");
                                setOnlyInStock(true);
                                setSelectedProductForDetail(null);
                                setPurchaseSuccessData(null);
                            }} 
                            className={`absolute -top-[34px] w-[72px] h-[72px] rounded-full flex flex-col items-center justify-center transition-all duration-300 transform active:scale-95 shadow-md z-10 ${
                                activeTab === "auth-purchase" 
                                    ? "bg-amber-400 text-amber-950 scale-105 shadow-amber-400/35 border-none" 
                                    : "bg-[#fffbeb] border border-amber-200 text-amber-700 hover:bg-amber-100/40 shadow-zinc-200"
                            }`}
                        >
                            <IconLock size={22} className={activeTab === "auth-purchase" ? "animate-pulse" : ""} />
                            <span className="text-[10px] font-black uppercase tracking-wider mt-0.5">PIN</span>
                        </button>
                    </div> 
                    <button 
                        onClick={() => { 
                            setRequestLoanView(false); 
                            setActiveTab("rewards"); 
                            setIsOrdersListOpen(false);
                            setIsTrackingOpen(false);
                            setSelectedDebtForPayment(null);
                            setPaymentStep("details");
                            setSelectedInstallmentOption(null);
                            setTxSearchQuery("");
                            setOnlyInStock(true);
                            setSelectedProductForDetail(null);
                            setPurchaseSuccessData(null);
                        }} 
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors duration-300 ${activeTab === "rewards" ? "text-amber-500 font-extrabold" : "text-zinc-400"}`}
                    >
                        <IconShoppingBag size={18} />
                        <span>Comprar</span>
                    </button>
                    <button 
                        onClick={() => { 
                            setRequestLoanView(false); 
                            setActiveTab("profile"); 
                            setIsOrdersListOpen(false);
                            setIsTrackingOpen(false);
                            setSelectedDebtForPayment(null);
                            setPaymentStep("details");
                            setSelectedInstallmentOption(null);
                            setTxSearchQuery("");
                            setOnlyInStock(true);
                            setSelectedProductForDetail(null);
                            setPurchaseSuccessData(null);
                        }} 
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors duration-300 ${activeTab === "profile" ? "text-amber-500 font-extrabold" : "text-zinc-400"}`}
                    >
                        <IconUser size={18} />
                        <span>Perfil</span>
                    </button>
                </div>
            </div>
            )}

            {/* BRANCHES MODAL */}
            <Dialog open={isBranchesModalOpen} onOpenChange={setIsBranchesModalOpen}>
                <DialogContent className="max-w-md rounded-xl border-amber-100 bg-[#fffdfa] text-zinc-850 p-6 shadow-lg">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
                            <IconMapPin className="text-amber-700" size={20} />
                            Tiendas Cercanas
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500 text-xs font-medium">
                            Encuentra nuestras sucursales físicas para realizar tus compras, abonos y retiros de premios.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                        {branches.length === 0 ? (
                            <div className="p-4 rounded-xl border border-dashed border-amber-200/60 bg-amber-50/20 text-center">
                                <p className="font-extrabold text-sm text-zinc-800">
                                    {settings?.businessName || "Syncro Principal"}
                                </p>
                                <p className="text-xs text-zinc-500 mt-1">
                                    {settings?.address || settings?.businessAddress || "Ubicación principal de la tienda."}
                                </p>
                                {settings?.phone && (
                                    <p className="text-xs text-amber-700 font-bold mt-2">
                                        📞 {settings.phone}
                                    </p>
                                )}
                            </div>
                        ) : (
                            branches.map((b) => (
                                <div key={b.id} className="p-4 rounded-xl border border-amber-100 bg-white space-y-2 relative transition-all hover:border-amber-200">
                                    {b.isMain && (
                                        <Badge className="absolute top-3 right-3 bg-amber-100 text-amber-800 border-none font-bold text-[9px] px-2 py-0.5 rounded-full">
                                            Principal
                                        </Badge>
                                    )}
                                    <p className="font-extrabold text-sm text-zinc-800 pr-12">{b.name}</p>
                                    <p className="text-xs text-zinc-505 flex items-start gap-1">
                                        <IconMapPin size={14} className="text-zinc-400 shrink-0 mt-0.5" />
                                        <span>{b.location || b.state || "Sin dirección registrada"}</span>
                                    </p>
                                    {b.phone && (
                                        <p className="text-xs text-amber-700 font-extrabold flex items-center gap-1">
                                            <span>📞</span>
                                            <span>{b.phone}</span>
                                        </p>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Floating Shopping Cart Button */}
            {activeTab === "rewards" && selectedBranchForShop !== null && (
                <button
                    onClick={() => {
                        setCheckoutItems(cart);
                        setIsCartOpen(true);
                    }}
                    className="fixed bottom-[108px] right-6 z-40 size-14 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-lg shadow-amber-400/25 active:scale-95 transition-all duration-200 border-none animate-in zoom-in-95 duration-200 cursor-pointer"
                >
                    <div className="relative">
                        <IconShoppingBag size={24} />
                        {cart.reduce((sum, item) => sum + item.quantity, 0) > 0 && (
                            <span className="absolute -top-3.5 -right-3.5 bg-rose-500 text-white text-[10px] font-black size-6 rounded-full flex items-center justify-center border-2 border-[#faf9f5]">
                                {cart.reduce((sum, item) => sum + item.quantity, 0)}
                            </span>
                        )}
                    </div>
                </button>
            )}




            {/* SHOPPING CART FULL PAGE OVERLAY */}
            {isCartOpen && (
                <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#faf9f5] z-50 overflow-y-auto px-6 pt-8 pb-28 flex flex-col space-y-5 animate-in slide-in-from-right duration-300">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-zinc-150/40 shrink-0">
                        <button
                            onClick={() => setIsCartOpen(false)}
                            className="text-xs text-[#854d0e] hover:text-amber-855 font-extrabold h-8 px-3 rounded-full bg-amber-50 hover:bg-amber-100/60 border border-amber-200/50 flex items-center gap-1 transition-all duration-300 cursor-pointer animate-in fade-in"
                        >
                            <IconChevronLeft size={14} />
                            <span>Volver</span>
                        </button>
                        <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-955 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                            Carrito de Compras
                        </span>
                    </div>

                    {cart.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-20 gap-4 animate-in fade-in zoom-in duration-300">
                            <div className="size-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 shadow-sm shadow-amber-400/5">
                                <IconShoppingBag size={32} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-black text-zinc-800">Tu carrito está vacío</p>
                                <p className="text-xs text-zinc-450 font-semibold max-w-[200px] mx-auto leading-relaxed">
                                    Agrega productos de los comercios para iniciar tu compra a crédito.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col justify-between">
                            {/* Items List */}
                            <div className="space-y-3.5 overflow-y-auto pr-1 flex-1">
                                {cart.map((item) => {
                                    const firstVariant = item.product.variants?.[0];
                                    const price = firstVariant?.promoPrice || firstVariant?.price || 0;

                                    return (
                                        <div key={item.product.id} className="flex justify-between items-center gap-4 bg-white border border-zinc-100 p-3 rounded-xl shadow-xs">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                {item.product.image ? (
                                                    <img src={item.product.image} alt={item.product.name} loading="lazy" decoding="async" className="size-12 rounded-lg object-cover shrink-0" />
                                                ) : (
                                                    <div className="size-12 bg-zinc-50 border border-zinc-100 text-zinc-400 flex items-center justify-center rounded-lg shrink-0">
                                                        <IconShoppingBag size={18} />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="font-extrabold text-xs text-zinc-800 truncate">{item.product.name}</p>
                                                    <p className="text-[10px] font-black text-zinc-455 mt-0.5">${price.toFixed(2)} c/u</p>
                                                </div>
                                            </div>

                                            {/* Quantity controls */}
                                            <div className="flex items-center gap-2.5 shrink-0">
                                                <button
                                                    onClick={() => updateCartQuantity(item.product.id, -1)}
                                                    className="size-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center font-black border-none text-xs transition-colors cursor-pointer"
                                                >
                                                    -
                                                </button>
                                                <span className="font-black text-xs text-zinc-850 text-center w-4">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateCartQuantity(item.product.id, 1)}
                                                    className="size-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center font-black border-none text-xs transition-colors cursor-pointer"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Total and Checkout */}
                            <div className="pt-4 border-t border-zinc-150/40 bg-[#faf9f5] space-y-4 shrink-0 mt-4">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs font-bold text-zinc-450 uppercase tracking-wider">Total estimado:</span>
                                    <span className="text-xl font-black text-zinc-900 font-mono">
                                        ${cart.reduce((sum, item) => {
                                            const firstVariant = item.product.variants?.[0];
                                            const price = firstVariant?.promoPrice || firstVariant?.price || 0;
                                            return sum + price * item.quantity;
                                        }, 0).toFixed(2)}
                                    </span>
                                </div>

                                <Button
                                    onClick={() => handleCheckout(cart)}
                                    className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-955 font-black text-xs transition-all duration-200 border-none shadow-md shadow-amber-400/10"
                                >
                                    Proceder al Pago
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}




            {/* PURCHASE SUCCESS CONFIRMATION MODAL */}
            <Dialog open={purchaseSuccessData !== null} onOpenChange={(open) => { if (!open) setPurchaseSuccessData(null); }}>
                <DialogContent className="max-w-md rounded-2xl border-emerald-150 bg-[#fdfdfd] text-zinc-850 p-6 shadow-xl text-center">
                    {purchaseSuccessData && (
                        <div className="space-y-6">
                            <div className="flex justify-center pt-2">
                                <div className="relative flex items-center justify-center size-20 rounded-full bg-emerald-50 text-emerald-500">
                                    <span className="absolute size-20 rounded-full bg-emerald-100 animate-ping opacity-25" />
                                    <IconCheck size={42} className="relative z-10" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-zinc-900 leading-tight">¡Orden Reservada Exitosamente!</h3>
                                <p className="text-xs text-zinc-500 leading-relaxed font-semibold max-w-xs mx-auto">
                                    Tu compra a crédito por un total de <strong className="text-zinc-900 font-black">${purchaseSuccessData.amount.toFixed(2)} USD</strong> ha sido pre-autorizada.
                                </p>
                            </div>

                            {/* PIN Code display card */}
                            <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-5 space-y-2">
                                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">Código de Retiro / PIN</span>
                                <span className="text-3xl font-black tracking-[0.2em] font-mono text-emerald-950 block">{purchaseSuccessData.pin}</span>
                                <p className="text-[10px] text-emerald-700/80 font-bold max-w-xs mx-auto leading-relaxed pt-1.5 border-t border-emerald-100/50 mt-1">
                                    Muestra este código al cajero o dile tu nombre para retirar tu pedido y formalizar el plan de pago.
                                </p>
                            </div>

                            {/* Aceptar Button */}
                            <Button
                                onClick={() => setPurchaseSuccessData(null)}
                                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs transition-all duration-200 border-none mt-2"
                            >
                                Entendido
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {isTrackingOpen && activeDeliveryOrder !== null && (
                /* Active Delivery Order Tracking View */
                            <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#faf9f5] z-[45] overflow-y-auto px-6 pt-8 pb-28 flex flex-col space-y-5 animate-in slide-in-from-right duration-300">
                                {/* Sharpie marker phrase in header */}
                                <div className="flex items-center shrink-0">
                                    <span className="text-zinc-850 text-4xl font-handwritten select-none leading-none tracking-normal">
                                        {`¡Sigue tu envío${client ? `, ${client.name.split(" ")[0]}` : ""}!`}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-150/40 shrink-0">
                                    <button
                                        onClick={() => {
                                            setIsTrackingOpen(false);
                                        }}
                                        className="text-xs text-[#854d0e] hover:text-amber-855 font-extrabold h-8 px-3 rounded-full bg-amber-50 hover:bg-amber-100/60 border border-amber-200/50 flex items-center gap-1 transition-all duration-300 cursor-pointer animate-in fade-in"
                                    >
                                        <IconChevronLeft size={14} />
                                        <span>Volver</span>
                                    </button>
                                    <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider ${
                                        activeDeliveryOrder.status === "PENDING"
                                            ? "bg-amber-50 border border-amber-100 text-amber-955"
                                            : activeDeliveryOrder.status === "APPROVED"
                                            ? "bg-blue-50 border border-blue-100 text-blue-955"
                                            : activeDeliveryOrder.status === "SHIPPED"
                                            ? "bg-indigo-50 border border-indigo-100 text-indigo-955"
                                            : activeDeliveryOrder.status === "ON_THE_WAY"
                                            ? "bg-orange-50 border border-orange-100 text-orange-955"
                                            : activeDeliveryOrder.status === "DELIVERED"
                                            ? "bg-emerald-50 border border-emerald-100 text-emerald-955"
                                            : "bg-zinc-50 border border-zinc-100 text-zinc-955"
                                    }`}>
                                        {activeDeliveryOrder.status === "PENDING" ? "Verificando" :
                                         activeDeliveryOrder.status === "APPROVED" ? "Aprobado" :
                                         activeDeliveryOrder.status === "SHIPPED" ? "Salida de Tienda" :
                                         activeDeliveryOrder.status === "ON_THE_WAY" ? "En Camino" :
                                         activeDeliveryOrder.status === "DELIVERED" ? "Entregado" :
                                         activeDeliveryOrder.status === "CANCELLED" ? "Cancelado" :
                                         activeDeliveryOrder.status === "REJECTED" ? "Rechazado" :
                                         activeDeliveryOrder.status}
                                    </span>
                                </div>

                                {activeDeliveryOrder.status === "PENDING" ? (
                                    /* Premium validation loading screen */
                                    <div className="flex-1 flex flex-col items-center justify-center py-10 space-y-8 select-none">
                                        <div className="relative size-32 flex items-center justify-center">
                                            {/* Concentric expanding waves */}
                                            <span className="absolute size-28 rounded-full bg-amber-500/10 animate-ping" style={{ animationDuration: '3s' }} />
                                            <span className="absolute size-20 rounded-full bg-amber-500/15 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '500ms' }} />
                                                                               {/* Needle pin with round head */}
                                            <div className="relative z-10 -translate-y-5 drop-shadow-[0_16px_28px_rgba(245,158,11,0.45)] animate-bounce" style={{ animationDuration: '2s' }}>
                                                <svg width="48" height="80" viewBox="0 0 24 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    {/* Needle Stem (metallic silver with cylindrical reflection) */}
                                                    <path d="M11.4 16 L12.6 16 L12.15 37.5 L12.0 39 L11.85 37.5 Z" fill="url(#sewingPinStemGrad)" />
                                                    
                                                    {/* Round Head (3D glossy ball) */}
                                                    <circle cx="12" cy="11" r="9" fill="url(#sewingPinHeadGrad)" stroke="#ffffff" strokeWidth="1.5" />
                                                    
                                                    {/* Inner glossy highlight reflections */}
                                                    <circle cx="9.5" cy="8.5" r="3" fill="#ffffff" opacity="0.65" />
                                                    <circle cx="8.2" cy="7.2" r="1" fill="#ffffff" opacity="0.85" />
                                                    
                                                    <defs>
                                                        {/* Radial gradient to create a 3D sphere effect */}
                                                        <radialGradient id="sewingPinHeadGrad" cx="30%" cy="30%" r="70%">
                                                            <stop offset="0%" stopColor="#fbbf24" />
                                                            <stop offset="40%" stopColor="#f59e0b" />
                                                            <stop offset="80%" stopColor="#d97706" />
                                                            <stop offset="100%" stopColor="#92400e" />
                                                        </radialGradient>
                                                        
                                                        {/* Linear gradient for metallic silver look */}
                                                        <linearGradient id="sewingPinStemGrad" x1="11.4" y1="16" x2="12.6" y2="16" gradientUnits="userSpaceOnUse">
                                                            <stop offset="0%" stopColor="#94a3b8" />
                                                            <stop offset="30%" stopColor="#f8fafc" />
                                                            <stop offset="60%" stopColor="#cbd5e1" />
                                                            <stop offset="100%" stopColor="#475569" />
                                                        </linearGradient>
                                                    </defs>
                                                </svg>
                                            </div>
                                        </div>
                                        
                                        <div className="text-center space-y-2">
                                            <h3 className="text-base font-black text-zinc-800 flex items-center justify-center gap-1.5">
                                                <span>Validando dirección</span>
                                                <span className="flex gap-1">
                                                    <span className="size-1.5 bg-zinc-800 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                    <span className="size-1.5 bg-zinc-800 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                    <span className="size-1.5 bg-zinc-800 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                </span>
                                            </h3>
                                            <p className="text-xs text-zinc-500 font-semibold max-w-[280px] mx-auto leading-relaxed">
                                                El comercio está validando la cobertura y asignando un repartidor para tu ubicación.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    /* Approved Tracking Details with Map and Timeline */
                                    <div className="space-y-5">
                                        {/* Map rendering the coordinates - half screen height, edge-to-edge */}
                                        <div className="relative -mx-6 -mt-5 h-[45vh] bg-zinc-50 border-b border-zinc-150/60 shadow-inner overflow-hidden">
                                            <div ref={trackingMapContainerRef} className="w-full h-full" />
                                            {activeDeliveryOrder.address && (
                                                <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-md border border-zinc-100 text-xs text-zinc-700 font-semibold">
                                                    <p className="font-bold text-zinc-800 text-[10px] uppercase tracking-wider mb-0.5">Dirección de Entrega</p>
                                                    <p className="text-zinc-600 leading-relaxed font-medium">{activeDeliveryOrder.address}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Timeline route progress card */}
                                        <div className="bg-white border border-zinc-100 rounded-2xl p-5 space-y-4 shadow-sm">
                                            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Estado del Envío</h4>
                                            <div className="relative pl-6 space-y-6">
                                                {/* Vertical line */}
                                                <div className="absolute left-2.5 top-2.5 bottom-2.5 w-0.5 bg-zinc-100" />
                                                
                                                {/* Step 1: Aprobado */}
                                                <div className="relative flex gap-3">
                                                    <div className="absolute -left-[20px] size-4 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center shadow-sm" />
                                                    <div>
                                                        <span className="block text-xs font-bold text-zinc-800">Pedido Aprobado</span>
                                                        <span className="block text-[10px] text-zinc-500 font-semibold">El comercio aceptó tu solicitud</span>
                                                    </div>
                                                </div>

                                                {/* Step 2: Salida de Tienda */}
                                                <div className={`relative flex gap-3 transition-opacity duration-300 ${
                                                    (activeDeliveryOrder.status === "SHIPPED" || activeDeliveryOrder.status === "ON_THE_WAY" || activeDeliveryOrder.status === "DELIVERED") ? "opacity-100" : "opacity-55"
                                                }`}>
                                                    <div className={`absolute -left-[20px] size-4 rounded-full border-4 border-white flex items-center justify-center shadow-sm ${
                                                        (activeDeliveryOrder.status === "ON_THE_WAY" || activeDeliveryOrder.status === "DELIVERED")
                                                            ? "bg-emerald-500"
                                                            : activeDeliveryOrder.status === "SHIPPED"
                                                            ? "bg-amber-500 animate-pulse"
                                                            : "bg-zinc-200"
                                                    }`} />
                                                    <div>
                                                        <span className={`block text-xs font-bold ${
                                                            (activeDeliveryOrder.status === "SHIPPED" || activeDeliveryOrder.status === "ON_THE_WAY" || activeDeliveryOrder.status === "DELIVERED")
                                                                ? "text-zinc-800"
                                                                : "text-zinc-400"
                                                        }`}>Salida de Tienda</span>
                                                        <span className="block text-[10px] font-semibold text-zinc-500">El pedido salió del establecimiento</span>
                                                    </div>
                                                </div>

                                                {/* Step 3: En Camino */}
                                                <div className={`relative flex gap-3 transition-opacity duration-300 ${
                                                    (activeDeliveryOrder.status === "ON_THE_WAY" || activeDeliveryOrder.status === "DELIVERED") ? "opacity-100" : "opacity-55"
                                                }`}>
                                                    <div className={`absolute -left-[20px] size-4 rounded-full border-4 border-white flex items-center justify-center shadow-sm ${
                                                        activeDeliveryOrder.status === "DELIVERED"
                                                            ? "bg-emerald-500"
                                                            : activeDeliveryOrder.status === "ON_THE_WAY"
                                                            ? "bg-amber-500 animate-pulse"
                                                            : "bg-zinc-200"
                                                    }`} />
                                                    <div>
                                                        <span className={`block text-xs font-bold ${
                                                            (activeDeliveryOrder.status === "ON_THE_WAY" || activeDeliveryOrder.status === "DELIVERED")
                                                                ? "text-zinc-800"
                                                                : "text-zinc-400"
                                                        }`}>En Camino</span>
                                                        <span className="block text-[10px] font-semibold text-zinc-500">El repartidor va hacia tu ubicación</span>
                                                    </div>
                                                </div>

                                                {/* Step 4: Entregado */}
                                                <div className={`relative flex gap-3 transition-opacity duration-300 ${
                                                    activeDeliveryOrder.status === "DELIVERED" ? "opacity-100" : "opacity-55"
                                                }`}>
                                                    <div className={`absolute -left-[20px] size-4 rounded-full border-4 border-white flex items-center justify-center shadow-sm ${
                                                        activeDeliveryOrder.status === "DELIVERED" ? "bg-emerald-500" : "bg-zinc-200"
                                                    }`} />
                                                    <div>
                                                        <span className={`block text-xs font-bold ${
                                                            activeDeliveryOrder.status === "DELIVERED" ? "text-zinc-800" : "text-zinc-400"
                                                        }`}>Recibido</span>
                                                        <span className={`block text-[10px] font-semibold ${
                                                            activeDeliveryOrder.status === "DELIVERED" ? "text-zinc-500" : "text-zinc-400"
                                                        }`}>Confirmar llegada con el repartidor</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Cancellation Action for the Client */}
                                        {(activeDeliveryOrder.status === "PENDING" || activeDeliveryOrder.status === "APPROVED") && (
                                            <div className="pt-2">
                                                <Button
                                                    onClick={() => setShowCancelConfirmModal(true)}
                                                    disabled={isCancellingOrder}
                                                    className="w-full h-11 rounded-xl bg-white border border-rose-200 hover:bg-rose-50/40 text-rose-600 font-bold text-xs transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                                                >
                                                    {isCancellingOrder ? (
                                                        <>
                                                            <span className="size-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                                                            <span>Cancelando...</span>
                                                        </>
                                                    ) : (
                                                        <span>Cancelar Pedido</span>
                                                    )}
                                                </Button>
                                            </div>
                                        )}

                                        {/* Wobbly/Sharpie Hand-drawn Arrows pointing to the PIN button */}
                                        <div className="flex flex-col items-center justify-center pt-6 pb-4 space-y-1.5 select-none">
                                            <span className="text-zinc-750 text-[19px] font-handwritten text-center max-w-[310px] leading-relaxed rotate-[-1.5deg]">
                                                ¡Pide el PIN de 6 dígitos al repartidor y presiona el botón de abajo para completar tu compra!
                                            </span>
                                            <div className="flex justify-center items-center pt-2 text-[#b45309]">
                                                {/* Single long curved hand-drawn arrow pointing to center PIN button */}
                                                <svg viewBox="0 0 60 80" className="w-20 h-28" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M 40,8 Q 15,35 28,70" />
                                                    <path d="M 17,62 Q 22,68 28,70" />
                                                    <path d="M 29,56 Q 29,65 28,70" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
            )}
{isOrdersListOpen && (
                            <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#faf9f5] z-40 overflow-y-auto px-6 pt-8 pb-28 flex flex-col space-y-5 animate-in slide-in-from-right duration-300">
                                {/* Sharpie marker phrase in header */}
                                <div className="flex items-center shrink-0">
                                    <span className="text-zinc-850 text-4xl font-handwritten select-none leading-none tracking-normal">
                                        {`¡Tus pedidos${client ? `, ${client.name.split(" ")[0]}` : ""}!`}
                                    </span>
                                </div>

                                {/* Header */}
                                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-150/40 shrink-0">
                                    <button
                                        onClick={() => setIsOrdersListOpen(false)}
                                        className="text-xs text-[#854d0e] hover:text-amber-855 font-extrabold h-8 px-3 rounded-full bg-amber-50 hover:bg-amber-100/60 border border-amber-200/50 flex items-center gap-1 transition-all duration-300 cursor-pointer animate-in fade-in"
                                    >
                                        <IconChevronLeft size={14} />
                                        <span>Volver</span>
                                    </button>
                                    <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-955 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                                        Mis Pedidos
                                    </span>
                                </div>

                                {/* List content */}
                                {isLoadingOrdersList && portalDeliveryOrders.length === 0 ? (
                                    <div className="space-y-3.5 animate-pulse">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="bg-white border border-zinc-100 rounded-2xl p-4.5 space-y-3.5 h-24 flex flex-col justify-between">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1.5">
                                                        <div className="h-3 w-16 bg-zinc-200/80 rounded" />
                                                        <div className="h-4.5 w-44 bg-zinc-200/80 rounded" />
                                                    </div>
                                                    <div className="h-5 w-24 bg-zinc-150/70 rounded-full" />
                                                </div>
                                                <div className="h-3.5 w-32 bg-zinc-150/70 rounded" />
                                            </div>
                                        ))}
                                    </div>
                                ) : portalDeliveryOrders.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center py-20 gap-4 animate-in fade-in zoom-in duration-300">
                                        <div className="size-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 shadow-sm shadow-amber-400/5">
                                            <IconTruck size={32} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-zinc-800">Sin pedidos activos</p>
                                            <p className="text-xs text-zinc-450 font-semibold max-w-[200px] mx-auto leading-relaxed">Aquí podrás ver el estado de tus envíos cuando realices una compra.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {portalDeliveryOrders.map((order: any) => {
                                            let statusLabel = "";
                                            let statusColor = "";
                                            if (order.status === "PENDING") {
                                                statusLabel = "Validando dirección";
                                                statusColor = "bg-amber-50 border border-amber-100 text-amber-700";
                                            } else if (order.status === "APPROVED") {
                                                statusLabel = "En camino";
                                                statusColor = "bg-blue-50 border border-blue-100 text-blue-700";
                                            } else if (order.status === "DELIVERED") {
                                                statusLabel = "Entregado";
                                                statusColor = "bg-emerald-50 border border-emerald-100 text-emerald-700";
                                            } else if (order.status === "REJECTED") {
                                                statusLabel = "Rechazado";
                                                statusColor = "bg-rose-50 border border-rose-100 text-rose-700";
                                            }

                                            return (
                                                <div
                                                    key={order.id}
                                                    onClick={() => {
                                                        setActiveDeliveryOrder(order);
                                                        setIsTrackingOpen(true);
                                                        setActiveTab("rewards");
                                                    }}
                                                    className="bg-white border border-zinc-100 rounded-2xl p-4.5 shadow-xs hover:border-amber-200/50 transition-all active:scale-[0.99] cursor-pointer flex flex-col gap-3 group animate-in fade-in duration-200"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="space-y-0.5">
                                                            <span className="text-[9px] text-zinc-400 font-extrabold uppercase font-mono tracking-wider">
                                                                Pedido #{order.id.slice(0, 8)}
                                                            </span>
                                                            <h4 className="text-xs font-black text-zinc-800 group-hover:text-amber-500 transition-colors">
                                                                {order.address || "Dirección de Entrega"}
                                                            </h4>
                                                        </div>
                                                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${statusColor}`}>
                                                            {statusLabel}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between items-center text-[10px] text-zinc-500 font-semibold border-t border-zinc-50 pt-2.5">
                                                        <span className="font-mono">
                                                            Total: <strong className="text-emerald-600 font-extrabold">${order.total.toFixed(2)}</strong>
                                                        </span>
                                                        <span className="text-[9px] text-zinc-450">
                                                            {new Date(order.createdAt).toLocaleDateString("es-VE", {
                                                                day: "numeric",
                                                                month: "short",
                                                                hour: "2-digit",
                                                                minute: "2-digit"
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

            {/* Cancel Order Confirmation Modal */}
            {showCancelConfirmModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.55)'}}>
                    <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="bg-rose-50 px-6 pt-7 pb-5 text-center">
                            <div className="size-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="8" x2="12" y2="12"/>
                                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                            </div>
                            <h3 className="text-base font-black text-zinc-900 mb-1">¿Cancelar este pedido?</h3>
                            <p className="text-xs text-zinc-500 font-semibold leading-relaxed">
                                Esta acción no se puede deshacer. El pedido será cancelado y tendrás que hacer uno nuevo.
                            </p>
                        </div>
                        {/* Actions */}
                        <div className="px-6 pb-6 pt-4 flex flex-col gap-3">
                            <button
                                onClick={handleCancelOrder}
                                disabled={isCancellingOrder}
                                className="w-full h-12 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black text-sm transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                {isCancellingOrder ? (
                                    <>
                                        <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Cancelando...</span>
                                    </>
                                ) : (
                                    "Sí, cancelar pedido"
                                )}
                            </button>
                            <button
                                onClick={() => setShowCancelConfirmModal(false)}
                                disabled={isCancellingOrder}
                                className="w-full h-12 rounded-2xl bg-zinc-100 hover:bg-zinc-200 active:scale-95 text-zinc-700 font-black text-sm transition-all duration-200"
                            >
                                No, mantener pedido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
