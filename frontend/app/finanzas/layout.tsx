import type { Metadata, Viewport } from "next";
import FinanceTheme from "./finance-theme";

export const metadata: Metadata = {
  title: "Syncro Finanzas",
  description: "Registra gastos, ingresos, saldos y transferencias desde tu teléfono.",
  manifest: null,
  icons: { icon: "/sc-icon-192.png", apple: "/sc-apple-touch.png" },
  appleWebApp: { capable: true, title: "Syncro Finanzas", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#F26B3A", viewportFit: "cover" };

export default function FinanceAppLayout({ children }: { children: React.ReactNode }) {
  return <FinanceTheme>{children}</FinanceTheme>;
}
