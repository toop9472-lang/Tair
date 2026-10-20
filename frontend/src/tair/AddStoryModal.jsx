/**
 * AddStoryModal — رفع صورة قصة تبقى ٢٤ ساعة.
 */
import React, { useState } from "react";
import { X, Upload } from "lucide-react";
import { tairApi } from "./tairApi";
import { TAIR, TAIR_PAGE_STYLE } from "./TairAppChrome";

export default function AddStoryModal({ user, onClose, onCreated }) {
  const uid = user?.id || user?.user_id;
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const handleUpload = async (fileList) => {
    const f = fileList?.[0];
    if (!f) return;
    setUploading(true); setErr(null);
    try {
      const base = process.env.REACT_APP_BACKEND_URL || "";
      const form = new FormData();
      form.append("file", f);
      form.append("user_id", uid || "guest");
      const res = await fetch(`${base}/api/listings/upload-image`, { method: "POST", body: form });
      const data = await res.json();
      if (data?.url) setImageUrl(data.url);
      else setErr("تعذّر رفع الصورة");
    } catch (e) { setErr("تعذّر رفع الصورة"); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!imageUrl) { setErr("اختر صورة"); return; }
    setSubmitting(true); setErr(null);
    try {
      await tairApi.communityCreateStory({ image_url: imageUrl, caption: caption.trim() }, uid);
      onCreated?.();
    } catch (e) {
      setErr(e?.response?.data?.detail || "تعذّر إنشاء القصة");
    } finally { setSubmitting(false); }
  };

  return (
    <div dir="rtl" style={TAIR_PAGE_STYLE} data-testid="add-story-screen">
      <div style={{ padding: 16, display: "flex", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${TAIR.divider}` }}>
        <button onClick={onClose} data-testid="close-add-story" style={{ background: "transparent", border: "none", cursor: "pointer", color: TAIR.emerald, padding: 4 }}>
          <X size={22} />
        </button>
        <div style={{ color: TAIR.emerald, fontWeight: 900, fontSize: 18 }}>قصة جديدة (٢٤ ساعة)</div>
        <div style={{ width: 22 }} />
      </div>

      <div style={{ padding: 20 }}>
        <label style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "100%", aspectRatio: "1/1", maxHeight: 320,
          borderRadius: 16, border: `2px dashed ${TAIR.gold}`,
          background: TAIR.card, cursor: uploading ? "wait" : "pointer",
          overflow: "hidden",
        }} data-testid="story-upload-label">
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleUpload(e.target.files)} />
          {imageUrl ? (
            <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ textAlign: "center", color: TAIR.emerald }}>
              <Upload size={40} color={TAIR.gold} strokeWidth={1.6} />
              <div style={{ fontSize: 14, fontWeight: 800, marginTop: 8 }}>
                {uploading ? "...جارٍ الرفع" : "اضغط لرفع صورة"}
              </div>
            </div>
          )}
        </label>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="أضف تعليقاً على قصتك (اختياري)"
          data-testid="story-caption-input"
          rows={3}
          style={{
            width: "100%", marginTop: 14,
            padding: "12px 14px", borderRadius: 12,
            border: `1px solid ${TAIR.divider}`, background: TAIR.card,
            color: TAIR.emerald, fontFamily: "inherit", fontSize: 14,
            textAlign: "right", direction: "rtl", outline: "none",
            boxSizing: "border-box",
          }}
        />

        {err && <div style={{ color: "#B91C1C", fontSize: 12, textAlign: "right", marginTop: 8 }}>{err}</div>}

        <button
          onClick={submit}
          disabled={submitting || !imageUrl}
          data-testid="story-submit-btn"
          style={{
            width: "100%", marginTop: 16,
            height: 48, borderRadius: 24,
            background: imageUrl ? TAIR.emerald : "#BFB39A",
            color: TAIR.gold, border: "none",
            fontWeight: 900, fontSize: 15,
            cursor: submitting ? "wait" : (imageUrl ? "pointer" : "not-allowed"),
            fontFamily: "inherit",
          }}
        >
          {submitting ? "..جارٍ النشر" : "نشر القصة"}
        </button>
      </div>
    </div>
  );
}
