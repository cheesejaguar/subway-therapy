"use client";

import React from "react";
import { trackEvent } from "@/lib/analytics";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        trackEvent("host_cards_printed");
        window.print();
      }}
      className="px-5 py-3 rounded-lg bg-[var(--mta-green)] text-white text-sm mta-button touch-target"
    >
      Print the cards
    </button>
  );
}
