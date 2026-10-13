"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { API_URL } from "@/lib/constants"
import { usePathname } from "next/navigation";
import { type Currency, type Rates, branchCurrencies, formatMoney, fromUsd, ratesFrom } from "@/lib/currency";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  exchangeRate: number; // Current active rate (POS or Dashboard)
  eurExchangeRate: number; // Current active EUR rate
  posRate: number;
  dashboardRate: number;
  formatPrice: (amount: number) => string;
  isLoading: boolean;
  bcvDate: string;
  syncBcvDashboard: () => Promise<boolean>;
  refreshRates: () => Promise<void>;
  /** Currencies of the branch picked (Táchira adds COP). */
  currencies: Currency[];
  branchState: string | null;
  /** Units per dollar used for cash (POS rates and the peso rate). */
  cashRates: Rates;
  /** Pesos per dollar: the business's own rate when set, else the TRM. */
  copRate: number;
  copTrm: number;
  copManual: number | null;
  copDate: string | null;
  setCopRate: (manual: number | null) => Promise<boolean>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [currency, setCurrency] = useState<Currency>("USD");
  const [exchangeRate, setExchangeRate] = useState(40.0); 
  const [eurExchangeRate, setEurExchangeRate] = useState(42.0);
  const [posRate, setPosRate] = useState(40.0);
  const [dashboardRate, setDashboardRate] = useState(40.0);
  const [bcvDate, setBcvDate] = useState<string>("No disponible");
  const [isLoading, setIsLoading] = useState(true);
  const [branchState, setBranchState] = useState<string | null>(null);
  const [cashRates, setCashRates] = useState<Rates>({ USD: 1, VES: 40, EUR: 40 / 42, COP: 0 });
  const [copTrm, setCopTrm] = useState(0);
  const [copManual, setCopManual] = useState<number | null>(null);
  const [copDate, setCopDate] = useState<string | null>(null);
  const currencies = branchCurrencies(branchState);

  const fetchRates = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setPosRate(40.0);
        setDashboardRate(40.0);
        setExchangeRate(40.0);
        setEurExchangeRate(42.0);
        setBcvDate("No disponible");
        setIsLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/settings?t=${Date.now()}`, {
        headers: { 
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const text = await res.text();
        if (!text) {
          // Empty content fallback (e.g. for support superadmin without business context)
          setPosRate(40.0);
          setDashboardRate(40.0);
          setExchangeRate(40.0);
          setEurExchangeRate(42.0);
          setBcvDate("No disponible");
          setIsLoading(false);
          return;
        }

        const data = JSON.parse(text);
        const isPos = pathname?.includes("/pos");

        const pRate = Number(data.exchangeRate || 40);
        const dRate = Number(data.exchangeRateDashboard || pRate);
        const pEurRate = Number(data.exchangeRateEur || 42);
        const dEurRate = Number(data.exchangeRateDashboardEur || pEurRate);

        setPosRate(pRate);
        setDashboardRate(dRate);
        setCashRates(ratesFrom(data));
        setCopTrm(Number(data.exchangeRateCop) || 0);
        setCopManual(Number(data.copRateManual) > 0 ? Number(data.copRateManual) : null);
        setCopDate(data.copUpdateDate || null);

        if (isPos) {
          setExchangeRate(pRate);
          setEurExchangeRate(pEurRate);
          setBcvDate(data.bcvUpdateDate || "No disponible");
        } else {
          setExchangeRate(dRate);
          setEurExchangeRate(dEurRate);
          setBcvDate(data.bcvUpdateDateDashboard || data.bcvUpdateDate || "No disponible");
        }
      } else {
        // Clear or set fallback if response is not ok (e.g. 401)
        setPosRate(40.0);
        setDashboardRate(40.0);
        setExchangeRate(40.0);
        setEurExchangeRate(42.0);
        setBcvDate("No disponible");
      }
    } catch (e) {
      console.error("Error fetching rates", e);
    } finally {
      setIsLoading(false);
    }
  };

  // State of the branch picked, which decides whether COP is used
  const fetchBranch = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_URL}/branches`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const list = (await res.json()) as { id: string; state?: string | null; isMain?: boolean }[];
      const id = localStorage.getItem("currentBranchId");
      const b = list.find((x) => x.id === id) ?? list.find((x) => x.isMain) ?? list[0];
      setBranchState(b?.state ?? null);
    } catch {
      // Without branches the default currencies apply
    }
  };

  useEffect(() => {
    fetchRates();
    fetchBranch();
    
    const saved = localStorage.getItem("selected-currency") as Currency;
    if (saved && ["USD", "VES", "EUR", "COP"].includes(saved)) {
      setCurrency(saved);
    }
  }, [pathname]);

  useEffect(() => {
    const onBranch = () => fetchBranch();
    window.addEventListener("branchUpdated", onBranch);
    return () => window.removeEventListener("branchUpdated", onBranch);
  }, []);

  // A currency the branch doesn't use falls back to dollars
  useEffect(() => {
    if (branchState !== null && !currencies.includes(currency)) setCurrency("USD");
  }, [branchState]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCopRate = async (manual: number | null) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/settings/cop-rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ manual }),
      });
      if (res.ok) await fetchRates();
      return res.ok;
    } catch {
      return false;
    }
  };

  const syncBcvDashboard = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/settings/sync-bcv`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ target: "dashboard" })
      });
      if (res.ok) {
        await fetchRates();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    localStorage.setItem("selected-currency", currency);
  }, [currency]);

  const formatPrice = (amount: number) => {
    if (currency === "USD") {
      return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (currency === "COP") {
      return formatMoney(fromUsd(amount, "COP", { ...cashRates }), "COP");
    } else if (currency === "EUR") {
      const ves = amount * exchangeRate;
      const eur = ves / eurExchangeRate;
      return `€${eur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      const ves = amount * exchangeRate;
      return `Bs ${ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  const refreshRates = async () => {
    await fetchRates();
  };

  return (
    <CurrencyContext.Provider value={{ 
      currency, 
      setCurrency, 
      exchangeRate, 
      eurExchangeRate, 
      posRate,
      dashboardRate,
      formatPrice, 
      isLoading, 
      bcvDate,
      syncBcvDashboard,
      refreshRates,
      currencies,
      branchState,
      cashRates,
      copRate: cashRates.COP,
      copTrm,
      copManual,
      copDate,
      setCopRate,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within CurrencyProvider");
  return context;
};
