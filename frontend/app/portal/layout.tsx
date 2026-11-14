import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Syncro Credit",
  description: "Accede a tus créditos y realiza pagos en línea.",
  manifest: "/manifest-portal.json",
  icons: {
    icon: "/syncro.png",
    apple: "/syncrocredit.png",
  },
  appleWebApp: {
    capable: true,
    title: "Syncro Credit",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#F26B3A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// Syncro's palette for the whole PWA (globals.css → html.syncro-credit), set before the first
// paint so the splash and the page never flash the old colours. Dialogs live in <body>, so it
// goes on <html>.
const PALETTE_SCRIPT = `document.documentElement.classList.add('syncro-credit');`;

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PALETTE_SCRIPT }} />
      {children}
    </>
  );
}
