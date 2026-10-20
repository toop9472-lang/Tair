// طير — Shared design constants used across mobile screens
// Matches the web version (500px width, teal palette, bird illustration banner).

export const TAIR_PALETTE = {
  primary: "#1B3D2F",       // Tair Emerald
  primaryDark: "#0F241C",   // Tair Deep Emerald
  accent: "#C6A15B",        // Tair Gold
  bg: "#F7F1E8",            // Tair Cream
  bgAlt: "#F0EAD8",         // Tair Cream Alt
  surface: "#FFFDF8",       // Tair Card
  text: "#1B3D2F",
  textStrong: "#0F241C",
  textMuted: "#6B5E4A",
  textFaint: "#8A7B60",
  border: "#E6DCC8",        // Tair Divider
  borderStrong: "#C6A15B",  // Tair Gold border
  danger: "#8B3A2F",
  success: "#2F6B45",
  warning: "#C6A15B",
  info: "#3D6B54",
  divider: "#E6DCC8",
};

// Unified banner illustration URL (identical to /app/frontend/src/tair/TairBanner.jsx)
export const TAIR_BANNER_IMAGE =
  "https://customer-assets-4nw71qhi.emergentagent.net/job_40eca190-5242-4463-8c95-bc5f66df29cb/artifacts/fittm2tg_IMG_7868.jpeg";

export const TAIR_RADIUS = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const TAIR_SHADOWS = {
  card: {
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: "#0ea5e9",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
};

// Legal disclaimer version key (bump to re-prompt every user)
export const LEGAL_ACK_KEY = "tair_legal_ack_v2";
