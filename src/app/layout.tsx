import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "FameRank — The World's Most Authoritative Creator Rankings",
  description:
    "FameRank is the definitive authority on creator and influencer rankings across Music, Fitness, Comedy, Beauty, and more.",
  openGraph: {
    title: "FameRank",
    description: "The World's Most Authoritative Creator Rankings",
    url: "https://www.thefamerank.com",
    siteName: "FameRank",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FameRank",
    description: "The World's Most Authoritative Creator Rankings",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${geistMono.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
