// طير — Create Listing (Mobile) — Matches Web parity
// Features: Family → Species hierarchy, video upload (15s max), cover badge on 1st image
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";
import { listingsApi, profileApi, speciesApi } from "../services/tairApi";
import api from "../services/api";
import IdentifyBirdModal from "../components/IdentifyBirdModal";
import { CityTriggerButton, CitySelectorSheet } from "../components/CitySelectorSheet";
import { ALL_LOCATIONS } from "../constants/saudiCities";
import { TAIR } from "../constants/tairTheme";
import { displayLocalPhone, savedContactPhone, toStoredPhone } from "../utils/contactPhone";

const GENDERS = [
  { id: "male", label: "ذكر" },
  { id: "female", label: "أنثى" },
  { id: "pair", label: "زوج" },
  { id: "unknown", label: "غير محدد" },
];
const HEALTH_STATUSES = [
  { id: "excellent", label: "ممتازة" },
  { id: "good", label: "جيدة" },
  { id: "needs_care", label: "تحتاج رعاية" },
  { id: "special_needs", label: "احتياجات خاصة" },
];

export default function CreateListingScreen({ user, onDone, onCancel }) {
  const [saving, setSaving] = useState(false);
  const [families, setFamilies] = useState([]);
  const [species, setSpecies] = useState([]);
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [citySheetOpen, setCitySheetOpen] = useState(false);
  const [familySheetOpen, setFamilySheetOpen] = useState(false);
  const [speciesSheetOpen, setSpeciesSheetOpen] = useState(false);

  const [form, setForm] = useState({
    title: "",
    family: "",
    species: "",
    breed: "",
    gender: "unknown",
    age_months: "",
    age_value: "",
    age_unit: "month",
    color: "",
    description: "",
    price_sar: "",
    price_negotiable: true,
    price_type: "fixed",  // fixed | negotiable
    allow_comments: true,
    whatsapp: "",
    city: "الرياض",
    district: "",
    health: { status: "good", vaccinated: false, ring_number: "", notes: "" },
  });

  useEffect(() => {
    const saved = savedContactPhone(user);
    if (!saved) return;
    setForm((prev) => (prev.whatsapp ? prev : { ...prev, whatsapp: displayLocalPhone(saved) }));
  }, [user]);

  // Load families once
  useEffect(() => {
    speciesApi.families()
      .then((r) => {
        const items = r.items || [];
        setFamilies(items);
        if (items.length && !form.family) {
          setForm((prev) => ({ ...prev, family: items[0].family_id }));
        }
      })
      .catch(() => {});
  }, []);

  // Load species when family changes
  useEffect(() => {
    if (!form.family) return;
    speciesApi.list(undefined, form.family)
      .then((r) => {
        const items = r.items || [];
        setSpecies(items);
        setForm((prev) => ({ ...prev, species: items[0]?.species_id || "" }));
      })
      .catch(() => setSpecies([]));
  }, [form.family]);

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  const setHealth = (k, v) =>
    setForm((prev) => ({ ...prev, health: { ...prev.health, [k]: v } }));

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("الإذن مطلوب", "نحتاج إذن الوصول للصور");
      return;
    }
    const remaining = 6 - images.length;
    if (remaining <= 0) {
      Alert.alert("الحد الأقصى", "الحد الأقصى 6 صور");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (res.canceled) return;
    const newImgs = res.assets.slice(0, remaining);
    setImages([...images, ...newImgs]);
  };

  const removeImage = (idx) => setImages(images.filter((_, i) => i !== idx));

  const pickVideo = async () => {
    if (videos.length >= 1) {
      Alert.alert("مسموح بمقطع واحد فقط", "احذف الفيديو الحالي أولاً");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("الإذن مطلوب", "نحتاج إذن الوصول للوسائط");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      videoMaxDuration: 30,
      quality: 0.8,
    });
    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset) return;
    // Enforce 30s duration guard
    const durSec = asset.duration ? asset.duration / 1000 : 0;
    if (durSec > 30.5) {
      Alert.alert("طول الفيديو", `مدة الفيديو ${Math.round(durSec)} ثانية — الحدّ الأقصى 30 ثانية`);
      return;
    }
    setUploadingVideo(true);
    try {
      const fd = new FormData();
      fd.append("file", {
        uri: asset.uri,
        name: `listing_video_${Date.now()}.mp4`,
        type: "video/mp4",
      });
      fd.append("user_id", String(user?.user_id || user?.id || ""));
      const resp = await api.fetch("/api/listings/upload-video", {
        method: "POST",
        body: fd,
        headers: {},
      });
      if (!resp?.ok) {
        Alert.alert("خطأ", "فشل رفع الفيديو");
        return;
      }
      const data = await resp.json().catch(() => null);
      if (data?.url || data?.video_url) {
        setVideos([...videos, data.url || data.video_url]);
      } else {
        Alert.alert("خطأ", "فشل رفع الفيديو");
      }
    } catch (e) {
      Alert.alert("خطأ", e?.message || "فشل رفع الفيديو");
    } finally {
      setUploadingVideo(false);
    }
  };

  const removeVideo = (idx) => setVideos(videos.filter((_, i) => i !== idx));

  const uploadImages = async () => {
    const urls = [];
    const uid = String(user?.user_id || user?.id || "");
    for (const img of images) {
      const fd = new FormData();
      fd.append("file", {
        uri: img.uri,
        name: `listing_${Date.now()}.jpg`,
        type: "image/jpeg",
      });
      fd.append("user_id", uid);
      try {
        const resp = await api.fetch("/api/listings/upload-image", {
          method: "POST",
          body: fd,
          headers: {},
        });
        if (resp?.ok) {
          const data = await resp.json().catch(() => null);
          const url = data?.url || data?.image_url;
          if (url) urls.push(url);
        }
      } catch (e) {
        console.warn("upload failed", e?.message);
      }
    }
    return urls;
  };

  // Normalize Arabic-Indic and Persian digits so users can type "١٠٠" and it
  // gets converted to 100 before validation / submission.
  const arabicToEnglish = (input) => {
    if (input == null) return input;
    const s = String(input);
    const map = { "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
                  "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9" };
    return s.replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
  };
  const parseNum = (v) => {
    const n = Number(arabicToEnglish(v));
    return Number.isFinite(n) ? n : NaN;
  };

  const validate = () => {
    if (!form.title.trim()) return "أدخل عنوان الإعلان";
    if (!form.family) return "اختر الفئة";
    if (!form.description.trim() || form.description.length < 20)
      return "الوصف يجب أن يكون 20 حرفاً على الأقل";
    const price = parseNum(form.price_sar);
    if (!Number.isFinite(price) || price <= 0)
      return "أدخل سعراً صحيحاً";
    if (images.length < 1) return "أضف صورة واحدة على الأقل";
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) {
      Alert.alert("تنبيه", err);
      return;
    }
    try {
      setSaving(true);
      const imageUrls = await uploadImages();
      if (imageUrls.length === 0) {
        Alert.alert("خطأ", "تعذّر رفع الصور، حاول مرة أخرى");
        setSaving(false);
        return;
      }

      const userId = user?.user_id || user?.id;
      const typedWa = (form.whatsapp || "").trim();
      const wa = typedWa ? toStoredPhone(typedWa) : null;
      if (typedWa) {
        profileApi.update(userId, { whatsapp: typedWa }).catch(() => {});
      }
      const payload = {
        title: form.title.trim(),
        category: form.family === "hotel_services" ? "services" : "birds",
        family: form.family,
        species: form.species || null,
        breed: form.breed.trim() || null,
        gender: form.gender,
        age_months: (() => {
          const v = parseNum(form.age_value);
          if (!v) return null;
          const unit = form.age_unit || "month";
          if (unit === "day") return Math.max(0, Math.round(v / 30));
          if (unit === "year") return v * 12;
          return v;
        })(),
        age_value: form.age_value ? parseNum(form.age_value) : null,
        age_unit: form.age_unit,
        color: form.color.trim() || null,
        description: form.description.trim(),
        price_sar: parseNum(form.price_sar),
        price_negotiable: form.price_negotiable || form.price_type === "negotiable",
        price_type: form.price_type,
        allow_comments: form.allow_comments,
        whatsapp: wa,
        city: form.city,
        district: form.district.trim() || null,
        images: imageUrls,
        videos: videos,
        cover_image: imageUrls[0],
        health: {
          status: form.health.status,
          vaccinated: form.health.vaccinated,
          ring_number: form.health.ring_number.trim() || null,
          notes: form.health.notes.trim() || null,
        },
      };

      const created = await listingsApi.create(userId, payload);
      Alert.alert("نجاح", "تم نشر إعلانك بنجاح", [
        { text: "حسناً", onPress: () => onDone && onDone(created) },
      ]);
    } catch (e) {
      Alert.alert("خطأ", e?.message || "حدث خطأ أثناء النشر");
    } finally {
      setSaving(false);
    }
  };

  const currentFamily = families.find((f) => f.family_id === form.family);
  const currentSpecies = species.find((s) => s.species_id === form.species);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { backgroundColor: "#1B3D2F" }]}>
        <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
          <Ionicons name="close" size={26} color="#C6A15B" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: "#C6A15B" }]}>إعلان جديد</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 120 }}>
        {/* ==================== Card: الصور والفيديو ==================== */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>الصور</Text>
          <Text style={styles.cardHint}>حد أقصى 6 صور — الأولى ستكون صورة الغلاف</Text>

          <View style={styles.imagesGrid}>
            {images.map((img, i) => (
              <View key={i} style={styles.imgTile}>
                <Image source={{ uri: img.uri }} style={styles.imgThumb} />
                <TouchableOpacity
                  style={styles.imgRemove}
                  onPress={() => removeImage(i)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
                {i === 0 && (
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverBadgeText}>الغلاف</Text>
                  </View>
                )}
              </View>
            ))}
            {images.length < 6 && (
              <TouchableOpacity
                style={styles.imgAdd}
                onPress={pickImages}
                data-testid="pick-images-btn"
              >
                <Ionicons name="camera" size={22} color="#1B3D2F" />
                <Text style={styles.imgAddText}>إضافة</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Video section */}
          <View style={styles.videoSection}>
            <View style={styles.videoHead}>
              <Text style={styles.videoTitle}>مقطع فيديو (اختياري)</Text>
              <Text style={styles.videoHint}>30 ثانية كحد أقصى — يُظهر حركة الطائر</Text>
            </View>
            {videos.length === 0 ? (
              <TouchableOpacity
                style={styles.videoAdd}
                onPress={pickVideo}
                disabled={uploadingVideo}
                data-testid="add-video-btn"
              >
                {uploadingVideo ? (
                  <ActivityIndicator color="#1B3D2F" />
                ) : (
                  <>
                    <Ionicons name="videocam" size={28} color="#1B3D2F" />
                    <Text style={styles.videoAddText}>أضف مقطع فيديو</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              videos.map((v, i) => (
                <View key={i} style={styles.videoTile}>
                  <Video
                    source={{ uri: v }}
                    style={styles.videoPreview}
                    resizeMode={ResizeMode.COVER}
                    useNativeControls
                    isMuted
                  />
                  <TouchableOpacity
                    style={styles.videoRemove}
                    onPress={() => removeVideo(i)}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.videoBadge}>
                    <Ionicons name="play" size={10} color="#fff" />
                    <Text style={styles.videoBadgeText}>فيديو</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ==================== Card: معلومات الطائر ==================== */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>معلومات الطائر</Text>

          <TouchableOpacity
            style={styles.aiButton}
            onPress={() => setAiOpen(true)}
            testID="btn-ai-identify"
          >
            <Ionicons name="sparkles" size={16} color="#C6A15B" />
            <Text style={styles.aiButtonText}>تعرّف على الطائر بالذكاء الاصطناعي</Text>
          </TouchableOpacity>

          <Field label="عنوان الإعلان *">
            <TextInput
              style={styles.input}
              placeholder="مثال: كناري ذكر مغني"
              placeholderTextColor="#8A7B66"
              value={form.title}
              onChangeText={(v) => set("title", v)}
              data-testid="input-title"
            />
          </Field>

          <Field label="الفئة *">
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() => setFamilySheetOpen(true)}
              data-testid="input-family"
            >
              <Ionicons name="leaf" size={14} color="#1B3D2F" />
              <Text style={styles.selectBtnText}>
                {currentFamily?.name_ar || "اختر الفئة"}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#8A7B66" style={{ marginRight: "auto" }} />
            </TouchableOpacity>
          </Field>

          {species.length > 0 && (
            <Field label="النوع (اختياري)">
              <TouchableOpacity
                style={styles.selectBtn}
                onPress={() => setSpeciesSheetOpen(true)}
                data-testid="input-species"
              >
                <Ionicons name="paw" size={14} color="#1B3D2F" />
                <Text style={styles.selectBtnText}>
                  {currentSpecies?.name_ar || "اختر النوع"}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#8A7B66" style={{ marginRight: "auto" }} />
              </TouchableOpacity>
            </Field>
          )}

          <View style={{ flexDirection: "row-reverse", gap: 8 }}>
            <Field label="الجنس" style={{ flex: 1 }}>
              <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 }}>
                {GENDERS.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.pill, form.gender === g.id && styles.pillActive]}
                    onPress={() => set("gender", g.id)}
                  >
                    <Text
                      style={[styles.pillText, form.gender === g.id && styles.pillTextActive]}
                    >
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>
          </View>

          <View style={{ flexDirection: "row-reverse", gap: 8 }}>
            <Field label="السلالة" style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                placeholder="ألماني"
                placeholderTextColor="#8A7B66"
                value={form.breed}
                onChangeText={(v) => set("breed", v)}
              />
            </Field>
            <Field label="العمر" style={{ flex: 1 }}>
              <View style={{ flexDirection: "row-reverse", gap: 6 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  keyboardType="numeric"
                  placeholder="6"
                  placeholderTextColor="#8A7B66"
                  value={form.age_value}
                  onChangeText={(v) => set("age_value", v)}
                />
                {[
                  { id: "day", label: "يوم" },
                  { id: "month", label: "شهر" },
                  { id: "year", label: "سنة" },
                ].map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    onPress={() => set("age_unit", u.id)}
                    style={[styles.pill, form.age_unit === u.id && styles.pillActive, { paddingHorizontal: 10 }]}
                  >
                    <Text style={[styles.pillText, form.age_unit === u.id && styles.pillTextActive]}>{u.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Field>
          </View>

          <Field label="اللون">
            <TextInput
              style={styles.input}
              placeholder="أصفر ذهبي"
              placeholderTextColor="#8A7B66"
              value={form.color}
              onChangeText={(v) => set("color", v)}
            />
          </Field>

          <Field label="الوصف التفصيلي *" hint="20 حرف على الأقل">
            <TextInput
              style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]}
              placeholder="اكتب معلومات مفيدة عن الطائر، عاداته، سبب البيع…"
              placeholderTextColor="#8A7B66"
              value={form.description}
              onChangeText={(v) => set("description", v)}
              multiline
              data-testid="input-description"
            />
          </Field>
        </View>

        {/* ==================== Card: الحالة الصحية ==================== */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>الحالة الصحية</Text>

          <Field label="الحالة العامة">
            <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 }}>
              {HEALTH_STATUSES.map((h) => (
                <TouchableOpacity
                  key={h.id}
                  style={[styles.pill, form.health.status === h.id && styles.pillActive]}
                  onPress={() => setHealth("status", h.id)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      form.health.status === h.id && styles.pillTextActive,
                    ]}
                  >
                    {h.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setHealth("vaccinated", !form.health.vaccinated)}
          >
            <Ionicons
              name={form.health.vaccinated ? "checkbox" : "square-outline"}
              size={22}
              color="#2F6B45"
            />
            <Text style={styles.checkboxLabel}>محصّن ضد الأمراض الشائعة</Text>
          </TouchableOpacity>

          <Field label="رقم الخاتم (اختياري)">
            <TextInput
              style={styles.input}
              placeholder="SA-2026-1234"
              placeholderTextColor="#8A7B66"
              value={form.health.ring_number}
              onChangeText={(v) => setHealth("ring_number", v)}
            />
          </Field>

          <Field label="ملاحظات صحية (اختياري)">
            <TextInput
              style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
              placeholder="أي حالة أو ملاحظة يجب أن يعرفها المشتري"
              placeholderTextColor="#8A7B66"
              value={form.health.notes}
              onChangeText={(v) => setHealth("notes", v)}
              multiline
            />
          </Field>
        </View>

        {/* ==================== Card: السعر والموقع ==================== */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>السعر والموقع</Text>

          <Field label="السعر (ر.س) *">
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="500"
              placeholderTextColor="#8A7B66"
              value={form.price_sar}
              onChangeText={(v) => set("price_sar", v)}
              data-testid="input-price"
            />
          </Field>

          {/* نوع السعر: حد / على السوم */}
          <Text style={styles.label}>نوع السعر</Text>
          <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 10 }}>
            <TouchableOpacity
              onPress={() => set("price_type", "fixed")}
              style={[styles.pill, form.price_type === "fixed" && styles.pillActive]}
            >
              <Text style={[styles.pillText, form.price_type === "fixed" && styles.pillTextActive]}>حد (ثابت)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => set("price_type", "negotiable")}
              style={[styles.pill, form.price_type === "negotiable" && styles.pillActive]}
            >
              <Text style={[styles.pillText, form.price_type === "negotiable" && styles.pillTextActive]}>على السوم</Text>
            </TouchableOpacity>
          </View>

          {/* واتساب — بدون مفتاح الدولة */}
          <Field label="واتساب للتواصل — يُؤخذ من متجرك، وبلا مفتاح دولة">
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              placeholder="05xxxxxxxx"
              placeholderTextColor="#8A7B66"
              value={form.whatsapp}
              onChangeText={(v) => set("whatsapp", v)}
              data-testid="input-whatsapp"
            />
          </Field>

          {/* تمكين الردود */}
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => set("allow_comments", !form.allow_comments)}
            data-testid="toggle-allow-comments"
          >
            <Ionicons
              name={form.allow_comments ? "checkbox" : "square-outline"}
              size={22}
              color={TAIR.emerald}
            />
            <Text style={styles.checkboxLabel}>تمكين الردود على الإعلان</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row-reverse", gap: 8 }}>
            <Field label="المدينة *" style={{ flex: 1 }}>
              <CityTriggerButton
                iconName="location"
                iconColor="#1B3D2F"
                label="المدينة"
                value={form.city}
                onPress={() => setCitySheetOpen(true)}
                testId="create-listing-city"
              />
            </Field>
          </View>

          <Field label="الحي (اختياري)">
            <TextInput
              style={styles.input}
              placeholder="حي النرجس"
              placeholderTextColor="#8A7B66"
              value={form.district}
              onChangeText={(v) => set("district", v)}
            />
          </Field>
        </View>
      </ScrollView>

      {/* Submit bar */}
      <View style={styles.submitBar}>
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={submit}
          disabled={saving}
          data-testid="submit-listing-btn"
        >
          {saving ? (
            <ActivityIndicator color="#C6A15B" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#C6A15B" />
              <Text style={styles.submitText}>نشر الإعلان</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Selectors */}
      <CitySelectorSheet
        visible={citySheetOpen}
        title="اختر مدينة الإعلان"
        selected={form.city}
        onSelect={(c) => set("city", c)}
        onClose={() => setCitySheetOpen(false)}
      />

      <PickerSheet
        visible={familySheetOpen}
        title="اختر الفئة"
        options={[
          ...families.map((f) => ({ id: f.family_id, label: f.name_ar })),
          { id: "hotel_services", label: "🏨 خدمات فندقة الطيور" },
          { id: "supplies", label: "🛒 مستلزمات" },
          { id: "food", label: "🌾 أغذية" },
          { id: "training", label: "🎓 تدريب" },
        ]}
        selected={form.family}
        onSelect={(id) => set("family", id)}
        onClose={() => setFamilySheetOpen(false)}
      />

      <PickerSheet
        visible={speciesSheetOpen}
        title="اختر النوع"
        options={species.map((s) => ({ id: s.species_id, label: s.name_ar }))}
        selected={form.species}
        onSelect={(id) => set("species", id)}
        onClose={() => setSpeciesSheetOpen(false)}
      />

      <IdentifyBirdModal
        visible={aiOpen}
        onClose={() => setAiOpen(false)}
        onApply={(v) => {
          if (v.title && !form.title) set("title", v.title);
          if (v.price_max && !form.price_sar) {
            set("price_sar", String(Math.round((v.price_min + v.price_max) / 2)));
          }
          setAiOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function Field({ label, hint, children, style }) {
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function PickerSheet({ visible, title, options, selected, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.sheetHead}>
            <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn}>
              <Ionicons name="close" size={20} color="#334155" />
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>{title}</Text>
            <View style={{ width: 32 }} />
          </View>
          <ScrollView style={{ maxHeight: 400 }}>
            {options.map((o) => (
              <TouchableOpacity
                key={o.id}
                style={[
                  styles.sheetItem,
                  selected === o.id && styles.sheetItemActive,
                ]}
                onPress={() => {
                  onSelect(o.id);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.sheetItemText,
                    selected === o.id && styles.sheetItemTextActive,
                  ]}
                >
                  {o.label}
                </Text>
                {selected === o.id && (
                  <Ionicons name="checkmark-circle" size={18} color="#1B3D2F" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F1E8" },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#C6A15B" },

  card: {
    backgroundColor: "#FFFDF8",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E6DCC8",
    shadowColor: "#1B3D2F",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1B3D2F",
    textAlign: "right",
    marginBottom: 6,
  },
  cardHint: {
    fontSize: 11.5,
    color: "#6B5E4A",
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "right",
  },

  labelRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: { fontSize: 13, fontWeight: "700", color: "#1B3D2F", textAlign: "right" },
  hint: { fontSize: 10.5, color: "#6B5E4A" },

  input: {
    borderWidth: 1,
    borderColor: "#E6DCC8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1B3D2F",
    textAlign: "right",
    backgroundColor: "#F7F1E8",
  },

  selectBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#E6DCC8",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F7F1E8",
  },
  selectBtnText: { fontSize: 14, fontWeight: "700", color: "#1B3D2F" },

  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#F0EAD8",
    borderWidth: 1,
    borderColor: "#E6DCC8",
  },
  pillActive: { backgroundColor: "#1B3D2F", borderColor: "#C6A15B" },
  pillText: { color: "#6B5E4A", fontWeight: "700", fontSize: 12.5 },
  pillTextActive: { color: "#C6A15B", fontWeight: "900" },

  imagesGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },
  imgTile: {
    width: 90,
    height: 90,
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
  },
  imgThumb: { width: "100%", height: "100%" },
  imgRemove: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(220, 38, 38, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(6, 95, 70, 0.92)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  coverBadgeText: { color: "#fff", fontSize: 9.5, fontWeight: "800" },
  imgAdd: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#C6A15B",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBF6EE",
  },
  imgAddText: { color: "#1B3D2F", fontSize: 11, marginTop: 4, fontWeight: "700" },

  videoSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    borderStyle: "dashed",
  },
  videoHead: { marginBottom: 8 },
  videoTitle: { fontSize: 13.5, fontWeight: "800", color: "#0F241C", textAlign: "right" },
  videoHint: { fontSize: 10.5, color: "#8A7B66", fontWeight: "600", textAlign: "right", marginTop: 2 },
  videoAdd: {
    aspectRatio: 16 / 9,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#C6A15B",
    borderStyle: "dashed",
    backgroundColor: "#FBF6EE",
    alignItems: "center",
    justifyContent: "center",
  },
  videoAddText: { color: "#1B3D2F", fontSize: 12.5, fontWeight: "800", marginTop: 6 },
  videoTile: {
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  videoPreview: { width: "100%", height: "100%" },
  videoRemove: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(15,23,42,0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  videoBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(15,118,110,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    zIndex: 3,
  },
  videoBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  checkbox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },
  checkboxLabel: { color: "#334155", fontSize: 13, fontWeight: "600" },

  submitBar: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: "#FFFDF8",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(198,161,91,0.45)",
  },
  submitBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1B3D2F",
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C6A15B",
    shadowColor: "#0F241C",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  submitText: { color: "#C6A15B", fontSize: 16, fontWeight: "800" },

  aiButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 12,
    padding: 11,
    borderRadius: 10,
    backgroundColor: "#1B3D2F",
  },
  aiButtonText: { color: "#C6A15B", fontSize: 13, fontWeight: "800" },

  // Picker Sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 20,
    maxHeight: "80%",
  },
  sheetHead: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  sheetCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center", justifyContent: "center",
  },
  sheetTitle: { fontSize: 15, fontWeight: "900", color: "#0F241C" },
  sheetItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sheetItemActive: { backgroundColor: "#FBF6EE" },
  sheetItemText: { fontSize: 14, fontWeight: "700", color: "#334155" },
  sheetItemTextActive: { color: "#1B3D2F", fontWeight: "900" },
});
