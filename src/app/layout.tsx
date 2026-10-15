import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Studio Admin", description: "Open-source teaching operations and authentication", icons: { icon: "/placeholder.svg" } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh"><body>{children}</body></html>;
}
