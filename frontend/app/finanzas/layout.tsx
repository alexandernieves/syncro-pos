import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Syncro Finanzas",
  description: "Registra gastos, ingresos, saldos y transferencias desde tu teléfono.",
  manifest: null,
  icons: { icon: "/finance-icon-192.png", apple: "/finance-icon-192.png" },
  appleWebApp: { capable: true, title: "Syncro Finanzas", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#F26B3A", viewportFit: "cover" };

export default function FinanceAppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
