// طير — App Store & Google Play download banner (bottom of feed)
// Elegant, brand-aligned, uses official Apple + Google badge assets.
import React from "react";
import { Smartphone, Star } from "lucide-react";
import { T } from "./tairTheme";

const APPLE_URL =
  "https://apps.apple.com/sa/app/%D8%B5%D9%82%D8%B1/id6758868843?l=ar";
const GOOGLE_URL =
  "https://play.google.com/store/apps/details?id=com.saqr.rewards&pcampaignid=web_share";

// Official Arabic App Store badge (SVG from apple.com marketing tools)
const APPLE_BADGE_AR =
  "https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/ar-sa?size=250x83";
// Official Arabic Google Play badge
const GOOGLE_BADGE_AR =
  "https://play.google.com/intl/ar_ar/badges/static/images/badges/ar_badge_web_generic.png";

export default function AppDownloadBanner() {
  return (
    <section
      style={styles.section}
      data-testid="app-download-banner"
      aria-label="حمّل تطبيق طير للجوال"
    >
      {/* Ambient glow bubbles */}
      <div style={styles.glow1} aria-hidden="true" />
      <div style={styles.glow2} aria-hidden="true" />

      <div style={styles.inner}>
        <div style={styles.iconWrap}>
          <Smartphone size={30} strokeWidth={2} color="#fff" />
        </div>

        <div style={styles.copy}>
          <div style={styles.eyebrow}>
            <Star size={12} strokeWidth={2.8} fill="#fbbf24" color="#fbbf24" />
            <Star size={12} strokeWidth={2.8} fill="#fbbf24" color="#fbbf24" />
            <Star size={12} strokeWidth={2.8} fill="#fbbf24" color="#fbbf24" />
            <Star size={12} strokeWidth={2.8} fill="#fbbf24" color="#fbbf24" />
            <Star size={12} strokeWidth={2.8} fill="#fbbf24" color="#fbbf24" />
            <span style={styles.eyebrowText}>تجربة أفضل على الجوال</span>
          </div>
          <h3 style={styles.title}>حمّل تطبيق طير</h3>
          <p style={styles.desc}>
            تصفّح الإعلانات، تابع الرحلات، وتفاعل مع المجتمع من هاتفك بسرعة أعلى وإشعارات فورية.
          </p>
        </div>

        <div style={styles.badges}>
          <a
            href={APPLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.badgeLink}
            data-testid="app-store-badge"
            aria-label="حمّل من App Store"
          >
            <img
              src={APPLE_BADGE_AR}
              alt="حمّل من App Store"
              style={styles.badgeImg}
              draggable={false}
            />
          </a>
          <a
            href={GOOGLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.badgeLink}
            data-testid="google-play-badge"
            aria-label="احصل عليه من Google Play"
          >
            <img
              src={GOOGLE_BADGE_AR}
              alt="احصل عليه من Google Play"
              style={styles.badgeImg}
              draggable={false}
            />
          </a>
        </div>
      </div>
    </section>
  );
}

const styles = {
  section: {
    position: "relative",
    margin: "28px auto 40px",
    maxWidth: 900,
    padding: "26px 22px 30px",
    borderRadius: 24,
    overflow: "hidden",
    background:
      "linear-gradient(135deg, #0f766e 0%, #0d9488 45%, #14b8a6 100%)",
    boxShadow:
      "0 20px 40px -12px rgba(15,118,110,0.35), 0 8px 16px rgba(0,0,0,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  glow1: {
    position: "absolute",
    width: 220, height: 220, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(236,72,153,0.28) 0%, transparent 65%)",
    top: -80, insetInlineStart: -60,
    pointerEvents: "none",
  },
  glow2: {
    position: "absolute",
    width: 260, height: 260, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 65%)",
    bottom: -110, insetInlineEnd: -70,
    pointerEvents: "none",
  },
  inner: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    textAlign: "center",
    zIndex: 2,
  },
  iconWrap: {
    width: 62, height: 62, borderRadius: 20,
    background: "rgba(255,255,255,0.18)",
    border: "1.5px solid rgba(255,255,255,0.35)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
  },
  copy: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 6, maxWidth: 520,
  },
  eyebrow: {
    display: "flex", flexDirection: "row-reverse",
    alignItems: "center", gap: 4,
    padding: "5px 12px", borderRadius: 999,
    background: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.25)",
  },
  eyebrowText: {
    marginInlineStart: 4,
    color: "#fff", fontSize: 11, fontWeight: 800,
    letterSpacing: 0.2,
  },
  title: {
    color: "#fff", fontSize: 26, fontWeight: 900,
    margin: "6px 0 0", letterSpacing: -0.5,
    textShadow: "0 2px 8px rgba(0,0,0,0.15)",
  },
  desc: {
    color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 1.7,
    margin: 0, fontWeight: 500,
  },
  badges: {
    display: "flex", flexDirection: "row-reverse",
    gap: 12, marginTop: 10, flexWrap: "wrap", justifyContent: "center",
  },
  badgeLink: {
    display: "inline-block",
    transition: "transform 0.2s ease, filter 0.2s ease",
    borderRadius: 10,
    lineHeight: 0,
  },
  badgeImg: {
    height: 52, width: "auto",
    display: "block",
    filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.2))",
    borderRadius: 10,
  },
};
