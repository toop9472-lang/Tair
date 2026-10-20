/**
 * ورقة المشاركة داخل التطبيق، ثم ورقة النظام عبر Share API.
 */
import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR, TAIR_ELEVATION } from "../constants/tairTheme";
import { PressableScale } from "./TairUI";
import { bindShareSheet, nativeShare } from "../services/shareContent";

const KIND_LABEL = {
  listing: "إعلان",
  auction: "مزاد",
  story: "قصة",
  trip: "رحلة",
  store: "متجر",
};

export default function TairShareSheet() {
  const [payload, setPayload] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => bindShareSheet(setPayload), []);

  const close = () => {
    if (busy) return;
    setPayload(null);
  };

  const confirm = async () => {
    if (!payload || busy) return;
    setBusy(true);
    try {
      await nativeShare(payload);
    } finally {
      setBusy(false);
      setPayload(null);
    }
  };

  return (
    <Modal visible={!!payload} transparent animationType="fade" onRequestClose={close}>
      <View style={s.wrap}>
        <TouchableWithoutFeedback onPress={close}>
          <View style={s.backdrop} />
        </TouchableWithoutFeedback>
        {payload ? (
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.brand}>مشاركة من طير</Text>
            <View style={s.kindRow}>
              <View style={s.kindPill}>
                <Text style={s.kind}>{KIND_LABEL[payload.kind] || "محتوى"}</Text>
              </View>
            </View>
            <Text style={s.title}>{payload.title}</Text>
            {payload.lines.map((line) => (
              <Text key={line} style={s.line}>{line}</Text>
            ))}
            <View style={s.linkRow}>
              <Ionicons name="phone-portrait-outline" size={16} color={TAIR.goldDark} />
              <Text style={s.linkText}>يفتح داخل التطبيق عند المستلم</Text>
            </View>
            <PressableScale onPress={confirm} haptic disabled={busy} scaleTo={0.98} style={s.primary} testID="share-confirm">
              <Ionicons name="share-social" size={18} color={TAIR.gold} />
              <Text style={s.primaryText}>{busy ? "جارٍ الفتح…" : "مشاركة الآن"}</Text>
            </PressableScale>
            <PressableScale onPress={close} scaleTo={0.98} style={s.ghost} testID="share-cancel">
              <Text style={s.ghostText}>إلغاء</Text>
            </PressableScale>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,36,28,0.46)" },
  sheet: {
    backgroundColor: TAIR.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: "rgba(198,161,91,0.45)",
    ...TAIR_ELEVATION.raised,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: TAIR.gold,
    opacity: 0.75,
    marginBottom: 14,
  },
  brand: { color: TAIR.goldDark, fontSize: 12, fontWeight: "900", textAlign: "center" },
  kindRow: { alignItems: "center", marginTop: 8 },
  kindPill: {
    backgroundColor: TAIR.goldWash,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  kind: { color: TAIR.emerald, fontSize: 11, fontWeight: "900" },
  title: { color: TAIR.ink, fontSize: 18, fontWeight: "900", textAlign: "center", marginTop: 12 },
  line: { color: TAIR.muted, fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 4 },
  linkRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    marginBottom: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: TAIR.bg,
  },
  linkText: { color: TAIR.emerald, fontSize: 12, fontWeight: "800" },
  primary: {
    height: 52,
    borderRadius: 16,
    backgroundColor: TAIR.emerald,
    borderWidth: 1,
    borderColor: TAIR.gold,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: TAIR.gold, fontWeight: "900", fontSize: 15 },
  ghost: {
    height: 44,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { color: TAIR.muted, fontWeight: "800", fontSize: 14 },
});
