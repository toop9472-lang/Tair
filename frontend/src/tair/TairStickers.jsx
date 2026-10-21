// ملصقات طير — نفس الرمز [[tair:id]] المستخدم في التطبيق.
import React from "react";

export const TAIR_STICKERS = [
  { id: "hello", label: "سلام" },
  { id: "thanks", label: "شكراً" },
  { id: "laugh", label: "ضحك" },
  { id: "love", label: "إعجاب" },
  { id: "wow", label: "واو" },
  { id: "sad", label: "حزين" },
  { id: "ok", label: "تمام" },
  { id: "deal", label: "صفقة" },
  { id: "fly", label: "على الطريق" },
  { id: "care", label: "عناية" },
  { id: "ask", label: "سؤال" },
  { id: "celebrate", label: "مبروك" },
];

export function stickerToken(id) {
  return `[[tair:${id}]]`;
}

export function parseSticker(text) {
  const match = String(text || "").trim().match(/^\[\[tair:([a-z0-9_]+)\]\]$/);
  if (!match) return null;
  return TAIR_STICKERS.find((s) => s.id === match[1]) || null;
}

export function stickerPreview(text) {
  if (!text) return "";
  return String(text).replace(/\[\[tair:([a-z0-9_]+)\]\]/g, (full, id) => {
    const sticker = TAIR_STICKERS.find((s) => s.id === id);
    return sticker ? `ملصق: ${sticker.label}` : full;
  });
}

function Heart({ x, y, s = 8 }) {
  return (
    <path
      d={`M ${x + s / 2} ${y + s * 0.9}
          C ${x + s / 2} ${y + s * 0.7} ${x} ${y + s * 0.45} ${x} ${y + s * 0.28}
          C ${x} ${y} ${x + s * 0.48} ${y} ${x + s / 2} ${y + s * 0.28}
          C ${x + s * 0.52} ${y} ${x + s} ${y} ${x + s} ${y + s * 0.28}
          C ${x + s} ${y + s * 0.45} ${x + s / 2} ${y + s * 0.7} ${x + s / 2} ${y + s * 0.9} Z`}
      fill="#C6A15B"
    />
  );
}

