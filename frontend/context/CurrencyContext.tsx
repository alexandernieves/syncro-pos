"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

type Currency = "USD" | "VES" | "EUR";

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

  const fetchRates = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000"}/settings?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const isPos = pathname?.includes("/pos");

        const pRate = Number(data.exchangeRate || 40);
        const dRate = Number(data.exchangeRateDashboard || pRate);
        const pEurRate = Number(data.exchangeRateEur || 42);
        const dEurRate = Number(data.exchangeRateDashboardEur || pEurRate);

        setPosRate(pRate);
        setDashboardRate(dRate);

        if (isPos) {
          setExchangeRate(pRate);
          setEurExchangeRate(pEurRate);
          setBcvDate(data.bcvUpdateDate || "No disponible");
        } else {
          setExchangeRate(dRate);
          setEurExchangeRate(dEurRate);
          setBcvDate(data.bcvUpdateDateDashboard || data.bcvUpdateDate || "No disponible");
        }
      }
    } catch (e) {
      console.error("Error fetching rates", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    
    const saved = localStorage.getItem("selected-currency") as Currency;
    if (saved && ["USD", "VES", "EUR"].includes(saved)) {
      setCurrency(saved);
    }
  }, [pathname]);

  const syncBcvDashboard = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000"}/settings/sync-bcv`, {
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
      refreshRates
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
