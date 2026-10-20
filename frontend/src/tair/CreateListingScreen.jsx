// طير — Create Listing (seller flow)
import React, { useEffect, useState } from "react";
import { X, Camera, MapPin, Bird, Video as VideoIcon, Play, Sparkles } from "lucide-react";
import { T, S } from "./tairTheme";
import { tairApi, ALL_LOCATIONS } from "./tairApi";
import { TopBar, BottomSheet, SelectorItem } from "./TairUI";
import { compressImage, getVideoDuration } from "./mediaUtils";
import { AnalyticsEvents } from "./analytics";
import IdentifyBirdModal from "./IdentifyBirdModal";

const GENDERS = [
  { id: "unknown", label: "غير محدد" },
  { id: "male", label: "ذكر" },
  { id: "female", label: "أنثى" },
  { id: "pair", label: "زوج" },
];
const FAMILY_GROUP = {
  parrots: "طيور", songbirds: "طيور", pigeons: "طيور", poultry: "طيور", falcons: "طيور",
  livestock: "حيوانات", horses: "حيوانات", cats: "حيوانات", dogs: "حيوانات",
  small_mammals: "حيوانات", pets: "حيوانات", reptiles: "حيوانات", fish: "حيوانات", insects: "حيوانات",
};

function categoryForFamily(id) {
  if (["hotel_services", "training", "services", "reserves"].includes(id)) return "services";
  if (["feed", "bird_supplies", "animal_supplies"].includes(id)) return "supplies";
  if (["livestock", "horses"].includes(id)) return "livestock";
  if (["cats", "dogs", "small_mammals", "pets"].includes(id)) return "mammals";
  if (id === "fish") return "fish";
  if (id === "reptiles") return "reptiles";
  if (id === "insects") return "insects";
  return "birds";
}

const HEALTH_STATUS = [
  { id: "excellent", label: "ممتازة" },
  { id: "good", label: "جيدة" },
  { id: "needs_care", label: "تحتاج رعاية" },
  { id: "special_needs", label: "احتياجات خاصة" },
];

