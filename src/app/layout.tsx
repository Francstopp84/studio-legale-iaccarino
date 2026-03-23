import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import FunnelNav from "@/components/FunnelNav";
import ClientProviders from "@/components/ClientProviders";

export const metadata: Metadata = {
  title: "Avv. Iaccarino — Studio Legale",
  description: "Dall'acquisizione alla padronanza. Il tuo percorso di studio guidato dall'AI.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#d4a853" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ais-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}})()`
              + `;if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}`,
          }}
        />
      </head>
      <body className="font-body flex h-screen overflow-hidden">
        <FunnelNav />
        <main className="flex-1 overflow-y-auto main-content">
          <ClientProviders>{children}</ClientProviders>
        </main>
        <Script src="https://www.googletagmanager.com/gtag/js?id=GTM-N5PKHC93" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'GTM-N5PKHC93');
          `}
        </Script>
      </body>
    </html>
  );
}
