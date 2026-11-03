import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "KEITORA HUB · Keitora Projects",
  description:
    "Private inventory, sales and financial records for Keitora Projects.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
