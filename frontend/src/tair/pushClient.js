// طير — Web Push (browser notifications, works even when tab is closed).
// Registers the service worker and subscribes the current user to Web Push.
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;
const SW_URL = "/tair-push-sw.js";

/** Convert a base64url VAPID key into the Uint8Array the Push API expects. */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerServiceWorker() {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register(SW_URL);
  } catch (e) {
    console.warn("[tair-push] SW register failed:", e);
    return null;
  }
}

/**
 * Prompt the user for permission and subscribe to Web Push.
 * @param {string} userId — the current Tair user id (guest or authenticated).
 * @returns {Promise<{ok: boolean, reason?: string, subscription?: any}>}
 */
export async function subscribeToPush(userId) {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "no_vapid_key" };
  if (!userId) return { ok: false, reason: "no_user_id" };

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, reason: "sw_failed" };

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return { ok: false, reason: "denied" };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (e) {
      console.warn("[tair-push] subscribe failed:", e);
      return { ok: false, reason: "subscribe_failed" };
    }
  }

  // Register with backend
  try {
    await axios.post(`${API}/webpush/subscribe`, sub.toJSON ? sub.toJSON() : sub, {
      params: { user_id: userId },
    });
  } catch (e) {
    console.warn("[tair-push] backend register failed:", e);
    return { ok: false, reason: "backend_failed", subscription: sub };
  }

  return { ok: true, subscription: sub };
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return { ok: false };
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!reg) return { ok: true };
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { ok: true };
  try {
    await axios.post(`${API}/webpush/unsubscribe`, null, { params: { endpoint: sub.endpoint } });
  } catch (_) { /* ignore backend cleanup failure */ }
  await sub.unsubscribe();
  return { ok: true };
}
