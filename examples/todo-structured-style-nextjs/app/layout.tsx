import type { Metadata } from "next";
import { Providers } from "./Providers.tsx";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kin Store: Next.js Todo",
  description:
    "SSR todo app demonstrating the persist plugin and StoreProvider",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
