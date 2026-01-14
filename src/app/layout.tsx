import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { CryptoLayout } from "@/components/layout/CryptoLayout";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crypto Analytics",
  description: "Real-time cryptocurrency market analytics and insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <CryptoLayout>{children}</CryptoLayout>
        </Providers>
      </body>
    </html>
  );
}
