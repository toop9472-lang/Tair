// طير — Lightweight JS error reporter for the mobile app.
//
// Why not @sentry/react-native? It requires linking native modules, which
// forces a new EAS build. Since builds are gated, we ship a JS-only reporter
// that POSTs errors to the backend, which forwards to the same Sentry project
// used by the web/backend.

import { Platform } from "react-native";
import Constants from "expo-constants";

let currentUserId = null;
let currentScreen = null;
let apiBaseUrl = null;
let installed = false;

const appVersion =
  Constants?.expoConfig?.version ||
  Constants?.manifest?.version ||
  "unknown";
const build =
  Constants?.expoConfig?.ios?.buildNumber ||
  Constants?.expoConfig?.android?.versionCode?.toString() ||
  "unknown";

function safeStringify(obj) {
  try {
    return typeof obj === "string" ? obj : JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

async function postError(payload) {
  if (!apiBaseUrl) return;
  try {
    await fetch(`${apiBaseUrl}/api/mobile/error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // swallow — we never want the reporter itself to crash the app
  }
}

/**
 * Manually report an error / event to the backend + Sentry.
 * @param {Error|string} err
 * @param {{ fatal?: boolean, extra?: object }} opts
 */
export async function reportError(err, opts = {}) {
  const message =
    (err && err.message) ||
    (typeof err === "string" ? err : safeStringify(err)) ||
    "Unknown error";
  const stack = err && err.stack ? String(err.stack).slice(0, 8000) : null;
  await postError({
    message: String(message).slice(0, 2000),
    stack,
    fatal: !!opts.fatal,
    platform: Platform.OS,
    app_version: appVersion,
    build: String(build),
    user_id: currentUserId,
    screen: currentScreen,
    extra: opts.extra || null,
  });
}

/** Tag the current logged-in user id so errors are linked to them. */
export function setReporterUser(userId) {
  currentUserId = userId || null;
}

/** Tag the currently-visible screen name to make triage easier. */
export function setReporterScreen(name) {
  currentScreen = name || null;
}

/**
 * Install global JS error handlers. Must be called once on app startup,
 * ideally before any other feature.
 */
export function installErrorReporter(baseUrl) {
  if (installed) return;
  installed = true;
  apiBaseUrl = (baseUrl || "").replace(/\/+$/, "") || null;

  // React Native's global error handler
  const globalObj = global;
  if (globalObj && typeof globalObj.ErrorUtils?.getGlobalHandler === "function") {
    const prev = globalObj.ErrorUtils.getGlobalHandler();
    globalObj.ErrorUtils.setGlobalHandler((error, isFatal) => {
      reportError(error, { fatal: !!isFatal });
      if (prev) {
        try { prev(error, isFatal); } catch { /* noop */ }
      }
    });
  }

  // Unhandled promise rejections
  if (typeof globalObj?.addEventListener === "function") {
    try {
      globalObj.addEventListener("unhandledrejection", (event) => {
        reportError(event?.reason || "unhandledrejection");
      });
    } catch { /* noop */ }
  }
}