export default function CreateListingScreen({ user, onBack, onCreated }) {
  const [families, setFamilies] = useState([]);
  const [species, setSpecies] = useState([]);
  const [form, setForm] = useState({
    title: "",
    family: "",
    species: "",
    breed: "",
    gender: "unknown",
    age_months: "",
    color: "",
    description: "",
    price_sar: "",
    price_negotiable: true,
    city: ALL_LOCATIONS[0],
    district: "",
    health: { status: "good", vaccinated: false, ring_number: "", notes: "" },
    images: [],
    videos: [],
  });
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(null); // 'family' | 'species' | 'city'
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    tairApi.listFamilies().then((f) => {
      setFamilies(f);
      if (f.length && !form.family) {
        setForm((prev) => ({ ...prev, family: f[0].family_id }));
      }
    });
  }, []);

  useEffect(() => {
    if (!form.family) return;
    tairApi.listSpecies(undefined, form.family).then((s) => {
      setSpecies(s);
      // reset species selection when family changes
      setForm((prev) => ({ ...prev, species: s[0]?.species_id || "", breed: "" }));
    });
  }, [form.family]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setHealth = (k, v) =>
    setForm((f) => ({ ...f, health: { ...f.health, [k]: v } }));

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (form.images.length + files.length > 6) {
      setError("الحد الأقصى 6 صور");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const urls = [];
      for (const f of files) {
        // Compress before upload to reduce bandwidth
        const compressed = await compressImage(f);
        const url = await tairApi.uploadImage(compressed, user.id || user.user_id);
        urls.push(url);
      }
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch (err) {
      setError(err.response?.data?.detail || "فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (form.videos.length >= 1) {
      setError("مسموح بمقطع واحد فقط");
      return;
    }
    // Enforce 15s duration limit before upload
    const duration = await getVideoDuration(file);
    if (duration && duration > 15.5) {
      setError(`مدة الفيديو ${Math.round(duration)} ثانية — الحدّ الأقصى 15 ثانية`);
      return;
    }
    setUploadingVideo(true);
    setError("");
    try {
      const url = await tairApi.uploadVideo(file, user.id || user.user_id);
      setForm((f) => ({ ...f, videos: [...f.videos, url] }));
    } catch (err) {
      setError(err.response?.data?.detail || "فشل رفع الفيديو");
    } finally {
      setUploadingVideo(false);
    }
  };

  const removeVideo = (idx) => {
    setForm((f) => ({ ...f, videos: f.videos.filter((_, i) => i !== idx) }));
  };

  const removeImage = (idx) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
  };

  const submit = async () => {
    setError("");
    if (!form.title.trim()) return setError("العنوان مطلوب");
    if (!form.description.trim()) return setError("الوصف مطلوب");
    if (!form.family) return setError("اختر الفئة");
    if (!form.price_sar || isNaN(Number(form.price_sar)))
      return setError("السعر مطلوب");
    if (!form.city) return setError("المدينة مطلوبة");

    const payload = {
      ...form,
      category: categoryForFamily(form.family),
      species: form.species || null,
      price_sar: Number(form.price_sar),
      age_months: form.age_months ? Number(form.age_months) : null,
      cover_image: form.images[0] || null,
    };
    setSaving(true);
    try {
      const created = await tairApi.createListing(payload, user.id || user.user_id);
      AnalyticsEvents.listingCreated(payload.family);
      onCreated?.(created);
    } catch (err) {
      setError(err.response?.data?.detail || "فشل إنشاء الإعلان");
    } finally {
      setSaving(false);
    }
  };

  const currentFamily = families.find((f) => f.family_id === form.family);
  const currentSpecies = species.find((s) => s.species_id === form.species);

  return (
    <div style={S.screen} data-testid="create-listing-screen">
      <TopBar title="إعلان جديد" onBack={onBack} />

      <div style={S.container}>
        <div style={S.card}>
          <h2 style={S.h2}>الصور</h2>
          <p style={styles.hint}>حد أقصى 6 صور — الأولى ستكون صورة الغلاف</p>
          <div style={styles.imagesGrid}>
            {form.images.map((url, i) => (
              <div key={i} style={styles.imgTile}>
                <img src={url} alt={`img-${i}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button
                  onClick={() => removeImage(i)}
                  style={styles.imgRemove}
                  data-testid={`remove-image-${i}`}
                  aria-label="حذف"
                >
                  <X size={12} strokeWidth={3} />
                </button>
                {i === 0 && <div style={styles.coverBadge}>الغلاف</div>}
              </div>
            ))}
            {form.images.length < 6 && (
              <label style={styles.imgAdd} data-testid="add-image-btn">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
                {uploading ? "…" : (
                  <>
                    <Camera size={22} strokeWidth={1.8} />
                    <span style={{ fontSize: 10, marginTop: 4 }}>إضافة</span>
                  </>
                )}
              </label>
            )}
          </div>

          {/* Video preview (max 15s) */}
          <div style={styles.videoSection}>
            <div style={styles.videoHead}>
              <h3 style={styles.videoTitle}>مقطع فيديو (اختياري)</h3>
              <span style={styles.videoHint}>15 ثانية كحد أقصى — يُظهر شكل الطائر وحركته</span>
            </div>

            {form.videos.length === 0 ? (
              <label style={styles.videoAdd} data-testid="add-video-btn">
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                  hidden
                  onChange={handleVideoUpload}
                  disabled={uploadingVideo}
                />
                <div style={styles.videoAddIcon}>
                  {uploadingVideo ? (
                    <span style={{ fontSize: 12, fontWeight: 700 }}>جاري الرفع…</span>
                  ) : (
                    <>
                      <VideoIcon size={28} strokeWidth={1.8} color={T.primary} />
                      <span style={styles.videoAddLabel}>أضف مقطع فيديو</span>
                    </>
                  )}
                </div>
              </label>
            ) : (
              <div style={styles.videoPreviewWrap}>
                {form.videos.map((v, i) => (
                  <div key={i} style={styles.videoTile}>
                    <video
                      src={v}
                      controls
                      playsInline
                      preload="metadata"
                      style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
                      data-testid={`video-preview-${i}`}
                    />
                    <button
                      onClick={() => removeVideo(i)}
                      style={styles.videoRemove}
                      data-testid={`remove-video-${i}`}
                      aria-label="حذف الفيديو"
                    >
                      <X size={14} strokeWidth={3} />
                    </button>
                    <div style={styles.videoBadge}>
                      <Play size={9} strokeWidth={2.6} />
                      <span>فيديو</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>معلومات الطائر</h2>

          <button
            type="button"
            onClick={() => setAiOpen(true)}
            style={styles.aiBtn}
            data-testid="btn-ai-identify"
          >
            <Sparkles size={16} strokeWidth={2.4} color="#fff" />
            <span>تعرّف على الطائر بالذكاء الاصطناعي</span>
          </button>

          <label style={S.label}>العنوان *</label>
          <input
            style={S.input}
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="مثال: كناري ذكر مغني"
            data-testid="input-title"
          />

          <label style={{ ...S.label, marginTop: 12 }}>الفئة *</label>
          <button
            type="button"
            onClick={() => setSheet("family")}
            style={styles.selectBtn}
            data-testid="input-family"
          >
            <Bird size={14} strokeWidth={2.2} color={T.primary} />
            <span>{currentFamily?.name_ar || "اختر الفئة"}</span>
          </button>

          {species.length > 0 && (
            <>
              <label style={{ ...S.label, marginTop: 12 }}>النوع (اختياري)</label>
              <button
                type="button"
                onClick={() => setSheet("species")}
                style={styles.selectBtn}
                data-testid="input-species"
              >
                <Bird size={14} strokeWidth={2.2} color={T.primary} />
                <span>{currentSpecies?.name_ar || "اختر النوع"}</span>
              </button>
            </>
          )}

          <div style={styles.row2}>
            <div>
              <label style={S.label}>الجنس</label>
              <select
                style={S.input}
                value={form.gender}
                onChange={(e) => setField("gender", e.target.value)}
                data-testid="input-gender"
              >
                {GENDERS.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>العمر (شهر)</label>
              <input
                type="number"
                style={S.input}
                value={form.age_months}
                onChange={(e) => setField("age_months", e.target.value)}
                placeholder="6"
                data-testid="input-age"
              />
            </div>
          </div>

          <div style={styles.row2}>
            <div>
              <label style={S.label}>السلالة</label>
              {(currentSpecies?.common_breeds || []).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, justifyContent: "flex-end" }}>
                  {currentSpecies.common_breeds.map((b) => {
                    const on = form.breed === b;
                    return (
                      <button
                        type="button"
                        key={b}
                        onClick={() => setField("breed", on ? "" : b)}
                        style={{
                          borderRadius: 999,
                          border: `1px solid ${on ? "#C6A15B" : "#E6DCC8"}`,
                          background: on ? "#1B3D2F" : "#F0EAD8",
                          color: on ? "#C6A15B" : "#6B5E4A",
                          padding: "6px 12px",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              )}
              <input
                style={S.input}
                value={form.breed}
                onChange={(e) => setField("breed", e.target.value)}
                placeholder="أو اكتب السلالة"
                data-testid="input-breed"
              />
            </div>
            <div>
              <label style={S.label}>اللون</label>
              <input
                style={S.input}
                value={form.color}
                onChange={(e) => setField("color", e.target.value)}
                placeholder="أصفر"
                data-testid="input-color"
              />
            </div>
          </div>

          <label style={{ ...S.label, marginTop: 12 }}>الوصف *</label>
          <textarea
            style={{ ...S.input, minHeight: 100, resize: "vertical" }}
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="اكتب معلومات مفيدة عن الطائر…"
            data-testid="input-description"
          />
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>الحالة الصحية</h2>
          <label style={S.label}>الحالة</label>
          <select
            style={S.input}
            value={form.health.status}
            onChange={(e) => setHealth("status", e.target.value)}
            data-testid="input-health-status"
          >
            {HEALTH_STATUS.map((h) => (
              <option key={h.id} value={h.id}>{h.label}</option>
            ))}
          </select>

          <label style={{ ...styles.checkboxRow, marginTop: 12 }}>
            <input
              type="checkbox"
              checked={form.health.vaccinated}
              onChange={(e) => setHealth("vaccinated", e.target.checked)}
              data-testid="input-vaccinated"
            />
            <span>محصّن</span>
          </label>

          <label style={{ ...S.label, marginTop: 12 }}>رقم الخاتم</label>
          <input
            style={S.input}
            value={form.health.ring_number}
            onChange={(e) => setHealth("ring_number", e.target.value)}
            placeholder="اختياري"
            data-testid="input-ring"
          />
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>السعر والمكان</h2>
          <label style={S.label}>السعر (ر.س) *</label>
          <input
            type="number"
            style={S.input}
            value={form.price_sar}
            onChange={(e) => setField("price_sar", e.target.value)}
            placeholder="500"
            data-testid="input-price"
          />

          <label style={{ ...styles.checkboxRow, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={form.price_negotiable}
              onChange={(e) => setField("price_negotiable", e.target.checked)}
              data-testid="input-negotiable"
            />
            <span>السعر قابل للتفاوض</span>
          </label>

          <div style={styles.row2}>
            <div>
              <label style={S.label}>المدينة *</label>
              <button
                type="button"
                onClick={() => setSheet("city")}
                style={styles.selectBtn}
                data-testid="input-city"
              >
                <MapPin size={14} strokeWidth={2.2} color={T.primary} />
                <span>{form.city}</span>
              </button>
            </div>
            <div>
              <label style={S.label}>الحي</label>
              <input
                style={S.input}
                value={form.district}
                onChange={(e) => setField("district", e.target.value)}
                placeholder="اختياري"
                data-testid="input-district"
              />
            </div>
          </div>
        </div>

        {error && <div style={S.errorBox} data-testid="create-listing-error">{error}</div>}

        <button
          onClick={submit}
          disabled={saving}
          style={{ ...S.primaryBtn, width: "100%", marginTop: 12, opacity: saving ? 0.7 : 1 }}
          data-testid="submit-listing"
        >
          {saving ? "جاري النشر…" : "انشر الإعلان"}
        </button>
      </div>

      {/* Sheets */}
      <BottomSheet
        open={sheet === "family"}
        onClose={() => setSheet(null)}
        title="اختر الفئة"
      >
        {families.flatMap((f, idx) => {
          const group = f.group_ar || FAMILY_GROUP[f.family_id] || "عناية وخدمات";
          const prev = idx > 0 ? (families[idx - 1].group_ar || FAMILY_GROUP[families[idx - 1].family_id] || "عناية وخدمات") : "";
          const nodes = [];
          if (group !== prev) {
            nodes.push(
              <div key={`group-${group}`} style={{ padding: "10px 8px 4px", color: "#8A6A2E", fontWeight: 800, fontSize: 12, textAlign: "right" }}>
                {group}
              </div>
            );
          }
          nodes.push(
            <SelectorItem
              key={f.family_id}
              icon={<Bird size={16} strokeWidth={2.2} />}
              label={f.name_ar}
              active={form.family === f.family_id}
              onClick={() => { setField("family", f.family_id); setSheet(null); }}
              testId={`family-opt-${f.family_id}`}
            />
          );
          return nodes;
        })}
      </BottomSheet>

      <BottomSheet
        open={sheet === "species"}
        onClose={() => setSheet(null)}
        title="اختر النوع"
      >
        {species.map((s) => (
          <SelectorItem
            key={s.species_id}
            icon={<Bird size={16} strokeWidth={2.2} />}
            label={s.name_ar}
            active={form.species === s.species_id}
            onClick={() => { setForm((f) => ({ ...f, species: s.species_id, breed: "" })); setSheet(null); }}
            testId={`species-opt-${s.species_id}`}
          />
        ))}
      </BottomSheet>

      <BottomSheet
        open={sheet === "city"}
        onClose={() => setSheet(null)}
        title="اختر المدينة أو الدولة"
      >
        {ALL_LOCATIONS.map((c) => (
          <SelectorItem
            key={c}
            icon={<MapPin size={16} strokeWidth={2.2} />}
            label={c}
            active={form.city === c}
            onClick={() => { setField("city", c); setSheet(null); }}
            testId={`city-opt-${c}`}
          />
        ))}
      </BottomSheet>

      <IdentifyBirdModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onApply={(v) => {
          if (v.title && !form.title) setField("title", v.title);
          if (v.price_max && !form.price_sar) {
            setField("price_sar", String(Math.round((v.price_min + v.price_max) / 2)));
          }
          setAiOpen(false);
        }}
      />
    </div>
  );
}

export function TopBarStub() { return null; }

const styles = {
  hint: { fontSize: 12, color: T.textMuted, marginTop: 0, marginBottom: 12, textAlign: "right" },
  aiBtn: {
    width: "100%",
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px 14px",
    background: "linear-gradient(135deg, #0f766e 0%, #ec4899 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    marginBottom: 14,
    boxShadow: "0 4px 14px rgba(15,118,110,0.25)",
  },
  selectBtn: {
    width: "100%",
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    padding: "12px 14px",
    background: T.surface,
    border: `1.5px solid ${T.border}`,
    borderRadius: T.radius,
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 700,
    color: T.text,
    cursor: "pointer",
    textAlign: "right",
    boxSizing: "border-box",
  },
  imagesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
    gap: 8,
  },
  imgTile: {
    position: "relative",
    aspectRatio: "1/1",
    borderRadius: 10,
    overflow: "hidden",
    background: T.divider,
  },
  imgRemove: {
    position: "absolute",
    top: 4,
    insetInlineEnd: 4,
    background: "rgba(220, 38, 38, 0.92)",
    color: "#fff",
    border: "none",
    width: 22,
    height: 22,
    borderRadius: 11,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  },
  coverBadge: {
    position: "absolute",
    bottom: 4,
    insetInlineStart: 4,
    background: "rgba(6, 95, 70, 0.9)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    padding: "2px 6px",
    borderRadius: 6,
  },
  imgAdd: {
    aspectRatio: "1/1",
    borderRadius: T.radius,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: T.borderStrong,
    background: T.bgAlt,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: T.primary,
    cursor: "pointer",
    fontWeight: 700,
  },

  // Video upload section
  videoSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTop: `1px dashed ${T.border}`,
  },
  videoHead: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginBottom: 10,
    textAlign: "right",
  },
  videoTitle: { fontSize: 14, fontWeight: 800, color: T.text, margin: 0 },
  videoHint: { fontSize: 11, color: T.textMuted, fontWeight: 600 },
  videoAdd: {
    display: "block",
    aspectRatio: "16/9",
    width: "100%",
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: T.borderStrong,
    background: "linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)",
    cursor: "pointer",
  },
  videoAddIcon: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    color: T.primary,
  },
  videoAddLabel: { fontSize: 13, fontWeight: 800 },
  videoPreviewWrap: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
  },
  videoTile: {
    position: "relative",
    aspectRatio: "16/9",
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    background: "#000",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
  },
  videoRemove: {
    position: "absolute",
    top: 8,
    insetInlineEnd: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    background: "rgba(15,23,42,0.85)",
    color: "#fff",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: 3,
  },
  videoBadge: {
    position: "absolute",
    bottom: 8,
    insetInlineStart: 8,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "rgba(15,118,110,0.92)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    padding: "3px 8px",
    borderRadius: 999,
    zIndex: 3,
  },
  row2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 12,
  },
  checkboxRow: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    color: T.text,
    fontWeight: 600,
    cursor: "pointer",
  },
};
