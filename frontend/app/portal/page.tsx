"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
    IconCreditCard, IconHistory, IconUser, IconCash, IconAlertCircle, 
    IconCopy, IconCoins, IconCheck, IconDeviceMobile, IconLock, 
    IconCalendar, IconChevronRight, IconGift
} from "@tabler/icons-react";
import { toast } from "sonner";

const API = API_URL;

export default function ClientPortal() {
    const [idSearch, setIdSearch] = useState("");
    const [client, setClient] = useState<any>(null);
    const [loans, setLoans] = useState<any[]>([]);
    const [rewards, setRewards] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<"login" | "dashboard">("login");
    const [activeTab, setActiveTab] = useState<"home" | "payments" | "rewards" | "profile">("home");
    
    // Currency converter state
    const [usdAmount, setUsdAmount] = useState<string>("10");

    const loadPortalData = useCallback(async (token: string) => {
        try {
            const profileRes = await fetch(`${API}/clients/portal/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (profileRes.ok) {
                setClient(await profileRes.json());
            } else if (profileRes.status === 401) {
                handleLogout();
                return;
            }

            const settingsRes = await fetch(`${API}/clients/portal/settings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (settingsRes.ok) {
                setSettings(await settingsRes.json());
            }

            const loansRes = await fetch(`${API}/clients/portal/loans`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (loansRes.ok) {
                setLoans(await loansRes.json());
            }

            const rewardsRes = await fetch(`${API}/clients/portal/rewards`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (rewardsRes.ok) {
                setRewards(await rewardsRes.json());
            }
        } catch (error) {
            console.error("Error loading portal data", error);
            toast.error("Error al sincronizar datos");
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("client_token");
        if (token) {
            loadPortalData(token);
            setView("dashboard");
        }
    }, [loadPortalData]);

    const handleLogin = async () => {
        if (!idSearch.trim()) {
            toast.error("Por favor ingresa tu número de identificación.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API}/auth/client-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentId: idSearch })
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem("client_token", data.access_token);
                await loadPortalData(data.access_token);
                setView("dashboard");
                toast.success("Sesión iniciada");
            } else {
                const err = await res.json();
                toast.error(err.message || "Identificación no encontrada.");
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

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copiado`);
    };

    const availableCredit = Math.max(0, (client?.creditLimit || 0) - (client?.currentDebt || 0));
    const usedPercentage = client?.creditLimit > 0 ? (client.currentDebt / client.creditLimit) * 100 : 0;
    const rateUsdToVes = settings?.exchangeRate || 40.0;
    const rateUsdToCop = 4000;

    // Custom floating keyframes for slow, smooth, elegant float
    const animationStyle = (
        <style>{`
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
        `}</style>
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#fffdf0] via-white to-[#fffdf0] flex flex-col items-center justify-center p-6 font-sans text-zinc-800 animate-in fade-in duration-300 relative overflow-hidden">
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

    if (view === "login") {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#fffdf0] via-white to-[#fffdf0] flex flex-col justify-between p-6 font-sans text-zinc-800 animate-in fade-in duration-700 relative overflow-hidden">
                {animationStyle}
                
                {/* Background Curves & Waves in Pastel Colors */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
                    <div className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full bg-[#fef3c7]/30 blur-2xl" />
                    <div className="absolute top-[35%] -left-20 w-[260px] h-[260px] rounded-full bg-amber-50/20 blur-3xl" />
                    
                    <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                        <path d="M 0,220 C 120,260 240,180 380,230 L 380,0 L 0,0 Z" fill="url(#pastelYellowGrad)" opacity="0.05" />
                        <path d="M 0,650 C 140,610 240,710 400,660 L 400,900 L 0,900 Z" fill="#fffbeb" opacity="0.6" />
                        <path d="M 0,690 C 110,650 280,750 400,700 L 400,900 L 0,900 Z" fill="#fef3c7" opacity="0.25" />
                        <path d="M 0,730 C 160,700 230,790 400,750 L 400,900 L 0,900 Z" fill="#fde68a" opacity="0.12" />
                        
                        <defs>
                            <linearGradient id="pastelYellowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#fef3c7" />
                                <stop offset="100%" stopColor="#fffbeb" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>

                {/* Brand Mascot: placed directly in the root context to prevent Safari z-index backdrop-filter isolation bugs */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[90vw] max-w-[340px] aspect-square z-0 pointer-events-none select-none">
                    <img 
                        src="/mascot.png" 
                        alt="Mascota Arepa" 
                        className="w-full h-full object-contain mix-blend-multiply" 
                    />
                </div>

                <div /> {/* Top spacer */}

                <div className="w-full max-w-sm mx-auto my-auto text-center flex flex-col items-center relative z-10">
                    {/* Text & Form Content: pushed down to start below the mascot but allows overlap on top of mascot z-index */}
                    <div className="w-full pt-[60px] space-y-6 z-10 relative">
                        <div className="space-y-3 w-full text-shadow-contrast">
                            <h1 className="text-5xl font-black tracking-tight text-zinc-950 leading-none">
                                Compra hoy,<br />
                                <span className="text-amber-800">paga después.</span>
                            </h1>
                            <p className="text-zinc-600 text-sm font-bold max-w-xs mx-auto leading-tight">
                                Tu línea de crédito digital, sin complicaciones.
                            </p>
                        </div>

                        <div className="space-y-3.5 w-full px-2">
                            <Input 
                                placeholder="Cédula de Identidad (ej. V12345678)" 
                                className="h-13 px-5 rounded-[1.25rem] bg-white border-zinc-200 text-sm font-semibold focus-visible:ring-amber-300 text-zinc-850 placeholder:text-zinc-450 transition-all duration-300 shadow-inner"
                                value={idSearch}
                                onChange={(e) => setIdSearch(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                            />
                            <Button 
                                onClick={handleLogin}
                                disabled={loading}
                                className="w-full h-13 rounded-full bg-[#fef3c7] hover:bg-[#fde68a] text-[#854d0e] font-black text-sm shadow-sm transition-all duration-350 active:scale-95 border-none"
                            >
                                Ingresar
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="w-full text-center z-10">
                    <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5">
                        <IconLock size={11} /> Conexión encriptada
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#fffdf0] via-[#faf9f5] to-[#fffdf0] text-zinc-800 font-sans pb-28 animate-in fade-in duration-500 relative overflow-hidden">
            {animationStyle}
            
            {/* Background Curves & Waves in Pastel Colors */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
                <div className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full bg-[#fef3c7]/25 blur-3xl" />
                <div className="absolute top-[40%] -left-20 w-[260px] h-[260px] rounded-full bg-amber-50/20 blur-3xl" />
                <div className="absolute bottom-[15%] -right-20 w-[280px] h-[280px] rounded-full bg-[#fcd34d]/5 blur-3xl" />
            </div>

            {/* Header */}
            <div className="px-6 py-5 flex items-center justify-between sticky top-0 bg-white/60 backdrop-blur-xl z-50 border-b border-amber-100/40 shadow-sm shadow-amber-900/5 relative">
                <div className="flex items-center gap-2">
                    <div className="size-8 rounded-full bg-[#fef3c7] flex items-center justify-center text-[#854d0e] font-black text-sm shadow-sm">S</div>
                    <div>
                        <p className="text-[9px] uppercase font-black tracking-widest text-zinc-400">Mi Cuenta</p>
                        <p className="text-xs font-bold text-zinc-700">{client?.name}</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-zinc-400 hover:text-zinc-650 h-8 px-2 rounded-full">Salir</Button>
            </div>

            <main className="max-w-md mx-auto px-6 space-y-5 pt-4">
                
                {/* BANNER MORA */}
                {client?.isSuspended && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-[1.5rem] flex items-start gap-3 shadow-sm">
                        <IconAlertCircle size={20} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-sm">Pago pendiente</p>
                            <p className="text-xs text-rose-500/80">Tu cuenta está suspendida temporalmente por mora.</p>
                        </div>
                    </div>
                )}

                {/* TAB 1: HOME */}
                {activeTab === "home" && (
                    <div className="space-y-5 animate-in slide-in-from-bottom duration-500">
                        
                        {/* Mascot Welcome Talk Bubble */}
                        <div className="bg-gradient-to-r from-amber-50/40 to-amber-50/80 border border-amber-100/40 p-4 rounded-[2rem] flex items-center gap-4 shadow-sm backdrop-blur-md">
                            <img 
                                src="/mascot.png" 
                                alt="Mascota Syncro" 
                                className="size-16 object-contain shrink-0 animate-soft-float mix-blend-multiply" 
                            />
                            <div className="space-y-0.5">
                                <p className="text-xs font-black text-zinc-850">¡Hola, {client?.name.split(' ')[0]}!</p>
                                <p className="text-[10px] text-zinc-500 font-semibold leading-tight">
                                    {client?.isSuspended 
                                        ? "Tienes cuotas vencidas. ¡Ponte al día en caja para reactivar tu cuenta y seguir comprando!"
                                        : "Recuerda pagar a tiempo para aumentar tu score y ganar más puntos."}
                                </p>
                            </div>
                        </div>

                        {/* PREMIUM CREDITO CARD */}
                        <div className="rounded-[2.25rem] bg-gradient-to-br from-[#fffdf4] via-[#fffbeb] to-amber-50/45 border border-amber-200/50 p-6 space-y-6 shadow-md shadow-amber-100/20 relative overflow-hidden">
                            <div className="absolute right-0 top-0 size-48 bg-[#fde68a]/35 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute -left-10 -bottom-10 size-32 bg-[#fef3c7]/25 rounded-full blur-2xl pointer-events-none" />
                            
                            <div className="flex justify-between items-center z-10 relative">
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Mi Crédito Disponible</p>
                                    <h2 className="text-4xl font-black text-zinc-800 mt-1 tracking-tight">${availableCredit.toFixed(2)}</h2>
                                </div>
                                <div className="text-right">
                                    <Badge className={`rounded-full border-none text-[10px] font-bold px-3 py-1 bg-[#fffbeb] text-amber-700`}>
                                        Score: {client?.creditScore || 50}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-2 z-10 relative">
                                <div className="flex justify-between text-xs text-zinc-500 font-semibold">
                                    <span>Deuda: ${client?.currentDebt.toFixed(2)}</span>
                                    <span>Límite: ${client?.creditLimit.toFixed(2)} USD</span>
                                </div>
                                <div className="w-full bg-amber-100/25 h-2.5 rounded-full overflow-hidden border border-amber-200/10">
                                    <div className="bg-gradient-to-r from-amber-300 to-amber-500 h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, usedPercentage)}%` }} />
                                </div>
                            </div>
                        </div>

                        {/* COINS LOYALTY CARD */}
                        <div 
                            onClick={() => setActiveTab("rewards")}
                            className="rounded-[1.75rem] bg-gradient-to-r from-amber-50/20 to-amber-50/50 border border-amber-100/40 p-4 flex justify-between items-center cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 group hover:border-amber-250/50"
                        >
                            <div className="flex items-center gap-3">
                                <div className="size-11 rounded-2xl bg-amber-100/40 flex items-center justify-center text-amber-600">
                                    <IconCoins size={22} />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Puntos Acumulados</p>
                                    <p className="text-base font-extrabold text-zinc-700">{client?.accumulatedPoints || 0} pts</p>
                                </div>
                            </div>
                            <div className="size-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-450 group-hover:text-amber-700 transition-colors duration-300">
                                <IconChevronRight size={18} />
                            </div>
                        </div>

                        {/* NEXT PAYMENT DATE */}
                        {client?.currentDebt > 0 && (
                            <div className="rounded-[1.75rem] bg-gradient-to-r from-[#fffdf4] to-amber-50/30 border border-amber-100/40 p-4 flex items-center gap-4 shadow-sm">
                                <div className="size-11 rounded-2xl bg-amber-100/40 flex items-center justify-center text-amber-700">
                                    <IconCalendar size={22} />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Próximo Vencimiento</p>
                                    <p className="text-sm font-extrabold text-zinc-700">
                                        {client.nextPaymentDate 
                                            ? new Date(client.nextPaymentDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                                            : "Sin deuda"}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ACTIVE LOANS */}
                        {loans.filter(l => l.status === 'PENDING').length > 0 && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Cuotas de Préstamos</h3>
                                    <span className="text-[10px] text-zinc-400 font-bold">{loans.filter(l => l.status === 'PENDING').length} activos</span>
                                </div>
                                <div className="space-y-3">
                                    {loans.filter(l => l.status === 'PENDING').map((loan) => (
                                        <div key={loan.id} className="rounded-[2rem] bg-gradient-to-b from-white to-amber-50/15 border border-amber-150/30 p-5 space-y-4 shadow-sm shadow-amber-900/5">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="text-xs font-black text-zinc-700">Préstamo de Efectivo</p>
                                                    <p className="text-[10px] text-zinc-400 mt-0.5">Total a pagar: ${loan.totalToPay.toFixed(2)} USD</p>
                                                </div>
                                                <Badge className="rounded-full bg-[#fffbeb] text-amber-700 border-none font-bold text-[10px] px-2.5 py-0.5">
                                                    Pte: ${loan.remainingBalance.toFixed(2)}
                                                </Badge>
                                            </div>

                                            {/* Installment progress list */}
                                            <div className="grid grid-cols-4 gap-2">
                                                {loan.installments.map((inst: any) => {
                                                    const isPaid = inst.status === 'PAID';
                                                    const isOverdue = inst.status === 'OVERDUE';
                                                    return (
                                                        <div key={inst.id} className={`p-2.5 rounded-2xl text-center border transition-all duration-300 ${
                                                            isPaid 
                                                                ? 'bg-[#fffbeb] border-amber-100/40 text-amber-700' 
                                                                : isOverdue 
                                                                ? 'bg-[#fdf2f2] border-rose-100/40 text-rose-600/80 animate-pulse'
                                                                : 'bg-white/60 border-zinc-100/80 text-zinc-400'
                                                        }`}>
                                                            <p className="text-[10px] font-black">Cuota {inst.installmentNumber}</p>
                                                            <p className="text-[9px] font-bold mt-0.5">${inst.amount.toFixed(0)}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* MULTI-CURRENCY CONVERTER */}
                        <div className="rounded-[2rem] bg-gradient-to-b from-white to-[#fffdf6] border border-amber-150/30 p-5 space-y-4 shadow-sm shadow-amber-900/5">
                            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Tasas de Conversión</h3>
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Monto en Dólares ($ USD)</Label>
                                    <Input 
                                        type="number" 
                                        value={usdAmount} 
                                        onChange={(e) => setUsdAmount(e.target.value)} 
                                        className="h-12 px-4 rounded-2xl bg-white border-zinc-200 text-zinc-800 text-sm mt-1 focus-visible:ring-amber-300 font-bold"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-100/45 space-y-1 shadow-inner">
                                        <p className="text-zinc-450 text-[9px] font-black uppercase tracking-wider">Bolívares (VES)</p>
                                        <p className="text-base font-black text-zinc-700">
                                            Bs. {((parseFloat(usdAmount) || 0) * rateUsdToVes).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                        <p className="text-[8px] text-zinc-450 font-bold uppercase">BCV: {rateUsdToVes} Bs/$</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-100/45 space-y-1 shadow-inner">
                                        <p className="text-zinc-450 text-[9px] font-black uppercase tracking-wider">Pesos (COP)</p>
                                        <p className="text-base font-black text-zinc-700">
                                            $ {((parseFloat(usdAmount) || 0) * rateUsdToCop).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </p>
                                        <p className="text-[8px] text-zinc-450 font-bold uppercase">Frontera: {rateUsdToCop} COP/$</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: PAYMENTS */}
                {activeTab === "payments" && (
                    <div className="space-y-5 animate-in slide-in-from-bottom duration-500">
                        {/* Mascot Help Bubble */}
                        <div className="bg-gradient-to-r from-amber-50/40 to-amber-50/80 border border-amber-100/40 p-4 rounded-[2rem] flex items-center gap-4 shadow-sm backdrop-blur-md">
                            <img 
                                src="/mascot.png" 
                                alt="Mascota Syncro" 
                                className="size-16 object-contain shrink-0 animate-soft-float mix-blend-multiply" 
                            />
                            <div className="space-y-0.5">
                                <p className="text-xs font-black text-amber-750">¿Ya pagaste?</p>
                                <p className="text-[10px] text-zinc-650 leading-tight font-medium">
                                    Por favor reporta tu capture de Pago Móvil al cajero del negocio para que apruebe tu saldo al instante.
                                </p>
                            </div>
                        </div>

                        {/* METODO PAGO MOVIL CARD */}
                        {settings?.pagoMovilEnabled && (
                            <div className="rounded-[2.25rem] bg-gradient-to-br from-[#fffdf4] via-[#fffbeb] to-amber-50/30 border border-amber-200/50 p-6 space-y-4 shadow-md shadow-amber-900/5">
                                <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                                    <IconDeviceMobile size={18} className="text-amber-700" />
                                    <h3 className="text-xs font-black uppercase text-zinc-700 tracking-wider">Pago Móvil del Comercio</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">Banco</p>
                                        <p className="font-extrabold text-zinc-700 mt-0.5">{settings.pagoMovilBank}</p>
                                    </div>
                                    <div>
                                        <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">Cédula / RIF</p>
                                        <div className="flex items-center gap-1 cursor-pointer mt-0.5" onClick={() => copyToClipboard(settings.pagoMovilId, "Cédula")}>
                                            <p className="font-extrabold text-amber-700">{settings.pagoMovilId}</p>
                                            <IconCopy size={12} className="text-zinc-400" />
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">Teléfono de Pago</p>
                                        <div className="flex items-center gap-1 cursor-pointer mt-0.5" onClick={() => copyToClipboard(settings.pagoMovilPhone, "Teléfono")}>
                                            <p className="font-black text-amber-700 text-base">{settings.pagoMovilPhone}</p>
                                            <IconCopy size={12} className="text-zinc-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* HISTORIAL TRANSACCIONES */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Historial de Transacciones</h3>
                            {client?.creditTransactions.length === 0 ? (
                                <div className="rounded-[2rem] bg-white/60 backdrop-blur-md border border-zinc-150/80 p-8 text-center text-zinc-455 font-bold shadow-inner">
                                    Aún no tienes movimientos registrados.
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {client?.creditTransactions.map((tx: any) => {
                                        const isDebt = tx.type === 'DEBT';
                                        return (
                                            <div key={tx.id} className="rounded-[1.5rem] bg-gradient-to-r from-white to-amber-50/10 border border-zinc-100/80 p-4 flex justify-between items-center text-xs shadow-sm hover:shadow-md transition-all duration-300">
                                                <div className="space-y-0.5">
                                                    <p className="font-bold text-zinc-700">{tx.notes || (isDebt ? "Compra a crédito" : "Abono realizado")}</p>
                                                    <p className="text-[10px] text-zinc-400 font-medium">
                                                        {new Date(tx.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <span className={`font-black text-sm px-3 py-1 rounded-full ${
                                                    isDebt 
                                                        ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                                                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                                                }`}>
                                                    {isDebt ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 3: REWARDS */}
                {activeTab === "rewards" && (
                    <div className="space-y-5 animate-in slide-in-from-bottom duration-500">
                        
                        {/* Mascot Points Bubble */}
                        <div className="bg-gradient-to-r from-amber-50/40 to-amber-50/80 border border-amber-100/40 p-4 rounded-[2rem] flex items-center gap-4 shadow-sm backdrop-blur-md">
                            <img 
                                src="/mascot.png" 
                                alt="Mascota Syncro" 
                                className="size-16 object-contain shrink-0 animate-soft-float mix-blend-multiply" 
                            />
                            <div className="space-y-0.5">
                                <p className="text-xs font-black text-[#854d0e]">¡Tu fidelidad premia!</p>
                                <p className="text-[10px] text-zinc-650 leading-tight font-medium">
                                    Canjea tus puntos acumulados por fabulosos regalos disponibles en la tienda.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Premios Disponibles</h3>
                            <div className="flex items-center gap-1 bg-[#fffbeb] border border-amber-200 px-3 py-1 rounded-full text-[#854d0e] font-extrabold text-xs">
                                <IconCoins size={14} />
                                <span>{client?.accumulatedPoints || 0} pts</span>
                            </div>
                        </div>

                        {rewards.length === 0 ? (
                            <div className="rounded-[2rem] bg-white/60 backdrop-blur-md border border-zinc-150/80 p-8 text-center text-zinc-455 font-bold shadow-inner">
                                No hay premios en catálogo en este momento.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {rewards.map((reward) => {
                                    const canRedeem = (client?.accumulatedPoints || 0) >= reward.pointsCost;
                                    return (
                                        <div key={reward.id} className="rounded-[2rem] bg-gradient-to-b from-white to-amber-50/10 border border-amber-100/50 overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md hover:border-amber-250/50 transition-all duration-300">
                                            {reward.image ? (
                                                <img src={reward.image} alt={reward.name} className="h-28 w-full object-cover border-b border-zinc-100" />
                                            ) : (
                                                <div className="h-24 bg-amber-50/20 flex items-center justify-center border-b border-zinc-100 shrink-0">
                                                    <IconGift size={32} className="text-amber-500/45" />
                                                </div>
                                            )}
                                            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                                <div>
                                                    <h4 className="text-xs font-bold text-zinc-700 line-clamp-1">{reward.name}</h4>
                                                    <p className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5">{reward.description || "Canjea este premio"}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center text-[10px]">
                                                        <span className="text-[#854d0e] font-extrabold">{reward.pointsCost} pts</span>
                                                        <span className="text-zinc-450 font-bold">Stock: {reward.stock}</span>
                                                    </div>
                                                    <Button 
                                                        disabled={!canRedeem || reward.stock <= 0}
                                                        onClick={() => handleRedeem(reward.id)}
                                                        className={`w-full h-9 rounded-xl text-[10px] font-black border-none transition-all active:scale-95 ${
                                                            canRedeem && reward.stock > 0
                                                                ? 'bg-[#fef3c7] hover:bg-[#fde68a] text-[#854d0e] shadow-md shadow-[#fef3c7]/20'
                                                                : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        {reward.stock <= 0 ? "Agotado" : "Canjear"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 4: PROFILE */}
                {activeTab === "profile" && (
                    <div className="space-y-5 animate-in slide-in-from-bottom duration-500">
                        {/* Mascot Profile Tip */}
                        <div className="bg-gradient-to-r from-amber-50/40 to-amber-50/80 border border-amber-100/40 p-4 rounded-[2rem] flex items-center gap-4 shadow-sm backdrop-blur-md">
                            <img 
                                src="/mascot.png" 
                                alt="Mascota Syncro" 
                                className="size-16 object-contain shrink-0 animate-soft-float mix-blend-multiply" 
                            />
                            <div className="space-y-0.5">
                                <p className="text-xs font-black text-amber-750">¡Protege tu línea!</p>
                                <p className="text-[10px] text-zinc-650 leading-tight font-medium">
                                    Tu score crediticio sube con cada pago de cuota puntual. ¡Un score alto te da mayor cupo de crédito!
                                </p>
                            </div>
                        </div>

                        <div className="rounded-[2.25rem] bg-gradient-to-br from-[#fffdf4] via-[#fffbeb] to-amber-50/30 border border-amber-200/50 p-6 space-y-5 shadow-sm shadow-amber-900/5">
                            <div className="flex items-center gap-3.5">
                                <div className="size-12 rounded-full bg-[#fffbeb] text-amber-700 flex items-center justify-center font-black">
                                    {client?.name.charAt(0).toUpperCase()}
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

                        {/* BENEFIT RULES */}
                        <div className="rounded-[2rem] bg-gradient-to-b from-white to-[#fffdf6] border border-amber-150/30 p-6 space-y-4 shadow-sm shadow-amber-900/5">
                            <h4 className="text-xs font-black uppercase text-amber-755 tracking-wider flex items-center gap-2">
                                <IconCheck size={18} /> Beneficios por Score de Crédito
                            </h4>
                            <p className="text-[10px] text-zinc-400 leading-relaxed font-bold">
                                Tu comportamiento de pago determina las condiciones de tus fiados:
                            </p>
                            <div className="space-y-2 text-[10px]">
                                <div className="flex justify-between items-center p-3 rounded-2xl bg-amber-50/50 border border-amber-100/40 shadow-inner">
                                    <span className="font-bold text-zinc-750">Score ≥ 95 (Súper VIP)</span>
                                    <span className="font-black text-amber-600">20% Inicial / +10% Cupo</span>
                                </div>
                                <div className="flex justify-between items-center p-3 rounded-2xl bg-amber-50/50 border border-amber-100/40 shadow-inner">
                                    <span className="font-bold text-zinc-750">Score ≥ 85 (VIP)</span>
                                    <span className="font-black text-amber-700">30% Inicial / +5% Cupo</span>
                                </div>
                                <div className="flex justify-between items-center p-3 rounded-2xl bg-amber-50/50 border border-amber-100/40 shadow-inner">
                                    <span className="font-bold text-zinc-750">Score ≥ 70</span>
                                    <span className="font-black text-zinc-500">40% Inicial</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* CAPSULE BOTTOM NAV */}
            <div className="fixed bottom-6 left-6 right-6 h-16 rounded-full border border-amber-150/50 bg-white/80 backdrop-blur-xl flex justify-around items-center px-4 z-50 max-w-sm mx-auto shadow-lg shadow-amber-950/8">
                <button 
                    onClick={() => setActiveTab("home")} 
                    className={`flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors duration-300 ${activeTab === "home" ? "text-amber-600" : "text-zinc-400"}`}
                >
                    <IconCreditCard size={18} />
                    <span>Inicio</span>
                </button>
                <button 
                    onClick={() => setActiveTab("payments")} 
                    className={`flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors duration-300 ${activeTab === "payments" ? "text-amber-600" : "text-zinc-400"}`}
                >
                    <IconHistory size={18} />
                    <span>Pagos</span>
                </button>
                <button 
                    onClick={() => setActiveTab("rewards")} 
                    className={`flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors duration-300 ${activeTab === "rewards" ? "text-amber-600" : "text-zinc-400"}`}
                >
                    <IconGift size={18} />
                    <span>Premios</span>
                </button>
                <button 
                    onClick={() => setActiveTab("profile")} 
                    className={`flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-colors duration-300 ${activeTab === "profile" ? "text-amber-600" : "text-zinc-400"}`}
                >
                    <IconUser size={18} />
                    <span>Perfil</span>
                </button>
            </div>
        </div>
    );
}
