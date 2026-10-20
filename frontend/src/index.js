import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import "@/index.css";
import App from "@/App";
import { initGA } from "@/tair/analytics";

// Initialise Sentry as early as possible so it captures every render error.
const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.REACT_APP_SENTRY_ENVIRONMENT || "development",
    // Session Replay — records the last 30s of user activity when an error happens.
    // Very useful for debugging visual bugs but slightly increases payload.
    integrations: [
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: 0.1, // 10% of transactions traced (perf)
    replaysSessionSampleRate: 0.05, // 5% of normal sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    // Ignore known noise
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications.",
      "Non-Error promise rejection captured",
    ],
    beforeSend(event) {
      // Drop errors coming from browser extensions / cross-origin scripts
      if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
        (f) => f.filename && f.filename.includes("chrome-extension://"),
      )) {
        return null;
      }
      return event;
    },
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));

// Initialise Google Analytics 4 — after Sentry, before render.
initGA();

// Wrap App in Sentry ErrorBoundary — catches React rendering errors gracefully.
const AppWithSentry = SENTRY_DSN ? Sentry.withErrorBoundary(App, {
  fallback: ({ error, resetError }) => (
    <div dir="rtl" style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "'Tajawal', system-ui, sans-serif",
      background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
      color: "#fff",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🦜</div>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px" }}>حصل خطأ غير متوقّع</h1>
      <p style={{ fontSize: 15, opacity: 0.9, maxWidth: 380, lineHeight: 1.7, margin: "0 0 20px" }}>
        نعتذر عن الإزعاج. تم إبلاغ فريق طير التقني وسنُصلحه في أقرب وقت.
      </p>
      <button
        onClick={resetError}
        style={{
          padding: "12px 32px",
          background: "#fff",
          color: "#0f766e",
          border: "none",
          borderRadius: 999,
          fontWeight: 900,
          fontSize: 15,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        إعادة المحاولة
      </button>
    </div>
  ),
}) : App;

root.render(
  <React.StrictMode>
    <AppWithSentry />
  </React.StrictMode>,
);
