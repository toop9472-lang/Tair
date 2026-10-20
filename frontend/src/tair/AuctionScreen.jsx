/**
 * AuctionScreen — شاشة المزاد (المزاد)
 * - الحلف الشرعي إلزامي قبل الدخول
 * - نافذة المزاد ٤:٠٠ م – ٩:٠٠ م بتوقيت السعودية
 * - تمديد ٦٠ ثانية عند المزايدة في الدقيقة الأخيرة
 * - كل الأوقات معروضة بصيغة ٢٤ ساعة
 */
import React, { useEffect, useMemo, useState } from "react";
import { Gavel, ShieldCheck, Clock, ChevronRight, X, Plus } from "lucide-react";
import { tairApi } from "./tairApi";
import auctionHeader from "../assets/tair-design/headers/auction.jpg";
import { TAIR, TAIR_PAGE_STYLE, TairAppHeader, format12, formatDate12, toArabicDigits } from "./TairAppChrome";

function toArabicNumerals(n) { return toArabicDigits(n); }

function countdownStr(ms) {
  if (ms <= 0) return "٠٠:٠٠:٠٠";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function AuctionScreen({ user, onBack, onOpenNotifications }) {
  const uid = user?.id || user?.user_id;
  const [oath, setOath] = useState({ accepted: null, text: "" });
  const [showOath, setShowOath] = useState(false);
  const [win, setWin] = useState(null); // window status
  const [now, setNow] = useState(Date.now());
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeAuction, setActiveAuction] = useState(null); // details modal

  // 1) Ticker for countdowns (every 1s)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 2) Load oath + window + list on mount
  useEffect(() => {
    if (!uid) return;
    const load = async () => {
      try {
        const [o, w, list] = await Promise.all([
          tairApi.auctionsOathStatus(uid),
          tairApi.auctionsWindowStatus(),
          tairApi.auctionsList("all"),
        ]);
        setOath({ accepted: o.accepted, text: o.text });
        setWin(w);
        setAuctions(list.items || []);
        if (!o.accepted) setShowOath(true);
      } catch (e) {
        // noop
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [uid]);

  // 3) Refresh list every 15s (auctions may end / new bids)
  useEffect(() => {
    if (!uid) return;
    const t = setInterval(async () => {
      try {
        const w = await tairApi.auctionsWindowStatus();
        setWin(w);
        const list = await tairApi.auctionsList("all");
        setAuctions(list.items || []);
      } catch (e) {}
    }, 15000);
    return () => clearInterval(t);
  }, [uid]);

  const acceptOath = async () => {
    try {
      await tairApi.auctionsOathAccept(uid);
      setOath({ ...oath, accepted: true });
      setShowOath(false);
    } catch (e) {}
  };

  const refreshList = async () => {
    const list = await tairApi.auctionsList("all");
    setAuctions(list.items || []);
    const w = await tairApi.auctionsWindowStatus();
    setWin(w);
  };

  const opensAt = win?.opens_at ? new Date(win.opens_at) : null;
  const closesAt = win?.closes_at ? new Date(win.closes_at) : null;
  const isOpen = !!win?.is_open;
  const timeToOpen = opensAt ? opensAt.getTime() - now : 0;
  const timeToClose = closesAt ? closesAt.getTime() - now : 0;

  return (
    <div dir="rtl" style={TAIR_PAGE_STYLE} data-testid="auction-screen">
      <TairAppHeader image={auctionHeader} onBell={onOpenNotifications} />

      {/* Top action row */}
      <div style={{ display: "flex", flexDirection: "row-reverse", padding: "0 16px", marginTop: 12, marginBottom: 8, gap: 8, alignItems: "center" }}>
        <button
          onClick={onBack}
          data-testid="auction-back-btn"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", color: TAIR.emerald }}
        >
          <ChevronRight size={22} strokeWidth={2} />
        </button>
        <div style={{ flex: 1 }} />
        {oath.accepted && (
          <button
            onClick={() => setShowCreate(true)}
            data-testid="new-auction-btn"
            style={{
              display: "flex", flexDirection: "row-reverse", gap: 6, alignItems: "center", justifyContent: "center",
              height: 40, padding: "0 16px", borderRadius: 20,
              background: TAIR.emerald, color: TAIR.gold, border: "none",
              fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 3px 6px rgba(27,61,47,0.16)",
            }}
          >
            <Plus size={18} strokeWidth={2.4} color={TAIR.gold} />
            <span>مزاد جديد</span>
          </button>
        )}
      </div>

      {/* Window status card */}
      {win && (
        <div style={{
          margin: "8px 16px 12px",
          padding: 14,
          background: isOpen ? TAIR.emerald : TAIR.card,
          color: isOpen ? TAIR.gold : TAIR.emerald,
          borderRadius: 14,
          border: `1px solid ${isOpen ? TAIR.gold : TAIR.divider}`,
          boxShadow: TAIR.softShadow,
        }} data-testid="auction-window-card">
          <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Clock size={18} strokeWidth={2} color={isOpen ? TAIR.gold : TAIR.emerald} />
            <div style={{ fontSize: 14, fontWeight: 900 }}>
              {isOpen ? "المزاد مفتوح الآن" : "المزاد مغلق"}
            </div>
          </div>
          <div style={{ fontSize: 12, textAlign: "right", opacity: 0.95 }}>
            أوقات المزاد يومياً: <b>٤:٠٠ م – ٩:٠٠ م</b> بتوقيت السعودية
          </div>
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800, direction: "ltr", textAlign: "right" }}>
            {isOpen
              ? `يُغلق خلال: ${countdownStr(timeToClose)}`
              : `يُفتح خلال: ${countdownStr(timeToOpen)}`}
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ padding: "4px 16px 8px" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: TAIR.textSoft }}>...جاري التحميل</div>
        ) : auctions.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: TAIR.textSoft, background: TAIR.card, borderRadius: 14, border: `1px solid ${TAIR.divider}` }}>
            لا توجد مزادات حالياً
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {auctions.map((a) => (
              <AuctionCard
                key={a.auction_id}
                a={a}
                now={now}
                onOpen={() => setActiveAuction(a)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Oath modal */}
      {showOath && (
        <OathModal text={oath.text} onAccept={acceptOath} onDismiss={onBack} />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateAuctionModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await refreshList();
          }}
          userId={uid}
        />
      )}

      {/* Details / Bid modal */}
      {activeAuction && (
        <AuctionDetailsModal
          auction={activeAuction}
          userId={uid}
          onClose={() => setActiveAuction(null)}
          onChanged={async () => { await refreshList(); }}
          isOpen={isOpen}
          now={now}
        />
      )}
    </div>
  );
}

