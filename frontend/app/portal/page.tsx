"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
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
    IconWallet, IconBrandPaypal, IconTrophy, IconArrowRight, IconChevronDown, IconEye, IconEyeOff
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
import { NubiSplash, syncThemeColor } from "@/components/portal/nubi-splash";
import { NubiFace, type NubiMood, type NubiRoll } from "@/components/portal/nubi-face";
import { NubiPortal, type PortalFx } from "@/components/portal/nubi-portal";
import { NubiPodium } from "@/components/portal/nubi-podium";
import { ScAdCard } from "@/components/portal/sc-ad-card";

/** Starts "Nubi's portal" (the screen between the login and the account) from inside the app. */
type PortalControl = { start: (fx: PortalFx, onMid?: () => void) => void; ready: () => void };

const API = API_URL;
const MAPBOX_TOKEN = "pk.eyJ1Ijoic3luY3JvcG9zIiwiYSI6ImNtcW80eHJoazF0MjQycXB6b2Q2c3loc3UifQ.RuEyWvPOieOxbOXf9Rq8rQ";

/** The app behind Nubi's start screen, which leaves once the session check is done. */
export default function ClientPortal() {
    const [ready, setReady] = useState(false);
    const onReady = useCallback(() => setReady(true), []);
    // Nubi's portal: covers the jump between the login and the account (both ways)
    const [fx, setFx] = useState<PortalFx | null>(null);
    const [fxReady, setFxReady] = useState(false);
    const fxMid = useRef<(() => void) | undefined>(undefined);
    const portal = useMemo<PortalControl>(() => ({
        start: (f, onMid) => { fxMid.current = onMid; setFxReady(false); setFx(f); },
        ready: () => setFxReady(true),
    }), []);
    return (
        <>
            <ClientPortalApp onReady={onReady} portal={portal} />
            {fx && <NubiPortal key={fx.mode + fx.title} fx={fx} ready={fxReady} onMid={() => fxMid.current?.()} onDone={() => setFx(null)} />}
            <NubiSplash ready={ready} />
        </>
    );
}

/** Small header used on every screen: the app name above the screen's title. */
const PortalTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="select-none">
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-zinc-900">{children}</h1>
    </div>
);

