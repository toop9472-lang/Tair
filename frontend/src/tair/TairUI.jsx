// طير — Shared UI Kit (professional, lucide-based)
import React, { useEffect } from "react";
import { ArrowRight, X, Check, Search } from "lucide-react";
import { T, S } from "./tairTheme";

// ---------------- TopBar ----------------
export function TopBar({ title, subtitle, onBack, right, transparent = false }) {
  return (
    <div style={{
      ...S.header,
      background: transparent ? "transparent" : T.surface,
      borderBottom: transparent ? "none" : `1px solid ${T.border}`,
    }}>
      <div style={{
        maxWidth: 900,
        margin: "0 auto",
        display: "flex",
        flexDirection: "row-reverse",
        alignItems: "center",
        gap: 12,
      }}>
        {onBack && (
          <button onClick={onBack} style={S.iconBtn} data-testid="topbar-back" aria-label="رجوع">
            <ArrowRight size={20} strokeWidth={2.2} />
          </button>
        )}
        <div style={{ flex: 1, textAlign: "right" }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.text }}>{title}</h1>
          {subtitle && (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: T.textMuted }}>{subtitle}</p>
          )}
        </div>
        {right}
      </div>
    </div>
  );
}

// ---------------- Bottom Sheet (RTL native feel) ----------------
export function BottomSheet({ open, onClose, title, children, height }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={sheetStyles.backdrop}
      onClick={onClose}
      data-testid="bottom-sheet-backdrop"
    >
      <div
        style={{ ...sheetStyles.sheet, maxHeight: height || "72vh" }}
        onClick={(e) => e.stopPropagation()}
        data-testid="bottom-sheet"
      >
        <div style={sheetStyles.grabber} />
        <div style={sheetStyles.header}>
          <button
            onClick={onClose}
            style={S.iconBtn}
            data-testid="sheet-close"
            aria-label="إغلاق"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
          <h2 style={sheetStyles.title}>{title}</h2>
          <div style={{ width: 40 }} />
        </div>
        <div style={sheetStyles.body}>{children}</div>
      </div>
    </div>
  );
}

const sheetStyles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(3, 7, 18, 0.55)",
    backdropFilter: "blur(2px)",
    zIndex: 200,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    animation: "tair-fade 0.15s ease-out",
  },
  sheet: {
    background: T.surface,
    width: "100%",
    maxWidth: 640,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: T.shadowLg,
    animation: "tair-slide-up 0.22s ease-out",
    fontFamily: "'Tajawal', 'IBM Plex Sans Arabic', system-ui, sans-serif",
    direction: "rtl",
  },
  grabber: {
    width: 36,
    height: 4,
    background: T.borderStrong,
    borderRadius: 2,
    margin: "10px auto 6px",
  },
  header: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px 14px",
    borderBottom: `1px solid ${T.divider}`,
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: T.text,
    flex: 1,
    textAlign: "center",
  },
  body: {
    overflowY: "auto",
    padding: "6px 6px 16px",
  },
};

