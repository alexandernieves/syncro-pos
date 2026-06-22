import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Syncro Credit",
  description: "Accede a tus créditos y realiza pagos en línea.",
  manifest: "/manifest-portal.json",
  icons: {
    icon: "/syncro.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf9f5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
