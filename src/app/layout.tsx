import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { TranslateProvider } from "@/context/TranslateContext";
import { SocketProvider } from "@/context/SocketContext";
import { HashRedirect } from "@/components/shared/HashRedirect";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { Toaster } from "sonner";
import { headers, cookies } from "next/headers";
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

function getBrowserLanguage(acceptLanguage: string): string {
  if (!acceptLanguage) return 'en';
  const languages = acceptLanguage.split(',').map(lang => {
    const [locale] = lang.split(';');
    return locale.trim().split('-')[0].toLowerCase();
  });
  const supported = ['en', 'es', 'de', 'fr'];
  for (const lang of languages) {
    if (supported.includes(lang)) {
      return lang;
    }
  }
  return 'en';
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const storedLang = cookieStore.get("NEXT_LOCALE")?.value || cookieStore.get("ds_lang")?.value;
  
  let defaultLang = 'en';
  const supported = ['en', 'es', 'de', 'fr'];
  if (storedLang && supported.includes(storedLang)) {
    defaultLang = storedLang;
  } else {
    const headersList = await headers();
    const acceptLanguage = headersList.get("accept-language") || "";
    defaultLang = getBrowserLanguage(acceptLanguage);
  }

  return (
    // Start with 'light' class — ThemeProvider will swap to 'dark' if user chose it
    <html lang="en" className="h-full scroll-smooth light">
      <body
        className={`${inter.variable} ${outfit.variable} font-sans min-h-full flex flex-col antialiased`}
        style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text)' }}
      >
        <TranslateProvider defaultLang={defaultLang}>
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
