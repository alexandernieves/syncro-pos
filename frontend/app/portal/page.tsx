"use client";

import React, { useState } from "react";
import { API_URL } from "@/lib/constants"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
    IconCreditCard, IconHistory, IconSearch, IconUser, IconCash, IconAlertCircle, IconArrowLeft, IconFingerprint, IconLayoutGrid, IconPackage, IconFilter, IconShoppingCart, IconPlus, IconX, IconScan, IconSmartHome, IconDeviceMobile, IconBallFootball, IconTools, IconHanger, IconClock
} from "@tabler/icons-react";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ModeSwitcher } from "@/components/mode-switcher";
import { ThemeSelector } from "@/components/theme-selector";
import { Label } from "@/components/ui/label";

const API = process.env.NEXT_PUBLIC_API_URL || "${process.env.NEXT_PUBLIC_API_URL || ``${API_URL}`}";

const CATEGORIES = [
    { name: "Tecnología", icon: <IconDeviceMobile size={18} /> },
    { name: "Deporte", icon: <IconBallFootball size={18} /> },
    { name: "Hogar", icon: <IconSmartHome size={18} /> },
    { name: "Herramientas", icon: <IconTools size={18} /> },
    { name: "Moda", icon: <IconHanger size={18} /> },
];

export default function ClientPortal() {
    const [idSearch, setIdSearch] = useState("");
    const [client, setClient] = useState<any>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<"login" | "dashboard">("login");
    const [activeTab, setActiveTab] = useState<"home" | "catalog" | "payments" | "profile">("home");
    const [settings, setSettings] = useState<any>(null);

    const fetchProducts = async () => {
        try {
            const res = await fetch(`${API}/products`);
            if (res.ok) setProducts(await res.json());
        } catch (e) {
            console.error("Error fetching products", e);
        }
    };

    const handleLogin = async () => {
        if (!idSearch) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/clients/search?q=${idSearch}`);
            const data = await res.json();
            const found = data.find((c: any) => c.documentId?.toLowerCase() === idSearch.toLowerCase());
            
            if (found) {
                const fullRes = await fetch(`${API}/clients/${found.id}`);
                setClient(await fullRes.json());
                await fetchProducts();
                
                try {
                    const setRes = await fetch(`${API}/settings`);
                    if (setRes.ok) setSettings(await setRes.json());
                } catch (e) {
                    console.error("Error fetching settings", e);
                }

                setView("dashboard");
            } else {
                toast.error("Cliente no encontrado.");
            }
        } catch (error) {
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    if (view === "login") {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 font-sans">
                <div className="fixed top-6 right-6 flex items-center gap-2">
                    <ModeSwitcher />
                </div>

                <div className="w-full max-w-sm space-y-12">
                    <div className="text-center space-y-4">
                        <div className="size-20 mx-auto flex items-center justify-center">
                            <IconFingerprint size={64} className="text-foreground" stroke={1.5} />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-3xl font-bold tracking-tighter">Syncro Credit</h1>
                            <p className="text-muted-foreground text-sm font-medium">Compra hoy, paga después.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground ml-1">IDENTIFICACIÓN</Label>
                            <div className="relative">
                                <IconUser className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                                <Input 
                                    placeholder="V-12345678" 
                                    className="h-14 pl-12 rounded-2xl bg-muted/50 border-none text-lg font-medium focus-visible:ring-[#fef01e]"
                                    value={idSearch}
                                    onChange={(e) => setIdSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                                />
                            </div>
                        </div>
                        <Button 
                            onClick={handleLogin}
                            disabled={loading}
                            className="w-full h-14 rounded-2xl bg-[#fef01e] hover:bg-[#fef01e]/90 text-black font-bold text-base shadow-lg shadow-[#fef01e]/10 transition-all active:scale-95"
                        >
                            {loading ? "Verificando..." : "Entrar"}
                        </Button>
                    </div>
                    
                    <p className="text-center text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                        Seguridad Syncro & Encriptación 256-bit
                    </p>
                </div>
            </div>
        );
    }

    const availableCredit = (client?.creditLimit || 0) - (client?.currentDebt || 0);
    const usedPercentage = client?.creditLimit > 0 ? (client.currentDebt / client.creditLimit) * 100 : 0;
    
    const getNextPaymentDetails = () => {
        if (!client?.nextPaymentDate) return null;
        const date = new Date(client.nextPaymentDate);
        const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
        return {
            day: date.getDate(),
            month: date.getMonth() + 1,
            dayName: days[date.getDay()]
        };
    };
    const payment = getNextPaymentDetails();
    const cuotasPendientes = client?.currentDebt > 0 ? 1 : 0; // Simplified for now


    return (
        <div className="min-h-screen bg-background text-foreground font-sans pb-24 flex flex-col items-center justify-center p-6">
            <div className="fixed top-6 right-6 flex items-center gap-2">
                <ModeSwitcher />
            </div>

            <div className="w-full max-w-md text-center space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="relative mx-auto size-32 bg-[#fef01e] rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-[#fef01e]/20 rotate-3">
                    <IconTools size={64} className="text-black" stroke={1.5} />
                    <div className="absolute -top-2 -right-2 size-8 bg-black rounded-full flex items-center justify-center border-2 border-white">
                        <IconClock size={16} className="text-white animate-pulse" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="text-4xl font-black tracking-tighter uppercase italic">En Construcción</h1>
                    <div className="h-1.5 w-24 bg-[#fef01e] mx-auto rounded-full" />
                    <p className="text-muted-foreground text-sm font-medium leading-relaxed px-8">
                        Estamos renovando tu experiencia Syncro. El portal de clientes estará disponible muy pronto con nuevas funciones.
                    </p>
                </div>

                <Card className="border-none bg-muted/30 rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-4 text-left">
                        <div className="size-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                            <IconAlertCircle size={24} className="text-black" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nota Importante</p>
                            <p className="text-sm font-semibold">Tus créditos y pagos siguen vigentes en el sistema del cajero.</p>
                        </div>
                    </div>
                </Card>

                <Button 
                    variant="ghost" 
                    className="gap-2 text-muted-foreground hover:text-black font-bold uppercase tracking-widest text-[10px]"
                    onClick={() => setView("login")}
                >
                    <IconArrowLeft size={14} /> Regresar
                </Button>
            </div>

            <div className="fixed bottom-8 text-center w-full">
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-30">Syncro Technologies • 2026</p>
            </div>
        </div>
    );
}
