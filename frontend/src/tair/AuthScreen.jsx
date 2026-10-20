// طير — Simple email + password auth (matches Tair theme)
import React, { useState } from "react";
import { Mail, Lock, User as UserIcon, Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import { T } from "./tairTheme";
import { AnalyticsEvents } from "./analytics";

const API = process.env.REACT_APP_BACKEND_URL;
const client = axios.create({ baseURL: `${API}/api`, withCredentials: true });

export default function AuthScreen({ onSuccess, onGuest }) {
  const [mode, setMode] = useState("signin"); // "signin" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [honeypot, setHoneypot] = useState(""); // bot trap — real users won't touch this
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validate = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "البريد الإلكتروني غير صحيح";
    }
    if (password.length < 6) {
      return "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
    }
    if (mode === "register" && name.trim().length < 2) {
      return "أدخل اسمك الكامل";
    }
    return null;
  };

  const submit = async () => {
    setError("");
    const v = validate();
    if (v) return setError(v);
    setLoading(true);
    try {
      if (mode === "register") {
        // Register first (with honeypot field)
        await client.post("/auth/register", {
          email: email.trim().toLowerCase(),
          password,
          name: name.trim(),
          website: honeypot,  // must remain empty; bots that fill everything will fail
        });
        // Then sign in to get token
        const { data } = await client.post("/auth/signin", {
          email: email.trim().toLowerCase(),
          password,
        });
        AnalyticsEvents.signup("email");
        persistAndSuccess(data);
      } else {
        const { data } = await client.post("/auth/signin", {
          email: email.trim().toLowerCase(),
          password,
        });
        AnalyticsEvents.login("email");
        persistAndSuccess(data);
      }
    } catch (e) {
      const detail = e.response?.data?.detail;
      setError(
        Array.isArray(detail) ? detail[0]?.msg || "خطأ" :
        detail || "تعذّر إتمام العملية"
      );
    } finally {
      setLoading(false);
    }
  };

  const persistAndSuccess = (data) => {
    if (data.token) localStorage.setItem("user_token", data.token);
    if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
    if (data.user) localStorage.setItem("tair_user", JSON.stringify(data.user));
    onSuccess(data.user);
  };

  return (
    <div style={styles.wrap} data-testid="tair-auth-screen">
      <div style={styles.bgLayer} />

      <div style={styles.card}>
        {/* Brand hero */}
        <div style={styles.hero}>
          <div style={styles.wordmarkBox}>
            <span style={styles.wordmark}>طير</span>
            <span style={styles.underscore} />
          </div>
          <p style={styles.tagline}>
            {mode === "signin" ? "أهلاً بعودتك" : "أنشئ حسابك في دقيقة"}
          </p>
        </div>

        {/* Mode tabs */}
        <div style={styles.tabRow}>
          <button
            onClick={() => { setMode("signin"); setError(""); }}
            style={{ ...styles.tab, ...(mode === "signin" ? styles.tabActive : {}) }}
            data-testid="tab-signin"
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => { setMode("register"); setError(""); }}
            style={{ ...styles.tab, ...(mode === "register" ? styles.tabActive : {}) }}
            data-testid="tab-register"
          >
            حساب جديد
          </button>
        </div>

        {/* Form */}
        <div style={styles.form}>
          {/* Honeypot — invisible to humans, bots often fill it. If filled, submit is silently accepted. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            aria-hidden="true"
            style={{
              position: "absolute",
              width: 1, height: 1, padding: 0,
              opacity: 0, pointerEvents: "none",
              left: "-9999px",
            }}
          />

          {mode === "register" && (
            <Field icon={UserIcon} label="الاسم">
              <input
                autoFocus
                style={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسمك أو اسم متجرك"
                maxLength={40}
                data-testid="auth-name"
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              />
            </Field>
          )}

          <Field icon={Mail} label="البريد الإلكتروني">
            <input
              dir="ltr"
              type="email"
              autoComplete="email"
              autoFocus={mode === "signin"}
              style={{ ...styles.input, textAlign: "left" }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              data-testid="auth-email"
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
          </Field>

          <Field icon={Lock} label="كلمة المرور">
            <div style={styles.pwWrap}>
              <input
                dir="ltr"
                type={showPw ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                style={{ ...styles.input, textAlign: "left", paddingInlineStart: 40 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "6 أحرف على الأقل" : "••••••••"}
                data-testid="auth-password"
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={styles.pwToggle}
                aria-label={showPw ? "إخفاء" : "إظهار"}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          {error && <div style={styles.error}>{error}</div>}

          <button
            onClick={submit}
            disabled={loading}
            style={{ ...styles.primary, opacity: loading ? 0.7 : 1 }}
            data-testid="auth-submit"
          >
            {loading && <Loader2 size={16} className="anim-spin" />}
            <span>{mode === "signin" ? "دخول" : "إنشاء الحساب"}</span>
          </button>

          {mode === "signin" && (
            <button
              onClick={() => (window.location.href = "/forgot-password")}
              style={styles.forgotBtn}
              data-testid="auth-forgot"
            >
              نسيت كلمة المرور؟
            </button>
          )}

          <div style={styles.divider}>
            <span style={styles.dividerText}>أو</span>
          </div>

          <button
            onClick={onGuest}
            style={styles.guest}
            data-testid="auth-guest"
          >
            متابعة كضيف
          </button>
        </div>

        <div style={styles.legal}>
          بمتابعتك أنت توافق على
          {" "}<a href="/terms" style={styles.link}>الشروط</a>
          {" "}و<a href="/privacy" style={styles.link}>سياسة الخصوصية</a>
        </div>
      </div>

      <style>{`
        @keyframes tair-spin { to { transform: rotate(360deg); } }
        .anim-spin { animation: tair-spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={styles.fieldLabel}>
        {Icon && <Icon size={13} strokeWidth={2.2} color={T.textMuted} />}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

const styles = {
  wrap: {
    position: "relative",
    minHeight: "100vh",
    background: T.bg,
    direction: "rtl",
    fontFamily: "'Tajawal', 'IBM Plex Sans Arabic', system-ui, sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px 40px",
    overflow: "hidden",
  },
  bgLayer: {
    position: "absolute", inset: 0, zIndex: 0,
    background:
      "radial-gradient(1200px 500px at 30% -10%, rgba(15,118,110,0.14), transparent 60%)," +
      "radial-gradient(900px 500px at 100% 110%, rgba(220,38,127,0.10), transparent 60%)," +
      "linear-gradient(180deg, #f0fdfa 0%, #ffffff 40%, #fdf2f8 100%)",
  },
  card: {
    position: "relative", zIndex: 2,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(16px) saturate(160%)",
    WebkitBackdropFilter: "blur(16px) saturate(160%)",
    borderRadius: 22,
    boxShadow: "0 20px 60px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.05)",
    border: "1px solid rgba(255,255,255,0.9)",
    padding: 26,
    width: "100%",
    maxWidth: 400,
  },
  hero: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 4, marginBottom: 18,
  },
  wordmarkBox: {
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: 6,
  },
  wordmark: {
    fontSize: 52, fontWeight: 900, color: T.primaryDark,
    letterSpacing: "-0.04em", lineHeight: 1,
    textShadow: "0 4px 20px rgba(15,118,110,0.12)",
  },
  underscore: {
    width: 46, height: 4, borderRadius: 2,
    background: "linear-gradient(90deg, " + T.primary + " 0%, #ec4899 100%)",
  },
  tagline: {
    margin: "12px 0 0", fontSize: 13, color: T.textMuted,
    fontWeight: 700, textAlign: "center",
  },
  tabRow: {
    display: "flex", flexDirection: "row-reverse",
    background: "#f1f5f9",
    borderRadius: 12, padding: 4, marginBottom: 18,
  },
  tab: {
    flex: 1, padding: "9px 14px",
    background: "transparent", border: "none",
    borderRadius: 10, fontSize: 13, fontWeight: 800,
    color: T.textMuted, cursor: "pointer", fontFamily: "inherit",
    transition: "background 0.15s, color 0.15s",
  },
  tabActive: {
    background: "#fff", color: T.primaryDark,
    boxShadow: "0 1px 4px rgba(15,23,42,0.10)",
  },
  form: {},
  fieldLabel: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    gap: 6, marginBottom: 6, fontSize: 12, fontWeight: 700, color: T.textMuted,
  },
  input: {
    width: "100%", padding: "12px 14px",
    border: `1.5px solid ${T.border}`, borderRadius: 12,
    fontSize: 14, outline: "none", background: T.surface, color: T.text,
    fontFamily: "inherit", textAlign: "right", boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  pwWrap: { position: "relative" },
  pwToggle: {
    position: "absolute",
    insetInlineStart: 8, top: "50%", transform: "translateY(-50%)",
    background: "transparent", border: "none", padding: 6,
    color: T.textMuted, cursor: "pointer", fontFamily: "inherit",
  },
  primary: {
    width: "100%", marginTop: 6,
    background: `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryLight} 100%)`,
    color: "#fff", border: "none", borderRadius: 14,
    padding: "13px 20px", fontSize: 15, fontWeight: 800,
    cursor: "pointer", fontFamily: "inherit",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 8, boxShadow: "0 6px 18px rgba(15,118,110,0.28)",
  },
  forgotBtn: {
    width: "100%", marginTop: 8,
    background: "transparent", color: T.primary,
    border: "none", padding: "6px", fontSize: 12,
    fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
  divider: {
    display: "flex", alignItems: "center",
    gap: 8, margin: "16px 0 10px",
    color: T.textFaint, fontSize: 11, fontWeight: 700,
  },
  dividerText: {
    width: "100%", textAlign: "center",
    position: "relative",
  },
  guest: {
    width: "100%", padding: "11px 20px",
    background: "transparent", color: T.textMuted,
    border: `1.5px solid ${T.border}`, borderRadius: 14,
    fontSize: 13, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  },
  error: {
    background: "#fef2f2", color: "#991b1b",
    border: "1px solid #fecaca", borderRadius: 10,
    padding: "9px 12px", fontSize: 12, fontWeight: 700,
    marginBottom: 10, textAlign: "right",
  },
  legal: {
    fontSize: 11, color: T.textFaint, textAlign: "center",
    marginTop: 16, lineHeight: 1.6,
  },
  link: {
    color: T.primary, textDecoration: "none", fontWeight: 700,
  },
};
