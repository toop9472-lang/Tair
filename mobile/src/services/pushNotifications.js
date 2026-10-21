// طير — Native push notifications via Expo Push service.
//
// This module:
//  1. Requests permission (iOS + Android) to show notifications
//  2. Fetches the Expo push token for the device
//  3. Sends the token to our backend so the server can push to this user
//  4. Sets up foreground notification handling and tap navigation hooks
//
// No Firebase / APNS credentials are needed — Expo Push service handles
// delivery to both platforms. See /app/backend/routes/mobile_push_routes.py

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

const APP_VERSION =
  Constants?.expoConfig?.version ||
  Constants?.manifest?.version ||
  "unknown";

let registeredFor = null;
let currentToken = null;
let apiBaseUrl = null;

// Foreground notification behavior: show alert + play sound + badge
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "الإشعارات",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1B3D2F",
      sound: "default",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
    });
  } catch (e) {
    // ignore
  }
}

async function requestPermission() {
  try {
    const settings = await Notifications.getPermissionsAsync();
    let status = settings.status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      status = req.status;
    }
    return status === "granted";
  } catch (e) {
    return false;
  }
}

async function fetchExpoToken() {
  try {
    // Expo's EAS projectId is required for tokens on EAS builds.
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      undefined;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenResp?.data || null;
  } catch (e) {
    return null;
  }
}

async function sendTokenToBackend({ token, userId }) {
  if (!apiBaseUrl || !token) return false;
  try {
    const r = await fetch(`${apiBaseUrl}/api/mobile/push/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        user_id: userId || "guest",
        platform: Platform.OS,
        app_version: APP_VERSION,
      }),
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Call once on app boot (after user is loaded). Silent no-op on failure or in
 * simulators / Expo Go for iOS where remote push isn't supported.
 * @param {{ apiUrl: string, userId?: string }} opts
 */
export async function initPushNotifications({ apiUrl, userId }) {
  apiBaseUrl = (apiUrl || "").replace(/\/+$/, "") || null;
  if (!Device.isDevice) return null;

  await ensureAndroidChannel();
  const granted = await requestPermission();
  if (!granted) return null;

  if (!currentToken) {
    currentToken = await fetchExpoToken();
  }
  if (!currentToken) return null;

  const owner = userId || "guest";
  if (registeredFor === owner) return currentToken;
  const saved = await sendTokenToBackend({ token: currentToken, userId: owner });
  if (saved) registeredFor = owner;
  return currentToken;
}

/** Re-register the current token under a new user id (e.g. after login). */
export async function bindPushToUser(userId) {
  if (!currentToken) return;
  await sendTokenToBackend({ token: currentToken, userId });
}

/** Remove the current device's token from the backend (e.g. on logout). */
export async function unregisterPushToken() {
  if (!apiBaseUrl || !currentToken) return;
  try {
    await fetch(`${apiBaseUrl}/api/mobile/push/unregister`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: currentToken }),
    });
  } catch (e) {
    // ignore
  }
  currentToken = null;
  registeredFor = null;
}

/**
 * Hook for handling notification taps. Pass a callback that receives the
 * notification data payload so the app can navigate to the right screen.
 * Returns an unsubscribe function.
 */
export function onNotificationTap(cb) {
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    try {
      const data = resp?.notification?.request?.content?.data || {};
      cb(data);
    } catch (e) {
      // ignore
    }
  });
  return () => {
    try { sub.remove(); } catch (e) { /* noop */ }
  };
}
