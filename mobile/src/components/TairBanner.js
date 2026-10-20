// طير — Unified banner header (Mobile). Matches /app/frontend/src/tair/TairBanner.jsx
import React from "react";
import { View, ImageBackground, StyleSheet, TouchableOpacity } from "react-native";
import { TAIR_BANNER_IMAGE, TAIR_PALETTE } from "../constants/tairDesign";

export function TairBanner({ leftSlot, rightSlot, tall = false }) {
  return (
    <ImageBackground
      source={{ uri: TAIR_BANNER_IMAGE }}
      style={[s.banner, tall && s.bannerTall]}
      imageStyle={{ resizeMode: "cover" }}
    >
      <View style={s.row}>
        <View style={[s.slot, tall && { minWidth: 42, width: "auto" }]}>{rightSlot}</View>
        <View style={{ flex: 1, minHeight: 42 }} />
        <View style={s.slot}>{leftSlot}</View>
      </View>
    </ImageBackground>
  );
}

export function BannerCircleButton({ icon, onPress, badge, testID }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.circleBtn} testID={testID}>
      {icon}
      {badge > 0 && (
        <View style={s.badge}>
          {/* eslint-disable-next-line react-native/no-inline-styles */}
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  banner: {
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14,
    backgroundColor: TAIR_PALETTE.primary,
    borderBottomWidth: 2, borderBottomColor: "rgba(255,255,255,0.15)",
  },
  bannerTall: {
    minHeight: 120,
    paddingTop: 32,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: TAIR_PALETTE.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.20,
    shadowRadius: 12,
    elevation: 4,
  },
  row: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    gap: 12,
  },
  slot: { width: 42, alignItems: "center", justifyContent: "center" },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute", top: 6, right: 6,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#ef4444",
  },
});
