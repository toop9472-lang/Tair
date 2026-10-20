/**
 * TairHeader (Mobile) — هدر متوازن:
 *  - يسار: زر "اسأل" الدائري (للمساعدة/الأسئلة)
 *  - يمين: زر الجرس الدائري (الإشعارات)
 *  - وسط: صورة الهدر (طير + الشاشة)
 *  - أسفل: تدرّج تلاشي إلى الخلفية الكريمية
 */
import React from "react";
import { View, Image, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { TAIR, TAIR_ELEVATION, TAIR_HEADERS } from "../constants/tairTheme";

export default function TairHeader({
  variant = "market",
  onBellPress,
  onAskPress,
  onMessagesPress,
  hasUnread = false,
  hasUnreadMsgs = false,
  testID,
}) {
  const source = TAIR_HEADERS[variant] || TAIR_HEADERS.market;
  return (
    <View style={styles.wrap} testID={testID || `tair-header-${variant}`}>
      <Image source={source} style={styles.img} resizeMode="contain" />

      {/* تدرّج تلاشي إلى الخلفية الكريمية */}
      <LinearGradient
        colors={["transparent", TAIR.bg]}
        style={styles.fade}
        pointerEvents="none"
      />

      {/* زر "اسأل" — يسار */}
      {onAskPress ? (
        <TouchableOpacity
          onPress={onAskPress}
          activeOpacity={0.7}
          style={styles.askBtn}
          hitSlop={8}
          testID="header-ask"
        >
          <Ionicons name="help-circle-outline" size={22} color={TAIR.emerald} />
        </TouchableOpacity>
      ) : null}

      {/* زر الجرس (الإشعارات) — يسار الهيدر */}
      <TouchableOpacity
        onPress={onBellPress}
        activeOpacity={0.7}
        style={styles.bellHit}
        hitSlop={8}
        testID="header-bell"
      >
        <Ionicons name="notifications" size={22} color={TAIR.gold} />
        {hasUnread ? <View style={styles.unreadDot} /> : null}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    aspectRatio: 1.486,
    backgroundColor: TAIR.bg,
    position: "relative",
    overflow: "hidden",
    alignSelf: "stretch",
  },
  img: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    width: "100%",
    height: "100%",
  },
  fade: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    height: "22%",
  },
  titleOverlay: {
    position: "absolute",
    top: "8%",
    left: 0, right: 0,
    alignItems: "center",
    zIndex: 4,
  },
  titleBg: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(27,61,47,0.92)",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: TAIR.gold,
    shadowColor: "#000",
    shadowOpacity: 0.2, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  titleText: {
    color: TAIR.gold,
    fontSize: 16,
    fontWeight: "900",
  },
  askBtn: {
    position: "absolute",
    top: "38%",
    left: "5%",
    width: "16%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: TAIR.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.55)",
    ...TAIR_ELEVATION.card,
  },
  /* زر الرسائل — يُغطي الجرس المرسوم بالكامل على اليمين */
  msgBtn: {
    position: "absolute",
    top: "48%",
    right: "4.5%",
    width: "18%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: TAIR.emerald,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: TAIR.gold,
    shadowColor: "#000",
    shadowOpacity: 0.22, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
    zIndex: 10,
  },
  /* نقطة إشعار على زر الرسائل */
  unreadDotSmall: {
    position: "absolute",
    top: "10%", right: "10%",
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: "#C4493A",
    borderWidth: 2, borderColor: TAIR.emerald,
  },
  /* الجرس — صغير على اليسار ليبقى واضحاً مع الرسائل على اليمين */
  bellHit: {
    position: "absolute",
    top: "48%",
    left: "4.5%",
    width: "14%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: "rgba(15,36,28,0.88)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: TAIR.gold,
    zIndex: 10,
    ...TAIR_ELEVATION.raised,
  },
  unreadDot: {
    position: "absolute",
    top: "10%",
    right: "10%",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#C4493A",
    borderWidth: 2,
    borderColor: TAIR.emerald,
  },
});
