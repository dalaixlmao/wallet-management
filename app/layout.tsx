import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppbarClient } from "../components/AppbarClient";
import Client from "../components/Client";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Wallet Management App",
  description: "Created by Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Client>
          <div className="min-w-screen min-h-screen bg-gray-900">
            <AppbarClient />
            {children}
          </div>
        </Client>
      </body>
    </html>
  );
}
