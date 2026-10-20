/**
 * TairBottomBar — شريط سفلي هادئ ورفيع بأيقونات ممتلئة عند النشاط
 * الترتيب RTL: السوق | الرحلات | الرسائل | المجتمع | حسابي
 * - النشط: أيقونة ذهبية ممتلئة + نقطة تحت + نص بارز
 * - غير النشط: أيقونة outline زمرد فاتح + نص خفيف
 * - شفاف يندمج مع الخلفية بلا حواف حادة
 */
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR } from "../constants/tairTheme";

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
            <TouchableOpacity
              key={t.key}
              onPress={() => onChange?.(t.key)}
              activeOpacity={0.7}
              style={styles.item}
              testID={`tab-${t.key}`}
            >
              <View style={styles.iconWrap}>
                <Ionicons
                  name={isActive ? t.iconOn : t.iconOff}
                  size={20}
                  color={isActive ? TAIR.emerald : "#8A7E67"}
                />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {t.label}
              </Text>
              {isActive ? <View style={styles.activeDot} /> : <View style={styles.activeDotHidden} />}
            </TouchableOpacity>
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
    paddingBottom: Platform.OS === "ios" ? 14 : 6,
    paddingTop: 2,
    backgroundColor: TAIR.bg,
    // خط ذهبي رفيع بلا ثقل
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TAIR.gold + "55",
  },
  inner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10,
    color: "#8A7E67",
    fontWeight: "700",
    marginTop: 0,
  },
  labelActive: {
    color: TAIR.emerald,
    fontWeight: "900",
  },
  activeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: TAIR.gold,
    marginTop: 2,
  },
  activeDotHidden: {
    width: 3, height: 3, marginTop: 2,
    backgroundColor: "transparent",
  },
});
