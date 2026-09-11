import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { PwaRegistration } from "@/components/pwa-registration";
import { Providers } from "./providers";
import "./globals.css";
import "./konoha.css";
import "./harvest.css";
import "./quiz.css";

const themeBootstrapScript = `try{const accent=localStorage.getItem("memorimber-theme");const mode=localStorage.getItem("memorimber-color-mode");if(["light-blue","orange","blue","black","green","purple"].includes(accent)){document.documentElement.dataset.accent=accent}if(["light","dark"].includes(mode)){document.documentElement.dataset.mode=mode}}catch{}`;

export const metadata: Metadata = {
  appleWebApp: { capable: true, title: "Memorimber", statusBarStyle: "default" },
  icons: { apple: "/pwa/icon-192.png" },
  title: "メモリンバー | 何もなかった、なんてことはない。",
  description: "写真1枚と一言で、日常の思い出を残すWebアプリのUIプロトタイプ",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4a90e2" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <PwaRegistration />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