// ---------------- Selector List Item ----------------
export function SelectorItem({ icon, label, active, onClick, muted, meta, testId }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...selectorStyles.item,
        ...(active ? selectorStyles.itemActive : {}),
      }}
      data-testid={testId}
    >
      {icon && <span style={selectorStyles.icon}>{icon}</span>}
      <span style={{ flex: 1, textAlign: "right" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: active ? T.primary : T.text }}>
          {label}
        </div>
        {meta && (
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{meta}</div>
        )}
      </span>
      {active && (
        <span style={selectorStyles.check}>
          <Check size={16} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

const selectorStyles = {
  item: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "12px 14px",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${T.divider}`,
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "right",
    transition: "background 0.1s",
  },
  itemActive: {
    background: "#f0fdfa",
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: T.bgAlt,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: T.primary,
    flexShrink: 0,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    background: T.primary,
    color: T.textInverse,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
};

// ---------------- Filter Chip Button (single, opens a sheet) ----------------
export function FilterChipButton({ icon, label, value, onClick, testId }) {
  const filled = !!value;
  return (
    <button
      onClick={onClick}
      style={{
        ...chipStyles.btn,
        ...(filled ? chipStyles.btnFilled : {}),
      }}
      data-testid={testId}
    >
      {icon && <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>}
      <span style={chipStyles.label}>{label}</span>
      {value && (
        <span style={chipStyles.value}>{value}</span>
      )}
    </button>
  );
}

const chipStyles = {
  btn: {
    display: "inline-flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    padding: "9px 14px",
    borderRadius: T.radiusPill,
    borderWidth: 1.5,
    borderStyle: "solid",
    borderColor: T.border,
    background: T.surface,
    color: T.text,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    transition: "all 0.15s",
  },
  btnFilled: {
    borderColor: T.primary,
    background: "#f0fdfa",
    color: T.primary,
  },
  label: { fontWeight: 700 },
  value: {
    background: T.primary,
    color: T.textInverse,
    padding: "2px 8px",
    borderRadius: T.radiusPill,
    fontSize: 11,
    fontWeight: 800,
  },
};

// ---------------- Search Input (inline) ----------------
export function SearchField({ value, onChange, placeholder, testId }) {
  return (
    <div style={searchStyles.wrap}>
      <Search size={18} strokeWidth={2.2} color={T.textMuted} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={searchStyles.input}
        data-testid={testId}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          style={searchStyles.clear}
          aria-label="مسح"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

const searchStyles = {
  wrap: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    background: T.surface,
    border: `1.5px solid ${T.border}`,
    borderRadius: T.radius,
    padding: "11px 14px",
    transition: "border-color 0.15s",
  },
  input: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: 15,
    background: "transparent",
    textAlign: "right",
    fontFamily: "inherit",
    color: T.text,
  },
  clear: {
    background: T.bgAlt,
    border: "none",
    width: 24,
    height: 24,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: T.textMuted,
    flexShrink: 0,
  },
};

// ---------------- Empty State ----------------
export function EmptyState({ icon, title, desc, action }) {
  return (
    <div style={emptyStyles.wrap} data-testid="empty-state">
      <div style={emptyStyles.iconWrap}>{icon}</div>
      <h3 style={emptyStyles.title}>{title}</h3>
      {desc && <p style={emptyStyles.desc}>{desc}</p>}
      {action}
    </div>
  );
}

const emptyStyles = {
  wrap: {
    padding: "48px 24px",
    textAlign: "center",
    background: T.surface,
    borderRadius: T.radiusMd,
    border: `1px solid ${T.border}`,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    background: T.bgAlt,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: T.textMuted,
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: 800,
    color: T.text,
    margin: "0 0 6px",
  },
  desc: {
    color: T.textMuted,
    fontSize: 13,
    margin: "0 0 18px",
    lineHeight: 1.6,
  },
};

// ---------------- Status Pill ----------------
export function StatusPill({ label, color = T.textMuted, size = "sm" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: size === "lg" ? "6px 14px" : "3px 10px",
        borderRadius: T.radiusPill,
        fontSize: size === "lg" ? 12 : 11,
        fontWeight: 800,
        background: color + "1a",
        color: color,
        letterSpacing: "0.01em",
      }}
    >
      {label}
    </span>
  );
}

// ---------------- Animations (injected once) ----------------
export function InjectAnimations() {
  useEffect(() => {
    if (document.getElementById("tair-anim-style")) return;
    const style = document.createElement("style");
    style.id = "tair-anim-style";
    style.innerHTML = `
      @keyframes tair-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes tair-slide-up {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      @keyframes tair-spin { to { transform: rotate(360deg); } }
      body { -webkit-tap-highlight-color: transparent; }
      button:active { transform: scale(0.98); transition: transform 0.06s; }
      input:focus, textarea:focus, select:focus {
        border-color: ${T.primary} !important;
        box-shadow: 0 0 0 3px ${T.primary}22 !important;
      }
    `;
    document.head.appendChild(style);
  }, []);
  return null;
}
