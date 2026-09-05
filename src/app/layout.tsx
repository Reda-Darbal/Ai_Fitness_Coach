import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/client";
import { dirFor } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geist has no Arabic glyphs; this sits behind it in the font stack so Arabic
// text renders properly while Latin text keeps Geist.
const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: {
    default: "Coach — AI gym trainer",
    template: "%s · Coach",
  },
  description:
    "An AI personal trainer that builds your workouts, teaches every movement, and remembers your progress.",
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={{ theme: shadcn }}>
          <I18nProvider locale={locale}>
            {children}
            <Toaster theme="dark" />
          </I18nProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
