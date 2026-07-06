import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "立法院議案追蹤",
  description: "追蹤立法院議案進度、提案政黨與跨黨派支持狀況",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b bg-white px-4 py-3">
          <Link href="/" className="text-lg font-bold">
            立法院議案追蹤
          </Link>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <Analytics />
      </body>
    </html>
  );
}
