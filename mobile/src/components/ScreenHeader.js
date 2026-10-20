// طير — Screen header with the branded banner background image.
// Mirrors the web's TairBanner styling. Use as the top bar for all main screens.
import React from "react";
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR_BANNER_IMAGE } from "../constants/tairDesign";

/**
 * A reusable branded screen header.
 *
 * Props:
 *   title          → screen title text
 *   subtitle       → optional secondary line
 *   onBack         → if set, shows a back button on the right (RTL)
 *   rightAction    → JSX rendered on the far left (RTL) e.g. an add button
 *   height         → optional (default 130)
 */
export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  height = 88,
}) {
  return (
    <ImageBackground
      source={{ uri: TAIR_BANNER_IMAGE }}
      style={[styles.banner, { height }]}
      imageStyle={styles.image}
    >
      <View style={styles.overlay} />
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity
            style={styles.circleBtn}
            onPress={onBack}
            data-testid="screen-header-back"
          >
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.circleSlot} />
        )}

        <View style={styles.center}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.circleSlot}>{rightAction}</View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    justifyContent: "flex-end",
  },
  image: {
    resizeMode: "cover",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 40,
    gap: 8,
  },
  circleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  circleSlot: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
});
