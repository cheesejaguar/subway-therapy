import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

// Self-hosted via next/font: no external font requests, no CSP exceptions,
// metric-adjusted fallbacks to avoid layout shift. The variable names match
// the var(--font-display)/var(--font-body) references used throughout the app.
const barlowBody = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const barlowDisplay = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
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
  // The Open Graph / Twitter images, icons, and web manifest are provided by
  // the App Router file conventions: opengraph-image.tsx, icon.tsx,
  // apple-icon.tsx, and manifest.ts.
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Subway Therapy",
    title: "Subway Therapy",
    description: "Leave a note on the virtual subway wall. Share your thoughts with the world.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Subway Therapy",
    description: "Leave a note on the virtual subway wall. Share your thoughts with the world.",
    creator: "@subwaytherapy",
  },
  alternates: {
    canonical: siteUrl,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#1C1C1C",
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
    <html lang="en" className={`${barlowBody.variable} ${barlowDisplay.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
