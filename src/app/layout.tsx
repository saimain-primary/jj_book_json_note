import type { Metadata } from "next";
import "@fontsource/jetbrains-mono"; // Global import for JetBrains Mono
import "./globals.css";

export const metadata: Metadata = {
  title: "JJBook (JSON Note)",
  description: "A professional JSON notebook and comparison tool.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body style={{ fontFamily: '"JetBrains Mono", monospace' }} className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
