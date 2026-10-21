// طير — طلب تنبيه في الحساب: طائر، وسعر أقصى اختياري.
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import { PressableScale, EmptyState } from "../components/TairUI";
import { TAIR, TAIR_ELEVATION, toArabicNumerals } from "../constants/tairTheme";
import { listingWatchApi } from "../services/tairApi";

function money(value) {
  if (value == null || value === "") return "أي سعر";
  return `حتى ${toArabicNumerals(value)} ر.س`;
}

export default function ListingWatchScreen({ user, onBack }) {
  const uid = user?.user_id || user?.id || user?.email;
  const [items, setItems] = useState([]);
  const [bird, setBird] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listingWatchApi.list(uid);
      setItems(data?.items || []);
    } catch (e) {
      Alert.alert("تعذّر التحميل", e?.message || "حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (bird.trim().length < 2) {
      Alert.alert("اسم الطائر", "اكتب الطائر الذي تنتظره، مثل كاسكو");
      return;
    }
    setSaving(true);
    try {
      await listingWatchApi.create(uid, { bird: bird.trim(), max_price: price.trim(), active: true });
      setBird("");
      setPrice("");
      await load();
    } catch (e) {
      Alert.alert("لم يُحفظ الطلب", e?.message || "حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item, active) => {
    setItems((prev) => prev.map((row) => (row.watch_id === item.watch_id ? { ...row, active } : row)));
    try {
      await listingWatchApi.update(uid, item.watch_id, { active });
    } catch (e) {
      Alert.alert("تعذّر التعديل", e?.message || "حاول مرة أخرى");
      load();
    }
  };

  const remove = (item) => {
    Alert.alert("حذف الطلب", `يتوقف التنبيه عن ${item.bird}`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await listingWatchApi.remove(uid, item.watch_id);
            setItems((prev) => prev.filter((row) => row.watch_id !== item.watch_id));
          } catch (e) {
            Alert.alert("تعذّر الحذف", e?.message || "حاول مرة أخرى");
          }
        },
      },
    ]);
  };

  return (
    <View style={s.page} testID="listing-watch-screen">
      <ScreenHeader
        title="تنبيه الإعلانات"
        subtitle="إشعار على الشاشة عندما ينزل إعلان يطابق طلبك"
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.form}>
          <Text style={s.label}>الطائر</Text>
          <TextInput
            value={bird}
            onChangeText={setBird}
            placeholder="مثال: كاسكو"
            placeholderTextColor={TAIR.faint}
            style={s.input}
            textAlign="right"
            testID="watch-bird"
          />
          <Text style={s.label}>السعر الأقصى</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="اختياري، مثال: ٥٠٠"
            placeholderTextColor={TAIR.faint}
            style={s.input}
            textAlign="right"
            keyboardType="number-pad"
            testID="watch-price"
          />
          <PressableScale onPress={create} disabled={saving} style={s.save} testID="watch-save">
            {saving ? <ActivityIndicator color={TAIR.gold} /> : <Text style={s.saveText}>فعّل الطلب</Text>}
          </PressableScale>
        </View>

        {loading ? <ActivityIndicator color={TAIR.emerald} style={{ marginTop: 24 }} /> : null}
        {!loading && items.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title="لا طلبات بعد"
            subtitle="اكتب الطائر، وحدد سعراً أقصى إن رغبت. يبقى الطلب فعّالاً حتى توقفه."
            testID="watch-empty"
          />
        ) : null}
        {items.map((item) => (
          <View key={item.watch_id} style={s.card} testID={`watch-${item.watch_id}`}>
            <View style={{ flex: 1 }}>
              <Text style={s.bird}>{item.bird}</Text>
              <Text style={s.meta}>{money(item.max_price)} · {item.active ? "فعّال" : "متوقف"}</Text>
            </View>
            <Switch
              value={!!item.active}
              onValueChange={(next) => toggle(item, next)}
              trackColor={{ false: TAIR.divider, true: TAIR.emeraldSoft }}
              thumbColor={item.active ? TAIR.gold : "#fff"}
              testID={`watch-active-${item.watch_id}`}
            />
            <PressableScale onPress={() => remove(item)} hitSlop={8} testID={`watch-delete-${item.watch_id}`}>
              <Ionicons name="trash-outline" size={18} color={TAIR.error} />
            </PressableScale>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },
  content: { padding: 16, paddingBottom: 40 },
  form: {
    backgroundColor: TAIR.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: TAIR.line,
    ...TAIR_ELEVATION.card,
  },
  label: { color: TAIR.emerald, fontSize: 13, fontWeight: "800", textAlign: "right", marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: TAIR.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TAIR.divider,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: TAIR.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  save: {
    marginTop: 14,
    backgroundColor: TAIR.emerald,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: TAIR.gold,
  },
  saveText: { color: TAIR.gold, fontSize: 15, fontWeight: "900" },
  card: {
    marginTop: 12,
    backgroundColor: TAIR.card,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: TAIR.line,
  },
  bird: { color: TAIR.ink, fontSize: 16, fontWeight: "800", textAlign: "right" },
  meta: { color: TAIR.muted, fontSize: 12, fontWeight: "700", textAlign: "right", marginTop: 3 },
});
