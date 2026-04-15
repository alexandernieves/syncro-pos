import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Punto de Venta | Syncro",
  description: "Terminal de venta de alta disponibilidad",
};

export default function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <main className="h-screen w-full flex flex-col">
        {children}
      </main>
    </div>
  );
}
