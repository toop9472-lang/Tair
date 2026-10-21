// طير — Mobile Wholesale / Suppliers Screen (mirrors web)
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Image,
  Linking,
  Modal,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../services/api";
import ScreenHeader from "../components/ScreenHeader";
import { CitySelectorSheet } from "../components/CitySelectorSheet";
import { displayLocalPhone, openWhatsApp, savedContactPhone, toTel } from "../utils/contactPhone";

async function req(path, options) {
  const res = await api.fetch(path, options);
  if (!res || typeof res.json !== "function") return res;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    const message = typeof detail === "string" ? detail : "تعذّر إتمام الطلب";
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

function categoryLabel(value, categories) {
  if (value && typeof value === "object") return value.label || value.name_ar || value.name || value.id;
  return categories.find((c) => c.id === value)?.label || value;
}

function SupplierCard({ supplier, categories, onPress }) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress?.(supplier)}
      data-testid={`supplier-${supplier.supplier_id}`}
    >
      <View style={styles.cardHead}>
        <View style={styles.logoWrap}>
          {supplier.logo_url ? (
            <Image source={{ uri: supplier.logo_url }} style={styles.logo} />
          ) : (
            <Ionicons name="storefront" size={18} color="#1B3D2F" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {supplier.name}
            </Text>
            <Text style={supplier.is_verified ? styles.verified : styles.pending}>
              {supplier.is_verified ? "موثّق" : "بانتظار التوثيق"}
            </Text>
          </View>
          {supplier.city ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color="#8A7B66" />
              <Text style={styles.metaText}>{supplier.city}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {supplier.description ? (
        <Text style={styles.desc} numberOfLines={2}>
          {supplier.description}
        </Text>
      ) : null}

      {Array.isArray(supplier.categories) && supplier.categories.length > 0 ? (
        <View style={styles.chipsRow}>
          {supplier.categories.slice(0, 4).map((c) => (
            <View key={c.id || c} style={styles.miniChip}>
              <Text style={styles.miniChipText}>{categoryLabel(c, categories)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        {supplier.whatsapp ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#25d366" }]}
            onPress={(e) => {
              e?.stopPropagation?.();
              openWhatsApp(supplier.whatsapp, "السلام عليكم، أستفسر عن التوريد بالجملة");
            }}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#fff" />
            <Text style={styles.actionText}>واتساب</Text>
          </TouchableOpacity>
        ) : null}
        {supplier.phone ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#1B3D2F" }]}
            onPress={(e) => {
              e?.stopPropagation?.();
              const tel = toTel(supplier.phone);
              if (tel) Linking.openURL(`tel:${tel}`);
            }}
          >
            <Ionicons name="call" size={16} color="#fff" />
            <Text style={styles.actionText}>اتصال</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function WholesaleScreen({ user, onBack }) {
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [city, setCity] = useState(null);
  const [cityOpen, setCityOpen] = useState(false);
  const [mine, setMine] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    req(`/api/wholesale/categories`)
      .then((r) =>
        setCategories(
          (r?.items || []).map((c) => ({
            id: c.id,
            label: c.name_ar || c.label || c.name,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeCat !== "all") params.set("category", activeCat);
      if (city) params.set("city", city);
      params.set("limit", "50");
      const r = await req(`/api/wholesale/suppliers?${params}`);
      setSuppliers(r?.items || []);
    } catch (e) {
      console.warn("wholesale load", e?.message);
      setSuppliers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCat, city]);

  const loadMine = useCallback(async () => {
    const uid = user?.user_id || user?.id;
    if (!uid) {
      setMine(null);
      return;
    }
    try {
      const r = await req("/api/wholesale/suppliers/mine");
      setMine(r?.supplier || null);
    } catch {
      setMine(null);
    }
  }, [user]);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="الموردون بالجملة"
        subtitle="شركات التوريد تتسجل وتظهر في الدليل"
        onBack={onBack}
      />

      <TouchableOpacity
        style={styles.registerBtn}
        onPress={() => {
          if (!(user?.user_id || user?.id)) {
            Alert.alert("تسجيل الدخول", "سجّل دخولك ثم أضف شركتك في الدليل.");
            return;
          }
          setFormOpen(true);
        }}
        testID="wholesale-register-btn"
      >
        <Ionicons name="add-circle" size={18} color="#C6A15B" />
        <Text style={styles.registerText}>{mine ? "عدّل بيانات شركتك" : "سجّل شركتك كمورد"}</Text>
      </TouchableOpacity>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catsBar}
      >
        <TouchableOpacity
          onPress={() => setActiveCat("all")}
          style={[styles.chip, activeCat === "all" && styles.chipActive]}
        >
          <Text style={[styles.chipText, activeCat === "all" && styles.chipTextActive]}>
            الكل
          </Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            onPress={() => setActiveCat(c.id)}
            style={[styles.chip, activeCat === c.id && styles.chipActive]}
          >
            <Text
              style={[styles.chipText, activeCat === c.id && styles.chipTextActive]}
            >
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.cityFilter} onPress={() => setCityOpen(true)} testID="wholesale-city-btn">
        <Ionicons name="location" size={16} color="#1B3D2F" />
        <Text style={styles.cityFilterText}>{city || "كل المدن"}</Text>
      </TouchableOpacity>

      <FlatList
        data={suppliers}
        keyExtractor={(s) => s.supplier_id || s.id}
        renderItem={({ item }) => <SupplierCard supplier={item} categories={categories} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#1B3D2F"
          />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#1B3D2F" size="large" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={64} color="#a7f3d0" />
              <Text style={styles.emptyTitle}>لا يوجد موردون في هذه الفئة</Text>
              <Text style={styles.emptyText}>ما فيه موردين بهالفئة الحين. سجّل شركتك أو جرّب فئة ثانية.</Text>
            </View>
          )
        }
      />

      <CitySelectorSheet
        visible={cityOpen}
        title="مدينة المورد"
        selected={city}
        allowAll
        onSelect={setCity}
        onClose={() => setCityOpen(false)}
      />
      <SupplierForm
        visible={formOpen}
        user={user}
        categories={categories}
        initial={mine}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          load();
          loadMine();
        }}
      />
    </View>
  );
}

function SupplierForm({ visible, user, categories, initial, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("الرياض");
  const [cityOpen, setCityOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const [description, setDescription] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name || "");
    setCity(initial?.city || "الرياض");
    setPicked(Array.isArray(initial?.categories) ? initial.categories.filter((c) => typeof c === "string") : []);
    setDescription(initial?.description || "");
    setMinOrder(initial?.min_order_sar ? String(initial.min_order_sar) : "");
    setWhatsapp(displayLocalPhone(initial?.whatsapp || savedContactPhone(user)));
    setPhone(initial?.phone ? displayLocalPhone(initial.phone) : "");
    setWebsite(initial?.website || "");
    setActive(initial ? initial.is_active !== false : true);
  }, [visible, initial, user]);

  const toggle = (id) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async () => {
    if (name.trim().length < 2) return Alert.alert("تنبيه", "اكتب اسم الشركة");
    if (!city) return Alert.alert("تنبيه", "اختر المدينة");
    if (!picked.length) return Alert.alert("تنبيه", "اختر فئة واحدة على الأقل");
    if (description.trim().length < 10) return Alert.alert("تنبيه", "صف نشاط الشركة بعشر أحرف على الأقل");
    if (!whatsapp.trim() && !phone.trim()) return Alert.alert("تنبيه", "أدخل واتساب أو رقم جوال");
    const payload = {
      name: name.trim(),
      city,
      categories: picked,
      description: description.trim(),
      min_order_sar: Number(String(minOrder).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))) || 0,
      whatsapp: whatsapp.trim() || null,
      phone: phone.trim() || null,
      website: website.trim() || null,
      is_active: active,
    };
    setSaving(true);
    try {
      const path = initial ? "/api/wholesale/suppliers/mine" : "/api/wholesale/suppliers";
      await req(path, { method: initial ? "PATCH" : "POST", body: JSON.stringify(payload) });
      Alert.alert(initial ? "تم التحديث" : "تم التسجيل", "شركتك ظاهرة في الدليل بعلامة بانتظار التوثيق حتى تعتمدها الإدارة.");
      onSaved?.();
    } catch (e) {
      Alert.alert("تعذّر الحفظ", e?.message || "حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.formPage} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.formHead}>
          <TouchableOpacity onPress={onClose} testID="supplier-form-close">
            <Ionicons name="close" size={24} color="#1B3D2F" />
          </TouchableOpacity>
          <Text style={styles.formTitle}>{initial ? "بيانات الشركة" : "تسجيل شركة توريد"}</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.formHint}>التسجيل يظهر فوراً. علامة «موثّق» تمنحها إدارة طير فقط.</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="اسم الشركة" placeholderTextColor="#8A7B66" textAlign="right" />
          <TouchableOpacity style={styles.inputBtn} onPress={() => setCityOpen(true)}>
            <Text style={styles.inputBtnText}>{city}</Text>
            <Ionicons name="chevron-down" size={16} color="#8A7B66" />
          </TouchableOpacity>
          <Text style={styles.fieldLabel}>الفئات</Text>
          <View style={styles.chipsRow}>
            {categories.map((c) => {
              const on = picked.includes(c.id);
              return (
                <TouchableOpacity key={c.id} style={[styles.miniChip, on && styles.miniChipOn]} onPress={() => toggle(c.id)}>
                  <Text style={[styles.miniChipText, on && styles.miniChipTextOn]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            style={[styles.input, { height: 90, textAlignVertical: "top" }]}
            value={description}
            onChangeText={setDescription}
            placeholder="ماذا توردون؟ طيور، أعلاف، أقفاص…"
            placeholderTextColor="#8A7B66"
            multiline
            textAlign="right"
          />
          <TextInput style={styles.input} value={minOrder} onChangeText={setMinOrder} placeholder="الحد الأدنى للطلب بالريال" placeholderTextColor="#8A7B66" keyboardType="number-pad" textAlign="right" />
          <TextInput style={styles.input} value={whatsapp} onChangeText={setWhatsapp} placeholder="واتساب 05xxxxxxxx" placeholderTextColor="#8A7B66" keyboardType="phone-pad" textAlign="right" />
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="جوال آخر (اختياري)" placeholderTextColor="#8A7B66" keyboardType="phone-pad" textAlign="right" />
          <TextInput style={styles.input} value={website} onChangeText={setWebsite} placeholder="الموقع (اختياري)" placeholderTextColor="#8A7B66" autoCapitalize="none" textAlign="right" />
          <View style={styles.switchRow}>
            <Text style={styles.fieldLabel}>ظاهرة في الدليل</Text>
            <Switch value={active} onValueChange={setActive} trackColor={{ true: "#1B3D2F" }} />
          </View>
          <TouchableOpacity style={styles.submit} onPress={submit} disabled={saving} testID="supplier-form-submit">
            <Text style={styles.submitText}>{saving ? "جارٍ الحفظ…" : initial ? "حفظ التعديل" : "تسجيل الشركة"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
    <CitySelectorSheet visible={visible && cityOpen} title="مدينة الشركة" selected={city} onSelect={setCity} onClose={() => setCityOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F1E8" },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "900" },

  catsBar: {
    flexDirection: "row-reverse",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
  },
  chipActive: { backgroundColor: "#1B3D2F" },
  chipText: { color: "#6B5E4A", fontWeight: "700", fontSize: 12 },
  chipTextActive: { color: "#fff", fontWeight: "800" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardHead: { flexDirection: "row-reverse", alignItems: "center", gap: 10, marginBottom: 8 },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f0fdfa",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: { width: "100%", height: "100%" },
  nameRow: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  name: { fontSize: 15, fontWeight: "900", color: "#0F241C", textAlign: "right" },
  verified: { color: "#8A6A2E", fontSize: 11, fontWeight: "800" },
  pending: { color: "#8A7B66", fontSize: 11, fontWeight: "700" },
  registerBtn: {
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: "#1B3D2F",
    borderRadius: 14,
    minHeight: 46,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  registerText: { color: "#C6A15B", fontWeight: "900", fontSize: 14 },
  cityFilter: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 12,
    marginBottom: 4,
    alignSelf: "flex-end",
  },
  cityFilterText: { color: "#1B3D2F", fontWeight: "800", fontSize: 13 },
  formPage: { flex: 1, backgroundColor: "#F7F1E8" },
  formHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  formTitle: { color: "#1B3D2F", fontSize: 17, fontWeight: "900" },
  formHint: { color: "#6B5E4A", textAlign: "right", marginBottom: 12, lineHeight: 20 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E6DCC8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    color: "#0F241C",
    fontSize: 14,
  },
  inputBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E6DCC8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputBtnText: { color: "#0F241C", fontWeight: "800" },
  fieldLabel: { color: "#1B3D2F", fontWeight: "800", textAlign: "right", marginBottom: 6 },
  miniChipOn: { backgroundColor: "#1B3D2F" },
  miniChipTextOn: { color: "#C6A15B" },
  switchRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginVertical: 8 },
  submit: { backgroundColor: "#1B3D2F", borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 8 },
  submitText: { color: "#C6A15B", fontWeight: "900", fontSize: 15 },
  metaRow: { flexDirection: "row-reverse", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { fontSize: 12, color: "#6B5E4A" },
  desc: { fontSize: 13, color: "#475569", lineHeight: 19, textAlign: "right", marginTop: 4 },
  chipsRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 8 },
  miniChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#f0fdfa",
    borderRadius: 8,
  },
  miniChipText: { color: "#1B3D2F", fontSize: 11, fontWeight: "800" },
  actionRow: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  empty: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 30 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F241C",
    marginTop: 12,
    textAlign: "center",
  },
  emptyText: { fontSize: 13, color: "#6B5E4A", marginTop: 6, textAlign: "center" },
});
