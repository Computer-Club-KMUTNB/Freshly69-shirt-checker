import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const thai = Noto_Sans_Thai({ variable: "--font-thai", subsets: ["thai", "latin"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: "Freshly69 แจกเสื้อ",
  description: "ระบบยืนยันการรับเสื้อเฟรชชี่ มจพ. ปี 69 (สำหรับสตาฟ)",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ea580c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={`${thai.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
