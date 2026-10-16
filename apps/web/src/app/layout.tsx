import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FAB ONE - Etch Chamber Live Simulation Demo",
  description: "Interactive semiconductor Etch chamber synthetic sensor monitoring, anomaly detection, and wafer traceability demo.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
