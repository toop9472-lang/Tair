/**
 * يُجبر الحساب الجديد على اختيار اسم ظاهر غير «ضيف طير» وغير مكرر.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR, TAIR_ELEVATION } from "../constants/tairTheme";
import { PressableScale } from "./TairUI";
import api from "../services/api";

export function needsDisplayName(user) {
  if (!user) return false;
  if (user.needs_name_setup) return true;
  const name = String(user.name || "").trim();
  if (!name) return true;
  const folded = name.toLowerCase();
  if (["ضيف طير", "ضيف", "guest", "مستخدم", "مستخدم apple", "مستخدم google", "صديق صقر"].includes(folded)) return true;
  if (folded.startsWith("صديق صقر") || folded.startsWith("guest")) return true;
  return false;
}

export default function NameGate({ user, onSaved }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const next = name.trim().replace(/\s+/g, " ");
    if (next.length < 2) {
      setError("اكتب حرفين على الأقل");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const uid = user?.user_id || user?.id;
      const res = await api.fetch(`/api/users/claim-name?user_id=${encodeURIComponent(uid || "")}`, {
        method: "POST",
        body: JSON.stringify({ name: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = data?.detail;
        setError(typeof detail === "string" ? detail : "تعذّر حفظ الاسم");
        return;
      }
      onSaved?.({ name: data?.name || next, needs_name_setup: false });
    } catch (e) {
      setError(e?.message || "تحقق من الاتصال ثم أعد المحاولة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.card}>
        <View style={s.mark}>
          <Ionicons name="person" size={22} color={TAIR.gold} />
        </View>
        <Text style={s.title}>اختر اسمك في طير</Text>
        <Text style={s.sub}>لن يظهر «ضيف طير». الاسم يظهر في السوق والرحلات والدردشة، ولا يتكرر.</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="مثال: أبو فهد"
          placeholderTextColor={TAIR.faint}
          style={s.input}
          textAlign="right"
          maxLength={24}
          autoFocus
          testID="name-gate-input"
        />
        {error ? <Text style={s.err}>{error}</Text> : null}
        <PressableScale onPress={save} disabled={busy} haptic style={s.btn} testID="name-gate-save">
          {busy ? <ActivityIndicator color={TAIR.gold} /> : <Text style={s.btnText}>حفظ الاسم</Text>}
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,36,28,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 80,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: TAIR.card,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.55)",
    ...TAIR_ELEVATION.raised,
  },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: TAIR.emerald,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  title: { color: TAIR.emerald, fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 12 },
  sub: { color: TAIR.muted, fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 20, marginTop: 6 },
  input: {
    marginTop: 16,
    backgroundColor: TAIR.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TAIR.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: TAIR.ink,
    fontWeight: "800",
  },
  err: { color: TAIR.error, fontSize: 12, fontWeight: "800", textAlign: "right", marginTop: 8 },
  btn: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: TAIR.emerald,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: TAIR.gold, fontWeight: "900", fontSize: 16 },
});
