import React from "react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <div className="min-h-dvh bg-[var(--station-dark)] flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white text-black px-4 py-2 rounded shadow z-50"
      >
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main-content" className={`flex-1 ${className}`}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
