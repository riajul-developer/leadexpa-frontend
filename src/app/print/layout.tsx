import { Hind_Siliguri, Inter, Noto_Sans_Arabic } from "next/font/google";

import "../globals.css";
import "./print.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const bengali = Hind_Siliguri({ subsets: ["bengali"], weight: ["400", "600", "700"], variable: "--font-bengali" });
const arabic = Noto_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "600", "700"], variable: "--font-arabic" });

export const metadata = { robots: { index: false, follow: false } };

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${inter.variable} ${bengali.variable} ${arabic.variable}`}>
      <body className="bg-white">{children}</body>
    </html>
  );
}
