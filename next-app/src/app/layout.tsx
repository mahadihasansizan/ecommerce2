import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./providers";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import GlobalLoader from "@/components/GlobalLoader";
import ScrollToTop from "@/components/layout/ScrollToTop";
import OffCanvasCart from "@/components/cart/OffCanvasCart";
import MobileBottomMenu from "@/components/mobile/MobileBottomMenu";
import NativeBrowserBar from "@/components/native/NativeBrowserBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KitchenHero",
  description: "High-quality WooCommerce products built for Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          <GlobalLoader>
            <NativeBrowserBar />
            <Header />
            <ScrollToTop />
            <main className="min-h-screen">
              {children}
            </main>
            <Footer />
            <OffCanvasCart />
            <MobileBottomMenu />
          </GlobalLoader>
        </Providers>
      </body>
    </html>
  );
}
