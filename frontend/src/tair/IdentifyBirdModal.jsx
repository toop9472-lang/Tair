// طير — AI-powered bird identifier & price estimator
// Opens as a modal, user uploads a photo, we call Gemini via backend.
import React, { useRef, useState } from "react";
import { X, Camera, Sparkles, RotateCw } from "lucide-react";
import { T } from "./tairTheme";
import { tairApi } from "./tairApi";

// Compress + convert to base64 to keep upload small
async function fileToBase64Compressed(file, maxSide = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl.split(",")[1]);   // strip prefix
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const money = (v) => new Intl.NumberFormat("ar-SA").format(v || 0);

export default function IdentifyBirdModal({ open, onClose, onApply }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  if (!open) return null;

  const reset = () => {
    setPreview(null);
    setResult(null);
    setError("");
    setLoading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("الرجاء اختيار صورة JPEG أو PNG أو WEBP");
      return;
    }
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const b64 = await fileToBase64Compressed(file, 1024);
      setPreview(`data:image/jpeg;base64,${b64}`);
      const data = await tairApi.identifyBirdFromBase64(b64, "image/jpeg");
      setResult(data);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "تعذّر التحليل");
    } finally {
      setLoading(false);
    }
  };

  const isBird = result?.is_bird === true;
  const price = result?.estimated_price_sar;

  return (
    <div style={styles.overlay} onClick={onClose} data-testid="identify-bird-modal">
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.head}>
          <button onClick={onClose} style={styles.closeBtn} data-testid="ai-bird-close">
            <X size={20} />
          </button>
          <div style={styles.title}>
            <Sparkles size={18} color={T.primary} strokeWidth={2.4} />
            <span>تعرّف على الطائر — AI</span>
          </div>
        </div>

        <div style={styles.body}>
          {!preview ? (
            <button
              onClick={() => inputRef.current?.click()}
              style={styles.upload}
              data-testid="ai-bird-upload"
            >
              <Camera size={32} color={T.primary} strokeWidth={2} />
              <div style={styles.uploadTitle}>ارفع صورة الطائر</div>
              <div style={styles.uploadSub}>
                نتعرف على النوع + نقترح سعر تقريبي بالسوق السعودي
              </div>
            </button>
          ) : (
            <>
              <div style={styles.previewWrap}>
                <img src={preview} alt="" style={styles.preview} />
              </div>
              {loading && (
                <div style={styles.loadingRow}>
                  <RotateCw size={16} className="tair-spin" />
                  <span>جاري التحليل بواسطة Gemini…</span>
                </div>
              )}
              {result && (
                <div style={styles.resultCard}>
                  {isBird ? (
                    <>
                      <div style={styles.resultTop}>
                        <div>
                          <div style={styles.species}>{result.species_ar || "نوع غير محدد"}</div>
                          {result.species_en && (
                            <div style={styles.speciesEn}>{result.species_en}</div>
                          )}
                        </div>
                        {typeof result.confidence === "number" && (
                          <div style={styles.confidence}>
                            {Math.round(result.confidence * 100)}%
                          </div>
                        )}
                      </div>
                      {price && (
                        <div style={styles.priceBox}>
                          <div style={styles.priceLabel}>السعر المقترح</div>
                          <div style={styles.priceVal}>
                            {money(price.min)} — {money(price.max)} ر.س
                          </div>
                        </div>
                      )}
                      {result.age_estimate_ar && result.age_estimate_ar !== "غير محدد" && (
                        <div style={styles.tagRow}>
                          <span style={styles.tag}>العمر: {result.age_estimate_ar}</span>
                        </div>
                      )}
                      {result.notes_ar && (
                        <div style={styles.notes}>{result.notes_ar}</div>
                      )}

                      {onApply && (
                        <button
                          onClick={() =>
                            onApply({
                              title: result.species_ar,
                              price_min: price?.min,
                              price_max: price?.max,
                              notes: result.notes_ar,
                            })
                          }
                          style={styles.applyBtn}
                          data-testid="ai-bird-apply"
                        >
                          استخدم في الإعلان
                        </button>
                      )}
                    </>
                  ) : (
                    <div style={styles.noBird}>
                      لم يتم التعرف على طائر في الصورة. جرّب صورة أوضح.
                    </div>
                  )}
                </div>
              )}
              {error && <div style={styles.errorBox}>{error}</div>}

              <button onClick={reset} style={styles.retryBtn} data-testid="ai-bird-retry">
                <Camera size={16} strokeWidth={2.4} />
                <span>صورة أخرى</span>
              </button>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      <style>{`
        .tair-spin { animation: tair-spin 1s linear infinite; }
        @keyframes tair-spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)",
    backdropFilter: "blur(4px)", zIndex: 1000,
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  },
  sheet: {
    background: T.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto",
    padding: 0, boxShadow: "0 -8px 40px rgba(0,0,0,0.2)",
  },
  head: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "space-between", padding: "14px 16px",
    borderBottom: `1px solid ${T.border}`,
  },
  title: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8,
    fontSize: 16, fontWeight: 900, color: T.textStrong,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, background: T.bgAlt,
    border: "none", cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center", color: T.text,
  },
  body: { padding: 16 },

  upload: {
    width: "100%", padding: "36px 20px",
    background: "linear-gradient(135deg, rgba(15,118,110,0.06), rgba(236,72,153,0.04))",
    border: `2px dashed ${T.primary}`, borderRadius: 16,
    cursor: "pointer", fontFamily: "inherit",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
  },
  uploadTitle: { fontSize: 16, fontWeight: 800, color: T.textStrong },
  uploadSub: { fontSize: 12, color: T.textMuted, textAlign: "center", lineHeight: 1.5 },

  previewWrap: {
    borderRadius: 14, overflow: "hidden", background: T.bgAlt,
    marginBottom: 12, maxHeight: 260, display: "flex", justifyContent: "center",
  },
  preview: { maxWidth: "100%", maxHeight: 260, objectFit: "contain" },

  loadingRow: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8,
    padding: "10px 12px", background: "rgba(15,118,110,0.06)", borderRadius: 10,
    color: T.primary, fontSize: 13, fontWeight: 700,
  },

  resultCard: {
    background: T.surface, border: `1px solid ${T.border}`,
    borderRadius: 14, padding: 14, marginTop: 8,
  },
  resultTop: {
    display: "flex", flexDirection: "row-reverse", alignItems: "flex-start",
    justifyContent: "space-between", gap: 10,
  },
  species: { fontSize: 18, fontWeight: 900, color: T.textStrong },
  speciesEn: { fontSize: 12, color: T.textMuted, fontFamily: "system-ui" },
  confidence: {
    background: T.primary, color: "#fff", padding: "4px 8px", borderRadius: 8,
    fontSize: 12, fontWeight: 900,
  },
  priceBox: {
    marginTop: 12, padding: "10px 12px", background: "rgba(15,118,110,0.08)",
    borderRadius: 10, textAlign: "center",
  },
  priceLabel: { fontSize: 11, color: T.textMuted, fontWeight: 700 },
  priceVal: { fontSize: 20, fontWeight: 900, color: T.primary, marginTop: 2 },
  tagRow: { display: "flex", flexDirection: "row-reverse", gap: 6, marginTop: 10 },
  tag: {
    background: T.bgAlt, color: T.text, padding: "4px 10px",
    borderRadius: 999, fontSize: 11, fontWeight: 700,
  },
  notes: {
    marginTop: 10, fontSize: 13, color: T.text, textAlign: "right", lineHeight: 1.6,
    padding: 10, background: "#fefce8", borderRadius: 8, border: "1px solid #fef3c7",
  },
  noBird: { padding: 12, color: T.textMuted, fontSize: 13, textAlign: "center" },
  applyBtn: {
    marginTop: 12, width: "100%",
    background: T.primary, color: "#fff", border: "none",
    padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 800,
    cursor: "pointer", fontFamily: "inherit",
  },

  errorBox: {
    marginTop: 10, padding: "10px 12px",
    background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca",
    borderRadius: 10, fontSize: 13, fontWeight: 600,
  },
  retryBtn: {
    marginTop: 10, width: "100%",
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "center", gap: 6,
    background: T.surface, color: T.text, border: `1px solid ${T.border}`,
    padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  },
};
