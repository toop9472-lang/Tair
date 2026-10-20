// طير — Push notifications & price alerts helpers
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { storefrontApi } from "./tairApi";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(userId) {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;
  try {
    const t = await Notifications.getExpoPushTokenAsync({
      projectId: "2a08ac90-1772-4377-bf99-af5d2357db30",
    });
    const token = t?.data;
    if (token && userId) {
      await storefrontApi
        .registerPushToken(userId, token, Platform.OS)
        .catch(() => null);
    }
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1B3D2F",
      });
    }
    return token;
  } catch (e) {
    console.warn("Push register failed", e?.message || e);
    return null;
  }
}
