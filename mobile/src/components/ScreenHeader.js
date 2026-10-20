// طير — Screen header. عنوان هادئ فوق تدرّج زمردي حتى تبقى الشاشات الداخلية من نفس العائلة.
import React from "react";
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { TAIR_BANNER_IMAGE } from "../constants/tairDesign";
import { TAIR } from "../constants/tairTheme";
import { PressableScale } from "./TairUI";

export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  height = 108,
}) {
  return (
    <ImageBackground
      source={{ uri: TAIR_BANNER_IMAGE }}
      style={[styles.banner, { height }]}
      imageStyle={styles.image}
    >
      <LinearGradient
        colors={["rgba(15,36,28,0.28)", "rgba(27,61,47,0.88)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        {onBack ? (
          <PressableScale
            style={styles.circleBtn}
            onPress={onBack}
            haptic
            scaleTo={0.94}
            testID="screen-header-back"
          >
            <Ionicons name="arrow-forward" size={20} color={TAIR.gold} />
          </PressableScale>
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
  image: { resizeMode: "cover" },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: Platform.OS === "ios" ? 48 : 28,
    gap: 8,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,253,248,0.14)",
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  circleSlot: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center" },
  title: {
    color: TAIR.gold,
    fontSize: 17,
    fontWeight: "800",
  },
  subtitle: {
    color: "rgba(247,241,232,0.82)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
});
