/**
 * TairBottomBar — شريط سفلي هادئ.
 * الترتيب RTL: السوق | الرحلات | العيادة | المجتمع | حسابي
 * النشط: كبسولة كريمية + أيقونة زمردية + نقطة ذهبية.
 */
import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR, TAIR_ELEVATION } from "../constants/tairTheme";
import { PressableScale } from "./TairUI";

const TABS = [
  { key: "account",   label: "حسابي",   iconOn: "person",              iconOff: "person-outline" },
  { key: "community", label: "المجتمع", iconOn: "people",              iconOff: "people-outline" },
  { key: "clinic",    label: "العيادة", iconOn: "medkit",              iconOff: "medkit-outline" },
  { key: "trips",     label: "الرحلات", iconOn: "airplane",            iconOff: "airplane-outline" },
  { key: "market",    label: "السوق",   iconOn: "storefront",          iconOff: "storefront-outline" },
];

export default function TairBottomBar({ active = "market", onChange, testID }) {
  return (
    <View style={styles.wrap} testID={testID || "tair-tabbar"}>
      <View style={styles.inner}>
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <PressableScale
              key={t.key}
              onPress={() => onChange?.(t.key)}
              haptic
              scaleTo={0.96}
              style={styles.item}
              testID={`tab-${t.key}`}
            >
              <View style={[styles.pill, isActive && styles.pillActive]}>
                <Ionicons
                  name={isActive ? t.iconOn : t.iconOff}
                  size={20}
                  color={isActive ? TAIR.emerald : TAIR.faint}
                />
                <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
                  {t.label}
                </Text>
              </View>
              <View style={[styles.dot, isActive && styles.dotOn]} />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: Platform.OS === "ios" ? 16 : 8,
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: TAIR.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(198,161,91,0.45)",
    ...TAIR_ELEVATION.raised,
  },
  inner: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  item: {
    flex: 1,
    alignItems: "center",
  },
  pill: {
    minWidth: 58,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 16,
  },
  pillActive: {
    backgroundColor: TAIR.emeraldWash,
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.75)",
  },
  label: {
    fontSize: 11,
    color: TAIR.faint,
    fontWeight: "700",
    marginTop: 2,
  },
  labelActive: {
    color: TAIR.emerald,
    fontWeight: "800",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 4,
    backgroundColor: "transparent",
  },
  dotOn: {
    backgroundColor: TAIR.gold,
  },
});
