/**
 * SubmitAuctionScreen — البائع يرفع مزاداً للمراجعة
 * ٣ صور على الأقل + وصف + الجنس + العمر + النوع + سعر الافتتاح (≥ 1 ر.س)
 */
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, Image, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { TAIR } from "../constants/tairTheme";
import { auctionsApi } from "../services/tairApi";
import api from "../services/api";

const GENDER_OPTIONS = ["ذكر", "أنثى", "زوج", "غير محدد"];
const SPECIES_OPTIONS = ["كناري", "بادجي", "زيبرا", "حسون", "فيشر", "روز", "كوكتيل", "غير محدد"];

export default function SubmitAuctionScreen({ user, onClose, onSubmitted }) {
  const uid = user?.id || user?.user_id;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]);
  const [gender, setGender] = useState("");
  const [ageMonths, setAgeMonths] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [city, setCity] = useState("");
  const [startingPrice, setStartingPrice] = useState("1");
  const [floor, setFloor] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await auctionsApi.settings().catch(() => null);
      if (s?.starting_price_floor) setFloor(Number(s.starting_price_floor));
    })();
  }, []);

  const pickImage = async () => {
    if (images.length >= 5) {
      Alert.alert("الحد الأقصى", "لا يمكن إضافة أكثر من ٥ صور");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
    });
    if (r.canceled || !r.assets?.length) return;
    const a = r.assets[0];
    // Upload immediately
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", { uri: a.uri, name: "auction.jpg", type: a.mimeType || "image/jpeg" });
      form.append("user_id", uid || "");
      const resp = await api.fetch("/api/listings/upload-image", { method: "POST", body: form });
      if (!resp?.ok) throw new Error("upload failed");
      const j = await resp.json();
      const url = j?.url || j?.image_url;
      if (url) setImages((prev) => [...prev, url]);
      else throw new Error("no url");
    } catch {
      Alert.alert("خطأ", "فشل رفع الصورة — حاول مرة أخرى");
    } finally { setBusy(false); }
  };

  const removeImage = (idx) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!title.trim()) return Alert.alert("خطأ", "أدخل عنوان المزاد");
    if (!description.trim() || description.trim().length < 10) return Alert.alert("خطأ", "الوصف يجب أن يكون ١٠ أحرف على الأقل");
    if (images.length < 3) return Alert.alert("خطأ", "يجب رفع ٣ صور على الأقل");
    if (!gender) return Alert.alert("خطأ", "اختر الجنس");
    if (!species) return Alert.alert("خطأ", "اختر النوع");
    const price = Number(startingPrice);
    if (!Number.isFinite(price) || price < floor) return Alert.alert("خطأ", `سعر الافتتاح ≥ ${floor} ر.س`);
    const age = parseInt(ageMonths, 10);
    if (!Number.isFinite(age) || age < 0) return Alert.alert("خطأ", "أدخل العمر بالأشهر");

    setBusy(true);
    try {
      await auctionsApi.submit({
        title: title.trim(),
        description: description.trim(),
        images,
        starting_price_sar: price,
        gender,
        age_months: age,
        species,
        breed: breed.trim(),
        city: city.trim() || null,
        category: "birds",
      }, uid);
      Alert.alert("✅ تم", "تم إرسال طلبك للمراجعة، سيتم إعلامك بعد الموافقة", [
        { text: "تمام", onPress: () => { onSubmitted?.(); onClose?.(); } },
      ]);
    } catch (e) {
      const msg = e?.message || "فشل الإرسال";
      Alert.alert("خطأ", msg);
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={s.page}
    >
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={26} color={TAIR.gold} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
          <Ionicons name="hammer" size={20} color={TAIR.gold} />
          <Text style={s.headerTitle}>قدّم إعلانك للمزاد</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {/* Images */}
        <Text style={s.label}>الصور (٣-٥ صور) *</Text>
        <View style={s.imgRow}>
          {images.map((uri, i) => (
            <View key={i} style={s.imgWrap}>
              <Image source={{ uri }} style={s.img} />
              <TouchableOpacity onPress={() => removeImage(i)} style={s.imgRemove}>
                <Ionicons name="close-circle" size={22} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
          {images.length < 5 && (
            <TouchableOpacity onPress={pickImage} style={s.imgAdd} disabled={busy}>
              <Ionicons name="add-circle" size={30} color={TAIR.gold} />
              <Text style={s.imgAddText}>{images.length}/5</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Title */}
        <Text style={s.label}>العنوان *</Text>
        <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="مثال: كناري ذهبي مغرد"
          placeholderTextColor={TAIR.textSoft} textAlign="right" />

        {/* Description */}
        <Text style={s.label}>الوصف * (٣+ أحرف)</Text>
        <TextInput style={[s.input, s.area]} value={description} onChangeText={setDescription}
          placeholder="اكتب وصفاً كاملاً..." placeholderTextColor={TAIR.textSoft}
          multiline numberOfLines={5} textAlign="right" textAlignVertical="top" />

        {/* Gender */}
        <Text style={s.label}>الجنس *</Text>
        <View style={s.pillsRow}>
          {GENDER_OPTIONS.map((g) => (
            <TouchableOpacity key={g} onPress={() => setGender(g)}
              style={[s.pill, gender === g && s.pillActive]}>
              <Text style={[s.pillText, gender === g && s.pillTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Age */}
        <Text style={s.label}>العمر (بالأشهر) *</Text>
        <TextInput style={s.input} value={ageMonths} onChangeText={setAgeMonths}
          placeholder="6" placeholderTextColor={TAIR.textSoft}
          keyboardType="number-pad" textAlign="right" />

        {/* Species */}
        <Text style={s.label}>النوع *</Text>
        <View style={s.pillsRow}>
          {SPECIES_OPTIONS.map((sp) => (
            <TouchableOpacity key={sp} onPress={() => setSpecies(sp)}
              style={[s.pill, species === sp && s.pillActive]}>
              <Text style={[s.pillText, species === sp && s.pillTextActive]}>{sp}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Breed */}
        <Text style={s.label}>السلالة (اختياري)</Text>
        <TextInput style={s.input} value={breed} onChangeText={setBreed}
          placeholder="مثال: ريد فاكتور" placeholderTextColor={TAIR.textSoft}
          textAlign="right" />

        {/* City */}
        <Text style={s.label}>المدينة (اختياري)</Text>
        <TextInput style={s.input} value={city} onChangeText={setCity}
          placeholder="الرياض" placeholderTextColor={TAIR.textSoft}
          textAlign="right" />

        {/* Starting price */}
        <Text style={s.label}>سعر الافتتاح (بالريال) — الحد الأدنى {floor} ر.س *</Text>
        <TextInput style={s.input} value={startingPrice} onChangeText={setStartingPrice}
          placeholder="1" placeholderTextColor={TAIR.textSoft}
          keyboardType="number-pad" textAlign="right" />

        {/* Info banner */}
        <View style={s.infoCard}>
          <Ionicons name="information-circle" size={20} color={TAIR.emerald} />
          <Text style={s.infoText}>
            بعد الإرسال، سيراجع المدير طلبك ويوافق عليه قبل ظهوره في المزادات. المزاد يفتح يومياً من ٤:٠٠ عصراً حتى ٩:٠٠ مساءً.
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity onPress={submit} disabled={busy} style={s.submitBtn} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color={TAIR.gold} /> : (
            <>
              <Ionicons name="paper-plane" size={18} color={TAIR.gold} />
              <Text style={s.submitText}>إرسال للمراجعة</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },
  header: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16,
    backgroundColor: TAIR.emerald, borderBottomWidth: 1.5, borderBottomColor: TAIR.gold,
  },
  headerTitle: { color: TAIR.gold, fontSize: 17, fontWeight: "900" },
  body: { padding: 16, paddingBottom: 48 },
  label: { color: TAIR.emerald, fontWeight: "800", fontSize: 13, marginBottom: 8, marginTop: 16, textAlign: "right" },
  input: {
    backgroundColor: TAIR.card, borderWidth: 1, borderColor: TAIR.divider,
    borderRadius: 14, paddingHorizontal: 14, minHeight: 48, paddingVertical: 12,
    fontSize: 15, color: TAIR.ink,
  },
  area: { minHeight: 90, textAlignVertical: "top" },
  pillsRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: "#F0EAD8", borderWidth: 1, borderColor: TAIR.divider,
  },
  pillActive: { backgroundColor: TAIR.emerald, borderColor: TAIR.gold },
  pillText: { color: TAIR.textSoft, fontWeight: "700", fontSize: 12.5 },
  pillTextActive: { color: TAIR.gold, fontWeight: "900" },
  imgRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  imgWrap: { position: "relative" },
  img: { width: 90, height: 90, borderRadius: 12, borderWidth: 1.5, borderColor: TAIR.gold },
  imgRemove: { position: "absolute", top: -6, left: -6, backgroundColor: TAIR.card, borderRadius: 11 },
  imgAdd: {
    width: 90, height: 90, borderRadius: 12,
    borderWidth: 2, borderStyle: "dashed", borderColor: TAIR.gold,
    alignItems: "center", justifyContent: "center", backgroundColor: TAIR.card,
  },
  imgAddText: { color: TAIR.emerald, fontWeight: "800", fontSize: 12, marginTop: 4 },
  infoCard: {
    flexDirection: "row-reverse", gap: 10, alignItems: "flex-start",
    backgroundColor: "#E9F3EC", padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: TAIR.emerald + "33", marginTop: 16,
  },
  infoText: { flex: 1, color: TAIR.emerald, fontSize: 12.5, lineHeight: 20, textAlign: "right" },
  submitBtn: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: TAIR.emerald, paddingVertical: 14, borderRadius: 14,
    marginTop: 20, borderWidth: 1.5, borderColor: TAIR.gold,
  },
  submitText: { color: TAIR.gold, fontWeight: "900", fontSize: 15 },
});
