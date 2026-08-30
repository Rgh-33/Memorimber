import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { Providers } from "./providers";
import "./globals.css";

const themeBootstrapScript = `try{const theme=localStorage.getItem("memorimber-theme");if(["light-blue","orange","blue","black"].includes(theme)){document.documentElement.dataset.theme=theme}}catch{}`;

export const metadata: Metadata = {
  title: "メモリンバー | 何もなかった、なんてことはない。",
  description: "写真1枚と一言で、日常の思い出を残すWebアプリのUIプロトタイプ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
