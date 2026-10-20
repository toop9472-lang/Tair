/**
 * MessagesFab — زر عائم صغير للرسائل الخاصة
 * - أسفل يمين الشاشة، فوق شريط التنقل مباشرة
 * - نقطة حمراء عند وجود رسائل غير مقروءة
 */
import React, { useEffect, useRef, useState } from "react";
import { TouchableOpacity, View, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TAIR } from "../constants/tairTheme";
import api from "../services/api";

const POLL_MS = 20000;

export default function MessagesFab({ user, onPress, testID }) {
  const [unread, setUnread] = useState(false);
  const timerRef = useRef(null);

  const check = async () => {
    try {
      const uid = user?.user_id || user?.id || user?.email;
      if (!uid) {
        setUnread(false);
        return;
      }
      const token = await AsyncStorage.getItem("saqr_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await api.fetch(`/api/social/messages/unread-count/${encodeURIComponent(uid)}`, { headers });
      if (!r?.ok) {
        setUnread(false);
        return;
      }
      const j = await r.json().catch(() => null);
      const count = Number(j?.count) || 0;
      setUnread(count > 0);
    } catch {
      setUnread(false);
    }
  };

  useEffect(() => {
    check();
    timerRef.current = setInterval(check, POLL_MS);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id, user?.id, user?.email]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.fab}
      hitSlop={10}
      testID={testID || "messages-fab"}
    >
      <Ionicons name="chatbubbles" size={18} color={TAIR.gold} />
      {unread ? <View style={styles.dot} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 14,
    bottom: Platform.OS === "ios" ? 92 : 82,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: TAIR.emerald,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: TAIR.gold,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 50,
  },
  dot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#C4493A",
    borderWidth: 1.5,
    borderColor: TAIR.emerald,
  },
});
