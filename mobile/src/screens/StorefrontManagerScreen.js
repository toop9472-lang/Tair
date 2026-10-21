// طير — Merchant Storefront Manager (comprehensive)
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Switch, ActivityIndicator, Alert, Image, Modal, RefreshControl, Share,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { CitySelectorSheet } from "../components/CitySelectorSheet";
import { listingsApi, storefrontApi } from "../services/tairApi";
import { API_URL } from "../services/api";
import { coordsFor } from "../constants/cityCoords";

const TEAL = "#1B3D2F";
const BORDER = "#e2e8f0";

const resolveMediaUrl = (u) =>
  !u ? "" : u.startsWith("http") ? u : `${API_URL}${u}`;

const IDENTITY_COLORS = [
  "#1B3D2F",
  "#3D6B54",
  "#C6A15B",
  "#8A6A2E",
  "#0F241C",
  "#0E7490",
  "#EC4899",
  "#F97316",
  "#7C3AED",
  "#059669",
  "#8B3A2F",
  "#EAB308",
];
const RESPONSE_PROMISES = ["خلال ساعة", "نفس اليوم", "خلال يومين"];
const DAYS_AR = { sat: "السبت", sun: "الأحد", mon: "الاثنين", tue: "الثلاثاء", wed: "الأربعاء", thu: "الخميس", fri: "الجمعة" };

const TABS = [
  { id: "identity", label: "الهوية", icon: "color-palette" },
  { id: "hours", label: "الدوام", icon: "time" },
  { id: "media", label: "الوسائط", icon: "images" },
  { id: "location", label: "الموقع", icon: "location" },
  { id: "service", label: "الخدمة", icon: "briefcase" },
  { id: "sales", label: "العروض", icon: "pricetag" },
  { id: "auto", label: "الأتمتة", icon: "sparkles" },
  { id: "analytics", label: "التحليلات", icon: "bar-chart" },
];

