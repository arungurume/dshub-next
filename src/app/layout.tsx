import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { TranslateProvider } from "@/context/TranslateContext";
import { SocketProvider } from "@/context/SocketContext";
import { HashRedirect } from "@/components/shared/HashRedirect";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DSHub | Digital Signage Portal",
  description: "Enterprise Digital Signage Content Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Start with 'light' class — ThemeProvider will swap to 'dark' if user chose it
    <html lang="en" className="h-full scroll-smooth light">
      <body
        className={`${inter.variable} ${outfit.variable} font-sans min-h-full flex flex-col antialiased`}
        style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text)' }}
      >
        <TranslateProvider>
          <SocketProvider>
            <ThemeProvider>
              <HashRedirect />
              {children}
              <Toaster
                position="top-right"
                closeButton
                richColors
              />
            </ThemeProvider>
          </SocketProvider>
        </TranslateProvider>
      </body>
    </html>
  );
}
