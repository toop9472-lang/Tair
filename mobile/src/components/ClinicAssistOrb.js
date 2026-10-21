// أيقونة مساعد المشرف: دائرة تُسحب وتلتصق بأطراف الصفحة.
import React, { useEffect, useRef, useState } from "react";
import { Dimensions, PanResponder, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo-vector-icons";

const KEY = "saqr_clinic_assist_pos";
const SIZE = 58;

function clamp(x, y, bottomInset, snap) {
  const { width, height } = Dimensions.get("window");
  const minX = 10;
  const maxX = Math.max(minX, width - SIZE - 10);
  const minY = 108;
  const maxY = Math.max(minY, height - bottomInset - SIZE);
  let nx = Math.min(maxX, Math.max(minX, x));
  const ny = Math.min(maxY, Math.max(minY, y));
  if (snap) nx = nx + SIZE / 2 < width / 2 ? minX : maxX;
  return { x: nx, y: ny };
}

export default function ClinicAssistOrb({ badge = 0, onPress, bottomInset = 128 }) {
  const [pos, setPos] = useState(() => {
    const { height } = Dimensions.get("window");
    return { x: 10, y: Math.max(140, height - bottomInset - SIZE - 36) };
  });
  const start = useRef(pos);
  const moved = useRef(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY).then((raw) => {
      if (!alive || !raw) return;
      try {
        const saved = JSON.parse(raw);
        if (!Number.isFinite(saved?.x) || !Number.isFinite(saved?.y)) return;
        const next = clamp(saved.x, saved.y, bottomInset, true);
        start.current = next;
        setPos(next);
      } catch { /* الموضع الافتراضي يبقى */ }
    }).catch(() => {});
    return () => { alive = false; };
  }, [bottomInset]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 3,
    onPanResponderGrant: () => { moved.current = false; },
    onPanResponderMove: (_, g) => {
      if (Math.abs(g.dx) + Math.abs(g.dy) > 8) moved.current = true;
      setPos(clamp(start.current.x + g.dx, start.current.y + g.dy, bottomInset, false));
    },
    onPanResponderRelease: (_, g) => {
      const next = clamp(start.current.x + g.dx, start.current.y + g.dy, bottomInset, true);
      start.current = next;
      setPos(next);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      if (!moved.current) onPress?.();
    },
    onPanResponderTerminate: () => {
      setPos(start.current);
    },
  })).current;

  return (
    <View
      style={[styles.orb, { left: pos.x, top: pos.y }]}
      {...pan.panHandlers}
      testID="ai-assist-btn"
    >
      <Ionicons name="sparkles" size={24} color="#C6A15B" />
      {badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? "9+" : String(badge)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: "#1B3D2F",
    borderWidth: 3,
    borderColor: "#C6A15B",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
    elevation: 12,
    shadowColor: "#0F241C",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  badge: {
    position: "absolute",
    top: -2,
    left: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: "#8B2E24",
    borderWidth: 2,
    borderColor: "#1B3D2F",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
});