// ---------- AuctionCard ----------
function AuctionCard({ a, now, onOpen }) {
  const end = new Date(a.end_at).getTime();
  const remaining = end - now;
  const active = a.status === "live" && remaining > 0;
  return (
    <button
      onClick={onOpen}
      data-testid={`auction-${a.auction_id}`}
      style={{
        display: "flex",
        flexDirection: "row-reverse",
        gap: 12,
        padding: 12,
        borderRadius: 16,
        background: TAIR.card,
        border: `1px solid ${TAIR.divider}`,
        boxShadow: TAIR.shadow,
        cursor: "pointer",
        textAlign: "right",
        width: "100%",
        fontFamily: "inherit",
      }}
    >
      <div style={{ width: 88, height: 88, borderRadius: 10, overflow: "hidden", background: TAIR.divider, flexShrink: 0 }}>
        {a.images?.[0] ? (
          <img src={a.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: TAIR.textSoft }}>
            <Gavel size={26} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: TAIR.emerald, fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{a.title}</div>
        <div style={{ color: TAIR.emerald, fontSize: 17, fontWeight: 900, marginBottom: 4 }}>
          {toArabicNumerals(a.current_bid_sar)} ر.س
        </div>
        <div style={{ display: "flex", flexDirection: "row-reverse", gap: 8, alignItems: "center", fontSize: 11 }}>
          <span style={{
            padding: "3px 8px",
            borderRadius: 999,
            background: active ? TAIR.emerald : "#EDE5D3",
            color: active ? TAIR.gold : TAIR.textSoft,
            fontWeight: 800,
          }}>
            {a.status === "live" ? "مباشر" : a.status === "scheduled" ? "قادم" : a.status === "closed" ? "منتهي" : "ملغى"}
          </span>
          <span style={{ color: TAIR.textSoft, direction: "ltr" }}>
            {a.status === "live" ? countdownStr(remaining) : formatDate12(a.start_at)}
          </span>
          <span style={{ color: TAIR.textSoft }}>• {toArabicNumerals(a.bids_count)} مزايدة</span>
        </div>
      </div>
    </button>
  );
}

// ---------- OathModal ----------
function OathModal({ text, onAccept, onDismiss }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div dir="rtl" style={{ position: "fixed", inset: 0, background: "rgba(15,36,28,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: TAIR.card, borderRadius: 20, padding: 22, width: "100%", maxWidth: 380, border: `1px solid ${TAIR.gold}` }} data-testid="auction-oath-modal">
        <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <ShieldCheck size={22} color={TAIR.gold} />
          <div style={{ fontSize: 17, fontWeight: 900, color: TAIR.emerald }}>الحلف الشرعي</div>
        </div>
        <p style={{ color: TAIR.emerald, lineHeight: 1.9, fontSize: 14, textAlign: "right", margin: "6px 0 14px" }}>
          {text}
        </p>
        <label style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8, color: TAIR.emerald, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            data-testid="auction-oath-confirm-checkbox"
          />
          <span>أوافق وأُقسم بذلك</span>
        </label>
        <div style={{ display: "flex", flexDirection: "row-reverse", gap: 8, marginTop: 16 }}>
          <button
            onClick={onAccept}
            disabled={!confirmed}
            data-testid="auction-oath-accept-btn"
            style={{
              flex: 1,
              height: 44,
              borderRadius: 22,
              background: confirmed ? TAIR.emerald : "#BFB39A",
              color: TAIR.gold,
              border: "none",
              fontWeight: 900,
              fontSize: 14,
              cursor: confirmed ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            دخول المزاد
          </button>
          <button
            onClick={onDismiss}
            style={{
              width: 100,
              height: 44,
              borderRadius: 22,
              background: TAIR.bg,
              color: TAIR.emerald,
              border: `1px solid ${TAIR.divider}`,
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            data-testid="auction-oath-cancel-btn"
          >
            رجوع
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- CreateAuctionModal ----------
function CreateAuctionModal({ onClose, onCreated, userId }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [inc, setInc] = useState("50");
  const [images, setImages] = useState([]); // up to 3
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const handleUpload = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 3 - images.length);
    if (files.length === 0) return;
    setUploading(true); setErr(null);
    try {
      const base = process.env.REACT_APP_BACKEND_URL || "";
      const uploaded = [];
      for (const f of files) {
        const form = new FormData();
        form.append("file", f);
        form.append("user_id", userId || "guest");
        const res = await fetch(`${base}/api/listings/upload-image`, { method: "POST", body: form });
        const data = await res.json();
        if (data?.url) uploaded.push(data.url);
      }
      setImages([...images, ...uploaded].slice(0, 3));
    } catch (e) {
      setErr("تعذّر رفع الصور");
    } finally { setUploading(false); }
  };

  const removeImg = (i) => setImages(images.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!title.trim() || !price) { setErr("العنوان والسعر الابتدائي مطلوبان"); return; }
    setSubmitting(true); setErr(null);
    try {
      await tairApi.auctionCreate({
        title: title.trim(),
        description: desc.trim(),
        starting_price_sar: parseFloat(price),
        min_increment_sar: parseFloat(inc) || 50,
        images,
      }, userId);
      await onCreated();
    } catch (e) {
      setErr(e?.response?.data?.detail || "تعذّر إنشاء المزاد");
    } finally { setSubmitting(false); }
  };

  return (
    <div dir="rtl" style={{ position: "fixed", inset: 0, background: "rgba(15,36,28,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: TAIR.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, width: "100%", maxWidth: 500, paddingBottom: 32 }} data-testid="create-auction-modal">
        <div style={{ display: "flex", flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: TAIR.emerald }}>مزاد جديد</div>
          <button onClick={onClose} data-testid="close-create-auction" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: TAIR.emerald }}>
            <X size={22} />
          </button>
        </div>

        <Input label="عنوان المزاد" value={title} onChange={setTitle} testId="auc-title" />
        <Input label="الوصف" value={desc} onChange={setDesc} testId="auc-desc" multiline />
        <Input label="السعر الابتدائي (ر.س)" value={price} onChange={setPrice} type="number" testId="auc-price" />
        <Input label="أقل زيادة (ر.س)" value={inc} onChange={setInc} type="number" testId="auc-inc" />

        {/* رفع حتى ٣ صور */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", color: TAIR.emerald, fontSize: 13, fontWeight: 800, marginBottom: 6, textAlign: "right" }}>
            صور المزاد (حتى ٣ صور)
          </label>
          <div style={{ display: "flex", flexDirection: "row-reverse", gap: 8 }}>
            {images.map((url, i) => (
              <div key={i} style={{ position: "relative", width: 82, height: 82, borderRadius: 10, overflow: "hidden", border: `1px solid ${TAIR.divider}` }}>
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button
                  onClick={() => removeImg(i)}
                  data-testid={`remove-img-${i}`}
                  style={{
                    position: "absolute", top: 3, left: 3,
                    width: 22, height: 22, borderRadius: 11,
                    background: "rgba(15,36,28,0.85)", color: "#fff",
                    border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                ><X size={13} /></button>
              </div>
            ))}
            {images.length < 3 && (
              <label style={{
                width: 82, height: 82, borderRadius: 10, border: `1.5px dashed ${TAIR.gold}`,
                background: TAIR.bg, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: uploading ? "wait" : "pointer", color: TAIR.emerald, fontSize: 12, fontWeight: 800,
              }} data-testid="add-auction-image">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => handleUpload(e.target.files)}
                />
                {uploading ? "...رفع" : "+ صورة"}
              </label>
            )}
          </div>
        </div>

        {err && <div style={{ color: "#B91C1C", fontSize: 12, textAlign: "right", marginTop: 6 }}>{err}</div>}

        <button
          onClick={submit}
          disabled={submitting}
          data-testid="submit-create-auction"
          style={{
            marginTop: 14,
            width: "100%",
            height: 46,
            borderRadius: 23,
            background: TAIR.emerald,
            color: TAIR.gold,
            border: "none",
            fontWeight: 900,
            fontSize: 14,
            cursor: submitting ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {submitting ? "..جارٍ الحفظ" : "إنشاء المزاد"}
        </button>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", multiline = false, testId }) {
  const Comp = multiline ? "textarea" : "input";
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", color: TAIR.emerald, fontSize: 13, fontWeight: 800, marginBottom: 4, textAlign: "right" }}>{label}</label>
      <Comp
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        data-testid={testId}
        style={{
          width: "100%",
          minHeight: multiline ? 70 : 40,
          padding: "10px 12px",
          borderRadius: 12,
          border: `1px solid ${TAIR.divider}`,
          background: TAIR.bg,
          color: TAIR.emerald,
          fontFamily: "inherit",
          fontSize: 14,
          direction: "rtl",
          textAlign: "right",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

// ---------- AuctionDetailsModal ----------
function AuctionDetailsModal({ auction, userId, onClose, onChanged, isOpen, now }) {
  const [full, setFull] = useState(auction);
  const [bidAmount, setBidAmount] = useState(String(auction.current_bid_sar + auction.min_increment_sar));
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const [flash, setFlash] = useState(null);

  const load = async () => {
    try {
      const d = await tairApi.auctionGet(auction.auction_id);
      setFull(d);
      setBidAmount(String(d.current_bid_sar + d.min_increment_sar));
    } catch (e) {}
  };
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [auction.auction_id]);

  const endMs = new Date(full.end_at).getTime();
  const remaining = endMs - now;

  const submit = async () => {
    setErr(null); setSubmitting(true);
    try {
      const res = await tairApi.auctionBid(auction.auction_id, parseFloat(bidAmount), userId);
      if (res.extended) setFlash("مُدّد المزاد ٦٠ ثانية بسبب مزايدتك في الدقيقة الأخيرة");
      setTimeout(() => setFlash(null), 3500);
      await load();
      await onChanged();
    } catch (e) {
      setErr(e?.response?.data?.detail || "تعذّرت المزايدة");
    } finally { setSubmitting(false); }
  };

  const canBid = isOpen && userId && auction.seller_id !== userId && full.status !== "closed" && full.status !== "cancelled";

  return (
    <div dir="rtl" style={{ position: "fixed", inset: 0, background: "rgba(15,36,28,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: TAIR.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, width: "100%", maxWidth: 500, paddingBottom: 32, maxHeight: "88vh", overflowY: "auto" }} data-testid="auction-details-modal">
        <div style={{ display: "flex", flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: TAIR.emerald }}>{full.title}</div>
          <button onClick={onClose} data-testid="close-auction-details" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: TAIR.emerald }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ color: TAIR.textSoft, fontSize: 12, textAlign: "right", marginBottom: 8 }}>
          البائع: {full.seller_name} • بدأ {formatDate12(full.start_at)}
        </div>

        {full.images?.length > 0 && (
          <div style={{ display: "flex", overflowX: "auto", gap: 8, marginBottom: 12 }}>
            {full.images.map((im, i) => (
              <img key={i} src={im} alt="" style={{ height: 140, borderRadius: 10, objectFit: "cover" }} />
            ))}
          </div>
        )}

        {full.description && (
          <div style={{ color: TAIR.emerald, fontSize: 14, textAlign: "right", marginBottom: 12, lineHeight: 1.7 }}>{full.description}</div>
        )}

        <div style={{ padding: 14, borderRadius: 14, background: TAIR.emerald, color: TAIR.gold, marginBottom: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.85, textAlign: "right" }}>أعلى مزايدة الآن</div>
          <div style={{ fontSize: 24, fontWeight: 900, textAlign: "right", marginTop: 2 }}>
            {toArabicNumerals(full.current_bid_sar)} ر.س
          </div>
          {full.highest_bidder_name && (
            <div style={{ fontSize: 12, opacity: 0.9, textAlign: "right", marginTop: 2 }}>
              من: {full.highest_bidder_name}
            </div>
          )}
          <div style={{ marginTop: 6, direction: "ltr", textAlign: "right", fontSize: 13, fontWeight: 800 }}>
            {full.status === "live" ? `يتبقى: ${countdownStr(remaining)}` : full.status === "closed" ? "منتهي" : full.status === "scheduled" ? `يبدأ ${formatDate12(full.start_at)}` : "ملغى"}
          </div>
        </div>

        {canBid ? (
          <div style={{ display: "flex", flexDirection: "row-reverse", gap: 8, alignItems: "center" }}>
            <input
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              type="number"
              data-testid="bid-amount-input"
              style={{
                flex: 1, height: 46, padding: "0 12px", borderRadius: 12,
                border: `1px solid ${TAIR.divider}`, background: TAIR.bg,
                color: TAIR.emerald, fontFamily: "inherit", fontSize: 15,
                direction: "ltr", textAlign: "right", outline: "none",
              }}
            />
            <button
              onClick={submit}
              disabled={submitting}
              data-testid="submit-bid-btn"
              style={{
                height: 46, padding: "0 20px", borderRadius: 23,
                background: TAIR.emerald, color: TAIR.gold, border: "none",
                fontWeight: 900, fontSize: 14, cursor: submitting ? "wait" : "pointer",
                fontFamily: "inherit",
              }}
            >
              مزايدة
            </button>
          </div>
        ) : (
          <div style={{ padding: 12, background: TAIR.bg, borderRadius: 12, textAlign: "center", color: TAIR.textSoft, fontSize: 13 }}>
            {!isOpen ? "المزاد مغلق الآن — أوقات المزايدة ٤:٠٠ م – ٩:٠٠ م" : auction.seller_id === userId ? "لا يمكنك المزايدة على مزادك" : "المزاد مغلق"}
          </div>
        )}

        {err && <div style={{ color: "#B91C1C", fontSize: 12, textAlign: "right", marginTop: 8 }}>{err}</div>}
        {flash && <div style={{ color: TAIR.emerald, background: TAIR.goldLight || "#F1E5C4", padding: 8, borderRadius: 10, fontSize: 12, textAlign: "right", marginTop: 8, fontWeight: 800 }}>{flash}</div>}

        {full.recent_bids?.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: TAIR.emerald, textAlign: "right", marginBottom: 6 }}>سجل المزايدات</div>
            {full.recent_bids.map((b) => (
              <div key={b.bid_id} style={{ display: "flex", flexDirection: "row-reverse", justifyContent: "space-between", padding: "6px 0", borderBottom: `0.5px solid ${TAIR.divider}`, fontSize: 12, color: TAIR.emerald }}>
                <span>{b.bidder_name}</span>
                <span>{toArabicNumerals(b.amount_sar)} ر.س</span>
                <span style={{ color: TAIR.textSoft, direction: "ltr" }}>{formatDate12(b.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
