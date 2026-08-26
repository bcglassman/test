import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { SessionsProvider } from "@/lib/sessions-context";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Cookie Training",
  description: "A simple exercise journal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--color-cream)] text-[var(--color-ink)]">
        <ToastProvider>
          <ConfirmProvider>
            <SessionsProvider>{children}</SessionsProvider>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
