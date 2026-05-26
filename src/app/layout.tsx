import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
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
    url: "https://thefamerank.com",
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
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
