import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://subwaytherapy.net";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Subway Therapy",
    template: "%s | Subway Therapy",
  },
  description: "Leave a note on the virtual subway wall. Draw or type your message on a sticky note and share your thoughts with the world, inspired by the NYC subway therapy movement.",
  keywords: [
    "Subway Therapy",
    "subway therapy",
    "sticky notes",
    "NYC subway",
    "anonymous expression",
    "community art",
    "virtual wall",
    "Matthew Chavez",
    "Levee",
    "public art",
    "mental health",
    "self expression",
  ],
  authors: [{ name: "Subway Therapy" }],
  creator: "Subway Therapy",
  publisher: "Subway Therapy",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Subway Therapy",
    title: "Subway Therapy",
    description: "Leave a note on the virtual subway wall. Share your thoughts with the world.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Subway Therapy - Virtual sticky note wall",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Subway Therapy",
    description: "Leave a note on the virtual subway wall. Share your thoughts with the world.",
    images: ["/og-image.png"],
    creator: "@subwaytherapy",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: siteUrl,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// JSON-LD structured data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Subway Therapy",
  description: "Leave a note on the virtual subway wall. Draw or type your message on a sticky note and share your thoughts with the world.",
  url: siteUrl,
  applicationCategory: "SocialApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  creator: {
    "@type": "Organization",
    name: "Subway Therapy",
    url: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