function face(id) {
  const eye = (extra = "") => (
    <g>
      <circle cx="33" cy="33" r="4.4" fill="#FFFDF8" />
      <circle cx="32.2" cy="33.2" r="2.1" fill="#0F241C" />
      {extra}
    </g>
  );
  const smile = <path d="M28 40 Q33 45 38 40" stroke="#C6A15B" strokeWidth="1.7" fill="none" strokeLinecap="round" />;
  if (id === "hello") {
    return (
      <g>
        {eye()}
        {smile}
        <ellipse cx="58" cy="36" rx="11" ry="5" fill="#C6A15B" transform="rotate(-48 58 36)" />
      </g>
    );
  }
  if (id === "thanks") {
    return (
      <g>
        <path d="M28 33 Q33 37 38 33" stroke="#0F241C" strokeWidth="1.7" fill="none" strokeLinecap="round" />
        {smile}
        <Heart x={36} y={48} s={9} />
      </g>
    );
  }
  if (id === "laugh") {
    return (
      <g>
        <path d="M27 32 Q32 37 37 32" stroke="#0F241C" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <ellipse cx="32" cy="42" rx="6" ry="4.2" fill="#C6A15B" />
        <ellipse cx="22" cy="38" rx="2.4" ry="1.6" fill="#E0C580" />
      </g>
    );
  }
  if (id === "love") {
    return (
      <g>
        <Heart x={27} y={28} s={10} />
        {smile}
        <ellipse cx="22" cy="39" rx="2.6" ry="1.6" fill="#E0C580" />
      </g>
    );
  }
  if (id === "wow") {
    return (
      <g>
        <circle cx="33" cy="32" r="5.6" fill="#FFFDF8" />
        <circle cx="32.4" cy="32.4" r="2.6" fill="#0F241C" />
        <circle cx="33" cy="43" r="3.2" fill="none" stroke="#C6A15B" strokeWidth="1.6" />
      </g>
    );
  }
  if (id === "sad") {
    return (
      <g>
        <path d="M28 27 L37 30" stroke="#E0C580" strokeWidth="1.6" strokeLinecap="round" />
        {eye()}
        <path d="M28 43 Q33 39 38 43" stroke="#C6A15B" strokeWidth="1.7" fill="none" strokeLinecap="round" />
        <ellipse cx="26" cy="40" rx="1.3" ry="2.6" fill="#E0C580" />
      </g>
    );
  }
  if (id === "ok") {
    return (
      <g>
        <path d="M26 33 Q30 36 34 33" stroke="#0F241C" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <circle cx="40" cy="32" r="3.6" fill="#FFFDF8" />
        <circle cx="39.4" cy="32.2" r="1.7" fill="#0F241C" />
        {smile}
        <path d="M54 46 L58 50 L66 40" stroke="#C6A15B" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }
  if (id === "deal") {
    return (
      <g>
        {eye()}
        {smile}
        <circle cx="54" cy="56" r="6" fill="#C6A15B" />
        <circle cx="61" cy="53" r="6" fill="#E0C580" stroke="#1B3D2F" strokeWidth="1.2" />
      </g>
    );
  }
  if (id === "fly") {
    return (
      <g>
        {eye()}
        <ellipse cx="60" cy="34" rx="13" ry="5.2" fill="#C6A15B" transform="rotate(-32 60 34)" />
        <path d="M62 24 H70 M64 28 H71 M60 32 H66" stroke="#E0C580" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    );
  }
  if (id === "care") {
    return (
      <g>
        <circle cx="33" cy="34" r="3.4" fill="#FFFDF8" />
        <circle cx="32.6" cy="34.2" r="1.6" fill="#0F241C" />
        {smile}
        <rect x="46" y="50" width="14" height="8" rx="2" fill="#F7F1E8" stroke="#C6A15B" strokeWidth="1" />
        <path d="M53 50 V58 M46 54 H60" stroke="#C6A15B" strokeWidth="1.3" />
      </g>
    );
  }
  if (id === "ask") {
    return (
      <g>
        <path d="M28 26 L38 29" stroke="#E0C580" strokeWidth="1.6" strokeLinecap="round" />
        {eye()}
        <text x="56" y="24" fill="#C6A15B" fontSize="16" fontWeight="800" fontFamily="inherit">؟</text>
      </g>
    );
  }
  return (
    <g>
      <path d="M27 33 Q32 37 37 33" stroke="#0F241C" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      {smile}
      <rect x="60" y="12" width="4" height="4" fill="#C6A15B" transform="rotate(45 62 14)" />
      <rect x="10" y="18" width="3.2" height="3.2" fill="#E0C580" transform="rotate(45 11.6 19.6)" />
      <rect x="64" y="34" width="3" height="3" fill="#C6A15B" transform="rotate(45 65.5 35.5)" />
    </g>
  );
}

function Falcon({ id, size }) {
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} aria-hidden="true">
      <ellipse cx="46" cy="54" rx="22" ry="16" fill="#1B3D2F" />
      <ellipse cx="44" cy="58" rx="12" ry="8" fill="#F7F1E8" />
      <circle cx="38" cy="34" r="16" fill="#1B3D2F" />
      <path d="M36 20 L40 9 L45 21 Z" fill="#C6A15B" />
      <path d="M42 22 L48 12 L50 24 Z" fill="#E0C580" />
      <path d="M24 33 L10 38 L24 44 Z" fill="#C6A15B" />
      <path d="M24 40 L14 42 L24 45 Z" fill="#8A6A2E" />
      <path d="M40 68 V74" stroke="#C6A15B" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M48 68 V74" stroke="#C6A15B" strokeWidth="1.8" strokeLinecap="round" />
      {face(id)}
    </svg>
  );
}

export function TairSticker({ id, size = 84 }) {
  const sticker = TAIR_STICKERS.find((s) => s.id === id);
  const label = sticker?.label || "ملصق";
  return (
    <div
      role="img"
      aria-label={`ملصق ${label}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: "#F7F1E8",
        border: "1.5px solid #C6A15B",
        boxShadow: "0 6px 16px rgba(27,61,47,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <Falcon id={id} size={size * 0.92} />
    </div>
  );
}

export function StickerTray({ onPick, disabled }) {
  return (
    <div style={tray.row} data-testid="sticker-tray">
      {TAIR_STICKERS.map((s) => (
        <button
          key={s.id}
          type="button"
          disabled={disabled}
          onClick={() => onPick(stickerToken(s.id))}
          aria-label={`ملصق ${s.label}`}
          data-testid={`sticker-${s.id}`}
          style={{ ...tray.btn, opacity: disabled ? 0.45 : 1 }}
        >
          <TairSticker id={s.id} size={52} />
          <span style={tray.caption}>{s.label}</span>
        </button>
      ))}
    </div>
  );
}

const tray = {
  row: {
    display: "flex",
    flexDirection: "row-reverse",
    gap: 8,
    overflowX: "auto",
    padding: "2px 2px 8px",
    width: "100%",
    minWidth: 0,
  },
  btn: {
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    flex: "0 0 auto",
    fontFamily: "inherit",
  },
  caption: { fontSize: 10, fontWeight: 800, color: "#6B5E4A" },
};
