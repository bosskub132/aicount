import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  variable: "--font-noto-thai",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AICount — Thai Accounting Platform",
  description: "AI-powered accounting SaaS for Thai businesses. Document OCR, journal entries, WHT certificates, VAT management, and bank reconciliation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${inter.variable} ${notoSansThai.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
