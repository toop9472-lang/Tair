// طير — بوّابة التنويه القانوني (Mobile)
// تطابق /app/frontend/src/tair/LegalDisclaimerGate.jsx تماماً
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Switch, Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TAIR_PALETTE, LEGAL_ACK_KEY } from "../constants/tairDesign";

export default function LegalDisclaimerGate({ children }) {
  const [ready, setReady] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [checkTerms, setCheckTerms] = useState(false);
  const [checkResp, setCheckResp] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(LEGAL_ACK_KEY);
        setAccepted(!!v);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) return null;
  if (accepted) return children;

  const canAccept = checkTerms && checkResp;

  const accept = async () => {
    await AsyncStorage.setItem(LEGAL_ACK_KEY, new Date().toISOString());
    setAccepted(true);
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.card}>
          <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
            <View style={s.iconRing}>
              <Text style={{ fontSize: 44 }}>⚠️</Text>
            </View>
            <Text style={s.title}>تنويه هام قبل البدء</Text>
            <Text style={s.subtitle}>يرجى قراءة النقاط التالية بعناية قبل استخدام منصة طير</Text>

            <View style={s.warnBox}>
              <Text style={s.warnText}>
                <Text style={{ fontWeight: "900" }}>منصة طير وسيط تقني فقط</Text> بين البائعين والمشترين والناقلين،
                ولا تتحمّل أي مسؤولية عن جودة الطيور، صحة المعلومات، أو تقصير المُعلنين أو الموصّلين{" "}
                <Text style={{ fontWeight: "900" }}>غير الموثّقين</Text>.
              </Text>
            </View>

            {[
              "تعامل فقط مع المستخدمين ذوي الشارة الزرقاء الموثّقة (KYC) للحصول على أعلى مستوى أمان.",
              "لا ترسل أي مبالغ مالية قبل التأكّد من هوية البائع/الناقل ورؤية الطائر مباشرة أو عبر فيديو حيّ.",
              "الاتفاق على السعر، طريقة الدفع، وشروط النقل يتم مباشرة بين الطرفين. طير لا تتدخل في تنفيذها.",
              "عند أي خلاف أو احتيال، أبلغنا فوراً من داخل الإعلان أو من صفحة الحساب.",
              "يُمنع بيع الحيوانات المهدّدة بالانقراض أو المخالفة لأنظمة الحياة الفطرية بالسعودية.",
            ].map((line, i) => (
              <View key={i} style={s.li}>
                <View style={s.dot} />
                <Text style={s.liText}>{line}</Text>
              </View>
            ))}

            <View style={s.checkRow}>
              <Switch
                value={checkTerms}
                onValueChange={setCheckTerms}
                trackColor={{ false: "#e2e8f0", true: TAIR_PALETTE.primary }}
                thumbColor="#fff"
              />
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setCheckTerms((v) => !v)}>
                <Text style={s.checkText}>
                  لقد قرأت وأوافق على{" "}
                  <Text style={s.link} onPress={() => Linking.openURL("https://saqr4u.com/terms")}>
                    الشروط
                  </Text>{" "}
                  و{" "}
                  <Text style={s.link} onPress={() => Linking.openURL("https://saqr4u.com/privacy")}>
                    الخصوصية
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>

            <View style={s.checkRow}>
              <Switch
                value={checkResp}
                onValueChange={setCheckResp}
                trackColor={{ false: "#e2e8f0", true: TAIR_PALETTE.primary }}
                thumbColor="#fff"
              />
              <TouchableOpacity style={{ flex: 1 }} onPress={() => setCheckResp((v) => !v)}>
                <Text style={s.checkText}>
                  أُدرك أنّ منصة طير <Text style={{ fontWeight: "900" }}>ليست مسؤولة</Text> عن أي خسائر أو
                  تقصير من المستخدمين غير الموثّقين، وأنّ التعامل يتمّ على مسؤوليتي.
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={accept}
              disabled={!canAccept}
              style={[s.accept, !canAccept && { opacity: 0.5 }]}
              testID="accept-legal-btn"
            >
              <Text style={s.acceptText}>موافق — ابدأ استخدام طير</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(15,36,28,0.72)",
    justifyContent: "center", padding: 16,
  },
  card: {
    backgroundColor: "#FFFDF8", borderRadius: 24, maxHeight: "92%",
    overflow: "hidden", borderWidth: 1, borderColor: "#E6DCC8",
  },
  body: { padding: 22 },
  iconRing: {
    width: 82, height: 82, borderRadius: 41,
    backgroundColor: "#F0EAD8", borderWidth: 3, borderColor: "#C6A15B",
    alignSelf: "center", marginBottom: 16,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: "900", textAlign: "center", color: "#0F241C" },
  subtitle: {
    fontSize: 13, color: "#6B5E4A", textAlign: "center",
    marginTop: 6, marginBottom: 18, fontWeight: "600",
  },
  warnBox: {
    backgroundColor: "#F0EAD8", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#C6A15B", marginBottom: 16,
  },
  warnText: { fontSize: 13, lineHeight: 22, color: "#8A6A2E", textAlign: "right", fontWeight: "600" },
  li: {
    flexDirection: "row-reverse", alignItems: "flex-start",
    borderBottomWidth: 1, borderBottomColor: "#E6DCC8",
    paddingVertical: 9, gap: 10,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: "#C6A15B", marginTop: 8,
  },
  liText: { flex: 1, fontSize: 13, lineHeight: 22, color: "#1B3D2F", textAlign: "right", fontWeight: "500" },
  checkRow: {
    flexDirection: "row-reverse", alignItems: "center",
    backgroundColor: "#F7F1E8", borderRadius: 12,
    padding: 12, marginTop: 12, gap: 10,
    borderWidth: 1, borderColor: "#E6DCC8",
  },
  checkText: { fontSize: 12.5, lineHeight: 20, color: "#1B3D2F", textAlign: "right", fontWeight: "600" },
  link: { color: "#C6A15B", fontWeight: "900", textDecorationLine: "underline" },
  accept: {
    marginTop: 18, backgroundColor: "#1B3D2F",
    borderRadius: 14, paddingVertical: 14, alignItems: "center",
  },
  acceptText: { color: "#C6A15B", fontWeight: "900", fontSize: 15 },
});
