import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalTopNav from "@/components/GlobalTopNav";
import ModuleTabs from "@/components/ModuleTabs";
import ModuleGuard from "@/components/ModuleGuard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jarvis Prime",
  description: "Jarvis Prime — Operations Command Center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Level 0: Global Top Bar */}
        <GlobalTopNav />

        {/* Level 1: Module Tabs */}
        <ModuleTabs />

        {/* Page Content — guarded by module access */}
        <ModuleGuard>
          <main className="page-content">{children}</main>
        </ModuleGuard>
      </body>
    </html>
  );
}