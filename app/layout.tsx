import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { TopNav } from "@/components/TopNav"
import { BottomNav } from "@/components/BottomNav"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "BizEnglish — Learn Business English",
  description: "Master business English phrases and vocabulary.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0f0f0f] text-foreground">
        <TopNav />
        <main className="flex-1 pb-[calc(env(safe-area-inset-bottom)+4rem)] md:pb-0">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
