// طير — Shared "verified tick" badge (Twitter/Instagram-style blue check)
// Use this next to any seller/carrier/merchant name to indicate KYC verification.
import React from "react";

/**
 * Renders a small verified check tick.
 *
 * Props:
 * - verified: shows the tick when truthy (defaults: false)
 * - type: "shop" | "carrier" — controls color (green for shops, blue for carriers)
 * - size: pixel size of the badge (default 14)
 * - title: tooltip text (default "موثّق")
 */
export default function VerifiedTick({ verified, type = "shop", size = 14, title = "موثّق" }) {
  if (!verified) return null;

  const color = type === "carrier" ? "#2563eb" : "#0891b2";  // carrier blue vs shop teal
  const outerSize = size;
  const innerSize = Math.max(8, Math.round(size * 0.6));

  return (
    <span
      title={title}
      aria-label={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: outerSize,
        height: outerSize,
        borderRadius: outerSize / 2,
        background: color,
        color: "#fff",
        flexShrink: 0,
        boxShadow: `0 1px 3px ${color}55`,
      }}
    >
      <svg
        width={innerSize}
        height={innerSize}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth={3.5}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}
