import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QR Maker",
  description: "Generate custom QR codes with optional logos and circle styling.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
