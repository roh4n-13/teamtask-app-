import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "TeamTask — Ouroboros Art Hub",
  description:
    "Team task manager for Ouroboros Art Hub: assign tasks, submit photo proof, approve. Work smarter. Together.",
};

export const viewport: Viewport = {
  themeColor: "#1A1A1A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <StoreProvider>
          {/* Phone-width column on desktop, full width on phones. */}
          <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-paper shadow-[0_0_40px_rgba(0,0,0,0.18)]">
            {children}
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
