/**
 * ClinicLibraryScreen — مكتبة العيادة
 * - المشرفون فقط يرفعون
 * - الجميع يتصفحون
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Pressable, Linking, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { TAIR } from "../constants/tairTheme";
import { clinicLibraryApi, adminExtApi } from "../services/tairApi";
import api from "../services/api";

export default function ClinicLibraryScreen({ user, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myScopes, setMyScopes] = useState([]);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [nTitle, setNTitle] = useState("");
  const [nDesc, setNDesc] = useState("");
  const [nUrl, setNUrl] = useState("");
  const [nType, setNType] = useState("image"); // image | pdf
  const [nCover, setNCover] = useState("");
  const [nCategory, setNCategory] = useState("");
  const [nPages, setNPages] = useState("");
  const [nSource, setNSource] = useState("");
  const [nTags, setNTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // { url, type }

  const uid = user?.user_id || user?.id || user?.email;
  const isAdmin = !!(user?.is_admin || user?.role === "admin" || user?.role === "super_admin");
  const canUpload = isAdmin || myScopes.includes("clinic") || myScopes.includes("general") || myScopes.includes("clinic_admin");

  const load = useCallback(async () => {
    try {
      const r = await clinicLibraryApi.list(query);
      setItems(r?.items || []);
    } catch { setItems([]); }
    finally { setLoading(false); }
    try {
      if (uid) {
        const r = await adminExtApi.myScopes(uid);
        setMyScopes(r?.scopes || []);
      }
    } catch {}
  }, [uid, query]);

  useEffect(() => { load(); }, [load]);

  const uploadFile = async (uri, mime, filename) => {
    const form = new FormData();
    form.append("file", { uri, name: filename || "file.pdf", type: mime || "application/pdf" });
    form.append("user_id", uid || "");
    const resp = await api.fetch("/api/listings/upload-pdf", { method: "POST", body: form });
    if (!resp?.ok) {
      let msg = `فشل الرفع (${resp?.status || "?"})`;
      try { const j = await resp.json(); msg = j?.detail || msg; } catch {}
      throw new Error(msg);
    }
    const j = await resp.json();
    return j?.url || j?.file_url;
  };

  const pickImage = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.9, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      if (r.canceled || !r.assets?.length) return;
      const a = r.assets[0];
      const url = await uploadFile(a.uri, a.mimeType || "image/jpeg", "cover.jpg");
      if (url) { setNUrl(url); setNType("image"); setNCover(url); }
    } catch { Alert.alert("خطأ", "فشل رفع الصورة"); }
  };

  const pickPdf = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: "application/pdf", copyToCacheDirectory: true, multiple: false,
      });
      if (r.canceled || !r.assets?.length) return;
      const a = r.assets[0];
      const url = await uploadFile(a.uri, "application/pdf", a.name || "doc.pdf");
      if (url) {
        setNUrl(url); setNType("pdf");
        if (!nCover) setNCover(""); // user can set cover separately
      }
    } catch (e) { Alert.alert("خطأ", e?.message || "فشل رفع الـPDF"); }
  };

  const pickCover = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
      if (r.canceled || !r.assets?.length) return;
      const a = r.assets[0];
      const url = await uploadFile(a.uri, a.mimeType || "image/jpeg", "cover.jpg");
      if (url) setNCover(url);
    } catch { Alert.alert("خطأ", "فشل رفع الغلاف"); }
  };

  const submit = async () => {
    if (nTitle.trim().length < 2 || !nUrl.trim())
      return Alert.alert("تنبيه", "اكتب عنواناً وارفع الملف");
    setBusy(true);
    try {
      const tags = nTags.split(/[,،\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 10);
      await clinicLibraryApi.add({
        title: nTitle.trim(),
        description: nDesc.trim(),
        file_url: nUrl,
        file_type: nType,
        cover_url: nCover || (nType === "image" ? nUrl : ""),
        category: nCategory.trim(),
        pages: parseInt(nPages, 10) || 0,
        source: nSource.trim(),
        tags,
      }, uid);
      setAddOpen(false);
      setNTitle(""); setNDesc(""); setNUrl(""); setNCover("");
      setNCategory(""); setNPages(""); setNSource(""); setNTags(""); setNType("image");
      load();
    } catch (e) { Alert.alert("خطأ", e?.message || "تعذّر الإضافة"); }
    finally { setBusy(false); }
  };

  const deleteItem = (id) => {
    Alert.alert("حذف", "حذف هذا الملف من المكتبة؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try { await clinicLibraryApi.delete(id, uid); load(); } catch (e) { Alert.alert("خطأ", e?.message || "تعذّر"); }
      }},
    ]);
  };

  const openPreview = (item) => {
    if (item.file_type === "pdf") {
      setPreview({ url: item.file_url, type: "pdf", title: item.title, pages: item.pages });
    } else {
      setPreview({ url: item.file_url, type: "image" });
    }
  };

  const render = ({ item }) => (
    <TouchableOpacity onPress={() => openPreview(item)} style={s.card} testID={`lib-item-${item.library_id}`}>
      <View style={s.thumb}>
        {item.file_type === "pdf" ? (
          <View style={{ flex: 1, backgroundColor: "#8B2635", alignItems: "center", justifyContent: "center" }}>
            {item.cover_url ? (
              <Image source={{ uri: item.cover_url }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <>
                <Ionicons name="document-text" size={36} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900", marginTop: 2 }}>ملف PDF</Text>
              </>
            )}
            <View style={s.pdfTag}>
              <Text style={s.pdfTagText}>PDF</Text>
            </View>
          </View>
        ) : (item.cover_url || item.file_url) ? (
          <Image source={{ uri: item.cover_url || item.file_url }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <Ionicons name="document-outline" size={28} color={TAIR.emerald} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={2}>{item.title}</Text>
        {item.category ? <Text style={s.catChip}>{item.category}</Text> : null}
        <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 4, alignItems: "center" }}>
          {item.pages ? (
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 2 }}>
              <Ionicons name="book-outline" size={11} color={TAIR.textSoft} />
              <Text style={{ color: TAIR.textSoft, fontSize: 10 }}>{item.pages} صفحة</Text>
            </View>
          ) : null}
          {item.source ? <Text style={{ color: TAIR.goldDark, fontSize: 10, fontWeight: "800" }}>· {item.source}</Text> : null}
        </View>
        {item.description ? <Text style={s.desc} numberOfLines={1}>{item.description}</Text> : null}
      </View>
      {canUpload ? (
        <TouchableOpacity onPress={() => deleteItem(item.library_id)} hitSlop={6} style={s.rm}>
          <Ionicons name="trash-outline" size={16} color="#8B3A2F" />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={s.hBtn}>
          <Ionicons name="chevron-forward" size={22} color={TAIR.gold} />
        </TouchableOpacity>
        <Text style={s.hTitle}>مكتبة العيادة</Text>
        {canUpload ? (
          <TouchableOpacity onPress={() => setAddOpen(true)} style={s.hBtn} testID="library-add">
            <Ionicons name="add-circle" size={22} color={TAIR.gold} />
          </TouchableOpacity>
        ) : <View style={s.hBtn} />}
      </View>

      <View style={s.searchRow}>
        <Ionicons name="search" size={16} color={TAIR.textSoft} />
        <TextInput
          value={query} onChangeText={setQuery}
          placeholder="ابحث في المكتبة..."
          placeholderTextColor={TAIR.textSoft} textAlign="right"
          style={{ flex: 1, color: TAIR.emerald }}
          onSubmitEditing={load}
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(x) => x.library_id}
        renderItem={render}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: "center", padding: 40, gap: 10 }}>
              <Ionicons name="book-outline" size={48} color={TAIR.divider} />
              <Text style={{ color: TAIR.textSoft }}>{query ? "لا توجد نتائج" : "المكتبة فارغة"}</Text>
            </View>
          ) : null
        }
      />
      {loading ? <ActivityIndicator style={{ position: "absolute", top: 200, left: 0, right: 0 }} color={TAIR.emerald} /> : null}

      {/* Add modal */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <View style={s.addSheet}>
            <View style={{ alignItems: "center", paddingTop: 6 }}>
              <View style={{ width: 40, height: 4, backgroundColor: "#D6C9AB", borderRadius: 2 }} />
            </View>
            <Text style={s.addTitle}>إضافة ملف للمكتبة</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              {/* type picker */}
              <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 10 }}>
                <TouchableOpacity onPress={pickImage} style={[s.typeBtn, nType === "image" && { backgroundColor: TAIR.emerald, borderColor: TAIR.gold }]}>
                  <Ionicons name="image" size={16} color={nType === "image" ? TAIR.gold : TAIR.emerald} />
                  <Text style={[s.typeTxt, nType === "image" && { color: TAIR.gold }]}>صورة (JPG/PNG)</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={pickPdf} style={[s.typeBtn, nType === "pdf" && { backgroundColor: TAIR.emerald, borderColor: TAIR.gold }]}>
                  <Ionicons name="document-text" size={16} color={nType === "pdf" ? TAIR.gold : TAIR.emerald} />
                  <Text style={[s.typeTxt, nType === "pdf" && { color: TAIR.gold }]}>PDF</Text>
                </TouchableOpacity>
              </View>

              {nUrl ? (
                <View style={{ marginBottom: 10, alignItems: "center" }}>
                  {nType === "pdf" ? (
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "#FEE2E2", padding: 12, borderRadius: 10 }}>
                      <Ionicons name="document-text" size={28} color="#8B2635" />
                      <Text style={{ color: "#8B2635", fontWeight: "900" }}>تم رفع الـPDF ✓</Text>
                    </View>
                  ) : (
                    <Image source={{ uri: nUrl }} style={{ width: "100%", height: 140, borderRadius: 10 }} />
                  )}
                </View>
              ) : null}

              {/* Cover (only for PDF, since image reuses itself) */}
              {nType === "pdf" ? (
                <View style={{ marginBottom: 10 }}>
                  <Text style={s.fieldLabel}>الغلاف (اختياري)</Text>
                  <TouchableOpacity onPress={pickCover} style={{ height: 100, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: TAIR.gold, alignItems: "center", justifyContent: "center", backgroundColor: TAIR.emerald }}>
                    {nCover ? <Image source={{ uri: nCover }} style={{ width: "100%", height: "100%", borderRadius: 10 }} /> : (
                      <>
                        <Ionicons name="image-outline" size={22} color={TAIR.gold} />
                        <Text style={{ color: TAIR.gold, fontSize: 11, fontWeight: "800", marginTop: 2 }}>اختر صورة غلاف</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}

              <TextInput value={nTitle} onChangeText={setNTitle} placeholder="عنوان الملف" placeholderTextColor={TAIR.textSoft} textAlign="right" style={s.inp} testID="lib-title" />
              <TextInput value={nCategory} onChangeText={setNCategory} placeholder="التصنيف (مثال: أدلة تربية / درة)" placeholderTextColor={TAIR.textSoft} textAlign="right" style={s.inp} testID="lib-cat" />
              <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                <TextInput value={nPages} onChangeText={setNPages} placeholder="عدد الصفحات" placeholderTextColor={TAIR.textSoft} textAlign="right" keyboardType="numeric" style={[s.inp, { flex: 1 }]} testID="lib-pages" />
                <TextInput value={nSource} onChangeText={setNSource} placeholder="المصدر" placeholderTextColor={TAIR.textSoft} textAlign="right" style={[s.inp, { flex: 1 }]} testID="lib-source" />
              </View>
              <TextInput value={nDesc} onChangeText={setNDesc} placeholder="شرح موجز..." placeholderTextColor={TAIR.textSoft} textAlign="right" multiline style={[s.inp, { height: 60, textAlignVertical: "top", paddingTop: 10 }]} testID="lib-desc" />
              <TextInput value={nTags} onChangeText={setNTags} placeholder="وسوم (مثال: تنفس، إسهال، فرخ)" placeholderTextColor={TAIR.textSoft} textAlign="right" style={s.inp} testID="lib-tags" />
            </ScrollView>
            <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 10 }}>
              <TouchableOpacity onPress={submit} disabled={busy} style={[s.submitBtn, busy && { opacity: 0.6 }]} testID="lib-save">
                {busy ? <ActivityIndicator color={TAIR.gold} size="small" /> : <Ionicons name="save" size={16} color={TAIR.gold} />}
                <Text style={{ color: TAIR.gold, fontWeight: "900" }}>حفظ</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAddOpen(false)} style={s.cancelBtn}>
                <Text style={{ color: TAIR.textSoft, fontWeight: "800" }}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Preview modal — PDF uses in-app WebView via Google Docs viewer */}
      <Modal visible={!!preview} transparent={preview?.type === "image"} animationType="fade" onRequestClose={() => setPreview(null)}>
        {preview?.type === "pdf" ? (
          <View style={{ flex: 1, backgroundColor: "#000" }}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", padding: 12, paddingTop: Platform.OS === "ios" ? 50 : 20, backgroundColor: TAIR.emerald, gap: 10, borderBottomWidth: 1, borderBottomColor: TAIR.gold }}>
              <TouchableOpacity onPress={() => setPreview(null)}>
                <Ionicons name="close" size={26} color={TAIR.gold} />
              </TouchableOpacity>
              <Text style={{ color: TAIR.gold, fontSize: 15, fontWeight: "900", flex: 1 }} numberOfLines={1}>{preview.title}</Text>
              <TouchableOpacity onPress={() => Linking.openURL(preview.url)}>
                <Ionicons name="open-outline" size={22} color={TAIR.gold} />
              </TouchableOpacity>
            </View>
            {/* WebView uses Google Docs viewer so PDFs render inline (works on iOS + Android without extra lib) */}
            <PdfWebView url={preview.url} />
          </View>
        ) : (
          <Pressable onPress={() => setPreview(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", alignItems: "center", justifyContent: "center" }}>
            <Image source={{ uri: preview?.url }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
          </Pressable>
        )}
      </Modal>
    </KeyboardAvoidingView>
  );
}

import { WebView } from "react-native-webview";

function PdfWebView({ url }) {
  // Google Docs viewer renders PDFs on both iOS & Android without native lib
  const viewer = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
  return (
    <WebView
      source={{ uri: viewer }}
      style={{ flex: 1, backgroundColor: "#000" }}
      startInLoadingState
      renderLoading={() => (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={TAIR.gold} size="large" />
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingTop: Platform.OS === "ios" ? 48 : 20, paddingBottom: 12,
    backgroundColor: TAIR.emerald, borderBottomWidth: 1, borderBottomColor: TAIR.gold,
  },
  hTitle: { color: TAIR.gold, fontSize: 17, fontWeight: "900" },
  hBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  searchRow: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    marginHorizontal: 12, marginTop: 10, paddingHorizontal: 12,
    backgroundColor: TAIR.card, borderRadius: 10, height: 42,
    borderWidth: 1, borderColor: TAIR.divider,
  },
  card: {
    flexDirection: "row-reverse", gap: 10, alignItems: "center",
    backgroundColor: TAIR.card, borderRadius: 12, padding: 10,
    marginBottom: 8, borderWidth: 1, borderColor: TAIR.divider,
  },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: TAIR.divider, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  title: { color: TAIR.emerald, fontWeight: "900", fontSize: 14, textAlign: "right" },
  desc: { color: TAIR.textSoft, fontSize: 11, textAlign: "right", marginTop: 2, lineHeight: 16 },
  tag: { backgroundColor: "#F5EED9", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: TAIR.divider },
  tagText: { color: TAIR.goldDark, fontSize: 10, fontWeight: "800" },
  rm: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#FDECEA", alignItems: "center", justifyContent: "center" },

  addSheet: { backgroundColor: "#FFFDF8", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32, maxHeight: "90%" },
  addTitle: { color: TAIR.emerald, fontSize: 16, fontWeight: "900", textAlign: "center", marginBottom: 12 },
  typeBtn: {
    flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: TAIR.divider, backgroundColor: TAIR.card,
  },
  typeTxt: { color: TAIR.emerald, fontSize: 12, fontWeight: "900" },
  fieldLabel: { color: TAIR.emerald, fontSize: 11, fontWeight: "900", textAlign: "right", marginBottom: 4 },
  pdfTag: {
    position: "absolute", top: 4, left: 4,
    backgroundColor: "#fff", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
  },
  pdfTagText: { color: "#8B2635", fontSize: 9, fontWeight: "900" },
  catChip: { color: TAIR.goldDark, fontSize: 10, fontWeight: "900", textAlign: "right", marginTop: 2 },
  pickBtn: { alignItems: "center", justifyContent: "center", backgroundColor: TAIR.emerald, borderRadius: 12, paddingVertical: 20, marginBottom: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: TAIR.gold, minHeight: 100 },
  inp: { backgroundColor: TAIR.card, borderRadius: 10, borderWidth: 1, borderColor: TAIR.divider, paddingHorizontal: 14, height: 44, color: TAIR.emerald, marginBottom: 8 },
  submitBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: TAIR.emerald, borderRadius: 10, paddingVertical: 12, borderWidth: 1, borderColor: TAIR.gold },
  cancelBtn: { paddingHorizontal: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: TAIR.bg, borderWidth: 1, borderColor: TAIR.divider },
});