function ClientPortalApp({ onReady, portal }: { onReady: () => void; portal: PortalControl }) {
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
    useEffect(() => { if (!isInitializing) onReady(); }, [isInitializing, onReady]);
    // Status bar: orange while the orange login is on screen, bone inside the app
    useEffect(() => { syncThemeColor(); });
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

    // Document type of the cédula (V, E, J, G, C), picked next to the number in the login
    const [docType, setDocType] = useState("V");
    // The eye in the password fields: show what you typed
    const [showPass, setShowPass] = useState(false);
    // Redesign: the installment plan and the history are views of their own; the home carousel
    const [planDebt, setPlanDebt] = useState<any | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [adIndex, setAdIndex] = useState(0);
    // Syncro Credit level (by money paid on time), the "Mi nivel" view and the level-up celebration
    const [scLevel, setScLevel] = useState<any | null>(null);
    const [showLevel, setShowLevel] = useState(false);
    const [levelUp, setLevelUp] = useState<any | null>(null);
    const [scAds, setScAds] = useState<any[]>([]);
    const creditCardRef = useRef<HTMLDivElement | null>(null);
    // Next payment: the day's list unfolded, and the "¿Qué quieres pagar?" sheet
    const [payDayOpen, setPayDayOpen] = useState(false);
    const [paySheet, setPaySheet] = useState<{ insts: any[]; title: string } | null>(null);
    const [sheetMode, setSheetMode] = useState<"all" | "pick" | "other">("all");
    // Receipts already decided that the client closed (so "¡Pago aprobado!" shows once)
    const [seenSubs, setSeenSubs] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem("sc-seen-subs") || "[]"); } catch { return []; }
    });
    const dismissSub = (id: string) => setSeenSubs((prev) => {
        const next = [...prev, id].slice(-50);
        try { localStorage.setItem("sc-seen-subs", JSON.stringify(next)); } catch { /* private mode */ }
        return next;
    });
    // Between login steps Nubi rolls (forward or back) and the sheet slides to the next step
    const [nubiRoll, setNubiRoll] = useState<NubiRoll>({ n: 0, dir: 1 });
    const rollNubi = (dir: 1 | -1) => setNubiRoll((r) => ({ n: r.n + 1, dir }));
    const [shownStep, setShownStep] = useState(loginStep);
    const [stepAnim, setStepAnim] = useState<{ phase: "out" | "in"; dir: 1 | -1 } | null>(null);
    useEffect(() => {
        if (loginStep === shownStep) return;
        // back only when returning to the cédula; password → reset code is still forward
        const dir: 1 | -1 = loginStep === "document" ? -1 : 1;
        setStepAnim({ phase: "out", dir });
        const t = setTimeout(() => { setShownStep(loginStep); setStepAnim({ phase: "in", dir }); }, 200);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loginStep]);
    // Waiting for the server (cédula, password, activation): Nubi rolls forward until it answers
    useEffect(() => { if (loading && view === "login") rollNubi(1); }, [loading, view]);
    // The sheet follows the height of each step smoothly instead of jumping
    const [stepH, setStepH] = useState<number | null>(null);
    const stepRo = useRef<ResizeObserver | null>(null);
    const stepBox = useCallback((el: HTMLDivElement | null) => {
        stepRo.current?.disconnect();
        if (!el) return;
        stepRo.current = new ResizeObserver(() => setStepH(el.offsetHeight));
        stepRo.current.observe(el);
    }, []);
    // Nubi in the login reacts: thinks while checking, sad on a mistake, happy when it knows you
    const [nubiFlash, setNubiFlash] = useState<NubiMood | null>(null);
    const nubiFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const nubiFeel = (m: NubiMood, ms = 2600) => {
        if (nubiFlashTimer.current) clearTimeout(nubiFlashTimer.current);
        setNubiFlash(m);
        nubiFlashTimer.current = setTimeout(() => setNubiFlash(null), ms);
    };

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
            // "Para ti" ads (Syncro Central)
            fetch(`${API}/portal-ads`, { headers: { Authorization: `Bearer ${token}` } })
                .then((r) => (r.ok ? r.json() : []))
                .then((a) => setScAds(Array.isArray(a) ? a : []))
                .catch(() => setScAds([]));

            const levelRes = await fetch(`${API}/clients/portal/level`, {
                headers: { Authorization: `Bearer ${token}` }
            }).catch(() => null);
            if (levelRes?.ok) {
                const lv = await levelRes.json();
                setScLevel(lv);
                // celebrate once when the client really went up (3 → 2 → 1)
                try {
                    const sub = JSON.parse(atob(token.split(".")[1])).sub;
                    const key = `sc-level-${sub}`;
                    const seen = Number(localStorage.getItem(key) || 0);
                    if (seen && lv.level < seen) setLevelUp(lv);
                    localStorage.setItem(key, String(lv.level));
                } catch { /* private mode */ }
            }

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
            nubiFeel("sad"); toast.error("Por favor ingresa tu número de identificación.");
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
                    nubiFeel("surprised", 1600);
                }
            } else {
                const err = await res.json();
                nubiFeel("sad"); toast.error(err.message || "Identificación no encontrada en el sistema.");
            }
        } catch (error) {
            nubiFeel("sad"); toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    const handleLoginWithPassword = async () => {
        if (!password.trim()) {
            nubiFeel("sad"); toast.error("Por favor ingresa tu contraseña.");
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
                const first = String(data.client?.name || clientName || "").trim().split(" ")[0];
                portal.start({ mode: "enter", title: first ? `¡Hola, ${first}!` : "¡Hola!", subtitle: "Abriendo tu cuenta" });
                await loadPortalData(data.access_token);
                setView("dashboard");
                portal.ready();
            } else {
                const err = await res.json();
                nubiFeel("sad"); toast.error(err.message || "Contraseña incorrecta.");
            }
        } catch (error) {
            nubiFeel("sad"); toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterPassword = async () => {
        if (!activationCode.trim()) {
            nubiFeel("sad"); toast.error("Por favor ingresa el código de activación.");
            return;
        }
        if (!password.trim()) {
            nubiFeel("sad"); toast.error("Por favor ingresa la nueva contraseña.");
            return;
        }
        if (password !== confirmPassword) {
            nubiFeel("sad"); toast.error("Las contraseñas no coinciden.");
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
                portal.start({ mode: "enter", title: isResettingPassword ? "¡Contraseña lista!" : "¡Cuenta activada!", subtitle: "Preparando todo para ti" });
                await loadPortalData(data.access_token);
                setView("dashboard");
                portal.ready();
            } else {
                const err = await res.json();
                nubiFeel("sad"); toast.error(err.message || "Error al registrar contraseña.");
            }
        } catch (error) {
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("client_token");
        setIdSearch("");
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

    // Log out behind Nubi's goodbye (the portal swaps to the login while it covers the screen)
    const requestLogout = () => {
        const first = String(client?.name || "").trim().split(" ")[0];
        portal.start({ mode: "leave", title: first ? `¡Hasta pronto, ${first}!` : "¡Hasta pronto!", subtitle: "Cerrando tu sesión de forma segura" }, handleLogout);
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

    // A receipt in review: ask every 20 s (and when the app comes back) until the business decides;
    // then reload the account so the installments show the payment applied
    useEffect(() => {
        if (view !== "dashboard" || !mySubmissions.some((x: any) => x.status === "PENDING")) return;
        const token = localStorage.getItem("client_token");
        if (!token) return;
        const check = async () => {
            try {
                const r = await fetch(`${API}/clients/portal/payments/submissions`, { headers: { Authorization: `Bearer ${token}` } });
                if (!r.ok) return;
                const fresh = await r.json();
                const changed = fresh.some((n: any) => { const o = mySubmissions.find((x: any) => x.id === n.id); return o && o.status !== n.status; });
                if (changed) await loadPortalData(token);
            } catch { /* offline: next round */ }
        };
        const t = setInterval(check, 20000);
        const onVis = () => { if (document.visibilityState === "visible") check(); };
        document.addEventListener("visibilitychange", onVis);
        return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
    }, [view, mySubmissions, loadPortalData]);

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
            label: "Crédito disponible",
        }
    } satisfies ChartConfig;

    // Custom floating keyframes for slow, smooth, elegant float
    const animationStyle = (
        <style>{`
            html, body {
                background-color: ${"#F7F5F0"} !important;
                background: ${"#F7F5F0"} !important;
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
                background-color: #FDE4D8 !important;
$1color: #8E3418 !important;
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
            <div className="min-h-screen bg-background text-zinc-800 font-sans-ui pb-28 relative overflow-x-clip">
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
                                        <div className="h-2 w-10 bg-zinc-100/70 rounded" />
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
                                                <div className="h-3 w-24 bg-zinc-100/70 rounded" />
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5">
                                                <div className="h-4 w-12 bg-zinc-200/80 rounded-full" />
                                                <div className="h-3 w-14 bg-zinc-100/70 rounded" />
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
                                <div className="h-3 w-48 bg-zinc-100/70 rounded" />
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
                                        <div className="h-3 w-16 bg-zinc-100/70 rounded" />
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
                                    <div className="h-5 w-28 bg-zinc-200/70 rounded mx-auto" />
                                    <div className="h-3 w-20 bg-zinc-100/70 rounded mx-auto" />
                                </div>
                            </div>

                            {/* Details Fields Skeleton */}
                            <div className="bg-white border border-zinc-100 rounded-2xl p-5 space-y-4 shadow-sm">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="flex justify-between items-center py-1">
                                        <div className="space-y-1">
                                            <div className="h-2.5 w-16 bg-zinc-100/70 rounded" />
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
                                <div className="h-3 w-48 bg-amber-50 rounded mx-auto" />
                            </div>

                            {/* PIN Code Boxes Skeleton */}
                            <div className="flex justify-center gap-2">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i} className="size-10 rounded-xl bg-white border border-zinc-200" />
                                ))}
                            </div>

                            {/* Floating details box skeleton */}
                            <div className="rounded-2xl bg-white border border-zinc-100 p-5 space-y-4 shadow-sm text-center">
                                <div className="h-14 w-full bg-zinc-100/70 rounded-xl" />
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
                            <div className="absolute -top-[22px] size-14 rounded-full bg-zinc-200/80 animate-pulse border-4 border-background" />
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

    // In the login the form stays on screen (Nubi thinks while it checks)
    if (loading && view !== "login") {
        return (
            <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-zinc-800 animate-in fade-in duration-300 relative overflow-hidden">
                {animationStyle}
                <div aria-hidden className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 size-[300px] rounded-full" style={{ background: "radial-gradient(circle, rgba(242,107,58,0.16) 0%, rgba(242,107,58,0) 65%)" }} />

                <div className="relative flex flex-col items-center justify-center z-10 text-center">
                    {/* Nubi waits with you */}
                    <div className="relative h-[120px] w-[134px] animate-soft-float select-none">
                        <img src="/nubi/nubi-neutral.webp" alt="" className="size-full object-contain" style={{ filter: "drop-shadow(0 16px 20px rgba(60,40,20,0.15))" }} />
                    </div>
                    <div className="mt-6 space-y-1.5">
                        <h2 className="text-lg font-semibold text-zinc-900">Un momento…</h2>
                        <p className="text-sm text-zinc-500 max-w-[220px] leading-snug">Estamos preparando tu cuenta</p>
                    </div>
                    <div className="mt-5 h-1 w-28 overflow-hidden rounded-full bg-zinc-200">
                        <div className="h-full w-2/5 rounded-full bg-primary" style={{ animation: "sc-bar 1.1s ease-in-out infinite" }} />
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
        // One rounded "pill" holds the field and its button, like a search bar
        const pill = "flex items-center h-14 rounded-full bg-white border border-zinc-200 pl-5 pr-1.5 gap-2 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15";
        const pillInput = "flex-1 min-w-0 h-full bg-transparent outline-none text-[15px] font-medium text-zinc-900 placeholder:text-zinc-400";
        const pillBtn = "h-11 shrink-0 rounded-full bg-primary hover:bg-primary/90 text-white px-5 text-sm font-semibold inline-flex items-center gap-1.5 shadow-sm active:scale-95 transition disabled:opacity-60";
        const linkCls = "text-sm font-medium bg-transparent border-none outline-none cursor-pointer py-1.5 px-2 rounded-lg focus-visible:ring-2 focus-visible:ring-primary/30";
        const eye = (
            <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Ocultar contraseña" : "Ver contraseña"}
                className="size-10 shrink-0 grid place-items-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
                {showPass ? <IconEyeOff size={20} /> : <IconEye size={20} />}
            </button>
        );
        const backToDocument = () => {
            rollNubi(-1);
            setLoginStep("document");
            setPassword("");
            setConfirmPassword("");
            setActivationCode("");
            setOtpDigits(["", "", "", "", "", ""]);
        };

        return (
            <div data-sc-orange className="min-h-[100dvh] flex flex-col relative overflow-hidden text-zinc-800" style={{ background: "#F26B3A", paddingTop: "env(safe-area-inset-top)" }}>
                {animationStyle}
                <div aria-hidden className="pointer-events-none absolute -top-1/4 left-1/2 -translate-x-1/2 size-[140vw] max-w-[900px] max-h-[900px] rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 62%)" }} />

                {/* Brand on orange, the same as the splash it comes from */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 pt-8 pb-10 relative z-10 min-h-[260px]">
                    {/* Still, but alive: blinks and reacts to what happens in the form */}
                    <NubiFace
                        className="h-[84px] w-[84px]"
                        roll={nubiRoll}
                        busy={loading}
                        mood={nubiFlash ?? (loading ? "thinking" : loginStep === "password" ? "happy" : "neutral")}
                    />
                    <h1 className="mt-3 text-center select-none" style={{ fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 0.92, fontSize: "clamp(46px, 14vw, 72px)" }}>
                        <span className="block text-white">SYNCRO</span>
                        <span className="block text-[#1A1815]">CREDIT</span>
                    </h1>
                    <p className="mt-4 text-[15px] font-medium text-white/90">Tu crédito, en tu bolsillo</p>
                </div>

                {/* The sheet that rises from the bottom with the form */}
                <div className="relative z-10 bg-background rounded-t-[32px] px-6 pt-3 shadow-[0_-16px_40px_rgba(90,30,5,0.25)] animate-in slide-in-from-bottom duration-500" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
                    <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-zinc-300" />
                    <div className="w-full max-w-sm mx-auto">
                      <div className="-mx-2 overflow-hidden" style={{ height: stepH ?? undefined, transition: "height 380ms cubic-bezier(.2,.8,.3,1)" }}>
                       <div
                        ref={stepBox}
                        className="px-2 py-1.5"
                        style={
                            stepAnim?.phase === "out"
                                ? { transform: `translateX(${stepAnim.dir * -56}px)`, opacity: 0, transition: "transform 200ms ease-in, opacity 200ms ease-in" }
                                : stepAnim?.phase === "in"
                                ? { animation: `${stepAnim.dir > 0 ? "sc-step-in-fwd" : "sc-step-in-back"} 420ms cubic-bezier(.2,.8,.3,1) both` }
                                : undefined
                        }
                       >
                        {shownStep === "document" && (
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900">Ingresa a tu cuenta</h2>
                                <p className="mt-1 text-sm text-zinc-500">Escribe tu cédula para continuar.</p>
                                <div className={`mt-5 ${pill} !pl-1.5`}>
                                    {/* Document type, then only the number: sent as "V-12345678" */}
                                    <div className="relative shrink-0">
                                        <select
                                            aria-label="Tipo de documento"
                                            value={docType}
                                            onChange={(e) => {
                                                const t = e.target.value;
                                                const num = idSearch.replace(/^[VEJGCP]-?/i, "");
                                                setDocType(t);
                                                setIdSearch(num ? `${t}-${num}` : "");
                                                document.getElementById("sc-doc")?.focus();
                                            }}
                                            className="appearance-none h-11 pl-4 pr-8 rounded-full bg-zinc-100 hover:bg-zinc-200/70 text-[15px] font-bold text-zinc-900 outline-none cursor-pointer transition focus-visible:ring-2 focus-visible:ring-primary/30"
                                        >
                                            <option value="V">V</option>
                                            <option value="E">E</option>
                                            <option value="J">J</option>
                                            <option value="G">G</option>
                                            <option value="C">C</option>
                                        </select>
                                        <IconChevronDown size={14} stroke={2.5} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    </div>
                                    <input
                                        id="sc-doc"
                                        autoFocus
                                        inputMode="numeric"
                                        autoComplete="username"
                                        aria-label="Número de documento"
                                        placeholder="Número de cédula"
                                        className={pillInput}
                                        value={idSearch.replace(/^[VEJGCP]-?/i, "")}
                                        onFocus={() => nubiFeel("surprised", 900)}
                                        onChange={(e) => {
                                            const num = e.target.value.replace(/\D/g, "").slice(0, 10);
                                            setIdSearch(num ? `${docType}-${num}` : "");
                                        }}
                                        onKeyDown={(e) => e.key === "Enter" && handleCheckStatus()}
                                    />
                                    <button onClick={handleCheckStatus} disabled={loading} className={pillBtn}>
                                        Acceder <IconArrowRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {shownStep === "password" && (
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className="size-11 rounded-full bg-amber-100 text-amber-700 grid place-items-center text-base font-bold shrink-0">
                                        {(clientName || "?").trim().charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="text-xl font-semibold text-zinc-900 truncate">¡Hola, {(clientName || "").split(" ")[0]}!</h2>
                                        <p className="text-sm text-zinc-500 truncate">{clientName}</p>
                                    </div>
                                    <button onClick={backToDocument} className={`${linkCls} text-zinc-500 hover:text-zinc-800 shrink-0`}>Cambiar</button>
                                </div>
                                <div className={`mt-5 ${pill}`}>
                                    <IconLock size={20} className="shrink-0 text-zinc-400" />
                                    <input
                                        id="sc-pass"
                                        type={showPass ? "text" : "password"}
                                        autoFocus
                                        autoComplete="current-password"
                                        aria-label="Contraseña"
                                        placeholder="Tu contraseña"
                                        className={pillInput}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleLoginWithPassword()}
                                    />
                                    {eye}
                                    <button onClick={handleLoginWithPassword} disabled={loading} className={pillBtn}>
                                        Entrar <IconArrowRight size={16} />
                                    </button>
                                </div>
                                <div className="mt-3 flex justify-center">
                                    <button
                                        onClick={() => {
                                            rollNubi(1);
                                            setLoginStep("register");
                                            setIsResettingPassword(true);
                                            setPassword("");
                                            setConfirmPassword("");
                                            setActivationCode("");
                                            setOtpDigits(["", "", "", "", "", ""]);
                                        }}
                                        className={`${linkCls} text-primary hover:text-amber-600`}
                                    >
                                        Olvidé mi contraseña
                                    </button>
                                </div>
                            </div>
                        )}

                        {shownStep === "register" && (
                            <div className="space-y-3">
                                <div>
                                    <h2 className="text-xl font-semibold text-zinc-900">{isResettingPassword ? "Restablece tu contraseña" : "Activa tu cuenta"}</h2>
                                    <p className="mt-1 text-sm text-zinc-500">Escribe el código de 6 dígitos que te dio el comercio.</p>
                                </div>
                                <div className="flex justify-between gap-2 pt-1">
                                    {otpDigits.map((digit, idx) => (
                                        <input
                                            key={idx}
                                            id={`otp-${idx}`}
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            autoComplete={idx === 0 ? "one-time-code" : "off"}
                                            aria-label={`Dígito ${idx + 1}`}
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(idx, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                            onPaste={handleOtpPaste}
                                            className={`w-full max-w-[52px] h-14 rounded-2xl bg-white border text-center font-semibold text-xl text-zinc-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 ${digit ? "border-amber-300" : "border-zinc-200"}`}
                                        />
                                    ))}
                                </div>
                                <div className={`${pill} !pr-2`}>
                                    <input
                                        type={showPass ? "text" : "password"}
                                        autoComplete="new-password"
                                        aria-label="Nueva contraseña"
                                        placeholder="Nueva contraseña"
                                        className={pillInput}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    {eye}
                                </div>
                                <div className={`${pill} !pr-2`}>
                                    <input
                                        type={showPass ? "text" : "password"}
                                        autoComplete="new-password"
                                        aria-label="Confirmar contraseña"
                                        placeholder="Confirmar contraseña"
                                        className={pillInput}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleRegisterPassword()}
                                    />
                                    {eye}
                                </div>
                                <button
                                    onClick={handleRegisterPassword}
                                    disabled={loading}
                                    className="w-full h-14 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold text-[15px] shadow-sm active:scale-[0.98] transition disabled:opacity-60"
                                >
                                    {isResettingPassword ? "Restablecer contraseña" : "Activar cuenta"}
                                </button>
                                <div className="flex justify-center">
                                    <button onClick={backToDocument} className={`${linkCls} text-zinc-500 hover:text-zinc-800`}>
                                        Usar otra cédula
                                    </button>
                                </div>
                            </div>
                        )}

                       </div>
                      </div>
                        <p className="mt-6 text-[11px] text-zinc-400 font-medium flex items-center justify-center gap-1.5">
                            <IconLock size={12} /> Conexión cifrada · Syncro
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (view === "dashboard" && client?.isSuspended) {
        return (
            <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center text-zinc-800 animate-in fade-in duration-500 relative overflow-hidden">
                {animationStyle}
                <div className="relative max-w-sm w-full bg-white border border-zinc-200 rounded-2xl p-7 shadow-sm space-y-5 z-10 flex flex-col items-center">
                    {/* Nubi dozing: the account is on hold, not gone */}
                    <div className="relative h-[100px] w-[112px] select-none">
                        <img src="/nubi/nubi-sleepy.webp" alt="" className="size-full object-contain opacity-90" style={{ filter: "grayscale(0.4) drop-shadow(0 12px 16px rgba(60,40,20,0.12))" }} />
                    </div>
                    <div className="space-y-2">
                        <span className="inline-flex items-center rounded-full bg-rose-50 border border-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">Cuenta pausada</span>
                        <h2 className="text-xl font-semibold text-zinc-900">Tu crédito está en pausa</h2>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                            Comunícate con el comercio o acércate a la caja para saber cómo reactivar tu línea de crédito.
                        </p>
                    </div>
                    <Button
                        onClick={requestLogout}
                        variant="outline"
                        className="w-full h-12 rounded-xl border-zinc-200 bg-white text-zinc-700 font-semibold text-sm"
                    >
                        Cerrar sesión
                    </Button>
                </div>
            </div>
        );
    }

    // ── Redesign (Inicio / Pagos / Plan de cuotas / Historial) ──────────────────
    const instLeft = (i: any) => (i.remaining !== undefined ? i.remaining : (i.amount - (i.paidAmount || 0)));
    const pendingDebtsList = (debts || []).filter((d: any) => d.remainingBalance > 0.004);
    const pendingInstsOf = (d: any) => {
        const list = (d.installments || [])
            .filter((i: any) => i.status === "PENDING" && instLeft(i) > 0.004)
            .sort((a: any, b: any) => (a.number - b.number) || (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));
        return list.length ? list : [{ id: `virtual-${d.loanId}`, number: 1, dueDate: d.nextPaymentDate || d.createdAt, amount: d.remainingBalance, paidAmount: 0, remaining: d.remainingBalance, status: "PENDING" }];
    };
    const allPendingInsts = pendingDebtsList
        .flatMap((d: any) => pendingInstsOf(d).map((i: any) => ({ ...i, remaining: instLeft(i), debt: d })))
        .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const nextInst = allPendingInsts[0];
    const ticketOf = (d: any) => (String(d?.description || "").match(/#\s?([A-Za-z0-9]+)/) || [])[1];
    const storeOf = (d: any) => d?.storeName || "Compra a crédito";
    const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const daysUntil = (date: any) => Math.round((dayStart(new Date(date)) - dayStart(new Date())) / 86400000);
    const whenText = (date: any) => {
        const n = daysUntil(date);
        if (n < 0) return `vencida hace ${-n} día${n === -1 ? "" : "s"}`;
        if (n === 0) return "vence hoy";
        if (n === 1) return "mañana";
        return `en ${n} días`;
    };
    const fmtDay = (date: any) => new Date(date).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
    const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
    const firstName = String(client?.name || "").trim().split(" ")[0];
    const allInstsOf = (d: any) => [...(d.installments || [])].sort((a: any, b: any) => (a.number - b.number) || (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));
    const paidCountOf = (d: any) => (d.installments || []).filter((i: any) => i.status === "PAID" || instLeft(i) <= 0.004).length;
    const totalCountOf = (d: any) => Math.max(d.installmentsCount || 0, (d.installments || []).length, 1);
    /** The latest news about a receipt: approved / rejected (until closed) or in review */
    const subBanner = () => {
        const recent = (x: any) => Date.now() - new Date(x.updatedAt || x.createdAt).getTime() < 14 * 86400000;
        const decided = mySubmissions.find((x: any) => x.status !== "PENDING" && recent(x) && !seenSubs.includes(x.id));
        const pending = mySubmissions.filter((x: any) => x.status === "PENDING");
        if (decided) {
            const ok = decided.status === "APPROVED";
            return (
                <div className={`relative flex items-center gap-3 rounded-[20px] border p-3.5 pr-10 animate-in fade-in slide-in-from-bottom-1 duration-300 ${ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
                    <img src={ok ? "/nubi/nubi-happy.webp" : "/nubi/nubi-sad.webp"} alt="" className="h-11 w-12 shrink-0 object-contain" />
                    <div className="min-w-0">
                        <p className={`text-[15px] font-bold ${ok ? "text-emerald-800" : "text-rose-800"}`}>{ok ? "¡Pago aprobado!" : "Comprobante rechazado"}</p>
                        <p className={`text-[12.5px] ${ok ? "text-emerald-700" : "text-rose-700"}`}>
                            {ok ? `Tu abono de ${money(decided.amount)} ya se aplicó a tus cuotas.` : `El comercio no pudo verificar tu pago de ${money(decided.amount)}. Escríbele o envía otro comprobante.`}
                        </p>
                    </div>
                    <button onClick={() => dismissSub(decided.id)} aria-label="Cerrar aviso" className={`absolute right-2 top-2 size-8 grid place-items-center rounded-full ${ok ? "text-emerald-700 hover:bg-emerald-100" : "text-rose-700 hover:bg-rose-100"}`}>
                        <IconCircleX size={18} />
                    </button>
                </div>
            );
        }
        if (pending.length) {
            const total = pending.reduce((a: number, x: any) => a + (Number(x.amount) || 0), 0);
            return (
                <div className="flex items-center gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-3.5">
                    <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                        <IconClock size={22} />
                        <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-amber-500 animate-pulse" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-[15px] font-bold text-amber-900">Pago en revisión</p>
                        <p className="text-[12.5px] text-amber-800">El comercio está verificando {pending.length > 1 ? `tus ${pending.length} comprobantes (${money(total)})` : `tu comprobante de ${money(total)}`}. Te avisamos aquí.</p>
                    </div>
                </div>
            );
        }
        return null;
    };

    const isOverdue = (d: any) => pendingInstsOf(d).some((i: any) => daysUntil(i.dueDate) < 0);

    // Pay: straight to the existing payment flow of that purchase, with the next installment chosen
    const openPay = (debt: any, custom = false) => {
        setActiveTab("payments");
        setPlanDebt(null);
        setShowHistory(false);
        setSelectedDebtForPayment(debt);
        setPaymentStep("details");
        setReceiptFile(null);
        setReceiptPreview(null);
        if (custom) {
            setSelectedInstallmentOption("custom");
            setPaymentAmount("");
        } else {
            setSelectedInstallmentOption(1);
            setPaymentAmount(instLeft(pendingInstsOf(debt)[0]).toFixed(2));
        }
        window.scrollTo({ top: 0 });
    };
    // ── Grouping the installments: what's overdue, and everything due on the next day ──
    const overdueInsts = allPendingInsts.filter((i: any) => daysUntil(i.dueDate) < 0);
    const upcomingInsts = allPendingInsts.filter((i: any) => daysUntil(i.dueDate) >= 0);
    const nextDay = upcomingInsts[0] ? dayStart(new Date(upcomingInsts[0].dueDate)) : null;
    const nextDayInsts = nextDay === null ? [] : upcomingInsts.filter((i: any) => dayStart(new Date(i.dueDate)) === nextDay);
    const sumOf = (l: any[]) => l.reduce((a: number, i: any) => a + (Number(i.remaining) || 0), 0);
    const instLabel = (i: any) => `Cuota ${i.number} de ${totalCountOf(i.debt)}`;
    const AV_COLORS = ["#F26B3A", "#2F7DFF", "#1F9D5B", "#8C6CF0", "#E8A72B", "#45413A"];
    const avColor = (d: any) => AV_COLORS[[...String(d?.loanId || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
    const avLetter = (d: any) => (storeOf(d).trim().charAt(0) || "?").toUpperCase();

    /**
     * Pay several installments at once (one transfer, one receipt): the payment flow gets a
     * "group" that behaves like one purchase whose installments are these, in due order. When the
     * business approves the receipt, the money is applied to the client's installments by due date.
     */
    /** Installments split by the business they are owed to (each one has its own bank details) */
    const byBusiness = (insts: any[]) => {
        const m = new Map<string, any[]>();
        insts.forEach((i: any) => { const k = i.debt?.businessId || "_"; if (!m.has(k)) m.set(k, []); m.get(k)!.push(i); });
        return [...m.values()];
    };
    const openGroupPay = (instsIn: any[], mode: "all" | "pick" | "other") => {
        // never mix businesses in one payment: one transfer and one receipt per business
        const insts = byBusiness(instsIn)[0];
        const sorted = [...insts].sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        const first = sorted[0].debt;
        const total = sumOf(sorted);
        const sameDay = sorted.every((i: any) => dayStart(new Date(i.dueDate)) === dayStart(new Date(sorted[0].dueDate)));
        const group = {
            ...first,
            description: `${sorted.length} cuota${sorted.length > 1 ? "s" : ""} ${sameDay ? `del ${fmtDay(sorted[0].dueDate)}` : "pendientes"}`,
            remainingBalance: total,
            items: [],
            installments: sorted.map((i: any, k: number) => ({ id: i.id, number: k + 1, dueDate: i.dueDate, amount: i.remaining, paidAmount: 0, remaining: i.remaining, status: "PENDING" })),
            isGroup: true,
        };
        setPaySheet(null);
        setActiveTab("payments");
        setPlanDebt(null);
        setShowHistory(false);
        setShowLevel(false);
        setSelectedDebtForPayment(group);
        setPaymentStep("details");
        setReceiptFile(null);
        setReceiptPreview(null);
        if (mode === "all") { setSelectedInstallmentOption(sorted.length); setPaymentAmount(total.toFixed(2)); }
        else if (mode === "other") { setSelectedInstallmentOption("custom"); setPaymentAmount(""); }
        else { setSelectedInstallmentOption(null); setPaymentAmount(""); }
        window.scrollTo({ top: 0 });
    };
    /** "Pagar": one installment goes straight to pay; several open the sheet */
    const askPay = (insts: any[], title: string) => {
        if (insts.length === 1) return openPay(insts[0].debt);
        if (byBusiness(insts).length > 1) setSheetMode("all");
        setSheetMode("all");
        setPaySheet({ insts, title });
    };

    const goTab = (tab: typeof activeTab) => {
        setRequestLoanView(false);
        setActiveTab(tab);
        setPlanDebt(null);
        setShowHistory(false);
        setShowLevel(false);
        setSelectedDebtForPayment(null);
        setPaymentStep("details");
        setSelectedInstallmentOption(null);
        window.scrollTo({ top: 0 });
    };
    const lvl = (scLevel?.level ?? 4) as 1 | 2 | 3 | 4;
    const lvlName: string = scLevel?.name ?? "Chispa";
    const openLevel = () => { setShowLevel(true); window.scrollTo({ top: 0 }); };

    /** A tiny row of segments: paid (green), next (orange), the rest (grey) */
    const Segments = ({ debt }: { debt: any }) => {
        const total = totalCountOf(debt);
        const paid = paidCountOf(debt);
        return (
            <div className="flex gap-1 mt-2">
                {Array.from({ length: Math.min(total, 12) }, (_, i) => (
                    <span key={i} className={`h-[5px] flex-1 max-w-7 rounded-full ${i < paid ? "bg-emerald-500" : i === paid ? "bg-amber-400" : "bg-zinc-200"}`} />
                ))}
            </div>
        );
    };

    const BackBar = ({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) => (
        <div className="flex items-center gap-3 pt-1">
            <button onClick={onBack} aria-label="Volver" className="size-10 shrink-0 rounded-full bg-white/25 text-white grid place-items-center active:scale-95 transition">
                <IconChevronLeft size={20} stroke={2.4} />
            </button>
            <div className="min-w-0">
                <h2 className="text-[22px] font-extrabold text-white leading-tight truncate" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</h2>
                {subtitle && <p className="text-[12.5px] font-semibold text-white/85 truncate">{subtitle}</p>}
            </div>
        </div>
    );

    // ── Mi nivel ──
    const LEVEL_INFO = [
        { level: 4, name: "Chispa", from: 0, desc: "Tu comienzo en Syncro Credit" },
        { level: 3, name: "Cometa", from: 200, desc: "Pagas a tiempo y tomas impulso" },
        { level: 2, name: "Órbita", from: 500, desc: "Cliente constante" },
        { level: 1, name: "Galaxia", from: 1500, desc: "Lo máximo: cliente estrella" },
    ];
    const renderLevel = () => {
        const paid = Number(scLevel?.paidOnTime || 0);
        const next = scLevel?.next;
        const base = LEVEL_INFO.find((l) => l.level === lvl)?.from ?? 0;
        const pct = next ? Math.min(100, Math.max(0, ((paid - base) / Math.max(1, next.at - base)) * 100)) : 100;
        return (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 pb-6">
                <BackBar title="Mi nivel" subtitle={`Nivel ${lvl} · ${lvlName}`} onBack={() => setShowLevel(false)} />
                <NubiPodium level={lvl} className="-mx-6 mt-2 h-[250px]" />
                <div className="mt-2 rounded-[24px] bg-white p-5 shadow-[0_16px_30px_-18px_rgba(90,40,10,0.45)]">
                    <p className="text-[12.5px] font-semibold text-zinc-500">Pagado a tiempo</p>
                    <p className="text-[34px] leading-tight text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.03em" }}>{money(paid)}</p>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#F6A27F,#F26B3A)" }} />
                    </div>
                    <p className="mt-2 text-[13px] text-zinc-600">
                        {next ? <>Te faltan <b className="text-zinc-900">{money(next.missing)}</b> pagados a tiempo para subir a <b className="text-amber-600">{next.name}</b>.</> : <>¡Llegaste a <b className="text-amber-600">Galaxia</b>, el nivel más alto!</>}
                    </p>
                </div>
                <h3 className="mt-6 mb-2 px-1 text-[17px] text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>Los niveles</h3>
                <div className="overflow-hidden rounded-[22px] border border-zinc-200 bg-white">
                    {LEVEL_INFO.map((l, i) => {
                        const here = l.level === lvl;
                        const done = l.level > lvl;
                        return (
                            <div key={l.level} className={`flex items-center gap-3 p-3.5 ${i ? "border-t border-zinc-100" : ""} ${here ? "bg-amber-50" : ""}`}>
                                <div className={`grid size-11 shrink-0 place-items-center rounded-[14px] text-lg ${here ? "bg-amber-400 text-white" : done ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"}`} style={{ fontWeight: 800 }}>{l.level}</div>
                                <div className="min-w-0">
                                    <p className="text-[15px] font-bold text-zinc-900">{l.name}</p>
                                    <p className="text-[12.5px] text-zinc-500">{l.from ? `Desde ${money(l.from)} pagados a tiempo` : l.desc}</p>
                                </div>
                                <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${here ? "bg-amber-400 text-white" : done ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                                    {here ? "Estás aquí" : done ? "Superado" : `Faltan ${money(Math.max(0, l.from - paid))}`}
                                </span>
                            </div>
                        );
                    })}
                </div>
                <p className="mt-3 px-1 text-[12px] text-zinc-500">Cuentan las cuotas que pagas hasta el día de su vencimiento. Mientras más alto tu nivel, más confianza para tu crédito.</p>
            </div>
        );
    };
    const renderLevelUp = () => (
        <div className="fixed inset-0 z-[250] grid place-items-center bg-black/45 p-6 animate-in fade-in duration-300" onClick={() => setLevelUp(null)}>
            <div className="w-full max-w-sm overflow-hidden rounded-[28px] bg-white px-6 pb-6 pt-2 text-center animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
                <NubiPodium level={levelUp.level} className="-mx-6 h-[190px]" />
                <p className="text-[13px] font-bold text-amber-600">¡Subiste de nivel!</p>
                <h2 className="mt-1 text-[28px] leading-tight text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.03em" }}>Nivel {levelUp.level} · {levelUp.name}</h2>
                <p className="mt-2 text-[14px] text-zinc-600">Pagaste a tiempo {money(levelUp.paidOnTime)}. ¡Sigue así!</p>
                <button onClick={() => { setLevelUp(null); openLevel(); }} className="mt-5 w-full rounded-full bg-primary py-3.5 text-[15px] font-bold text-white active:scale-[0.98] transition">Ver mi nivel</button>
                <button onClick={() => setLevelUp(null)} className="mt-2 w-full py-2 text-sm font-semibold text-zinc-500">Cerrar</button>
            </div>
        </div>
    );

    const renderPaySheet = () => {
        if (!paySheet) return null;
        const total = sumOf(paySheet.insts);
        const parts = byBusiness(paySheet.insts);
        if (parts.length > 1) {
            // several businesses: one payment each, with that business's own bank details
            return (
                <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 animate-in fade-in duration-200" onClick={() => setPaySheet(null)}>
                    <div className="w-full max-w-md rounded-t-[28px] bg-background px-5 pt-3 animate-in slide-in-from-bottom duration-300" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }} onClick={(e) => e.stopPropagation()}>
                        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-300" />
                        <h3 className="text-[19px] text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>¿A qué comercio pagas?</h3>
                        <p className="mt-1 text-[13px] text-zinc-500">Cada comercio tiene sus propios datos de pago: haces un pago y subes un comprobante por cada uno.</p>
                        <div className="mt-3 space-y-2.5">
                            {parts.map((p) => (
                                <button key={p[0].debt.businessId || p[0].id} onClick={() => (p.length === 1 ? (setPaySheet(null), openPay(p[0].debt)) : openGroupPay(p, "all"))} className="flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-zinc-200 bg-white p-3.5 text-left active:bg-zinc-50 transition">
                                    <span className="grid size-9 shrink-0 place-items-center rounded-full text-[13px] text-white" style={{ background: avColor(p[0].debt), fontWeight: 800 }}>{avLetter(p[0].debt)}</span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-[15px] font-bold text-zinc-900">{storeOf(p[0].debt)}</span>
                                        <span className="block text-[12.5px] text-zinc-500">{p.length} cuota{p.length > 1 ? "s" : ""}</span>
                                    </span>
                                    <span className="ml-auto text-[15px] text-zinc-900" style={{ fontWeight: 800 }}>{money(sumOf(p))}</span>
                                    <IconChevronRight size={18} className="shrink-0 text-zinc-400" />
                                </button>
                            ))}
                        </div>
                        <p className="mt-3 text-center text-[12px] text-zinc-500">Total: {money(total)}</p>
                    </div>
                </div>
            );
        }
        const opts: { k: "all" | "pick" | "other"; t: string; d: string; right: string }[] = [
            { k: "all", t: paySheet.title, d: `${paySheet.insts.length} cuotas`, right: money(total) },
            { k: "pick", t: "Elegir cuántas cuotas", d: "Pagas desde la que vence primero", right: "›" },
            { k: "other", t: "Otro monto", d: "Se aplica a la cuota que vence primero", right: "›" },
        ];
        return (
            <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 animate-in fade-in duration-200" onClick={() => setPaySheet(null)}>
                <div className="w-full max-w-md rounded-t-[28px] bg-background px-5 pt-3 animate-in slide-in-from-bottom duration-300" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }} onClick={(e) => e.stopPropagation()}>
                    <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-300" />
                    <h3 className="text-[19px] text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>¿Qué quieres pagar?</h3>
                    <div className="mt-3 space-y-2.5" role="radiogroup">
                        {opts.map((o) => (
                            <button key={o.k} role="radio" aria-checked={sheetMode === o.k} onClick={() => setSheetMode(o.k)} className={`flex w-full items-center gap-3 rounded-2xl border-[1.5px] p-3.5 text-left transition ${sheetMode === o.k ? "border-primary bg-amber-50" : "border-zinc-200 bg-white"}`}>
                                <span className={`size-[18px] shrink-0 rounded-full ${sheetMode === o.k ? "border-[5px] border-primary" : "border-2 border-zinc-300"}`} />
                                <span className="min-w-0">
                                    <span className="block text-[15px] font-bold text-zinc-900">{o.t}</span>
                                    <span className="block text-[12.5px] text-zinc-500">{o.d}</span>
                                </span>
                                <span className="ml-auto text-[15px] text-zinc-900" style={{ fontWeight: 800 }}>{o.right}</span>
                            </button>
                        ))}
                    </div>
                    <button onClick={() => openGroupPay(paySheet.insts, sheetMode)} className="mt-4 w-full rounded-full bg-primary py-3.5 text-[15px] text-white shadow-[0_10px_20px_-10px_rgba(242,107,58,0.8)] active:scale-[0.98] transition" style={{ fontWeight: 800 }}>
                        {sheetMode === "all" ? `Continuar · ${money(total)}` : "Continuar"}
                    </button>
                    <p className="mt-2.5 text-center text-[12px] text-zinc-500">Haces una sola transferencia y subes un solo comprobante.</p>
                </div>
            </div>
        );
    };

    // ── Inicio ──
    const renderHome = () => {
        if (showLevel) return renderLevel();
        // "Para ti": product ads picked in Syncro Central (each with its own look); while there are
        // none, the level card keeps the spot
        const ads: React.ReactNode[] = scAds.map((ad: any) => (
            <ScAdCard
                key={ad.id}
                ad={ad}
                onClick={() => {
                    if (!ad.branch) return goTab("rewards");
                    goTab("rewards");
                    setSelectedBranchForShop(ad.branch);
                    setProductSearchQuery(ad.product?.name || "");
                    setBusinessSearchQuery("");
                }}
            />
        ));
        if (!ads.length) ads.push(
            <div key="lvl" className="sc-ad" style={{ background: "linear-gradient(135deg,#F26B3A,#F6A27F)" }}>
                <span className="sc-ad-tag">Tu nivel · {lvlName}</span>
                <h4>{scLevel?.next ? `Sube a ${scLevel.next.name}` : "¡Estás en la cima!"}</h4>
                <p>{scLevel?.next ? `Te faltan ${money(scLevel.next.missing)} pagados a tiempo` : "Galaxia: lo máximo en Syncro Credit"}</p>
                <button className="sc-ad-go" onClick={openLevel}>Ver mi nivel →</button>
                <img src="/nubi/nubi-happy.webp" alt="" className="absolute right-3 bottom-3 w-[74px] drop-shadow-[0_10px_12px_rgba(90,30,5,0.35)]" />
            </div>,
        );

        return (
            // Fills the screen: the gaps between blocks share the free height evenly (with limits), and
            // "Para ti" sits at the bottom so the PIN button floats over the cards, like in the design.
            <div className="flex flex-col animate-in fade-in duration-500" style={{ minHeight: "calc(100dvh - 136px - env(safe-area-inset-top))" }}>
                {levelUp && createPortal(renderLevelUp(), document.body)}
                {paySheet && createPortal(renderPaySheet(), document.body)}
                {/* Hello, with Nubi (it glances at the credit card now and then) */}
                <div className="relative text-white pr-24">
                    <h1 className="text-[30px] leading-tight" style={{ fontWeight: 800, letterSpacing: "-0.03em" }}>Hola{firstName ? `, ${firstName}` : ""}</h1>
                    <p className="mt-1 text-[15px] font-medium text-white/90">Tienes <b className="font-bold">{money(availableCredit)}</b> para comprar hoy</p>
                    <NubiFace lookAt={creditCardRef} className="!absolute -right-1 -top-4 h-[84px] w-[84px]" />
                </div>

                <div aria-hidden className="grow min-h-4" />
                {/* Credit available: lacquered white like Nubi, a split bar (what you have / what you used)
                    and a level button that looks pressable */}
                <div
                    ref={creditCardRef}
                    className="relative overflow-hidden rounded-[26px] p-5 text-zinc-900"
                    style={{
                        background: "linear-gradient(160deg, #ffffff 0%, #fafbfc 42%, #eceff3 100%)",
                        boxShadow: "0 18px 40px -16px rgba(90,30,5,0.45), inset 0 1px 0 #ffffff, inset 0 -12px 26px rgba(140,150,170,0.18), inset 0 0 0 1px rgba(255,255,255,0.7)",
                    }}
                >
                    <style>{`@keyframes sc-glint { 0%, 78% { transform: translateX(-160%) skewX(-18deg); } 100% { transform: translateX(420%) skewX(-18deg); } }`}</style>
                    {/* the lacquer's reflections: a soft band on top, a small bright spot and a passing glint */}
                    <span aria-hidden className="pointer-events-none absolute left-5 right-28 top-1.5 h-9 rounded-full" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0))", filter: "blur(1px)" }} />
                    <span aria-hidden className="pointer-events-none absolute right-[34%] top-3 h-2 w-7 rounded-full bg-white" style={{ filter: "blur(1.5px)" }} />
                    <span aria-hidden className="pointer-events-none absolute -top-4 bottom-[-16px] left-0 w-16" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.75), rgba(255,255,255,0))", animation: "sc-glint 7s ease-in-out 2s infinite" }} />

                    <div className="relative flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-zinc-500">Crédito disponible</p>
                            <p className="mt-1 text-[44px] leading-none text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.045em" }}>{money(availableCredit)}</p>
                        </div>
                        <button
                            onClick={openLevel}
                            aria-label={`Ver mi nivel: nivel ${lvl}, ${lvlName}`}
                            className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-amber-200 bg-amber-50 py-1.5 pl-1.5 pr-1.5 text-[13px] font-bold text-amber-700 shadow-[0_2px_0_var(--color-amber-200)] transition active:translate-y-[2px] active:shadow-none"
                        >
                            <span className="grid size-[22px] place-items-center rounded-full text-[11.5px] text-white" style={{ fontWeight: 800, background: "radial-gradient(circle at 35% 30%, #F6A27F, #E8541F)", boxShadow: "inset 0 -2px 3px rgba(0,0,0,.18), inset 0 2px 3px rgba(255,255,255,.5)" }}>{lvl}</span>
                            {lvlName}
                            <span className="grid size-[18px] place-items-center rounded-full bg-primary text-white"><IconChevronRight size={12} stroke={3} /></span>
                        </button>
                    </div>

                    {/* split bar: available (orange) and used (striped grey) */}
                    {(() => {
                        const availPct = creditLimit > 0 ? Math.max(0, Math.min(100, (availableCredit / creditLimit) * 100)) : 0;
                        const used = client?.currentDebt || 0;
                        return (
                            <>
                                <div className="relative mt-4 mb-2.5 flex h-3.5 gap-[3px]">
                                    {availPct > 0 && <div className="h-full rounded-full" style={{ width: `${availPct}%`, background: "linear-gradient(90deg,#F6A27F,#F26B3A)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.45)" }} />}
                                    {availPct < 100 && <div className="h-full flex-1 rounded-full" style={{ background: "repeating-linear-gradient(135deg,#D3CEC4 0 4px,#E5E1D9 4px 8px)" }} />}
                                </div>
                                <div className="relative flex items-center gap-2.5 text-[12.5px] text-zinc-700">
                                    <span className="whitespace-nowrap"><i className="mr-1 inline-block size-2 rounded-full bg-primary align-[0px]" />Disponible <b className="text-zinc-900">{Math.round(availPct)}%</b></span>
                                    <span className="whitespace-nowrap"><i className="mr-1 inline-block size-2 rounded-full bg-zinc-300 align-[0px]" />Usado <b className="text-zinc-900">{money(used)}</b></span>
                                    <span className="ml-auto whitespace-nowrap text-zinc-500">Límite <b className="text-zinc-900">{Number.isInteger(creditLimit) ? `$${creditLimit}` : money(creditLimit)}</b></span>
                                </div>
                            </>
                        );
                    })()}
                </div>

                <div aria-hidden className="grow-[0.6] min-h-3" />
                {/* Next payment: overdue first; otherwise everything due on the next day, added up */}
                {(() => {
                    const late = overdueInsts.length > 0;
                    const group = late ? overdueInsts : nextDayInsts;
                    const low = creditLimit > 0 && availableCredit < Math.max(5, creditLimit * 0.1);
                    if (!group.length) return (
                        <div className="flex items-center gap-3 rounded-[20px] border border-emerald-100 bg-emerald-50/60 p-3.5">
                            <div className="size-11 shrink-0 rounded-2xl grid place-items-center bg-emerald-100 text-emerald-600"><IconCircleCheck size={22} /></div>
                            <div>
                                <p className="text-[12px] font-semibold text-emerald-700">Estás al día</p>
                                <p className="text-[15px] font-bold text-zinc-900">No tienes pagos pendientes</p>
                            </div>
                        </div>
                    );
                    const one = group.length === 1;
                    const total = sumOf(group);
                    const after = late && nextDayInsts.length ? nextDayInsts : null;
                    const title = late ? "Todo lo vencido" : `Todo lo del ${fmtDay(group[0].dueDate)}`;
                    return (
                        <div className={`rounded-[20px] border bg-white p-3.5 ${late ? "border-rose-200" : "border-zinc-200"}`}>
                            <div className="flex items-center gap-3">
                                <div className={`size-11 shrink-0 rounded-2xl grid place-items-center ${late ? "bg-rose-50 text-rose-600" : "bg-amber-100 text-amber-600"}`}>
                                    {late ? <IconAlertCircle size={22} /> : <IconCalendar size={22} />}
                                </div>
                                <div className="min-w-0">
                                    <p className={`text-[12px] font-semibold ${late ? "text-rose-600" : "text-zinc-500"}`}>
                                        {late ? `Vencido · ${group.length} cuota${one ? "" : "s"}` : `Próximo pago · ${whenText(group[0].dueDate)}`}
                                    </p>
                                    <p className="text-[17px] text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
                                        {money(total)} <span className={`text-[13px] font-semibold ${late ? "text-rose-600" : "text-zinc-500"}`}>{late ? `desde el ${fmtDay(group[0].dueDate)}` : `· ${fmtDay(group[0].dueDate)}`}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => askPay(group, title)}
                                    className={`ml-auto shrink-0 rounded-full px-4 py-2.5 text-sm font-bold text-white active:scale-95 transition ${late ? "bg-rose-600 shadow-[0_6px_14px_-6px_rgba(214,69,53,0.7)]" : "bg-primary shadow-[0_6px_14px_-6px_rgba(242,107,58,0.7)]"}`}
                                >
                                    {one || late ? "Pagar" : "Pagar todo"}
                                </button>
                            </div>

                            {/* who: one store, or the stack of them with the list on demand */}
                            {one ? (
                                <div className="mt-2.5 flex items-center gap-2 text-[12.5px] text-zinc-500">
                                    <span className="grid size-6 place-items-center rounded-full text-[10.5px] text-white" style={{ background: avColor(group[0].debt), fontWeight: 800 }}>{avLetter(group[0].debt)}</span>
                                    <span className="truncate">{storeOf(group[0].debt)} · {instLabel(group[0])}</span>
                                </div>
                            ) : (
                                <>
                                    <button onClick={() => setPayDayOpen((v) => !v)} aria-expanded={payDayOpen} className="mt-2.5 flex w-full items-center text-left">
                                        <span className="flex">
                                            {group.slice(0, 4).map((i: any, k: number) => (
                                                <span key={i.id} className="grid size-[26px] place-items-center rounded-full border-2 border-white text-[10.5px] text-white" style={{ background: avColor(i.debt), marginLeft: k ? -7 : 0, fontWeight: 800 }}>{avLetter(i.debt)}</span>
                                            ))}
                                            {group.length > 4 && <span className="grid size-[26px] place-items-center rounded-full border-2 border-white bg-zinc-700 text-[10px] text-white" style={{ marginLeft: -7, fontWeight: 800 }}>+{group.length - 4}</span>}
                                        </span>
                                        <span className="ml-2 text-[12.5px] font-semibold text-zinc-500">{group.length} cuotas</span>
                                        <span className="ml-auto text-[13px] font-bold text-amber-600">{payDayOpen ? "Ocultar ▴" : `Ver las ${group.length} ▾`}</span>
                                    </button>
                                    {payDayOpen && (
                                        <div className="mt-2 border-t border-zinc-100 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {group.map((i: any) => (
                                                <div key={i.id} className="flex items-center gap-2.5 border-b border-zinc-100 py-2.5 last:border-0">
                                                    <span className="grid size-7 shrink-0 place-items-center rounded-[9px] text-[11px] text-white" style={{ background: avColor(i.debt), fontWeight: 800 }}>{avLetter(i.debt)}</span>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-[13.5px] font-bold text-zinc-900">{storeOf(i.debt)}</p>
                                                        <p className="text-[12px] text-zinc-500">{instLabel(i)}{ticketOf(i.debt) ? ` · #${ticketOf(i.debt)}` : ""}{late ? ` · ${fmtDay(i.dueDate)}` : ""}</p>
                                                    </div>
                                                    <span className="ml-auto text-[14px] text-zinc-900" style={{ fontWeight: 800 }}>{money(i.remaining)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            {after && (
                                <p className="mt-2 text-[12.5px] text-zinc-500">
                                    Luego: <b className="text-zinc-800">{money(sumOf(after))}</b> el {fmtDay(after[0].dueDate)}{after.length > 1 ? ` (${after.length} cuotas)` : ""}
                                </p>
                            )}
                            {low && (
                                <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                                    Te quedan <b>{money(availableCredit)}</b> de crédito. {late ? "Pagando lo vencido se libera." : "Cada cuota que pagas lo libera."}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {subBanner() && <div className="mt-3">{subBanner()}</div>}
                <div aria-hidden className="grow min-h-5" />
                {/* Talk to the business (only when it has a phone set) */}
                {(() => {
                    const phone = String(settings?.phone || "").replace(/\D/g, "");
                    if (!phone) return null;
                    const wa = `https://wa.me/${phone.startsWith("0") ? `58${phone.slice(1)}` : phone}`;
                    return (
                        <button
                            onClick={() => window.open(wa, "_blank")}
                            className="relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] px-4 py-3 text-left transition active:translate-y-[1px]"
                            style={{
                                background: "linear-gradient(160deg, #ffffff 0%, #fafbfc 45%, #e9ecf1 100%)",
                                boxShadow: "0 8px 16px -10px rgba(90,40,10,0.45), inset 0 1px 0 #ffffff, inset 0 -6px 12px rgba(140,150,170,0.2), inset 0 0 0 1px rgba(255,255,255,0.75)",
                            }}
                        >
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><IconPhone size={20} /></span>
                            <span className="min-w-0">
                                <span className="block text-[14px] font-bold text-zinc-900">Escribir al comercio</span>
                                <span className="block text-[12px] text-zinc-500">Dudas sobre tu crédito o tus pagos</span>
                            </span>
                            <IconChevronRight size={18} className="ml-auto shrink-0 text-zinc-400" />
                        </button>
                    );
                })()}

                {/* Your credit purchases (where "Para ti" was; it comes back with shopping later) */}
                <div aria-hidden className="grow min-h-5" />
                <div className="mb-2.5 flex items-baseline justify-between">
                    <h3 className="text-[17px] text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>Tus compras a crédito</h3>
                    {pendingDebtsList.length > 0 && <button onClick={() => goTab("payments")} className="text-[13px] font-bold text-amber-600">Ver todas</button>}
                </div>
                {pendingDebtsList.length ? (
                    <div className="-mb-3 overflow-hidden rounded-[22px] border border-zinc-200 bg-white">
                        {pendingDebtsList.slice(0, 3).map((d: any, i: number) => {
                            const late = isOverdue(d);
                            return (
                                <button key={d.loanId} onClick={() => { goTab("payments"); setPlanDebt(d); }} className={`flex w-full items-center gap-3 p-3.5 text-left active:bg-zinc-50 transition ${i ? "border-t border-zinc-100" : ""}`}>
                                    <span className="grid size-10 shrink-0 place-items-center rounded-[13px] text-[13px] text-white" style={{ background: avColor(d), fontWeight: 800 }}>{avLetter(d)}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[14.5px] font-bold text-zinc-900">{storeOf(d)}</span>
                                        <span className="block text-[12px] text-zinc-500">{paidCountOf(d)} de {totalCountOf(d)} cuotas pagadas</span>
                                        <Segments debt={d} />
                                    </span>
                                    <span className="shrink-0 text-right">
                                        <span className={`block text-[11px] font-bold ${late ? "text-rose-600" : "text-emerald-600"}`}>{late ? "Vencida" : "Al día"}</span>
                                        <span className="block text-[15px] text-zinc-900" style={{ fontWeight: 800 }}>{money(d.remainingBalance)}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="-mb-3 flex items-center gap-3 rounded-[22px] border border-zinc-200 bg-white p-4">
                        <img src="/nubi/nubi-happy.webp" alt="" className="h-12 w-14 shrink-0 object-contain" />
                        <p className="text-[13.5px] text-zinc-600">Aún no tienes compras a crédito. Pídelo en la caja de tu comercio y lo verás aquí.</p>
                    </div>
                )}
            </div>
        );
    };

    // ── Historial ──
    const renderHistory = () => {
        const txs = (client?.creditTransactions || []).filter((tx: any) => {
            const isDebt = tx.type === "DEBT";
            const notes = (tx.notes || (isDebt ? "Compra a crédito" : "Abono realizado")).toLowerCase();
            const q = txSearchQuery.toLowerCase();
            return !q || notes.includes(q) || String(tx.amount).includes(q) || fmtDay(tx.createdAt).toLowerCase().includes(q);
        });
        const groups: { label: string; items: any[] }[] = [];
        txs.forEach((tx: any) => {
            const label = new Date(tx.createdAt).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
            const g = groups.find((x) => x.label === label);
            if (g) g.items.push(tx); else groups.push({ label, items: [tx] });
        });
        return (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <BackBar title="Historial" subtitle="Tus compras y abonos" onBack={() => setShowHistory(false)} />
                <div className="relative mt-5">
                    <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                        value={txSearchQuery}
                        onChange={(e) => setTxSearchQuery(e.target.value)}
                        placeholder="Buscar por tienda, monto o fecha"
                        className="w-full h-12 rounded-full bg-white border border-zinc-200 pl-11 pr-4 text-[15px] font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
                    />
                </div>
                {mySubmissions.length > 0 && !txSearchQuery && (
                    <div className="mt-5">
                        <p className="mb-2 px-1 text-[12px] font-bold text-zinc-500">Comprobantes enviados</p>
                        <div className="rounded-[22px] border border-zinc-200 bg-white overflow-hidden">
                            {mySubmissions.slice(0, 10).map((x: any, i: number) => {
                                const st = x.status === "APPROVED" ? { t: "Aprobado", c: "bg-emerald-50 text-emerald-700" } : x.status === "REJECTED" ? { t: "Rechazado", c: "bg-rose-50 text-rose-700" } : { t: "En revisión", c: "bg-amber-100 text-amber-800" };
                                return (
                                    <button key={x.id} onClick={() => x.receiptUrl && window.open(x.receiptUrl, "_blank")} className={`w-full text-left flex items-center gap-3 p-3.5 ${i ? "border-t border-zinc-100" : ""}`}>
                                        <div className="size-11 shrink-0 overflow-hidden rounded-[15px] bg-zinc-100">
                                            {x.receiptUrl ? <img src={x.receiptUrl} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-zinc-400"><IconCamera size={20} /></div>}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[14.5px] font-semibold text-zinc-900">Abono de {money(x.amount)}</p>
                                            <p className="text-[12.5px] text-zinc-500 truncate">{new Date(x.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{x.referenceNumber ? ` · Ref. ${x.referenceNumber}` : ""}</p>
                                        </div>
                                        <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.c}`}>{st.t}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
                {groups.length === 0 ? (
                    <div className="mt-8 text-center text-sm text-zinc-500">{(client?.creditTransactions || []).length ? "No hay movimientos con esa búsqueda." : "Aún no tienes movimientos."}</div>
                ) : groups.map((g) => (
                    <div key={g.label} className="mt-5">
                        <p className="mb-2 px-1 text-[12px] font-bold text-zinc-500 first-letter:uppercase">{g.label}</p>
                        <div className="rounded-[22px] border border-zinc-200 bg-white overflow-hidden">
                            {g.items.map((tx: any, i: number) => {
                                const isDebt = tx.type === "DEBT";
                                return (
                                    <div key={tx.id} className={`flex items-center gap-3 p-3.5 ${i ? "border-t border-zinc-100" : ""}`}>
                                        <div className={`size-11 shrink-0 rounded-[15px] grid place-items-center ${isDebt ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>
                                            {isDebt ? <IconShoppingBag size={20} /> : <IconCash size={20} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[14.5px] font-semibold text-zinc-900 truncate">{tx.notes || (isDebt ? "Compra a crédito" : "Abono realizado")}</p>
                                            <p className="text-[12.5px] text-zinc-500">{new Date(tx.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                                        </div>
                                        <span className={`ml-auto shrink-0 text-[15px] font-bold ${isDebt ? "text-zinc-900" : "text-emerald-600"}`}>{isDebt ? "" : "−"}{money(Math.abs(tx.amount))}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // ── Plan de cuotas ──
    const renderPlan = (debt: any) => {
        const insts = allInstsOf(debt);
        const total = totalCountOf(debt);
        const paid = paidCountOf(debt);
        const next = pendingInstsOf(debt)[0];
        const pct = total ? paid / total : 0;
        const pendingSubmission = mySubmissions.find((s: any) => s.debtId === debt.loanId && s.status === "PENDING");
        const R = 15, C = 2 * Math.PI * R;
        return (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 pb-36">
                <BackBar title="Plan de cuotas" subtitle={`${storeOf(debt)}${ticketOf(debt) ? ` · Ticket #${ticketOf(debt)}` : ""}`} onBack={() => setPlanDebt(null)} />
                <div className="mt-5 flex items-center gap-4 rounded-[24px] bg-white p-[18px] shadow-[0_16px_30px_-18px_rgba(90,40,10,0.45)]">
                    <svg width="74" height="74" viewBox="0 0 36 36" className="shrink-0">
                        <circle cx="18" cy="18" r={R} fill="none" stroke="#EDEAE4" strokeWidth="4" />
                        <circle cx="18" cy="18" r={R} fill="none" stroke="#F26B3A" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${Math.max(pct * C, 0.01)} ${C}`} transform="rotate(-90 18 18)" />
                        <text x="18" y="21" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#1A1815">{paid}/{total}</text>
                    </svg>
                    <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-zinc-500">Te falta pagar</p>
                        <p className="text-[30px] leading-tight text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.03em" }}>{money(debt.remainingBalance)}</p>
                        <p className="text-[12.5px] text-zinc-500">
                            {total} cuota{total > 1 ? "s" : ""} · {isOverdue(debt) ? <b className="text-rose-600">con atraso</b> : <b className="text-emerald-600">al día</b>}
                        </p>
                    </div>
                </div>
                {pendingSubmission && (
                    <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
                        <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                        Abono de {money(pendingSubmission.amount)} en revisión por el comercio
                    </div>
                )}

                <h3 className="mt-6 mb-2 px-1 text-[17px] text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>Cuotas</h3>
                <div>
                    {insts.map((inst: any, idx: number) => {
                        const left = instLeft(inst);
                        const isPaid = inst.status === "PAID" || left <= 0.004;
                        const isNext = !isPaid && next && inst.id === next.id;
                        const late = !isPaid && daysUntil(inst.dueDate) < 0;
                        return (
                            <div key={inst.id} className="relative flex gap-3.5 pb-3">
                                <div className="relative w-7 flex justify-center">
                                    <span className={`z-10 mt-4 size-[18px] rounded-full border-[3px] ${isPaid ? "border-emerald-500 bg-emerald-500" : isNext ? "border-primary bg-primary shadow-[0_0_0_5px_#FDE6DA]" : late ? "border-rose-400 bg-background" : "border-zinc-300 bg-background"}`}>
                                        {isPaid && <IconCheck size={12} stroke={3} className="text-white -m-[1px]" />}
                                    </span>
                                    {idx < insts.length - 1 && <span className="absolute top-[34px] -bottom-3 w-0.5 bg-zinc-200" />}
                                </div>
                                <div className={`flex-1 flex items-center rounded-[18px] border bg-white px-3.5 py-3 ${isNext ? "border-amber-200 shadow-[0_10px_22px_-14px_rgba(242,107,58,0.6)]" : "border-zinc-200"} ${isPaid ? "opacity-70" : ""}`}>
                                    <div>
                                        <p className="text-[15px] font-bold text-zinc-900">
                                            Cuota {inst.number}
                                            {isNext && <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 align-[2px]">Próxima</span>}
                                            {isPaid && <span className="ml-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 align-[2px]">Pagada</span>}
                                            {late && <span className="ml-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 align-[2px]">Vencida</span>}
                                        </p>
                                        <p className="text-[12.5px] text-zinc-500 mt-0.5">{isPaid ? `Venció el ${fmtDay(inst.dueDate)}` : `Vence el ${fmtDay(inst.dueDate)} · ${whenText(inst.dueDate)}`}</p>
                                    </div>
                                    <div className="ml-auto text-right">
                                        <p className={`text-base font-extrabold ${isPaid ? "text-zinc-500 line-through" : isNext ? "text-zinc-900" : "text-zinc-700"}`} style={{ fontWeight: 800 }}>{money(isPaid ? inst.amount : left)}</p>
                                        {!isPaid && left < inst.amount - 0.004 && <p className="text-[11px] text-zinc-500">de {money(inst.amount)}</p>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {(debt.items || []).length > 0 && (
                    <details className="mt-2 rounded-[18px] border border-zinc-200 bg-white p-3.5 group">
                        <summary className="list-none flex justify-between text-[14px] font-bold text-zinc-900 cursor-pointer">
                            <span>Productos ({debt.items.length})</span>
                            <span className="text-amber-600 group-open:hidden">Ver</span>
                            <span className="text-amber-600 hidden group-open:inline">Ocultar</span>
                        </summary>
                        <div className="mt-2 space-y-1.5">
                            {debt.items.map((it: any, i: number) => (
                                <div key={i} className="flex justify-between text-[13.5px] text-zinc-700">
                                    <span className="truncate pr-3">{it.quantity}× {it.name}</span>
                                    <span className="shrink-0">{money(it.subtotal ?? it.price * it.quantity)}</span>
                                </div>
                            ))}
                        </div>
                    </details>
                )}

                {/* Pay, always at hand */}
                {next && (
                    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md px-5 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)", background: "linear-gradient(180deg, rgba(247,245,240,0), #F7F5F0 30%)" }}>
                        <button onClick={() => openPay(debt)} className="w-full rounded-full bg-primary py-4 text-base font-extrabold text-white shadow-[0_10px_20px_-10px_rgba(242,107,58,0.8)] active:scale-[0.98] transition" style={{ fontWeight: 800 }}>
                            Pagar cuota {next.number} · {money(instLeft(next))}
                        </button>
                        <button onClick={() => openPay(debt, true)} className="mt-2.5 w-full text-center text-sm font-bold text-zinc-500">Pagar otro monto</button>
                    </div>
                )}
            </div>
        );
    };

    // ── Pagos ──
    const renderPayments = () => {
        if (showHistory) return renderHistory();
        if (planDebt) return renderPlan(debts.find((d: any) => d.loanId === planDebt.loanId) || planDebt);

        const monthsFull = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        const groups: { key: string; m: number; y: number; insts: any[] }[] = [];
        allPendingInsts.forEach((inst: any) => {
            const d = new Date(inst.dueDate);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            const g = groups.find((x) => x.key === key);
            if (g) g.insts.push(inst); else groups.push({ key, m: d.getMonth(), y: d.getFullYear(), insts: [inst] });
        });
        const active = groups.find((g) => g.key === selectedMonthTab) || groups[0];
        const monthTotal = active ? active.insts.reduce((s, i) => s + i.remaining, 0) : 0;
        const firstOfMonth = active?.insts[0];
        const q = (inst: any) => (new Date(inst.dueDate).getDate() <= 15 ? "primera quincena" : "segunda quincena");
        const thisYear = new Date().getFullYear();

        return (
            <div className="animate-in fade-in duration-500">
                <h1 className="text-[30px] leading-tight text-white" style={{ fontWeight: 800, letterSpacing: "-0.03em" }}>Tus pagos</h1>

                {groups.length > 0 ? (
                    <>
                        {groups.length > 1 && (
                            <div className="mt-4 -mx-6 px-6 overflow-x-auto scrollbar-none">
                                <div className="flex w-max gap-1.5 rounded-full bg-white/20 p-1">
                                    {groups.map((g) => (
                                        <button key={g.key} onClick={() => setSelectedMonthTab(g.key)} className={`rounded-full px-3.5 py-2 text-[13px] font-bold transition ${g.key === active?.key ? "bg-white text-amber-600" : "text-white"}`}>
                                            <span className="first-letter:uppercase inline-block">{monthsFull[g.m]}{g.y !== thisYear ? ` ${g.y}` : ""}</span>
                                            <span className="opacity-75 font-semibold"> · {g.insts.length}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="mt-5 text-white">
                            <p className="text-[13px] font-semibold text-white/90">A pagar en {monthsFull[active.m]}</p>
                            <p className="text-[52px] leading-[1.05]" style={{ fontWeight: 800, letterSpacing: "-0.045em" }}>{money(monthTotal)}</p>
                            <p className="mt-1 text-[13.5px] font-medium text-white/90">
                                {active.insts.length} cuota{active.insts.length > 1 ? "s" : ""}
                                {active.insts.length === 1 ? ` · vence el ${fmtDay(firstOfMonth.dueDate)} (${q(firstOfMonth)})` : ` · la primera vence el ${fmtDay(firstOfMonth.dueDate)}`}
                            </p>
                        </div>
                        <div className="mt-4 flex gap-2.5">
                            <button onClick={() => (active.insts.length === 1 ? openPay(firstOfMonth.debt) : byBusiness(active.insts).length > 1 ? askPay(active.insts, `Todo lo de ${monthsFull[active.m]}`) : openGroupPay(active.insts, "all"))} className="flex-1 rounded-full bg-[#1A1815] py-3.5 text-[15px] font-bold text-white active:scale-[0.98] transition">
                                Pagar {money(monthTotal)}
                            </button>
                            <button onClick={() => (active.insts.length === 1 ? openPay(firstOfMonth.debt, true) : byBusiness(active.insts).length > 1 ? askPay(active.insts, `Todo lo de ${monthsFull[active.m]}`) : openGroupPay(active.insts, "other"))} className="rounded-full bg-white/95 px-[18px] py-3.5 text-[15px] font-bold text-zinc-900 active:scale-[0.98] transition">
                                Otro monto
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="mt-5 text-white">
                        <p className="text-[13px] font-semibold text-white/90">Estás al día</p>
                        <p className="text-[52px] leading-[1.05]" style={{ fontWeight: 800, letterSpacing: "-0.045em" }}>$0.00</p>
                        <p className="mt-1 text-[13.5px] font-medium text-white/90">No tienes cuotas pendientes</p>
                    </div>
                )}

                {subBanner() && <div className="mt-5">{subBanner()}</div>}

                {pendingDebtsList.length > 0 && (
                    <>
                        <div className="mt-8 mb-2.5 flex items-baseline justify-between">
                            <h3 className="text-[17px] text-zinc-900" style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>Compras a crédito</h3>
                            <span className="text-[13px] font-bold text-amber-600">{pendingDebtsList.length} activa{pendingDebtsList.length > 1 ? "s" : ""}</span>
                        </div>
                        <div className="rounded-[22px] border border-zinc-200 bg-white overflow-hidden">
                            {pendingDebtsList.map((d: any, i: number) => {
                                const late = isOverdue(d);
                                const sub = mySubmissions.find((s: any) => s.debtId === d.loanId && s.status === "PENDING");
                                return (
                                    <button key={d.loanId} onClick={() => { setPlanDebt(d); window.scrollTo({ top: 0 }); }} className={`w-full text-left flex items-center gap-3 p-3.5 active:bg-zinc-50 transition ${i ? "border-t border-zinc-100" : ""}`}>
                                        <div className="size-[46px] shrink-0 rounded-[15px] bg-zinc-100 text-zinc-600 grid place-items-center"><IconBuildingStore size={22} /></div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[15px] font-bold leading-tight text-zinc-900 line-clamp-2">{storeOf(d)}</p>
                                            <p className="text-[12.5px] text-zinc-500 truncate">{ticketOf(d) ? `#${ticketOf(d)} · ` : ""}{fmtDay(d.createdAt)}{sub ? " · abono en revisión" : ""}</p>
                                            <Segments debt={d} />
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${late ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{late ? "Vencida" : "Al día"}</span>
                                            <p className="mt-1 text-base text-zinc-900" style={{ fontWeight: 800 }}>{money(d.remainingBalance)}</p>
                                            <p className="text-[11.5px] text-zinc-500">{paidCountOf(d)} de {totalCountOf(d)} pagadas</p>
                                        </div>
                                        <IconChevronRight size={18} stroke={2.4} className="shrink-0 text-zinc-300" />
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}

                <button onClick={() => { setShowHistory(true); window.scrollTo({ top: 0 }); }} className="mt-3 w-full text-left flex items-center gap-3 rounded-[22px] border border-zinc-200 bg-white p-3.5 active:bg-zinc-50 transition">
                    <div className="size-[46px] shrink-0 rounded-[15px] bg-amber-100 text-amber-600 grid place-items-center"><IconHistory size={22} /></div>
                    <div className="min-w-0">
                        <p className="text-[15px] font-bold text-zinc-900">Historial de movimientos</p>
                        <p className="text-[12.5px] text-zinc-500">Compras y abonos · {(client?.creditTransactions || []).length} movimiento{(client?.creditTransactions || []).length === 1 ? "" : "s"}</p>
                    </div>
                    <IconChevronRight size={18} stroke={2.4} className="ml-auto shrink-0 text-zinc-300" />
                </button>
            </div>
        );
    };

    return (
        <div data-sc-orange={!isOrdersListOpen && !isTrackingOpen ? "" : undefined} className="min-h-screen bg-background text-zinc-800 font-sans-ui pb-28 animate-in fade-in duration-500 relative overflow-x-clip">
            {animationStyle}

            {/* Header: orange that melts into the page, with the bounce trail of the splash */}
            {!isOrdersListOpen && !isTrackingOpen && (
                <>
                    <div aria-hidden className="sc-hero pointer-events-none absolute inset-x-0 top-0 z-0" />
                    <svg aria-hidden className="pointer-events-none absolute left-0 top-0 z-0 h-[300px] w-full opacity-40" viewBox="0 0 390 300" preserveAspectRatio="none">
                        <path d="M-10 230 Q40 120 90 210 Q140 110 190 200 Q240 100 290 190 Q340 95 400 170" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="1.5 8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    </svg>
                    {/* room for the phone's status bar / notch */}
                    <div aria-hidden className="relative z-10" style={{ height: "calc(env(safe-area-inset-top) + 12px)" }} />
                    {activeTab !== "home" && !(activeTab === "payments" && !selectedDebtForPayment) && (
                        <div className="relative z-10 max-w-md mx-auto px-6 mt-4">
                            <h1 className="text-[30px] leading-tight text-white" style={{ fontWeight: 800, letterSpacing: "-0.03em" }}>
                                {activeTab === "payments" && "Pagar"}
                                {activeTab === "rewards" && "Compra en tiendas"}
                                {activeTab === "profile" && "Tu perfil"}
                                {activeTab === "auth-purchase" && "Autoriza tu compra"}
                            </h1>
                        </div>
                    )}
                </>
            )}

            <main className="relative z-10 max-w-md mx-auto px-6 space-y-4 pt-5">
                
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
                                className="text-xs text-amber-800 hover:text-amber-800 font-extrabold h-8 px-3 rounded-full bg-amber-50 hover:bg-amber-100/60 border border-amber-200/50 flex items-center gap-1 transition-all duration-300"
                            >
                                ← Volver
                            </Button>
                            <span className="text-xs font-black text-zinc-400">Solicitud</span>
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
                                        Tu solicitud de préstamo por <strong className="text-amber-800">${pendingRequestLoan.amount} USD</strong> está siendo evaluada por el comercio.
                                    </p>
                                    <p className="text-[10px] text-zinc-400 font-bold mt-3">
                                        Te notificaremos aquí una vez sea aprobada.
                                    </p>
                                </div>
                                <div className="bg-zinc-50 border border-zinc-100/60 rounded-xl p-4 text-[10px] space-y-1.5 text-left text-zinc-500">
                                    <div className="flex justify-between">
                                        <span>Monto solicitado:</span>
                                        <span className="font-extrabold text-zinc-700">${pendingRequestLoan.amount.toFixed(2)} USD</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Interés estimado:</span>
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
                                    <h3 className="text-lg font-black text-zinc-800">¡Préstamo aprobado!</h3>
                                    <p className="text-xs text-zinc-600 leading-relaxed font-semibold">
                                        Tu préstamo por <strong className="text-emerald-700">${approvedRequestLoan.amount} USD</strong> ha sido aprobado.
                                    </p>
                                    <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-xl p-4 text-xs font-semibold text-emerald-800 space-y-2 mt-3 leading-tight text-left">
                                        <p>📍 Por favor acércate al negocio o sucursal para desembolsar el dinero en efectivo.</p>
                                        <p>🤝 En la sucursal coordinaremos a cuántas cuotas pagarás tu préstamo y en qué días.</p>
                                    </div>
                                </div>
                                <div className="bg-zinc-50 border border-zinc-100/60 rounded-xl p-4 text-[10px] space-y-1.5 text-left text-zinc-500">
                                    <div className="flex justify-between">
                                        <span>Monto a entregar:</span>
                                        <span className="font-extrabold text-zinc-700">${approvedRequestLoan.amount.toFixed(2)} USD</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Intereses semanales (20%):</span>
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
                                    <h3 className="text-xl font-black text-zinc-800">¿Cuánto dinero necesitas?</h3>
                                    <p className="text-xs text-zinc-400 font-bold max-w-xs mx-auto leading-tight">
                                        Como cliente nivel 1, puedes solicitar préstamos rápidos en efectivo.
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
                                                        : 'bg-white border-zinc-100 hover:border-zinc-200'
                                                }`}
                                            >
                                                <div className="space-y-1">
                                                    <p className="text-xs text-zinc-500 font-bold">Monto</p>
                                                    <p className="text-3xl font-black text-zinc-800">${amt}</p>
                                                </div>
                                                <div className="border-t border-zinc-100 pt-2.5 space-y-1 text-[9px] text-zinc-400 font-bold text-left">
                                                    <div className="flex justify-between">
                                                        <span>Interés (20%):</span>
                                                        <span className="text-zinc-600">${interest.toFixed(0)} USD</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px] font-extrabold text-amber-800">
                                                        <span>Total:</span>
                                                        <span>${total.toFixed(0)} USD</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="bg-amber-50 border border-amber-100/60 p-4 rounded-xl flex items-start gap-3">
                                    <IconInfoCircle size={18} className="text-amber-700 shrink-0 mt-0.5" />
                                    <div className="space-y-0.5 text-[10px] text-zinc-500 leading-normal font-semibold">
                                        <p className="font-bold text-amber-800">Información importante</p>
                                        <p>• Los préstamos se entregan en efectivo dólares (USD) en la sucursal.</p>
                                        <p>• La tasa cobrada es del 20% semanal.</p>
                                        <p>• Al retirar acordarás el número de cuotas y fechas de pago.</p>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleRequestLoan}
                                    disabled={!selectedAmount || submittingRequest}
                                    className="w-full h-12 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none mt-2"
                                >
                                    {submittingRequest ? "Enviando solicitud..." : `Solicitar $${selectedAmount} USD`}
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* TAB 1: HOME */}
                        {activeTab === "home" && renderHome()}

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
                                    className="text-xs text-amber-800 hover:text-amber-800 font-extrabold h-8 px-3 rounded-full bg-amber-50 hover:bg-amber-100/60 border border-amber-200/50 flex items-center gap-1 transition-all duration-300"
                                >
                                    ← Volver
                                </button>
                                <span className="text-xs font-bold text-white/90">
                                    {paymentStep === "details" && "Detalles de la compra"}
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
                                                <h3 className="text-sm font-black text-zinc-800">
                                                    {selectedDebtForPayment.description || "Compra a crédito"}
                                                </h3>
                                                <p className="text-[10px] text-zinc-400 font-bold">
                                                    Realizada el {new Date(selectedDebtForPayment.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-zinc-400 font-bold">Monto pendiente</p>
                                                <p className="text-xl font-black text-zinc-950 font-mono">${selectedDebtForPayment.remainingBalance.toFixed(2)}</p>
                                            </div>
                                        </div>

                                        {selectedDebtForPayment.items && selectedDebtForPayment.items.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[9px] font-bold text-zinc-500">Productos adquiridos</p>
                                                <div className="space-y-1.5">
                                                    {selectedDebtForPayment.items.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between items-center text-xs text-zinc-600">
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
                                        <h4 className="text-xs font-black text-zinc-400">¿Cuánto deseas abonar?</h4>
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
                                                                            ? "bg-amber-50 border-amber-400 shadow-sm text-zinc-900 font-extrabold"
                                                                            : "bg-white border-zinc-100 hover:border-zinc-200 text-zinc-700 font-medium"
                                                                    }`}
                                                                >
                                                                    <div className="flex flex-col text-left">
                                                                        <span className="text-xs font-black tracking-tight">{opt.label}</span>
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
                                                                    ? "bg-amber-50 border-amber-400 shadow-sm text-zinc-900 font-extrabold"
                                                                    : "bg-white border-zinc-100 hover:border-zinc-200 text-zinc-700 font-medium"
                                                            }`}
                                                        >
                                                            <div className="flex flex-col text-left">
                                                                <span className="text-xs font-black tracking-tight">Otro monto</span>
                                                                <span className="text-[10px] text-zinc-400 font-bold mt-0.5">
                                                                    Ingresa una cantidad personalizada
                                                                </span>
                                                            </div>
                                                            <span className="text-xs font-bold text-amber-700">Editar →</span>
                                                        </div>

                                                        {/* Custom Amount Input field */}
                                                        {selectedInstallmentOption === "custom" && (
                                                            <div className="rounded-2xl bg-white border border-zinc-100 p-4 space-y-3 animate-in slide-in-from-top duration-300 text-center">
                                                                <p className="text-[10px] font-black text-zinc-500">Monto personalizado (USD)</p>
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
                                                label: "Pago móvil",
                                                desc: "Transferencia interbancaria rápida (Bs)",
                                                icon: <IconDeviceMobile size={22} />,
                                                color: "amber",
                                                iconBg: "bg-amber-500/10 text-amber-700",
                                                border: "border-amber-200/60 hover:border-amber-300",
                                                arrow: "text-amber-700",
                                                bg: "bg-gradient-to-br from-amber-50 via-amber-50 to-amber-50/30",
                                            },
                                            settings?.binanceEnabled && {
                                                key: "binance",
                                                label: "Binance pay",
                                                desc: "Pago con criptomonedas (USDT)",
                                                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L8.5 5.5 10.5 7.5 12 6l1.5 1.5 2-2L12 2zm-4 4L6 8l2 2 2-2-2-2zm8 0l-2 2 2 2 2-2-2-2zM12 10l-2 2 2 2 2-2-2-2zm-4 4l-2 2 2 2 2-2-2-2zm8 0l-2 2 2 2 2-2-2-2zM12 18l-1.5 1.5-2-2L12 22l3.5-4.5-2 2L12 18z"/></svg>,
                                                color: "yellow",
                                                iconBg: "bg-yellow-400/10 text-yellow-600",
                                                border: "border-yellow-200/60 hover:border-yellow-300",
                                                arrow: "text-yellow-600",
                                                bg: "bg-gradient-to-br from-amber-50 via-[#fefce8] to-yellow-50/30",
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
                                                <h4 className="text-xs font-black text-zinc-400">Selecciona método de pago</h4>
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
                                                                <p className="text-xs font-black text-zinc-800 tracking-tight">{method.label}</p>
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
                                    <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-amber-50 to-amber-50/30 border border-amber-200/50 p-5 space-y-4 shadow-sm animate-in fade-in duration-300">
                                        <div className="flex items-center gap-2 border-b border-zinc-100/60 pb-3">
                                            <IconDeviceMobile size={18} className="text-amber-700" />
                                            <h3 className="text-xs font-black text-zinc-700">Pago móvil del comercio</h3>
                                        </div>
                                        {settings?.pagoMovilEnabled ? (
                                            <div className="grid grid-cols-2 gap-4 text-xs">
                                                <div>
                                                    <p className="text-zinc-500 text-[9px] font-bold">Banco</p>
                                                    <p className="font-extrabold text-zinc-700 mt-0.5">{settings.pagoMovilBank}</p>
                                                </div>
                                                <div>
                                                    <p className="text-zinc-500 text-[9px] font-bold">Cédula / RIF</p>
                                                    <div className="flex items-center gap-1 cursor-pointer mt-0.5" onClick={() => copyToClipboard(settings.pagoMovilId, "Cédula")}>
                                                        <p className="font-extrabold text-amber-700">{settings.pagoMovilId}</p>
                                                        <IconCopy size={12} className="text-zinc-400" />
                                                    </div>
                                                </div>
                                                <div className="col-span-2">
                                                    <p className="text-zinc-500 text-[9px] font-bold">Teléfono de pago</p>
                                                    <div className="flex items-center gap-1 cursor-pointer mt-0.5" onClick={() => copyToClipboard(settings.pagoMovilPhone, "Teléfono")}>
                                                        <p className="font-black text-amber-700 text-base">{settings.pagoMovilPhone}</p>
                                                        <IconCopy size={12} className="text-zinc-400" />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-zinc-500 font-bold text-center py-2">
                                                El comercio no tiene habilitado pago móvil actualmente.
                                            </p>
                                        )}
                                    </div>

                                    {/* Amount in Bs (primary) with USD conversion */}
                                    <div className="rounded-2xl bg-white border border-zinc-100 p-5 space-y-4 shadow-sm text-center animate-in fade-in duration-300">
                                        <p className="text-[10px] font-black text-zinc-400">Monto a transferir (Bs)</p>
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
                                            className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none mt-2"
                                        >
                                            Ya pagué
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2b: BINANCE PAY */}
                            {paymentStep === "binance" && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-[#fefce8] to-yellow-50/30 border border-yellow-200/50 p-5 space-y-4 shadow-sm animate-in fade-in duration-300">
                                        <div className="flex items-center gap-2 border-b border-zinc-100/60 pb-3">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-600"><path d="M12 2L8.5 5.5 10.5 7.5 12 6l1.5 1.5 2-2L12 2zm-4 4L6 8l2 2 2-2-2-2zm8 0l-2 2 2 2 2-2-2-2zM12 10l-2 2 2 2 2-2-2-2zm-4 4l-2 2 2 2 2-2-2-2zm8 0l-2 2 2 2 2-2-2-2zM12 18l-1.5 1.5-2-2L12 22l3.5-4.5-2 2L12 18z"/></svg>
                                            <h3 className="text-xs font-black text-zinc-700">Datos de Binance pay</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 text-xs">
                                            {settings?.binanceId && (
                                                <div>
                                                    <p className="text-zinc-400 text-[9px] font-bold">Binance ID</p>
                                                    <div className="flex items-center gap-1 cursor-pointer mt-0.5" onClick={() => copyToClipboard(settings.binanceId, "Binance ID")}>
                                                        <p className="font-extrabold text-yellow-700">{settings.binanceId}</p>
                                                        <IconCopy size={12} className="text-zinc-400" />
                                                    </div>
                                                </div>
                                            )}
                                            {settings?.binanceEmail && (
                                                <div>
                                                    <p className="text-zinc-400 text-[9px] font-bold">Correo de la cuenta</p>
                                                    <div className="flex items-center gap-1 cursor-pointer mt-0.5" onClick={() => copyToClipboard(settings.binanceEmail, "Correo Binance")}>
                                                        <p className="font-extrabold text-yellow-700">{settings.binanceEmail}</p>
                                                        <IconCopy size={12} className="text-zinc-400" />
                                                    </div>
                                                </div>
                                            )}
                                            {!settings?.binanceId && !settings?.binanceEmail && (
                                                <p className="text-xs text-zinc-500 font-bold text-center py-2">El comercio no ha configurado sus datos de Binance pay.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Editable Amount */}
                                    <div className="rounded-2xl bg-white border border-zinc-100 p-5 space-y-4 shadow-sm text-center animate-in fade-in duration-300">
                                        <p className="text-[10px] font-black text-zinc-400">Monto a abonar (USD)</p>
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
                                            className="w-full h-12 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none mt-2"
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
                                            <h3 className="text-xs font-black text-zinc-700">Datos de Zinli</h3>
                                        </div>
                                        <div className="text-xs">
                                            {settings?.zinliEmail ? (
                                                <div>
                                                    <p className="text-zinc-400 text-[9px] font-bold">Correo Zinli</p>
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
                                        <p className="text-[10px] font-black text-zinc-400">Monto a abonar (USD)</p>
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
                                            className="w-full h-12 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none mt-2"
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
                                            <h3 className="text-xs font-black text-zinc-700">Datos de PayPal</h3>
                                        </div>
                                        <div className="text-xs">
                                            {settings?.paypalEmail ? (
                                                <div>
                                                    <p className="text-zinc-400 text-[9px] font-bold">Correo PayPal</p>
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
                                        <p className="text-[10px] font-black text-zinc-400">Monto a abonar (USD)</p>
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
                                            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none mt-2"
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
                                        <h3 className="text-sm font-black text-zinc-800">Cargar comprobante de pago</h3>
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
                                                    <p className="text-xs font-black text-zinc-600">Subir foto del comprobante</p>
                                                    <p className="text-[10px] text-zinc-500 font-bold">Formatos permitidos: jpg, png</p>
                                                </>
                                            )}
                                        </div>

                                        {/* Reference Number Input */}
                                        <div className="w-full space-y-1 text-left">
                                            <label className="text-[10px] font-black text-zinc-400 block">N° de referencia (opcional)</label>
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
                                                        body: formData,
                                                        headers: { Authorization: `Bearer ${localStorage.getItem("client_token") ?? ""}` }
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
                                            className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none mt-2"
                                        >
                                            {isSubmittingPayment ? "Registrando abono..." : "Enviar comprobante"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: PENDING CONFIRMATION */}
                            {paymentStep === "pending" && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl bg-white border border-zinc-100 p-6 shadow-sm text-center space-y-5 animate-in scale-in-95 duration-300">
                                        <div className="flex justify-center">
                                            <div className="relative flex items-center justify-center size-20 rounded-full bg-amber-50 text-amber-500">
                                                <span className="absolute size-20 rounded-full bg-amber-100 animate-ping opacity-30" />
                                                <IconClock size={40} className="relative z-10" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-lg font-black text-zinc-800">¡Abono en validación!</h3>
                                            <p className="text-xs text-zinc-600 leading-relaxed font-semibold">
                                                Su orden está pendiente en ser abonada
                                            </p>
                                            <p className="text-[10px] text-zinc-400 font-bold leading-normal px-2">
                                                Hemos recibido tu comprobante de pago móvil por <strong className="text-zinc-700">${parseFloat(paymentAmount).toFixed(2)} USD</strong>. El comercio validará la transacción a la brevedad y aplicará el saldo a tu cuenta.
                                            </p>
                                        </div>

                                        <Button
                                            onClick={() => {
                                                setSelectedDebtForPayment(null);
                                                setPaymentStep("details");
                                            }}
                                            className="w-full h-12 rounded-xl bg-zinc-800 hover:bg-zinc-900 text-white font-black text-sm shadow-sm transition-all border-none mt-2"
                                        >
                                            Entendido
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        renderPayments()
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
                                            <h3 className="text-sm font-black text-zinc-900">Confirmar delivery</h3>
                                            <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-black">
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
                                                <span className="text-[9px] font-black text-zinc-400 block">Ubicación de entrega</span>
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
                                            <h4 className="text-[9px] font-black text-zinc-400">Artículos</h4>
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
                                            <div className="pt-2 border-t border-zinc-100 flex justify-between items-baseline">
                                                <span className="text-[10px] font-black text-zinc-500">Total</span>
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
                                            <Label className="text-[9px] font-black text-zinc-400">Detalle adicional (apto, piso, ref.) <span className="text-rose-500 font-bold ml-0.5">*</span></Label>
                                            <Input
                                                type="text"
                                                placeholder="Ej. Edif. Centro, apto 4b, frente a la farmacia"
                                                value={deliveryNote}
                                                onChange={(e) => setDeliveryNote(e.target.value)}
                                                className="h-10 rounded-xl border-zinc-200 bg-zinc-50 text-xs font-semibold focus-visible:ring-amber-400"
                                            />
                                        </div>

                                        {/* Phone */}
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black text-zinc-400">Teléfono de contacto <span className="text-rose-500 font-bold ml-0.5">*</span></Label>
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
                                            className="w-full h-12 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-[0.98] text-white font-black text-sm border-none shadow-lg shadow-amber-400/20 transition-all duration-200"
                                        >
                                            {isSubmittingDelivery ? (
                                                <span className="flex items-center gap-2">
                                                    <span className="size-4 border-2 border-amber-900/40 border-t-amber-900 rounded-full animate-spin" />
                                                    Enviando solicitud...
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-2">
                                                    <IconTruck size={18} />
                                                    Solicitar envío
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
                                    <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-background z-50 overflow-y-auto px-6 pt-8 pb-28 flex flex-col space-y-5 animate-in slide-in-from-right duration-300">
                                        {/* Back Header */}
                                        <div className="flex items-center justify-between pb-1.5">
                                            <button
                                                onClick={() => setSelectedProductForDetail(null)}
                                                className="text-xs text-amber-800 hover:text-amber-800 font-extrabold h-8 px-3 rounded-full bg-amber-50 hover:bg-amber-100/60 border border-amber-200/50 flex items-center gap-1 transition-all duration-300 cursor-pointer"
                                            >
                                                <IconChevronLeft size={14} />
                                                <span>Volver</span>
                                            </button>
                                            <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-950 px-3 py-1 rounded-full font-black">
                                                Detalle de producto
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
                                                    <span className="inline-block text-[9px] bg-zinc-100/80 text-zinc-600 font-extrabold px-2.5 py-0.5 rounded-md">
                                                        {product.category.name}
                                                    </span>
                                                )}
                                                <h3 className="text-lg font-black text-zinc-900 leading-tight">
                                                    {product.name}
                                                </h3>
                                                {product.description && (
                                                    <p className="text-xs text-zinc-600 leading-relaxed font-semibold">
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
                                                        <span className="text-zinc-800 font-black text-2xl font-mono">
                                                            ${price.toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>

                                                <span className={`inline-flex items-center justify-center text-[10px] font-extrabold px-3 py-1 rounded-full ${
                                                    inStock 
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/40' 
                                                        : 'bg-rose-50 text-rose-600 border border-rose-100/40'
                                                }`}>
                                                    {inStock ? `En stock (${product.totalStock})` : "Agotado"}
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
                                                className="h-14 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-black text-xs transition-colors border-none active:scale-[0.98] cursor-pointer"
                                            >
                                                Agregar al carrito
                                            </Button>
                                            <Button
                                                onClick={() => handleCheckout([{ product, quantity: 1 }])}
                                                disabled={!inStock}
                                                className="h-14 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-black text-xs transition-all duration-200 border-none active:scale-[0.98] cursor-pointer shadow-md shadow-amber-400/10"
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
                                        <h3 className="text-base font-black text-zinc-800">Comercios disponibles</h3>
                                        <p className="text-xs text-zinc-400 font-semibold mt-0.5">
                                            Selecciona una tienda para ver su catálogo de productos.
                                        </p>
                                    </div>
                                    <Button
                                        onClick={() => setIsOrdersListOpen(true)}
                                        className="w-full rounded-2xl bg-amber-400 hover:bg-amber-500 text-amber-900 font-black text-xs h-11 border-none shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-[0.97] transition-all duration-200 cursor-pointer animate-in fade-in"
                                    >
                                        <IconTruck size={18} />
                                        <span>Mis pedidos</span>
                                    </Button>
                                </div>

                                {/* Search Businesses */}
                                <div className="sticky top-0 z-40 bg-background py-3 -mx-6 px-6 border-b border-zinc-100/40 shadow-sm">
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
                                    <div className="rounded-2xl bg-white/60 border border-dashed border-zinc-200 p-8 text-center text-zinc-500 font-bold text-xs">
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
                                                <div className="rounded-2xl bg-white/60 border border-dashed border-zinc-200 p-8 text-center text-zinc-500 font-bold text-xs">
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
                                                                        <span className="inline-block text-[8px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full shadow-sm shadow-amber-500/10">
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
                                    <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-950 px-3 py-1 rounded-full font-black">
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
                                                    <span className="text-[9px] bg-amber-500 text-white font-black px-2.5 py-0.5 rounded-full shadow-sm shadow-amber-500/10">
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
                                                <span className="inline-flex items-center gap-1.5 text-[10px] bg-zinc-100/70 border border-zinc-200/30 text-zinc-600 px-3 py-1.5 rounded-full font-bold">
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
                                                <div key={i} className="h-[34px] w-24 bg-zinc-100/70 rounded-xl animate-pulse shrink-0" />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    businessBranchesForShop.length > 1 && (
                                        <div className="space-y-2">
                                            <span className="text-[10px] font-black text-zinc-400">
                                                Sucursales disponibles
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
                                                                    ? 'bg-amber-400 text-white shadow-md shadow-amber-400/20 scale-[1.02] border-none'
                                                                    : 'bg-white border border-zinc-100 text-zinc-600 hover:border-amber-200 hover:text-amber-500'
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
                                    <div className="sticky top-0 z-40 bg-background py-3 -mx-6 px-6 border-b border-zinc-100/40 shadow-sm">
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
                                            
                                            <div className="flex flex-col items-center shrink-0 bg-white border border-zinc-100/80 px-2.5 py-1.5 rounded-xl shadow-xs gap-0.5 min-w-[66px]">
                                                <span className="text-[8px] font-black text-zinc-400">En stock</span>
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
                                                        <div className="h-4 w-3/4 bg-zinc-100/70 rounded-md" />
                                                        
                                                        {/* Description placeholder */}
                                                        <div className="space-y-1.5">
                                                            <div className="h-3 w-full bg-zinc-100/80 rounded" />
                                                            <div className="h-3 w-5/6 bg-zinc-100/80 rounded" />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2.5 pt-2 border-t border-zinc-50">
                                                        {/* Price placeholder */}
                                                        <div className="h-5 w-16 bg-zinc-100/70 rounded" />
                                                        
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
                                                    <div className="rounded-2xl bg-white/60 border border-dashed border-zinc-200 p-8 text-center text-zinc-500 font-bold text-xs">
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
                                                                className="rounded-2xl bg-white border border-zinc-100/80 overflow-hidden flex flex-col justify-between hover:border-amber-200/60 hover:-translate-y-0.5 transition-all duration-300 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_30px_-5px_rgba(0,0,0,0.08)] animate-in zoom-in-95 duration-200 cursor-pointer"
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
                                                                    <div className="h-28 bg-gradient-to-br from-zinc-50 to-zinc-100/50 flex items-center justify-center border-b border-zinc-100 shrink-0 text-zinc-300">
                                                                        <IconShoppingBag size={28} className="opacity-40 text-zinc-400" />
                                                                    </div>
                                                                )}
                                                                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                                                                    <div className="space-y-1.5">
                                                                        {product.category && (
                                                                            <span className="inline-block text-[8px] bg-zinc-100/80 text-zinc-500 font-extrabold px-2 py-0.5 rounded-md">
                                                                                {product.category.name}
                                                                            </span>
                                                                        )}
                                                                        <h4 className="text-xs font-extrabold text-zinc-800 line-clamp-1 leading-tight">
                                                                            {product.name}
                                                                        </h4>
                                                                        {product.description && (
                                                                            <p className="text-[9px] text-zinc-500 line-clamp-2 leading-relaxed">
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
                                                                            {inStock ? `En stock (${product.totalStock})` : "Agotado"}
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
                                <div className="rounded-xl bg-gradient-to-br from-amber-50 via-amber-50 to-amber-50/30 border border-amber-200/50 p-6 space-y-4">
                                    <h3 className="text-sm font-black text-zinc-800 border-b border-zinc-100 pb-2">Editar perfil</h3>
                                    <div className="space-y-3.5">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-zinc-400">Nombre</label>
                                            <Input 
                                                value={editName} 
                                                onChange={(e) => setEditName(e.target.value)} 
                                                className="h-10 rounded-lg text-xs border-zinc-200 bg-white" 
                                                disabled={isSavingProfile}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-zinc-400">Email</label>
                                            <Input 
                                                value={editEmail} 
                                                onChange={(e) => setEditEmail(e.target.value)} 
                                                className="h-10 rounded-lg text-xs border-zinc-200 bg-white" 
                                                disabled={isSavingProfile}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-zinc-400">Teléfono</label>
                                            <Input 
                                                value={editPhone} 
                                                onChange={(e) => setEditPhone(e.target.value)} 
                                                className="h-10 rounded-lg text-xs border-zinc-200 bg-white" 
                                                disabled={isSavingProfile}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-zinc-400">Dirección</label>
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
                                        className="flex-1 h-12 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-500 text-white shadow-md border-none"
                                        disabled={isSavingProfile}
                                    >
                                        {isSavingProfile ? "Guardando..." : "Guardar"}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="rounded-xl bg-gradient-to-br from-amber-50 via-amber-50 to-amber-50/30 border border-amber-200/50 p-6 space-y-5">
                                    <div className="flex items-center gap-3.5">
                                        <div className="size-12 rounded-full bg-amber-50 text-amber-950 flex items-center justify-center font-black">
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
                                    Editar perfil
                                </Button>

                                <Button 
                                    variant="outline" 
                                    onClick={requestLogout} 
                                    className="w-full h-12 rounded-xl text-xs font-black text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50/50 transition-all duration-300 bg-transparent"
                                >
                                    Cerrar sesión
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
                                    <h3 className="text-xl font-black text-zinc-900">Operación cancelada</h3>
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
                                    Ir al inicio
                                </button>
                            </div>
                        ) : showApprovalSuccess ? (
                            <div className="w-full max-w-sm flex flex-col items-center justify-center py-12 text-center space-y-4 animate-in zoom-in-95 duration-500 mx-auto">
                                <div className="size-20 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                    <IconCheck size={40} stroke={3} />
                                </div>
                                <h3 className="text-lg font-black text-zinc-950">¡Compra autorizada con éxito!</h3>
                                <p className="text-xs text-zinc-500 max-w-[280px]">
                                    El crédito ha sido restado de tu cupo y los detalles de tu compra fiada se cargaron.
                                </p>
                            </div>
                        ) : !pendingPurchase ? (
                            <div className="w-full max-w-sm rounded-2xl border border-amber-100 bg-card p-6 space-y-6 text-center shadow-sm mx-auto">
                                <div className="size-16 rounded-full bg-amber-400/10 text-amber-500 flex items-center justify-center mx-auto">
                                    <IconLock size={32} />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-base font-black text-zinc-900">Autorizar compra con PIN</h3>
                                    <p className="text-[11px] text-zinc-500 leading-normal max-w-[280px] mx-auto">
                                        Ingresa el PIN de 6 dígitos que te dictó el cajero para cargar el resumen de tu compra fiada.
                                    </p>
                                </div>

                                <div className="space-y-4 max-w-[250px] mx-auto">
                                    <Input 
                                        type="text" 
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        className="h-14 text-center text-2xl font-black rounded-xl border-amber-200 bg-white"
                                        placeholder="000000"
                                        value={authPin}
                                        onChange={(e) => setAuthPin(e.target.value.replace(/[^0-9]/g, ""))}
                                    />
                                    <Button
                                        onClick={() => handleFetchPendingPurchase(authPin)}
                                        disabled={isLoadingPendingPurchase || authPin.length !== 6}
                                        className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-black text-xs shadow-sm border-none transition-all duration-350 active:scale-95"
                                    >
                                        {isLoadingPendingPurchase ? "Buscando..." : "Buscar compra"}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full max-w-sm space-y-4 animate-in zoom-in-95 duration-350 mx-auto">
                                {/* CART SUMMARY CARD */}
                                <div className="rounded-2xl border border-amber-100 bg-white p-5 space-y-4 shadow-sm">
                                    <div className="flex justify-between items-start pb-3 border-b border-zinc-100">
                                        <div className="space-y-0.5">
                                            <span className="text-[9px] font-extrabold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100/50">
                                                {pendingPurchase.businessName}
                                            </span>
                                            <h4 className="font-extrabold text-sm text-zinc-800 mt-1">Resumen de compra</h4>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold text-zinc-400 block leading-none">Total</span>
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
                                    <div className="rounded-2xl border border-amber-100 bg-white p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
                                        <h4 className="font-black text-xs text-zinc-800">Elige la frecuencia de pago</h4>
                                        
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
                                                                ? "bg-amber-400 border-amber-400 text-white shadow-sm"
                                                                : "bg-amber-50 border-amber-100 text-zinc-700 hover:border-amber-400 hover:text-amber-500"
                                                        }`}
                                                    >
                                                        {freq} días
                                                    </button>
                                                ));
                                            })()}
                                        </div>
                                    </div>

                                    {/* INSTALLMENTS SELECTOR */}
                                    <div className="rounded-2xl border border-amber-100 bg-white p-5 space-y-4 shadow-sm">
                                        <h4 className="font-black text-xs text-zinc-800">Elige el número de cuotas</h4>
                                        
                                        <div className="grid grid-cols-3 gap-2">
                                            {Array.from({ length: client?.syncroCreditMaxInstallments || settings?.syncroCreditMaxInstallments || 3 }, (_, i) => i + 1).map((num) => (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    onClick={() => setSelectedInstallments(num)}
                                                    className={`h-12 rounded-xl text-xs font-extrabold border transition-all duration-150 ${
                                                        selectedInstallments === num
                                                            ? "bg-amber-400 border-amber-400 text-white shadow-sm"
                                                            : "bg-amber-50 border-amber-100 text-zinc-700 hover:border-amber-400 hover:text-amber-500"
                                                    }`}
                                                >
                                                    {num} {num === 1 ? "Cuota" : "Cuotas"}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Installment Calendar Preview */}
                                        <div className="bg-amber-50/20 border border-amber-100/50 rounded-xl p-4 space-y-3">
                                            <span className="text-[9px] font-extrabold text-amber-700">Calendario de pagos estimado</span>
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
                                            {submittingApproval ? "Autorizando..." : "Autorizar e iniciar crédito"}
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
            {selectedProductForDetail === null && !isCheckoutOpen && !isCartOpen && !(activeTab === "payments" && planDebt && !showHistory) && (
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
                            setPurchaseSuccessData(null); setPlanDebt(null); setShowHistory(false); setShowLevel(false);
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
                            setPurchaseSuccessData(null); setPlanDebt(null); setShowHistory(false); setShowLevel(false);
                        }} 
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors duration-300 ${activeTab === "payments" && !showHistory ? "text-amber-500 font-extrabold" : "text-zinc-400"}`}
                    >
                        <IconWallet size={18} />
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
                                setPurchaseSuccessData(null); setPlanDebt(null); setShowHistory(false); setShowLevel(false);
                            }} 
                            className={`absolute -top-[34px] w-[72px] h-[72px] rounded-full flex flex-col items-center justify-center transition-all duration-300 transform active:scale-95 shadow-md z-10 ${
                                activeTab === "auth-purchase" 
                                    ? "bg-amber-400 text-white scale-105 shadow-amber-400/35 border-none" 
                                    : "bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100/40 shadow-zinc-200"
                            }`}
                        >
                            <IconLock size={22} className={activeTab === "auth-purchase" ? "animate-pulse" : ""} />
                            <span className="text-[10px] font-black mt-0.5">PIN</span>
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
                            setPurchaseSuccessData(null); setPlanDebt(null); setShowLevel(false);
                            // the app is credit-only for now: shopping is hidden; this slot is the history
                            setActiveTab("payments");
                            setShowHistory(true);
                            window.scrollTo({ top: 0 });
                        }} 
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors duration-300 ${activeTab === "payments" && showHistory ? "text-amber-500 font-extrabold" : "text-zinc-400"}`}
                    >
                        <IconHistory size={18} />
                        <span>Historial</span>
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
                            setPurchaseSuccessData(null); setPlanDebt(null); setShowHistory(false); setShowLevel(false);
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
                <DialogContent className="max-w-md rounded-xl border-amber-100 bg-card text-zinc-800 p-6 shadow-lg">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
                            <IconMapPin className="text-amber-700" size={20} />
                            Tiendas cercanas
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500 text-xs font-medium">
                            Encuentra nuestras sucursales físicas para realizar tus compras, abonos y retiros de premios.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                        {branches.length === 0 ? (
                            <div className="p-4 rounded-xl border border-dashed border-amber-200/60 bg-amber-50/20 text-center">
                                <p className="font-extrabold text-sm text-zinc-800">
                                    {settings?.businessName || "Syncro principal"}
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
                                    <p className="text-xs text-zinc-500 flex items-start gap-1">
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
                    className="fixed bottom-[108px] right-6 z-40 size-14 rounded-full bg-amber-400 text-white flex items-center justify-center shadow-lg shadow-amber-400/25 active:scale-95 transition-all duration-200 border-none animate-in zoom-in-95 duration-200 cursor-pointer"
                >
                    <div className="relative">
                        <IconShoppingBag size={24} />
                        {cart.reduce((sum, item) => sum + item.quantity, 0) > 0 && (
                            <span className="absolute -top-3.5 -right-3.5 bg-rose-500 text-white text-[10px] font-black size-6 rounded-full flex items-center justify-center border-2 border-background">
                                {cart.reduce((sum, item) => sum + item.quantity, 0)}
                            </span>
                        )}
                    </div>
                </button>
            )}




            {/* SHOPPING CART FULL PAGE OVERLAY */}
            {isCartOpen && (
                <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-background z-50 overflow-y-auto px-6 pt-8 pb-28 flex flex-col space-y-5 animate-in slide-in-from-right duration-300">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100/40 shrink-0">
                        <button
                            onClick={() => setIsCartOpen(false)}
                            className="text-xs text-amber-800 hover:text-amber-800 font-extrabold h-8 px-3 rounded-full bg-amber-50 hover:bg-amber-100/60 border border-amber-200/50 flex items-center gap-1 transition-all duration-300 cursor-pointer animate-in fade-in"
                        >
                            <IconChevronLeft size={14} />
                            <span>Volver</span>
                        </button>
                        <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-900 px-3 py-1 rounded-full font-black">
                            Carrito de compras
                        </span>
                    </div>

                    {cart.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-20 gap-4 animate-in fade-in zoom-in duration-300">
                            <div className="size-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 shadow-sm shadow-amber-400/5">
                                <IconShoppingBag size={32} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-black text-zinc-800">Tu carrito está vacío</p>
                                <p className="text-xs text-zinc-500 font-semibold max-w-[200px] mx-auto leading-relaxed">
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
                                                    <p className="text-[10px] font-black text-zinc-500 mt-0.5">${price.toFixed(2)} c/u</p>
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
                                                <span className="font-black text-xs text-zinc-800 text-center w-4">{item.quantity}</span>
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
                            <div className="pt-4 border-t border-zinc-100/40 bg-background space-y-4 shrink-0 mt-4">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs font-bold text-zinc-500">Total estimado:</span>
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
                                    className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-900 font-black text-xs transition-all duration-200 border-none shadow-md shadow-amber-400/10"
                                >
                                    Proceder al pago
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}




            {/* PURCHASE SUCCESS CONFIRMATION MODAL */}
            <Dialog open={purchaseSuccessData !== null} onOpenChange={(open) => { if (!open) setPurchaseSuccessData(null); }}>
                <DialogContent className="max-w-md rounded-2xl border-emerald-100 bg-card text-zinc-800 p-6 shadow-xl text-center">
                    {purchaseSuccessData && (
                        <div className="space-y-6">
                            <div className="flex justify-center pt-2">
                                <div className="relative flex items-center justify-center size-20 rounded-full bg-emerald-50 text-emerald-500">
                                    <span className="absolute size-20 rounded-full bg-emerald-100 animate-ping opacity-25" />
                                    <IconCheck size={42} className="relative z-10" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-zinc-900 leading-tight">¡Orden reservada exitosamente!</h3>
                                <p className="text-xs text-zinc-500 leading-relaxed font-semibold max-w-xs mx-auto">
                                    Tu compra a crédito por un total de <strong className="text-zinc-900 font-black">${purchaseSuccessData.amount.toFixed(2)} USD</strong> ha sido pre-autorizada.
                                </p>
                            </div>

                            {/* PIN Code display card */}
                            <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-5 space-y-2">
                                <span className="text-[10px] font-black text-emerald-800 block">Código de retiro / PIN</span>
                                <span className="text-3xl font-black font-mono text-emerald-950 block">{purchaseSuccessData.pin}</span>
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
                            <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-background z-[45] overflow-y-auto px-6 pt-8 pb-28 flex flex-col space-y-5 animate-in slide-in-from-right duration-300">
                                <div className="shrink-0">
                                    <PortalTitle>Sigue tu envío</PortalTitle>
                                </div>

                                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100/40 shrink-0">
                                    <button
                                        onClick={() => {
                                            setIsTrackingOpen(false);
                                        }}
                                        className="text-xs text-amber-800 hover:text-amber-800 font-extrabold h-8 px-3 rounded-full bg-amber-50 hover:bg-amber-100/60 border border-amber-200/50 flex items-center gap-1 transition-all duration-300 cursor-pointer animate-in fade-in"
                                    >
                                        <IconChevronLeft size={14} />
                                        <span>Volver</span>
                                    </button>
                                    <span className={`text-[10px] px-3 py-1 rounded-full font-black   ${
                                        activeDeliveryOrder.status === "PENDING"
                                            ? "bg-amber-50 border border-amber-100 text-amber-900"
                                            : activeDeliveryOrder.status === "APPROVED"
                                            ? "bg-blue-50 border border-blue-100 text-blue-900"
                                            : activeDeliveryOrder.status === "SHIPPED"
                                            ? "bg-indigo-50 border border-indigo-100 text-indigo-900"
                                            : activeDeliveryOrder.status === "ON_THE_WAY"
                                            ? "bg-orange-50 border border-orange-100 text-orange-900"
                                            : activeDeliveryOrder.status === "DELIVERED"
                                            ? "bg-emerald-50 border border-emerald-100 text-emerald-900"
                                            : "bg-zinc-50 border border-zinc-100 text-zinc-900"
                                    }`}>
                                        {activeDeliveryOrder.status === "PENDING" ? "Verificando" :
                                         activeDeliveryOrder.status === "APPROVED" ? "Aprobado" :
                                         activeDeliveryOrder.status === "SHIPPED" ? "Salida de tienda" :
                                         activeDeliveryOrder.status === "ON_THE_WAY" ? "En camino" :
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
                                        <div className="relative -mx-6 -mt-5 h-[45vh] bg-zinc-50 border-b border-zinc-100/60 shadow-inner overflow-hidden">
                                            <div ref={trackingMapContainerRef} className="w-full h-full" />
                                            {activeDeliveryOrder.address && (
                                                <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-md border border-zinc-100 text-xs text-zinc-700 font-semibold">
                                                    <p className="font-bold text-zinc-800 text-[10px] mb-0.5">Dirección de entrega</p>
                                                    <p className="text-zinc-600 leading-relaxed font-medium">{activeDeliveryOrder.address}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Timeline route progress card */}
                                        <div className="bg-white border border-zinc-100 rounded-2xl p-5 space-y-4 shadow-sm">
                                            <h4 className="text-[10px] font-black text-zinc-400">Estado del envío</h4>
                                            <div className="relative pl-6 space-y-6">
                                                {/* Vertical line */}
                                                <div className="absolute left-2.5 top-2.5 bottom-2.5 w-0.5 bg-zinc-100" />
                                                
                                                {/* Step 1: Aprobado */}
                                                <div className="relative flex gap-3">
                                                    <div className="absolute -left-[20px] size-4 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center shadow-sm" />
                                                    <div>
                                                        <span className="block text-xs font-bold text-zinc-800">Pedido aprobado</span>
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
                                                        }`}>Salida de tienda</span>
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
                                                        }`}>En camino</span>
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
                                                        <span>Cancelar pedido</span>
                                                    )}
                                                </Button>
                                            </div>
                                        )}

                                        {/* How to finish: points down to the PIN button in the bar */}
                                        <div className="flex flex-col items-center pt-4 pb-2 select-none">
                                            <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 flex items-start gap-3">
                                                <div className="size-9 shrink-0 rounded-xl bg-amber-400 text-white grid place-items-center">
                                                    <IconLock size={18} />
                                                </div>
                                                <p className="text-[13px] leading-snug text-zinc-700">
                                                    <span className="font-semibold text-zinc-900">Pide el PIN de 6 dígitos al repartidor</span> y tócalo en el botón <span className="font-semibold text-amber-700">PIN</span> de abajo para completar tu compra.
                                                </p>
                                            </div>
                                            <svg viewBox="0 0 24 24" className="mt-3 size-6 text-amber-400 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                                <path d="M12 5v14M5 12l7 7 7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </div>
            )}
{isOrdersListOpen && (
                            <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-background z-40 overflow-y-auto px-6 pt-8 pb-28 flex flex-col space-y-5 animate-in slide-in-from-right duration-300">
                                <div className="shrink-0">
                                    <PortalTitle>Tus pedidos</PortalTitle>
                                </div>

                                {/* Header */}
                                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100/40 shrink-0">
                                    <button
                                        onClick={() => setIsOrdersListOpen(false)}
                                        className="text-xs text-amber-800 hover:text-amber-800 font-extrabold h-8 px-3 rounded-full bg-amber-50 hover:bg-amber-100/60 border border-amber-200/50 flex items-center gap-1 transition-all duration-300 cursor-pointer animate-in fade-in"
                                    >
                                        <IconChevronLeft size={14} />
                                        <span>Volver</span>
                                    </button>
                                    <span className="text-[10px] bg-amber-50 border border-amber-100 text-amber-900 px-3 py-1 rounded-full font-black">
                                        Mis pedidos
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
                                                    <div className="h-5 w-24 bg-zinc-100/70 rounded-full" />
                                                </div>
                                                <div className="h-3.5 w-32 bg-zinc-100/70 rounded" />
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
                                            <p className="text-xs text-zinc-500 font-semibold max-w-[200px] mx-auto leading-relaxed">Aquí podrás ver el estado de tus envíos cuando realices una compra.</p>
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
                                                            <span className="text-[9px] text-zinc-400 font-extrabold font-mono">
                                                                Pedido #{order.id.slice(0, 8)}
                                                            </span>
                                                            <h4 className="text-xs font-black text-zinc-800 group-hover:text-amber-500 transition-colors">
                                                                {order.address || "Dirección de entrega"}
                                                            </h4>
                                                        </div>
                                                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black   ${statusColor}`}>
                                                            {statusLabel}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between items-center text-[10px] text-zinc-500 font-semibold border-t border-zinc-50 pt-2.5">
                                                        <span className="font-mono">
                                                            Total: <strong className="text-emerald-600 font-extrabold">${order.total.toFixed(2)}</strong>
                                                        </span>
                                                        <span className="text-[9px] text-zinc-500">
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
