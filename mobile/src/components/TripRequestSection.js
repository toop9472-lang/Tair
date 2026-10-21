// طلب رحلة — نموذج وإدارة الحالة
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { tripsApi, profileApi } from "../services/tairApi";
import { CityTriggerButton, CitySelectorSheet } from "./CitySelectorSheet";
import { TAIR } from "../constants/tairTheme";
import { EmptyState, ErrorState } from "./TairUI";
import { displayLocalPhone, openWhatsApp, savedContactPhone } from "../utils/contactPhone";
import { REQUEST_STATUS } from "../utils/tripStatus";

function dayOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const DATE_CHIPS = [
  { id: "today", label: "اليوم", offset: 0 },
  { id: "tomorrow", label: "غداً", offset: 1 },
  { id: "after", label: "بعد غد", offset: 2 },
];

function RequestCard({ item, userId, onAction }) {
  const tone = REQUEST_STATUS[item.status] || REQUEST_STATUS.pending;
  const mine = item.requester_id === userId;
  const carrier = item.accepted_by === userId;
  const phone = item.contact_phone;
  return (
    <View style={styles.card} testID={`trip-request-${item.request_id}`}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.route}>
            {item.from_city}  ←  {item.to_city}
          </Text>
          <Text style={styles.meta}>
            {item.depart_on} · {item.requester_name || "عضو طير"}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.pillText, { color: tone.fg }]}>{tone.label}</Text>
        </View>
      </View>
      {item.details ? (
        <Text style={styles.details} numberOfLines={3}>{item.details}</Text>
      ) : null}
      {item.accepted_name && item.status !== "pending" ? (
        <Text style={styles.meta}>الموصل: {item.accepted_name}</Text>
      ) : null}
      <View style={styles.actions}>
        {phone && !mine ? (
          <TouchableOpacity
            style={[styles.action, { backgroundColor: "#25D366" }]}
            onPress={() =>
              openWhatsApp(
                phone,
                `السلام عليكم، بخصوص طلب الرحلة من ${item.from_city} إلى ${item.to_city}`,
              )
            }
            testID={`trip-request-wa-${item.request_id}`}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#fff" />
            <Text style={styles.actionText}>واتساب</Text>
          </TouchableOpacity>
        ) : null}
        {item.status === "pending" && !mine ? (
          <TouchableOpacity
            style={[styles.action, { backgroundColor: TAIR.emerald }]}
            onPress={() => onAction(item, "accepted")}
            testID={`trip-request-accept-${item.request_id}`}
          >
            <Text style={[styles.actionText, { color: TAIR.gold }]}>أقبل الطلب</Text>
          </TouchableOpacity>
        ) : null}
        {carrier && item.status === "accepted" ? (
          <TouchableOpacity
            style={[styles.action, { backgroundColor: TAIR.emerald }]}
            onPress={() => onAction(item, "in_progress")}
          >
            <Text style={[styles.actionText, { color: TAIR.gold }]}>بدأت الرحلة</Text>
          </TouchableOpacity>
        ) : null}
        {carrier && item.status === "in_progress" ? (
          <TouchableOpacity
            style={[styles.action, { backgroundColor: TAIR.emerald }]}
            onPress={() => onAction(item, "completed")}
          >
            <Text style={[styles.actionText, { color: TAIR.gold }]}>اكتملت</Text>
          </TouchableOpacity>
        ) : null}
        {(mine || carrier) && item.status !== "completed" && item.status !== "cancelled" ? (
          <TouchableOpacity
            style={[styles.action, { backgroundColor: TAIR.creamDeep }]}
            onPress={() => onAction(item, "cancelled")}
          >
            <Text style={[styles.actionText, { color: TAIR.error }]}>إلغاء</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default function TripRequestSection({ user, refreshKey = 0 }) {
  const userId = user?.user_id || user?.id;
  const [fromCity, setFromCity] = useState("الرياض");
  const [toCity, setToCity] = useState("جدة");
  const [departOn, setDepartOn] = useState(dayOffset(1));
  const [details, setDetails] = useState("");
  const [phone, setPhone] = useState("");
  const [citySheet, setCitySheet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [mine, setMine] = useState([]);
  const [board, setBoard] = useState([]);

  useEffect(() => {
    const saved = savedContactPhone(user);
    if (saved) setPhone((prev) => prev || displayLocalPhone(saved));
  }, [user]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const open = await tripsApi.listRequests({ scope: "board", limit: 30 });
      let own = { items: [] };
      if (userId) own = await tripsApi.listRequests({ scope: "mine", user_id: userId, limit: 20 });
      setBoard(open.items || []);
      setMine(own.items || []);
      setLoadError(null);
    } catch (e) {
      setLoadError(e?.message || "تعذّر تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const submit = async () => {
    if (!userId) {
      Alert.alert("تنبيه", "سجّل الدخول لإرسال طلب الرحلة");
      return;
    }
    if (fromCity === toCity) {
      Alert.alert("تنبيه", "المدينتان يجب أن تكونا مختلفتين");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(departOn.trim())) {
      Alert.alert("تنبيه", "اكتب التاريخ بصيغة 2026-10-25");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("تنبيه", "أضف رقم واتساب ليتواصل معك الموصل");
      return;
    }
    try {
      setSaving(true);
      await tripsApi.createRequest(userId, {
        from_city: fromCity,
        to_city: toCity,
        depart_on: departOn.trim(),
        details: details.trim() || null,
        contact_phone: phone.trim(),
        requester_name: user?.name || null,
      });
      profileApi.update(userId, { whatsapp: phone.trim() }).catch(() => {});
      setDetails("");
      Alert.alert("تم", "وصل طلبك. يظهر للموصلين بانتظار القبول.");
      setLoading(true);
      await load();
    } catch (e) {
      Alert.alert("خطأ", e?.message || "تعذّر إرسال الطلب");
    } finally {
      setSaving(false);
    }
  };

  const onAction = (item, status) => {
    const labels = {
      accepted: "قبول هذا الطلب؟",
      in_progress: "تحديث الحالة إلى: في الطريق؟",
      completed: "تعليم الطلب كمكتمل؟",
      cancelled: "إلغاء الطلب؟",
    };
    Alert.alert("تحديث الطلب", labels[status] || "تأكيد", [
      { text: "لا", style: "cancel" },
      {
        text: "نعم",
        onPress: async () => {
          try {
            await tripsApi.updateRequestStatus(item.request_id, userId, status);
            setLoading(true);
            await load();
          } catch (e) {
            Alert.alert("خطأ", e?.message || "تعذّر تحديث الحالة");
          }
        },
      },
    ]);
  };

  const openBoard = board.filter((r) => r.requester_id !== userId);

  return (
    <View style={styles.wrap}>
      <CitySelectorSheet
        visible={citySheet === "from"}
        title="من أي مدينة؟"
        selected={fromCity}
        onSelect={setFromCity}
        onClose={() => setCitySheet(null)}
      />
      <CitySelectorSheet
        visible={citySheet === "to"}
        title="إلى أي مدينة؟"
        selected={toCity}
        onSelect={setToCity}
        onClose={() => setCitySheet(null)}
      />

      <View style={styles.form}>
        <Text style={styles.formTitle}>طلب رحلة</Text>
        <Text style={styles.formHint}>
          حدّد المسار والموعد. رقم واتساب يُؤخذ من متجرك ويمكنك تعديله.
        </Text>
        <View style={styles.routeRow}>
          <CityTriggerButton
            iconName="location"
            iconColor={TAIR.emerald}
            label="من"
            value={fromCity}
            onPress={() => setCitySheet("from")}
            testId="request-trip-from"
          />
          <Ionicons name="arrow-back" size={16} color={TAIR.faint} />
          <CityTriggerButton
            iconName="flag"
            iconColor={TAIR.gold}
            label="إلى"
            value={toCity}
            onPress={() => setCitySheet("to")}
            testId="request-trip-to"
          />
        </View>
        <Text style={styles.label}>التاريخ</Text>
        <View style={styles.chips}>
          {DATE_CHIPS.map((c) => {
            const value = dayOffset(c.offset);
            const on = departOn === value;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => setDepartOn(value)}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TextInput
          style={styles.input}
          value={departOn}
          onChangeText={setDepartOn}
          placeholder="2026-10-25"
          placeholderTextColor={TAIR.faint}
          testID="request-trip-date"
        />
        <Text style={styles.label}>التفاصيل</Text>
        <TextInput
          style={[styles.input, styles.area]}
          value={details}
          onChangeText={setDetails}
          placeholder="عدد الأقفاص، نوع الطير، ووقت يناسبك"
          placeholderTextColor={TAIR.faint}
          multiline
          testID="request-trip-details"
        />
        <Text style={styles.label}>واتساب للتواصل</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="05xxxxxxxx"
          placeholderTextColor={TAIR.faint}
          testID="request-trip-phone"
        />
        <TouchableOpacity style={styles.submit} onPress={submit} disabled={saving} testID="request-trip-submit">
          {saving ? (
            <ActivityIndicator color={TAIR.gold} />
          ) : (
            <>
              <Ionicons name="paper-plane" size={18} color={TAIR.gold} />
              <Text style={styles.submitText}>إرسال الطلب</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>طلباتي وما قبلته</Text>
      {loading ? (
        <ActivityIndicator color={TAIR.emerald} style={{ marginVertical: 16 }} />
      ) : loadError ? (
        <ErrorState title="تعذّر تحميل الطلبات" onRetry={() => { setLoading(true); load(); }} />
      ) : mine.length === 0 ? (
        <EmptyState icon="document-text-outline" title="لا توجد طلبات لك بعد" subtitle="أرسل طلبك أعلاه ليراه الموصلون." />
      ) : (
        mine.map((item) => (
          <RequestCard key={item.request_id} item={item} userId={userId} onAction={onAction} />
        ))
      )}

      <Text style={styles.section}>طلبات بانتظار موصل</Text>
      {!loading && openBoard.length === 0 ? (
        <EmptyState icon="hourglass-outline" title="لا توجد طلبات مفتوحة" subtitle="عندما يطلب أحد رحلة ستظهر هنا." />
      ) : (
        openBoard.map((item) => (
          <RequestCard key={item.request_id} item={item} userId={userId} onAction={onAction} />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 24 },
  form: {
    backgroundColor: TAIR.card,
    borderRadius: TAIR.cardRadius,
    borderWidth: 1,
    borderColor: TAIR.line,
    padding: 14,
    marginBottom: 8,
  },
  formTitle: { color: TAIR.emerald, fontSize: 18, fontWeight: "900", textAlign: "right" },
  formHint: { color: TAIR.textSoft, fontSize: 12, textAlign: "right", marginTop: 4, lineHeight: 18 },
  routeRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 12 },
  label: { color: TAIR.emerald, fontSize: 13, fontWeight: "800", textAlign: "right", marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: "row-reverse", gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: TAIR.creamDeep,
  },
  chipOn: { backgroundColor: TAIR.emerald },
  chipText: { color: TAIR.emerald, fontWeight: "800", fontSize: 12 },
  chipTextOn: { color: TAIR.gold },
  input: {
    backgroundColor: TAIR.surfaceMuted,
    borderWidth: 1,
    borderColor: TAIR.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: TAIR.ink,
    textAlign: "right",
    fontSize: 14,
  },
  area: { minHeight: 72, textAlignVertical: "top" },
  submit: {
    marginTop: 14,
    backgroundColor: TAIR.emerald,
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitText: { color: TAIR.gold, fontWeight: "900", fontSize: 15 },
  section: {
    color: TAIR.emerald,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: TAIR.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TAIR.line,
    padding: 12,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  route: { color: TAIR.ink, fontSize: 16, fontWeight: "900", textAlign: "right" },
  meta: { color: TAIR.textSoft, fontSize: 12, textAlign: "right", marginTop: 2 },
  details: { color: TAIR.text, fontSize: 13, textAlign: "right", marginTop: 8, lineHeight: 20 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: "800" },
  actions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 10 },
  action: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
