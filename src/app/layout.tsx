import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Subway Therapy - Virtual Wall",
  description: "Share your thoughts anonymously on our virtual subway wall. Draw or type a sticky note and connect with others around the world.",
  keywords: ["subway therapy", "sticky notes", "anonymous", "community", "expression", "art"],
  openGraph: {
    title: "Subway Therapy - Virtual Wall",
    description: "Share your thoughts anonymously on our virtual subway wall",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