function Section({ title, children, onSave, savedLabel }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSave ? (
          <TouchableOpacity
            style={styles.sectionSaveBtn}
            onPress={onSave}
            testID={`section-save-${title}`}
          >
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.sectionSaveText}>{savedLabel || "حفظ"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function StorefrontHeader({ title, subtitle, onBack, onPreview }) {
  return (
    <View style={styles.storefrontHeader}>
      <TouchableOpacity
        style={styles.headerCloseBtn}
        onPress={onBack}
        testID="storefront-close-btn"
      >
        <Ionicons name="close" size={22} color="#fff" />
        <Text style={styles.headerCloseText}>خروج</Text>
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {onPreview ? (
        <TouchableOpacity style={styles.headerCloseBtn} onPress={onPreview} testID="storefront-preview-btn">
          <Ionicons name="eye" size={16} color="#fff" />
          <Text style={styles.headerCloseText}>عرض</Text>
        </TouchableOpacity>
      ) : <View style={{ width: 88 }} />}
    </View>
  );
}

export default function StorefrontManagerScreen({ user, onBack, onUserChanged, onPreview }) {
  const uid = user?.id || user?.user_id;
  const [tab, setTab] = useState("identity");
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [flashModal, setFlashModal] = useState(false);
  const [flashTitle, setFlashTitle] = useState("");
  const [flashPct, setFlashPct] = useState("10");
  const [flashHours, setFlashHours] = useState("24");
  const [highlightTitle, setHighlightTitle] = useState("");
  const [stockName, setStockName] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponPct, setCouponPct] = useState("10");
  const [cityDraft, setCityDraft] = useState("");
  const [flashListings, setFlashListings] = useState([]);
  const [flashPicks, setFlashPicks] = useState([]);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const s = await storefrontApi.getSettings(uid);
      setSettings(s);
    } catch (e) {
      Alert.alert("خطأ", e?.message || "تعذّر تحميل الإعدادات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === "analytics" && uid) {
      storefrontApi.analytics(uid, 30).then(setAnalytics).catch(() => setAnalytics(null));
    }
  }, [tab, uid]);

  const saveField = async (patch) => {
    setSaving(true);
    try {
      await storefrontApi.updateSettings(uid, patch);
      setSettings((s) => ({ ...(s || {}), ...patch }));
      // Mirror identity-affecting fields into App-level user so Profile updates instantly
      if (onUserChanged) {
        const mirror = {};
        if (patch.about_text !== undefined) mirror.bio = patch.about_text;
        if (patch.logo_url) mirror.avatar = patch.logo_url;
        if (Array.isArray(patch.banner_slides) && patch.banner_slides[0]) {
          mirror.profile_bg_url = patch.banner_slides[0];
        }
        if (Object.keys(mirror).length) onUserChanged(mirror);
      }
    } catch (e) {
      Alert.alert("خطأ", e?.message || "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (kind) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: kind === "logo" ? [1, 1] : kind === "banner" ? [16, 9] : [4, 3],
      quality: 0.85,
    });
    if (res.canceled) return;
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    setSaving(true);
    try {
      const r = await storefrontApi.uploadMedia(uid, kind, uri);
      return r.url;
    } catch (e) {
      Alert.alert("خطأ", e?.message || "تعذّر الرفع");
      return null;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StorefrontHeader onBack={onBack} title="إدارة المتجر" />
        <View style={styles.center}><ActivityIndicator color={TEAL} size="large" /></View>
      </View>
    );
  }

  const s = settings || {};

  return (
    <View style={styles.container}>
      <StorefrontHeader
        onBack={onBack}
        onPreview={onPreview}
        title="إدارة المتجر الاحترافي"
        subtitle={saving ? "جاري الحفظ…" : (s.store_paused ? "المتجر متوقف عن الاستقبال" : "خصّص متجرك بحرية")}
      />

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => setTab(t.id)}
            testID={`sf-tab-${t.id}`}
          >
            <Ionicons name={t.icon} size={13} color={tab === t.id ? "#fff" : TEAL} />
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* ==================== IDENTITY ==================== */}
        {tab === "identity" && (
          <>
            <Section title="جاهزية المتجر">
              <View style={styles.colorGrid}>
                {[
                  { ok: !!s.logo_url, label: "الشعار" },
                  { ok: !!(s.about_text || "").trim(), label: "من نحن" },
                  { ok: !!s.location?.city, label: "المدينة" },
                  { ok: (s.banner_slides || []).length > 0, label: "البانر" },
                  { ok: !!(s.contact_prefs?.whatsapp || s.contact_prefs?.call || s.contact_prefs?.chat), label: "التواصل" },
                  { ok: (s.business_hours || []).some((h) => !h.closed), label: "الدوام" },
                ].map((item) => (
                  <View key={item.label} style={[styles.readyChip, item.ok && styles.readyChipOn]}>
                    <Ionicons name={item.ok ? "checkmark-circle" : "ellipse-outline"} size={14} color={item.ok ? "#059669" : "#8A7B66"} />
                    <Text style={styles.readyText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </Section>
            <Section title="لون هوية المتجر">
              <View style={styles.colorGrid}>
                {IDENTITY_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c },
                      s.identity_color === c && styles.colorSwatchActive,
                    ]}
                    onPress={() => saveField({ identity_color: c })}
                    testID={`color-${c}`}
                  >
                    {s.identity_color === c && <Ionicons name="checkmark" size={20} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </View>
            </Section>

            <Section title="شعار المتجر (Logo)">
              <TouchableOpacity
                style={styles.logoBtn}
                onPress={async () => {
                  const url = await uploadImage("logo");
                  if (url) saveField({ logo_url: url });
                }}
              >
                {s.logo_url ? (
                  <Image source={{ uri: resolveMediaUrl(s.logo_url) }} style={styles.logoImg} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={26} color={TEAL} />
                    <Text style={styles.logoText}>ارفع شعارك (1:1)</Text>
                  </>
                )}
              </TouchableOpacity>
            </Section>

            <Section
              title="من نحن (About)"
              onSave={() => saveField({ about_text: s.about_text })}
            >
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: "top" }]}
                value={s.about_text || ""}
                onChangeText={(t) => setSettings({ ...s, about_text: t })}
                placeholder="اكتب قصة متجرك…"
                placeholderTextColor="#8A7B66"
                multiline
              />
            </Section>

            <Section title="تفضيلات التواصل">
              {["whatsapp", "call", "chat"].map((k) => (
                <View key={k} style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{k === "whatsapp" ? "واتساب" : k === "call" ? "اتصال" : "دردشة داخلية"}</Text>
                  <Switch
                    value={s.contact_prefs?.[k] || false}
                    onValueChange={(v) => saveField({ contact_prefs: { ...(s.contact_prefs || {}), [k]: v } })}
                  />
                </View>
              ))}
            </Section>
          </>
        )}

        {/* ==================== HOURS ==================== */}
        {tab === "hours" && (
          <Section
            title="ساعات العمل الأسبوعية"
            onSave={() => saveField({ business_hours: s.business_hours })}
          >
            {(s.business_hours || []).map((h, i) => (
              <View key={h.day} style={styles.hourRow}>
                <Text style={styles.dayLabel}>{DAYS_AR[h.day]}</Text>
                <Switch
                  value={!h.closed}
                  onValueChange={(v) => {
                    const next = [...(s.business_hours || [])];
                    next[i] = { ...next[i], closed: !v };
                    saveField({ business_hours: next });
                  }}
                />
                <TextInput
                  style={[styles.timeInput, h.closed && { opacity: 0.4 }]}
                  editable={!h.closed}
                  value={h.open}
                  onChangeText={(t) => {
                    const next = [...(s.business_hours || [])];
                    next[i] = { ...next[i], open: t };
                    setSettings({ ...s, business_hours: next });
                  }}
                  // save on section button
                  placeholder="09:00"
                />
                <Text style={{ color: "#6B5E4A" }}>→</Text>
                <TextInput
                  style={[styles.timeInput, h.closed && { opacity: 0.4 }]}
                  editable={!h.closed}
                  value={h.close}
                  onChangeText={(t) => {
                    const next = [...(s.business_hours || [])];
                    next[i] = { ...next[i], close: t };
                    setSettings({ ...s, business_hours: next });
                  }}
                  // save on section button
                  placeholder="22:00"
                />
              </View>
            ))}
          </Section>
        )}

        {/* ==================== MEDIA ==================== */}
        {tab === "media" && (
          <>
            <Section title="بانر متحرك (حتى 5 صور)">
              <View style={styles.mediaGrid}>
                {(s.banner_slides || []).map((url, i) => (
                  <View key={i} style={styles.mediaThumbBox}>
                    <Image source={{ uri: resolveMediaUrl(url) }} style={styles.mediaThumb} />
                    <TouchableOpacity
                      style={styles.removeBadge}
                      onPress={() => saveField({ banner_slides: (s.banner_slides || []).filter((_, x) => x !== i) })}
                    >
                      <Ionicons name="close" size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {(s.banner_slides || []).length < 5 && (
                  <TouchableOpacity
                    style={styles.addMediaBox}
                    onPress={async () => {
                      const url = await uploadImage("banner");
                      if (url) saveField({ banner_slides: [...(s.banner_slides || []), url] });
                    }}
                  >
                    <Ionicons name="add" size={26} color={TEAL} />
                  </TouchableOpacity>
                )}
              </View>
            </Section>

            <Section title="معرض المتجر (Portfolio — حتى 6 صور)">
              <View style={styles.mediaGrid}>
                {(s.portfolio_images || []).map((url, i) => (
                  <View key={i} style={styles.mediaThumbBox}>
                    <Image source={{ uri: resolveMediaUrl(url) }} style={styles.mediaThumb} />
                    <TouchableOpacity
                      style={styles.removeBadge}
                      onPress={() => saveField({ portfolio_images: (s.portfolio_images || []).filter((_, x) => x !== i) })}
                    >
                      <Ionicons name="close" size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {(s.portfolio_images || []).length < 6 && (
                  <TouchableOpacity
                    style={styles.addMediaBox}
                    onPress={async () => {
                      const url = await uploadImage("portfolio");
                      if (url) saveField({ portfolio_images: [...(s.portfolio_images || []), url] });
                    }}
                  >
                    <Ionicons name="add" size={26} color={TEAL} />
                  </TouchableOpacity>
                )}
              </View>
            </Section>

            <Section title="قصص المتجر">
              <Text style={styles.hint}>دوائر فوق واجهة المتجر. اكتب العنوان ثم اختر صورة.</Text>
              {(s.highlights || []).map((h, i) => (
                <View key={`${h.title}-${i}`} style={styles.saleCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.saleTitle}>{h.title || "قصة"}</Text>
                    <Text style={styles.saleMeta}>{h.cover ? "فيها صورة" : "بلا صورة"}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      const next = (s.highlights || []).filter((_, x) => x !== i);
                      saveField({ highlights: next });
                    }}
                  >
                    <Ionicons name="trash" size={18} color="#8B3A2F" />
                  </TouchableOpacity>
                </View>
              ))}
              {(s.highlights || []).length < 8 ? (
                <View style={{ marginTop: 8 }}>
                  <TextInput
                    style={styles.input}
                    value={highlightTitle}
                    onChangeText={setHighlightTitle}
                    placeholder="عنوان القصة، مثل: وصول كاسكو"
                    placeholderTextColor="#8A7B66"
                  />
                  <TouchableOpacity
                    style={[styles.primaryBtn, { marginTop: 8 }]}
                    onPress={async () => {
                      const title = highlightTitle.trim();
                      if (!title) {
                        Alert.alert("تنبيه", "اكتب عنوان القصة أولاً");
                        return;
                      }
                      const url = await uploadImage("portfolio");
                      if (!url) return;
                      const next = [
                        ...(s.highlights || []),
                        { title, cover: url, items: [{ image: url, caption: title }] },
                      ];
                      await saveField({ highlights: next });
                      setHighlightTitle("");
                    }}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={styles.primaryBtnText}>أضف القصة</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </Section>
          </>
        )}

        {/* ==================== LOCATION ==================== */}
        {tab === "location" && (
          <>
            <Section
              title="مدينة المتجر"
              onSave={() => saveField({ location: s.location })}
            >
              <TouchableOpacity
                style={styles.input}
                onPress={() => setCityOpen(true)}
                testID="store-city-btn"
              >
                <Text style={{ textAlign: "right", color: s.location?.city ? "#1B3D2F" : "#8A7B66", fontWeight: "800" }}>
                  {s.location?.city || s.location?.address_label || "اختر المدينة"}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={s.location?.address_label || ""}
                placeholder="وصف قصير للموقع (اختياري)"
                onChangeText={(t) => setSettings({ ...s, location: { ...(s.location || {}), address_label: t } })}
              />
            </Section>

            <Section
              title="الاستلام من المتجر (Pickup)"
              onSave={() => saveField({ pickup_enabled: s.pickup_enabled, pickup_note: s.pickup_note })}
            >
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>تفعيل الاستلام</Text>
                <Switch
                  value={!!s.pickup_enabled}
                  onValueChange={(v) => setSettings({ ...s, pickup_enabled: v })}
                />
              </View>
              {s.pickup_enabled && (
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={s.pickup_note || ""}
                  placeholder="تعليمات (مثل: الأربعاء والسبت 4-8 مساءً)"
                  onChangeText={(t) => setSettings({ ...s, pickup_note: t })}
                />
              )}
            </Section>
          </>
        )}

        {/* ==================== SERVICE ==================== */}
        {tab === "service" && (
          <Section
            title="خدمة الزبائن"
            onSave={() => saveField({
              store_paused: !!s.store_paused,
              announcement: s.announcement || "",
              response_promise: s.response_promise || "",
              shipping_note: s.shipping_note || "",
              return_note: s.return_note || "",
              delivery_cities: s.delivery_cities || [],
            })}
          >
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>إيقاف المتجر مؤقتاً</Text>
              <Switch
                value={!!s.store_paused}
                onValueChange={(v) => {
                  setSettings({ ...s, store_paused: v });
                  saveField({ store_paused: v });
                }}
              />
            </View>
            <Text style={styles.hint}>عند الإيقاف يظهر تنبيه للزائر، ويصل للمراسل رد واحد في اليوم.</Text>
            <TextInput
              style={[styles.input, { marginTop: 8, height: 72, textAlignVertical: "top" }]}
              value={s.announcement || ""}
              onChangeText={(t) => setSettings({ ...s, announcement: t })}
              placeholder="إعلان قصير على واجهة المتجر"
              placeholderTextColor="#8A7B66"
              multiline
            />
            <Text style={styles.fieldLabel}>وعد الرد</Text>
            <View style={styles.colorGrid}>
              {RESPONSE_PROMISES.map((label) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.readyChip, s.response_promise === label && styles.readyChipOn]}
                  onPress={() => setSettings({ ...s, response_promise: s.response_promise === label ? "" : label })}
                >
                  <Text style={styles.readyText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, { marginTop: 8, height: 72, textAlignVertical: "top" }]}
              value={s.shipping_note || ""}
              onChangeText={(t) => setSettings({ ...s, shipping_note: t })}
              placeholder="التوصيل: المدن والمدة"
              placeholderTextColor="#8A7B66"
              multiline
            />
            <TextInput
              style={[styles.input, { height: 72, textAlignVertical: "top" }]}
              value={s.return_note || ""}
              onChangeText={(t) => setSettings({ ...s, return_note: t })}
              placeholder="الاسترجاع والاستبدال"
              placeholderTextColor="#8A7B66"
              multiline
            />
            <Text style={styles.fieldLabel}>مدن التوصيل</Text>
            <View style={styles.colorGrid}>
              {(s.delivery_cities || []).map((city) => (
                <TouchableOpacity
                  key={city}
                  style={styles.readyChip}
                  onPress={() => setSettings({ ...s, delivery_cities: (s.delivery_cities || []).filter((c) => c !== city) })}
                >
                  <Text style={styles.readyText}>{city} ×</Text>
                </TouchableOpacity>
              ))}
            </View>
            {(s.delivery_cities || []).length < 8 ? (
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={cityDraft}
                  onChangeText={setCityDraft}
                  placeholder="أضف مدينة"
                  placeholderTextColor="#8A7B66"
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 0, paddingHorizontal: 16 }]}
                  onPress={() => {
                    const city = cityDraft.trim();
                    if (!city) return;
                    if ((s.delivery_cities || []).includes(city)) {
                      setCityDraft("");
                      return;
                    }
                    setSettings({ ...s, delivery_cities: [...(s.delivery_cities || []), city].slice(0, 8) });
                    setCityDraft("");
                  }}
                >
                  <Text style={styles.primaryBtnText}>أضف</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </Section>
        )}

        {/* ==================== SALES ==================== */}
        {tab === "sales" && (
          <>
            <Section title="عروض لفترة محدودة">
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setFlashModal(true)}>
                <Ionicons name="flash" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>أنشئ عرض Flash جديد</Text>
              </TouchableOpacity>
              {(s.flash_sales || []).map((sale) => {
                const ended = new Date(sale.ends_at).getTime() < Date.now();
                return (
                <View key={sale.id} style={styles.saleCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.saleTitle}>{sale.title}{ended ? " · منتهٍ" : ""}</Text>
                    <Text style={styles.saleMeta}>خصم {sale.discount_pct}% • ينتهي {new Date(sale.ends_at).toLocaleString("ar-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
                  </View>
                  <TouchableOpacity onPress={async () => { await storefrontApi.deleteFlashSale(uid, sale.id); load(); }}>
                    <Ionicons name="trash" size={18} color="#8B3A2F" />
                  </TouchableOpacity>
                </View>
                );
              })}
            </Section>

            <Section title="كوبونات الخصم">
              <Text style={styles.hint}>يظهر الكود للزائر لينسخه ويذكره عند التواصل. الخصم لا يُحسب تلقائياً داخل الطلب.</Text>
              {(s.coupons || []).map((c) => (
                <View key={c.code} style={styles.saleCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.saleTitle}>{c.code}</Text>
                    <Text style={styles.saleMeta}>خصم {c.discount_pct}% • {c.active ? "ظاهر" : "مخفي"}</Text>
                  </View>
                  <Switch
                    value={c.active !== false}
                    onValueChange={async (v) => {
                      try {
                        const res = await storefrontApi.setCouponActive(uid, c.code, v);
                        setSettings((prev) => ({ ...prev, coupons: res?.coupons || prev?.coupons }));
                      } catch (e) {
                        Alert.alert("تعذّر التحديث", e?.message || "حاول مرة أخرى");
                      }
                    }}
                  />
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        const res = await storefrontApi.deleteCoupon(uid, c.code);
                        setSettings((prev) => ({ ...prev, coupons: res?.coupons || [] }));
                      } catch (e) {
                        Alert.alert("تعذّر الحذف", e?.message || "حاول مرة أخرى");
                      }
                    }}
                  >
                    <Ionicons name="trash" size={18} color="#8B3A2F" />
                  </TouchableOpacity>
                </View>
              ))}
              <TextInput style={styles.input} value={couponCode} onChangeText={setCouponCode} placeholder="الكود، مثل TAIR10" placeholderTextColor="#8A7B66" autoCapitalize="characters" />
              <TextInput style={styles.input} value={couponPct} onChangeText={setCouponPct} placeholder="نسبة الخصم" placeholderTextColor="#8A7B66" keyboardType="number-pad" />
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={async () => {
                  const pct = parseFloat(String(couponPct).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
                  if (!couponCode.trim() || !Number.isFinite(pct)) {
                    Alert.alert("تنبيه", "اكتب الكود ونسبة الخصم");
                    return;
                  }
                  try {
                    await storefrontApi.createCoupon(uid, { code: couponCode.trim(), discount_pct: pct, active: true });
                    setCouponCode("");
                    setCouponPct("10");
                    load();
                  } catch (e) {
                    Alert.alert("تعذّر الحفظ", e?.message || "حاول مرة أخرى");
                  }
                }}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>أضف الكوبون</Text>
              </TouchableOpacity>
            </Section>

            <Section title="المخزون">
              <Text style={styles.hint}>عدد المتاح من كل نوع في متجرك. الصفر يحذف السطر.</Text>
              {Object.entries(s.inventory || {}).map(([name, row]) => (
                <View key={name} style={styles.saleCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.saleTitle}>{name}</Text>
                    <Text style={styles.saleMeta}>متاح {row?.available ?? 0}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={async () => {
                      await storefrontApi.updateInventory(uid, { species_id: name, available: 0, reserved: 0 });
                      setSettings((prev) => {
                        const inventory = { ...(prev?.inventory || {}) };
                        delete inventory[name];
                        return { ...prev, inventory };
                      });
                    }}
                  >
                    <Ionicons name="trash" size={18} color="#8B3A2F" />
                  </TouchableOpacity>
                </View>
              ))}
              <TextInput
                style={styles.input}
                value={stockName}
                onChangeText={setStockName}
                placeholder="النوع، مثل: بادجي"
                placeholderTextColor="#8A7B66"
              />
              <TextInput
                style={styles.input}
                value={stockQty}
                onChangeText={setStockQty}
                placeholder="العدد المتاح"
                placeholderTextColor="#8A7B66"
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={async () => {
                  const name = stockName.trim();
                  const qty = parseInt(String(stockQty).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)), 10);
                  if (!name || !Number.isFinite(qty) || qty < 0) {
                    Alert.alert("تنبيه", "اكتب النوع والعدد");
                    return;
                  }
                  try {
                    const res = await storefrontApi.updateInventory(uid, { species_id: name, available: qty, reserved: 0 });
                    setSettings((prev) => ({ ...prev, inventory: res?.inventory || { ...(prev?.inventory || {}), [name]: { available: qty, reserved: 0 } } }));
                    setStockName("");
                    setStockQty("");
                  } catch (e) {
                    Alert.alert("تعذّر الحفظ", e?.message || "حاول مرة أخرى");
                  }
                }}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>احفظ الكمية</Text>
              </TouchableOpacity>
            </Section>
          </>
        )}

        {/* ==================== AUTO ==================== */}
        {tab === "auto" && (
          <>
            <Section
              title="رد آلي خارج الدوام"
              onSave={() => saveField({ auto_reply_enabled: s.auto_reply_enabled, auto_reply_message: s.auto_reply_message })}
            >
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>تفعيل الرد الآلي</Text>
                <Switch
                  value={!!s.auto_reply_enabled}
                  onValueChange={(v) => setSettings({ ...s, auto_reply_enabled: v })}
                />
              </View>
              {s.auto_reply_enabled && (
                <TextInput
                  style={[styles.input, { marginTop: 8, height: 90, textAlignVertical: "top" }]}
                  value={s.auto_reply_message || ""}
                  onChangeText={(t) => setSettings({ ...s, auto_reply_message: t })}
                  placeholder="مثال: شكراً لتواصلك، سنرد عليك خلال ساعات العمل."
                  placeholderTextColor="#8A7B66"
                  multiline
                />
              )}
            </Section>

            <Section title="خارج الدوام">
              <Text style={styles.hint}>يُرسل الرد مرة واحدة في اليوم لكل محادثة، خارج ساعات العمل فقط. أثناء الدوام يرد البائع بنفسه.</Text>
            </Section>
          </>
        )}

        {/* ==================== ANALYTICS ==================== */}
        {tab === "analytics" && (
          <>
            {!analytics ? (
              <ActivityIndicator color={TEAL} />
            ) : (
              <>
                <Section title="آخر 30 يوم">
                  <View style={styles.metricsGrid}>
                    <View style={styles.metric}>
                      <Ionicons name="people" size={20} color={TEAL} />
                      <Text style={styles.metricValue}>{analytics.total_visitors}</Text>
                      <Text style={styles.metricLabel}>زائر</Text>
                    </View>
                    <View style={styles.metric}>
                      <Ionicons name="eye" size={20} color="#f59e0b" />
                      <Text style={styles.metricValue}>{analytics.total_listings_views}</Text>
                      <Text style={styles.metricLabel}>مشاهدة إعلان</Text>
                    </View>
                    <View style={styles.metric}>
                      <Ionicons name="checkmark-circle" size={20} color="#2F6B45" />
                      <Text style={styles.metricValue}>{analytics.completed_orders_count}</Text>
                      <Text style={styles.metricLabel}>طلب مكتمل</Text>
                    </View>
                    <View style={styles.metric}>
                      <Ionicons name="trending-up" size={20} color="#C6A15B" />
                      <Text style={styles.metricValue}>{analytics.predicted_next_month_sar} ر.س</Text>
                      <Text style={styles.metricLabel}>تنبؤ الشهر القادم</Text>
                    </View>
                    <View style={styles.metric}>
                      <Ionicons name="chatbubbles" size={20} color="#0E7490" />
                      <Text style={styles.metricValue}>{analytics.messages_received || 0}</Text>
                      <Text style={styles.metricLabel}>رسالة واردة</Text>
                    </View>
                    <View style={styles.metric}>
                      <Ionicons name={analytics.open_now ? "sunny" : "moon"} size={20} color={analytics.store_paused ? "#8B3A2F" : "#059669"} />
                      <Text style={styles.metricValue}>{analytics.store_paused ? "متوقف" : analytics.open_now ? "مفتوح" : "مغلق"}</Text>
                      <Text style={styles.metricLabel}>حالة المتجر الآن</Text>
                    </View>
                  </View>
                </Section>
                {(analytics.low_stock || []).length > 0 && (
                  <Section title="مخزون منخفض">
                    {analytics.low_stock.map((row) => (
                      <View key={row.name} style={styles.rowItem}>
                        <Text style={styles.rowItemLabel}>{row.name}</Text>
                        <Text style={styles.rowItemVal}>{row.available} متبقٍ</Text>
                      </View>
                    ))}
                  </Section>
                )}

                {(analytics.top_cities || []).length > 0 && (
                  <Section title="أكثر المدن زيارة">
                    {analytics.top_cities.map(([city, count]) => (
                      <View key={city} style={styles.rowItem}>
                        <Text style={styles.rowItemLabel}>{city}</Text>
                        <Text style={styles.rowItemVal}>{count} زائر</Text>
                      </View>
                    ))}
                  </Section>
                )}

                {(analytics.top_listings || []).length > 0 && (
                  <Section title="أفضل إعلاناتك أداءً">
                    {analytics.top_listings.map((l) => (
                      <View key={l.listing_id} style={styles.rowItem}>
                        <Text style={styles.rowItemLabel} numberOfLines={1}>{l.title}</Text>
                        <Text style={styles.rowItemVal}>{l.views} مشاهدة</Text>
                      </View>
                    ))}
                  </Section>
                )}

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={async () => {
                    const lines = [
                      "تقرير متجر طير — آخر ٣٠ يوم",
                      `الزوار: ${analytics.total_visitors ?? 0}`,
                      `مشاهدات الإعلانات: ${analytics.total_listings_views ?? 0}`,
                      `الطلبات المكتملة: ${analytics.completed_orders_count ?? 0}`,
                      `توقع الشهر القادم: ${analytics.predicted_next_month_sar ?? 0} ر.س`,
                    ];
                    (analytics.top_cities || []).forEach(([city, count]) => lines.push(`${city}: ${count} زائر`));
                    (analytics.top_listings || []).forEach((l) => lines.push(`${l.title}: ${l.views} مشاهدة`));
                    try {
                      await Share.share({ message: lines.join("\n"), title: "تقرير المتجر" });
                    } catch (e) {
                      Alert.alert("تعذّرت المشاركة", e?.message || "حاول مرة أخرى");
                    }
                  }}
                >
                  <Ionicons name="share-social" size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>مشاركة التقرير</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Flash Sale Modal */}
      <Modal visible={flashModal} transparent animationType="slide" onRequestClose={() => setFlashModal(false)} onShow={() => {
        if (!uid) return;
        listingsApi.bySeller(uid, false).then((res) => {
          const items = Array.isArray(res) ? res : (res?.items || []);
          setFlashListings(items.filter((l) => l?.status !== "sold").slice(0, 20));
        }).catch(() => setFlashListings([]));
      }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <TouchableOpacity onPress={() => setFlashModal(false)}><Ionicons name="close" size={24} color="#6B5E4A" /></TouchableOpacity>
              <Text style={styles.modalTitle}>عرض Flash جديد</Text>
              <View style={{ width: 24 }} />
            </View>
            <TextInput style={styles.input} value={flashTitle} onChangeText={setFlashTitle} placeholder="عنوان العرض" />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.fieldLabel}>نسبة الخصم %</Text>
                <TextInput style={styles.input} value={flashPct} onChangeText={setFlashPct} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.fieldLabel}>مدة (ساعات)</Text>
                <TextInput style={styles.input} value={flashHours} onChangeText={setFlashHours} keyboardType="numeric" />
              </View>
            </View>
            {flashListings.length > 0 ? (
              <View style={{ maxHeight: 160 }}>
                <Text style={styles.fieldLabel}>الإعلانات المشمولة</Text>
                <ScrollView>
                  {flashListings.map((l) => {
                    const on = flashPicks.includes(l.listing_id);
                    return (
                      <TouchableOpacity
                        key={l.listing_id}
                        style={styles.switchRow}
                        onPress={() => setFlashPicks((prev) => on ? prev.filter((id) => id !== l.listing_id) : [...prev, l.listing_id].slice(0, 12))}
                      >
                        <Text style={styles.switchLabel} numberOfLines={1}>{l.title}</Text>
                        <Ionicons name={on ? "checkbox" : "square-outline"} size={18} color={TEAL} />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={async () => {
                const ends = new Date(Date.now() + (parseFloat(flashHours) || 24) * 3600 * 1000).toISOString();
                const pct = parseFloat(String(flashPct).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
                try {
                  await storefrontApi.createFlashSale(uid, {
                    title: flashTitle || "عرض",
                    discount_pct: Number.isFinite(pct) ? pct : 10,
                    ends_at: ends,
                    listing_ids: flashPicks,
                  });
                  setFlashModal(false);
                  setFlashTitle(""); setFlashPct("10"); setFlashHours("24"); setFlashPicks([]);
                  load();
                } catch (e) { Alert.alert("خطأ", e?.message || "تعذّر الحفظ"); }
              }}
            >
              <Text style={styles.primaryBtnText}>إنشاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <CitySelectorSheet
        visible={cityOpen}
        title="مدينة المتجر"
        selected={settings?.location?.city || null}
        onClose={() => setCityOpen(false)}
        onSelect={(city) => {
          if (!city) return;
          const pos = coordsFor(city);
          setSettings((prev) => ({
            ...(prev || {}),
            location: {
              ...(prev?.location || {}),
              city,
              address_label: prev?.location?.address_label && prev.location.address_label !== prev.location.city
                ? prev.location.address_label
                : city,
              lat: pos ? pos[0] : null,
              lng: pos ? pos[1] : null,
            },
          }));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F1E8" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabsRow: { flexGrow: 0, maxHeight: 46, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: BORDER },
  tab: { flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8, marginRight: 6, borderRadius: 999, backgroundColor: "#f0fdfa", borderWidth: 1, borderColor: "#99f6e4" },
  tabActive: { backgroundColor: TEAL, borderColor: TEAL },
  tabText: { color: TEAL, fontSize: 11.5, fontWeight: "800" },
  tabTextActive: { color: "#fff" },
  section: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, marginBottom: 12 },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 13, color: TEAL, fontWeight: "900", textAlign: "right", flex: 1 },
  sectionSaveBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: TEAL,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sectionSaveText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  storefrontHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 14,
    backgroundColor: TEAL,
  },
  headerCloseBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    width: 88,
    justifyContent: "center",
  },
  headerCloseText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  headerTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  headerSubtitle: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 2, fontWeight: "600" },
  colorGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  colorSwatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  colorSwatchActive: { borderColor: "#0F241C" },
  logoBtn: { width: 100, height: 100, borderRadius: 14, borderWidth: 2, borderStyle: "dashed", borderColor: BORDER, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F1E8" },
  logoImg: { width: 100, height: 100, borderRadius: 14 },
  logoText: { color: TEAL, fontSize: 11, marginTop: 4, fontWeight: "700" },
  input: { backgroundColor: "#F7F1E8", borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 10, fontSize: 13.5, color: "#0F241C", textAlign: "right", marginBottom: 6 },
  switchRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  switchLabel: { fontSize: 13, color: "#0F241C", fontWeight: "700" },
  hourRow: { flexDirection: "row-reverse", alignItems: "center", gap: 5, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  dayLabel: { width: 60, fontSize: 12, fontWeight: "800", color: "#0F241C", textAlign: "right" },
  timeInput: { flex: 1, backgroundColor: "#F7F1E8", borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, fontSize: 12, color: "#0F241C", textAlign: "center" },
  mediaGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  mediaThumbBox: { position: "relative", width: 90, height: 68 },
  mediaThumb: { width: 90, height: 68, borderRadius: 10 },
  removeBadge: { position: "absolute", top: 2, left: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: "#8B3A2F", alignItems: "center", justifyContent: "center" },
  addMediaBox: { width: 90, height: 68, borderRadius: 10, borderWidth: 2, borderStyle: "dashed", borderColor: TEAL, alignItems: "center", justifyContent: "center", backgroundColor: "#f0fdfa" },
  row: { flexDirection: "row-reverse", gap: 8, marginBottom: 6 },
  primaryBtn: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: TEAL, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  saleCard: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  saleTitle: { fontSize: 13, fontWeight: "800", color: "#0F241C", textAlign: "right" },
  saleMeta: { fontSize: 11, color: "#6B5E4A", fontWeight: "600", textAlign: "right", marginTop: 2 },
  hint: { color: "#6B5E4A", fontSize: 12, textAlign: "right", lineHeight: 18 },
  metricsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  metric: { width: "48%", backgroundColor: "#F7F1E8", borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, alignItems: "center" },
  metricValue: { color: "#0F241C", fontSize: 18, fontWeight: "900", marginTop: 4 },
  metricLabel: { color: "#6B5E4A", fontSize: 10, fontWeight: "700", marginTop: 2 },
  rowItem: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  rowItemLabel: { color: "#0F241C", fontSize: 13, fontWeight: "700", flex: 1 },
  rowItemVal: { color: TEAL, fontSize: 12, fontWeight: "800" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: "80%" },
  modalHead: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  modalTitle: { fontSize: 15, fontWeight: "900", color: "#0F241C" },
  fieldLabel: { fontSize: 11, color: TEAL, fontWeight: "800", marginBottom: 4, textAlign: "right" },
  readyChip: { flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: "#F7F1E8", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  readyChipOn: { backgroundColor: "#E7F6EE" },
  readyText: { color: "#0F241C", fontSize: 12, fontWeight: "800" },
});
