/**
 * AskExpertsScreen — اسأل الخبراء (بديل المنتدى)
 *  - قائمة أسئلة عامة عن الطيور والمُربّي
 *  - يستخدم /api/forum/feed كما هو (نفس البيانات لكن بواجهة جديدة نظيفة)
 */
import React, { useEffect, useState } from "react";
import { ChevronRight, HelpCircle, MessageSquare, Plus, X, ThumbsUp } from "lucide-react";
import { tairApi } from "./tairApi";
import { TAIR, TAIR_PAGE_STYLE, timeAgo12 } from "./TairAppChrome";

export default function AskExpertsScreen({ user, onBack }) {
  const uid = user?.id || user?.user_id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const d = await tairApi.forumFeed({ limit: 30 });
        setItems(d.items || d.posts || []);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [refreshTick]);

  return (
    <div dir="rtl" style={TAIR_PAGE_STYLE} data-testid="ask-experts-screen">
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: TAIR.bg, padding: "16px", display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 12, borderBottom: `1px solid ${TAIR.divider}` }}>
        <button
          onClick={onBack}
          data-testid="ask-experts-back-btn"
          aria-label="رجوع"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", color: TAIR.emerald }}
        >
          <ChevronRight size={24} strokeWidth={2} />
        </button>
        <div style={{ flex: 1, textAlign: "right", display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
          <HelpCircle size={20} color={TAIR.gold} />
          <span style={{ color: TAIR.emerald, fontSize: 18, fontWeight: 900 }}>اسأل الخبراء</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          data-testid="new-question-btn"
          style={{
            display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 4,
            padding: "8px 14px", borderRadius: 20,
            background: TAIR.emerald, color: TAIR.gold, border: "none",
            fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <Plus size={16} strokeWidth={2.4} />
          <span>سؤال</span>
        </button>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: TAIR.textSoft }}>...جاري التحميل</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: TAIR.textSoft }}>
            لا أسئلة بعد. كن أول من يسأل الخبراء.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((p) => (
              <QuestionCard key={p.post_id || p.id} p={p} />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <NewQuestionModal
          userId={uid}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); setRefreshTick((x) => x + 1); }}
        />
      )}
    </div>
  );
}

function QuestionCard({ p }) {
  return (
    <div
      data-testid={`question-${p.post_id || p.id}`}
      style={{
        padding: 14, borderRadius: 14,
        background: TAIR.card, border: `1px solid ${TAIR.divider}`,
        boxShadow: TAIR.softShadow, textAlign: "right",
      }}
    >
      <div style={{ display: "flex", flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 6, color: TAIR.textSoft, fontSize: 11 }}>
        <span style={{ fontWeight: 800, color: TAIR.emerald }}>{p.author_name || p.user_name || "مربّي"}</span>
        <span>{timeAgo12(p.created_at)}</span>
      </div>
      <div style={{ color: TAIR.emerald, fontSize: 15, fontWeight: 900, marginBottom: 4 }}>{p.title || "سؤال"}</div>
      <div style={{ color: TAIR.text, fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
        {(p.body || p.content || "").slice(0, 220)}{(p.body || p.content || "").length > 220 ? "…" : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "row-reverse", gap: 14, color: TAIR.textSoft, fontSize: 12 }}>
        <span style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
          <MessageSquare size={14} strokeWidth={1.8} />
          {p.replies_count || 0}
        </span>
        <span style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
          <ThumbsUp size={14} strokeWidth={1.8} />
          {p.likes_count || 0}
        </span>
      </div>
    </div>
  );
}

function NewQuestionModal({ userId, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    if (!title.trim()) { setErr("اكتب عنوان السؤال"); return; }
    setSubmitting(true); setErr(null);
    try {
      await tairApi.forumCreatePost({
        title: title.trim(),
        body: body.trim(),
        category: "general",
      }, userId);
      await onCreated();
    } catch (e) {
      setErr(e?.response?.data?.detail || "تعذّر النشر");
    } finally { setSubmitting(false); }
  };

  return (
    <div dir="rtl" style={{ position: "fixed", inset: 0, background: "rgba(15,36,28,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: TAIR.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, width: "100%", maxWidth: 500, paddingBottom: 32 }} data-testid="new-question-modal">
        <div style={{ display: "flex", flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: TAIR.emerald }}>سؤال جديد</div>
          <button onClick={onClose} data-testid="close-new-question" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: TAIR.emerald }}>
            <X size={22} />
          </button>
        </div>

        <label style={{ display: "block", color: TAIR.emerald, fontSize: 13, fontWeight: 800, marginBottom: 4, textAlign: "right" }}>عنوان السؤال</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="q-title"
          style={inpStyle}
        />

        <label style={{ display: "block", color: TAIR.emerald, fontSize: 13, fontWeight: 800, marginTop: 10, marginBottom: 4, textAlign: "right" }}>التفاصيل (اختياري)</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          data-testid="q-body"
          style={{ ...inpStyle, minHeight: 90 }}
        />

        {err && <div style={{ color: "#B91C1C", fontSize: 12, textAlign: "right", marginTop: 6 }}>{err}</div>}

        <button
          onClick={submit}
          disabled={submitting}
          data-testid="q-submit"
          style={{
            marginTop: 14, width: "100%",
            height: 46, borderRadius: 23,
            background: TAIR.emerald, color: TAIR.gold, border: "none",
            fontWeight: 900, fontSize: 14, cursor: submitting ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {submitting ? "..جاري النشر" : "نشر السؤال"}
        </button>
      </div>
    </div>
  );
}

const inpStyle = {
  width: "100%", height: 42, padding: "0 12px",
  borderRadius: 12, border: `1px solid ${TAIR.divider}`,
  background: TAIR.bg, color: TAIR.emerald,
  fontFamily: "inherit", fontSize: 14,
  direction: "rtl", textAlign: "right", outline: "none",
  boxSizing: "border-box",
};
