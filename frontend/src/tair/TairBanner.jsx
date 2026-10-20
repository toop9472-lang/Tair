// طير — Shared banner header used across all pages (unified illustration)
import React from "react";
import { T } from "./tairTheme";

const DEFAULT_BG_IMAGE =
  "https://customer-assets-4nw71qhi.emergentagent.net/job_40eca190-5242-4463-8c95-bc5f66df29cb/artifacts/fittm2tg_IMG_7868.jpeg";

/**
 * TairBanner — signature top banner. Uses the unified bird/animal illustration
 * as background across the whole app. Left slot & right slot each accept an
 * optional element (usually a circular button).
 *
 * Props:
 * - bgImage: optional override for the background illustration.
 */
export default function TairBanner({ leftSlot, rightSlot, bgImage, tall = false, title }) {
  const url = bgImage || DEFAULT_BG_IMAGE;
  return (
    <header
      style={{
        ...styles.banner,
        ...(tall ? styles.bannerTall : null),
        backgroundImage: `url("${url}")`,
      }}
    >
      <div style={styles.row}>
        <div style={styles.slot}>{rightSlot}</div>
        <div style={styles.brandSpacer}>
          {title ? <div style={styles.title}>{title}</div> : null}
        </div>
        <div style={styles.slot}>{leftSlot}</div>
      </div>
    </header>
  );
}

export function BannerCircleBtn({ onClick, children, badge, testId, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      style={styles.circleBtn}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      {children}
      {badge > 0 && (
        <span style={styles.badge}>{badge > 9 ? "9+" : badge}</span>
      )}
    </button>
  );
}

const styles = {
  banner: {
    position: "sticky",
    backgroundColor: "#0f766e",
    backgroundSize: "cover",
    backgroundPosition: "center 30%",
    backgroundRepeat: "no-repeat",
    padding: "8px 12px 10px",
    top: 0,
    zIndex: 30,
    boxShadow: "0 4px 16px rgba(15,118,110,0.20)",
    borderBottom: "2px solid rgba(255,255,255,0.15)",
    overflow: "hidden",
    isolation: "isolate",
  },
  bannerTall: {
    minHeight: 160,
    padding: "14px 14px 32px",
    backgroundPosition: "center 45%",
    borderRadius: "0 0 32px 32px",
    boxShadow: "0 12px 30px -8px rgba(15,118,110,0.35)",
  },
  row: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 900,
    margin: "0 auto",
    gap: 10,
  },
  slot: {
    minWidth: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brandSpacer: {
    flex: 1,
    minHeight: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: 900,
    textShadow: "0 1px 3px rgba(0,0,0,0.25)",
    letterSpacing: "-0.01em",
  },
  circleBtn: {
    position: "relative",
    width: 36,
    height: 36,
    borderRadius: 18,
    background: "rgba(255,255,255,0.18)",
    border: "1.5px solid rgba(255,255,255,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
  },
  badge: {
    position: "absolute",
    top: -2,
    insetInlineStart: -2,
    background: "#ef4444",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    padding: "0 5px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid rgba(15,118,110,1)",
  },
};

export const PAGE_BG_STYLE = {
  minHeight: "100vh",
  background:
    "radial-gradient(80% 40% at 90% 5%, rgba(220,38,127,0.08) 0%, transparent 60%)," +
    "radial-gradient(80% 40% at 5% 30%, rgba(15,118,110,0.08) 0%, transparent 60%)," +
    "radial-gradient(60% 40% at 60% 65%, rgba(236,72,153,0.05) 0%, transparent 60%)," +
    "radial-gradient(80% 50% at 20% 95%, rgba(20,184,166,0.07) 0%, transparent 60%)," +
    T.bg,
  paddingBottom: 88,
};
