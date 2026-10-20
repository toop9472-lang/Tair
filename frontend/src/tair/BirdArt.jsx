// طير — Real bird SVG illustrations (not emojis).
// Detailed, vibrant, hand-crafted for the Tair marketplace vibe.
import React from "react";

/* -------------------------------------------------------------------------- */
/*  Parrot — vibrant tropical (red/teal/yellow)                                */
/* -------------------------------------------------------------------------- */
export function Parrot({ size = 64, style }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={style} aria-hidden="true">
      <defs>
        <linearGradient id="pr-body" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ef4444" />
          <stop offset="0.6" stopColor="#f97316" />
          <stop offset="1" stopColor="#facc15" />
        </linearGradient>
        <linearGradient id="pr-wing" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      {/* Tail feathers */}
      <path d="M92 78 L112 96 L96 88 L108 106 L88 92 Z" fill="#0ea5e9" opacity="0.9" />
      <path d="M96 74 L118 82 L102 80 L114 92 L94 84 Z" fill="#14b8a6" opacity="0.85" />
      {/* Body */}
      <path d="M32 56 Q28 78 46 92 Q68 100 88 88 Q96 76 92 60 Q78 40 58 42 Q40 46 32 56 Z" fill="url(#pr-body)" />
      {/* Wing */}
      <path d="M56 54 Q52 74 68 84 Q84 82 86 66 Q82 52 68 50 Q60 50 56 54 Z" fill="url(#pr-wing)" />
      {/* Wing detail feathers */}
      <path d="M60 60 Q64 72 74 78" stroke="#0369a1" strokeWidth="1.4" fill="none" opacity="0.5" />
      <path d="M66 58 Q70 70 80 74" stroke="#0369a1" strokeWidth="1.4" fill="none" opacity="0.5" />
      {/* Head */}
      <circle cx="42" cy="46" r="16" fill="url(#pr-body)" />
      {/* Beak (curved parrot beak) */}
      <path d="M28 46 Q20 48 22 56 Q28 58 32 52 Z" fill="#1f2937" />
      <path d="M28 46 Q22 48 24 54" stroke="#111827" strokeWidth="0.8" fill="none" />
      {/* Eye */}
      <circle cx="44" cy="44" r="3.4" fill="#fff" />
      <circle cx="43.4" cy="44.2" r="2" fill="#0f172a" />
      <circle cx="43" cy="43.6" r="0.7" fill="#fff" />
      {/* Cheek blush */}
      <circle cx="36" cy="52" r="3" fill="#fecaca" opacity="0.75" />
      {/* Crest */}
      <path d="M46 32 Q50 22 56 26 Q52 30 54 36 Z" fill="#ef4444" />
      <path d="M50 32 Q54 24 60 28 Q56 32 58 38 Z" fill="#facc15" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Canary — cheerful golden songbird                                          */
/* -------------------------------------------------------------------------- */
export function Canary({ size = 56, style }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={style} aria-hidden="true">
      <defs>
        <linearGradient id="cn-body" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fde047" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      {/* Tail */}
      <path d="M92 66 L110 70 L98 72 L108 82 L92 74 Z" fill="#eab308" />
      {/* Body */}
      <ellipse cx="60" cy="66" rx="30" ry="24" fill="url(#cn-body)" />
      {/* Wing */}
      <path d="M52 60 Q56 78 74 80 Q84 74 82 62 Q70 54 60 56 Z" fill="#eab308" />
      <path d="M60 66 Q64 74 74 76" stroke="#a16207" strokeWidth="1.2" fill="none" opacity="0.5" />
      {/* Head */}
      <circle cx="40" cy="54" r="16" fill="url(#cn-body)" />
      {/* Little tuft */}
      <path d="M40 38 Q42 30 48 34 Q44 40 46 44 Z" fill="#eab308" />
      {/* Beak */}
      <path d="M26 54 L18 56 L26 60 Z" fill="#f97316" />
      {/* Eye */}
      <circle cx="42" cy="52" r="2.8" fill="#0f172a" />
      <circle cx="41.6" cy="51.6" r="0.9" fill="#fff" />
      {/* Chest tone */}
      <ellipse cx="52" cy="76" rx="14" ry="6" fill="#fef08a" opacity="0.6" />
      {/* Legs */}
      <line x1="54" y1="88" x2="52" y2="98" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      <line x1="64" y1="88" x2="66" y2="98" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Falcon — Saudi heritage bird, majestic silhouette                          */
/* -------------------------------------------------------------------------- */
export function Falcon({ size = 60, style }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={style} aria-hidden="true">
      <defs>
        <linearGradient id="fl-body" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#78350f" />
          <stop offset="1" stopColor="#451a03" />
        </linearGradient>
        <linearGradient id="fl-belly" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="1" stopColor="#fde68a" />
        </linearGradient>
      </defs>
      {/* Wings spread */}
      <path d="M20 54 Q10 40 6 30 Q28 42 42 52 Z" fill="url(#fl-body)" />
      <path d="M100 54 Q110 40 114 30 Q92 42 78 52 Z" fill="url(#fl-body)" />
      {/* Wing feather details */}
      <path d="M14 42 L26 48" stroke="#1c1917" strokeWidth="1" opacity="0.5" />
      <path d="M18 34 L30 44" stroke="#1c1917" strokeWidth="1" opacity="0.5" />
      <path d="M106 42 L94 48" stroke="#1c1917" strokeWidth="1" opacity="0.5" />
      <path d="M102 34 L90 44" stroke="#1c1917" strokeWidth="1" opacity="0.5" />
      {/* Body */}
      <path d="M50 50 Q46 76 60 88 Q74 76 70 50 Z" fill="url(#fl-body)" />
      {/* Belly speckled */}
      <path d="M54 60 Q60 76 66 60 Q62 82 60 84 Q58 82 54 60 Z" fill="url(#fl-belly)" />
      <circle cx="58" cy="66" r="0.8" fill="#78350f" />
      <circle cx="62" cy="70" r="0.8" fill="#78350f" />
      <circle cx="60" cy="74" r="0.8" fill="#78350f" />
      <circle cx="58" cy="78" r="0.8" fill="#78350f" />
      <circle cx="62" cy="82" r="0.8" fill="#78350f" />
      {/* Head */}
      <ellipse cx="60" cy="42" rx="12" ry="11" fill="url(#fl-body)" />
      {/* Hooked beak */}
      <path d="M60 46 Q62 52 58 54 Q56 50 58 46 Z" fill="#facc15" />
      <path d="M58 50 Q56 54 60 54" stroke="#78350f" strokeWidth="0.6" fill="none" />
      {/* Eye w/ dark mask */}
      <path d="M54 40 Q56 34 62 34" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      <circle cx="56" cy="40" r="2.6" fill="#facc15" />
      <circle cx="56" cy="40" r="1.4" fill="#0f172a" />
      {/* Tail */}
      <path d="M52 84 L60 100 L68 84 Z" fill="url(#fl-body)" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dove — peaceful, elegant                                                   */
/* -------------------------------------------------------------------------- */
export function Dove({ size = 54, style }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={style} aria-hidden="true">
      <defs>
        <linearGradient id="dv-body" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
      </defs>
      {/* Tail */}
      <path d="M92 62 L112 60 L104 68 L110 76 L94 70 Z" fill="url(#dv-body)" />
      {/* Wing (upraised) */}
      <path d="M52 44 Q40 30 50 22 Q68 24 70 44 Q60 52 52 44 Z" fill="url(#dv-body)" />
      <path d="M56 32 L62 38" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
      <path d="M60 30 L66 36" stroke="#94a3b8" strokeWidth="1" opacity="0.5" />
      {/* Body */}
      <ellipse cx="60" cy="66" rx="30" ry="18" fill="url(#dv-body)" />
      {/* Head */}
      <circle cx="38" cy="54" r="12" fill="url(#dv-body)" />
      {/* Beak */}
      <path d="M26 54 L20 55 L26 58 Z" fill="#f97316" />
      {/* Eye */}
      <circle cx="38" cy="52" r="1.8" fill="#0f172a" />
      {/* Legs */}
      <line x1="56" y1="82" x2="54" y2="94" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      <line x1="66" y1="82" x2="68" y2="94" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      {/* Soft chest highlight */}
      <ellipse cx="52" cy="72" rx="14" ry="6" fill="#ffffff" opacity="0.6" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Hummingbird — small colorful accent                                        */
/* -------------------------------------------------------------------------- */
export function Hummingbird({ size = 44, style }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={style} aria-hidden="true">
      <defs>
        <linearGradient id="hb-body" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#a855f7" />
          <stop offset="0.5" stopColor="#ec4899" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      {/* Wings (blur suggestion) */}
      <ellipse cx="72" cy="46" rx="18" ry="8" fill="#67e8f9" opacity="0.55" transform="rotate(-20 72 46)" />
      <ellipse cx="72" cy="46" rx="14" ry="5" fill="#a5f3fc" opacity="0.7" transform="rotate(-30 72 46)" />
      {/* Body */}
      <path d="M40 56 Q34 66 46 74 Q66 76 76 66 Q78 56 68 52 Q52 50 40 56 Z" fill="url(#hb-body)" />
      {/* Tail */}
      <path d="M76 66 L96 74 L82 68 L94 82 L74 72 Z" fill="#7c3aed" />
      {/* Head */}
      <circle cx="36" cy="52" r="10" fill="url(#hb-body)" />
      {/* Long thin beak */}
      <line x1="26" y1="52" x2="8" y2="50" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
      {/* Eye */}
      <circle cx="38" cy="50" r="1.6" fill="#0f172a" />
      <circle cx="37.6" cy="49.6" r="0.5" fill="#fff" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pigeon — everyday city bird                                                */
/* -------------------------------------------------------------------------- */
export function Pigeon({ size = 54, style }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={style} aria-hidden="true">
      <defs>
        <linearGradient id="pg-body" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#64748b" />
          <stop offset="1" stopColor="#334155" />
        </linearGradient>
      </defs>
      {/* Tail */}
      <path d="M92 74 L110 76 L100 82 L108 88 L94 82 Z" fill="url(#pg-body)" />
      {/* Body */}
      <ellipse cx="62" cy="74" rx="30" ry="18" fill="url(#pg-body)" />
      {/* Wing */}
      <path d="M54 66 Q60 84 78 82 Q86 74 82 66 Q68 60 54 66 Z" fill="#475569" />
      <path d="M60 70 Q66 78 76 78" stroke="#1e293b" strokeWidth="1" fill="none" opacity="0.6" />
      {/* Head */}
      <circle cx="42" cy="60" r="12" fill="url(#pg-body)" />
      {/* Iridescent neck patch */}
      <path d="M42 68 Q50 66 52 76 Q46 78 40 74 Z" fill="#10b981" opacity="0.8" />
      <path d="M44 70 Q50 68 52 74" fill="#a855f7" opacity="0.6" />
      {/* Beak */}
      <path d="M30 60 L22 62 L30 64 Z" fill="#0f172a" />
      <ellipse cx="26" cy="59" rx="2.5" ry="1.4" fill="#fef3c7" />
      {/* Eye */}
      <circle cx="43" cy="58" r="2.2" fill="#f97316" />
      <circle cx="43" cy="58" r="1" fill="#0f172a" />
      {/* Legs */}
      <line x1="58" y1="90" x2="56" y2="100" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
      <line x1="68" y1="90" x2="70" y2="100" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Peacock feather — decorative flourish                                      */
/* -------------------------------------------------------------------------- */
export function Feather({ size = 40, style }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={style} aria-hidden="true">
      <defs>
        <radialGradient id="fe-eye" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#facc15" />
          <stop offset="0.4" stopColor="#0f766e" />
          <stop offset="1" stopColor="#0369a1" />
        </radialGradient>
      </defs>
      <path d="M60 12 Q30 40 40 78 Q54 92 60 108 Q66 92 80 78 Q90 40 60 12 Z" fill="#14b8a6" />
      <path d="M60 20 Q38 44 46 74 Q60 84 74 74 Q82 44 60 20 Z" fill="#0f766e" />
      <ellipse cx="60" cy="50" rx="12" ry="16" fill="url(#fe-eye)" />
      <ellipse cx="60" cy="46" rx="4" ry="6" fill="#0f172a" />
      <line x1="60" y1="60" x2="60" y2="108" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sparkle — tiny star accent                                                 */
/* -------------------------------------------------------------------------- */
export function Sparkle({ size = 14, color = "#fff", style }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} style={style} aria-hidden="true">
      <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" fill={color} />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Corner flock — a scattered decorative set (fixed positions, no emoji)      */
/* -------------------------------------------------------------------------- */
export function BannerFlock() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 2, insetInlineEnd: "18%", transform: "rotate(-14deg)" }}>
        <Parrot size={54} />
      </div>
      <div style={{ position: "absolute", top: 34, insetInlineEnd: "3%", transform: "rotate(6deg)" }}>
        <Canary size={38} />
      </div>
      <div style={{ position: "absolute", top: 6, insetInlineStart: "10%", transform: "rotate(10deg)" }}>
        <Falcon size={52} />
      </div>
      <div style={{ position: "absolute", top: 42, insetInlineStart: "2%", transform: "rotate(-8deg)" }}>
        <Hummingbird size={34} />
      </div>
      <div style={{ position: "absolute", top: 8, insetInlineStart: "44%", opacity: 0.9 }}>
        <Sparkle size={12} color="#fff8" />
      </div>
      <div style={{ position: "absolute", top: 58, insetInlineEnd: "42%", opacity: 0.8 }}>
        <Sparkle size={10} color="#fff8" />
      </div>
      <div style={{ position: "absolute", top: 28, insetInlineStart: "38%", opacity: 0.7 }}>
        <Sparkle size={8} color="#fff8" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Background scatter — subtle low-opacity birds for empty screen areas       */
/* -------------------------------------------------------------------------- */
export function BackgroundBirds() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
        opacity: 0.06,
      }}
      aria-hidden="true"
    >
      <div style={{ position: "absolute", top: "22%", insetInlineEnd: -20, transform: "rotate(-10deg)" }}>
        <Feather size={120} />
      </div>
      <div style={{ position: "absolute", top: "48%", insetInlineStart: -30, transform: "rotate(24deg)" }}>
        <Dove size={140} />
      </div>
      <div style={{ position: "absolute", top: "72%", insetInlineEnd: -10, transform: "rotate(-6deg)" }}>
        <Pigeon size={130} />
      </div>
      <div style={{ position: "absolute", top: "88%", insetInlineStart: "40%", transform: "rotate(4deg)" }}>
        <Hummingbird size={70} />
      </div>
    </div>
  );
}
