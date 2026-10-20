// طير — Listing Details (contact + comments + like — no direct buy)
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  MapPin, Heart, Flag, User, Calendar, Palette, Tag, Fingerprint,
  Syringe, HeartPulse, MessageCircle, Bird, X, Phone, Send,
  Store, Truck, UserPlus, UserCheck, Trash2, Share2, UserX, Copy, Star,
} from "lucide-react";
import { T, S } from "./tairTheme";
import { tairApi } from "./tairApi";
import { TopBar, StatusPill } from "./TairUI";
import { toast } from "../hooks/use-toast";
import { AnalyticsEvents } from "./analytics";
import VerifiedTick from "./VerifiedTick";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GENDER_LABEL = { male: "ذكر", female: "أنثى", pair: "زوج", unknown: "غير محدد" };
const HEALTH_LABEL = {
  excellent: "ممتازة", good: "جيدة", needs_care: "تحتاج رعاية", special_needs: "احتياجات خاصة",
};
const HEALTH_COLOR = {
  excellent: T.success, good: T.info, needs_care: T.warning, special_needs: T.danger,
};

function timeAgo(iso) {
  if (!iso) return "الآن";
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  return new Date(iso).toLocaleDateString("ar-SA");
}

export default function ListingDetailsScreen({ user, listingId, onBack, onOpenThread, onOpenSeller }) {
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!listing) return;
    const ok = window.confirm("هل تريد حذف هذا الإعلان نهائياً؟ لا يمكن التراجع.");
    if (!ok) return;
    setDeleting(true);
    try {
      await tairApi.deleteListing(listing.listing_id, uid);
      toast({ title: "تم حذف الإعلان", description: "تمت إزالته من السوق." });
      onBack?.();
    } catch (e) {
      toast({
        title: "تعذّر الحذف",
        description: e.response?.data?.detail || e.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/?listing=${listing.listing_id}`;
    const shareData = {
      title: `طير — ${listing.title}`,
      text: `شاهد هذا الإعلان على منصة طير: ${listing.title} — ${listing.price_sar} ر.س`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        AnalyticsEvents.shareListing("native");
      } else {
        await navigator.clipboard.writeText(url);
        AnalyticsEvents.shareListing("copy");
        toast({ title: "تم نسخ الرابط", description: "الصقه في أي تطبيق للمشاركة." });
      }
    } catch (e) { /* user cancelled */ }
  };

  const shareToWhatsApp = () => {
    const url = `${window.location.origin}/?listing=${listing.listing_id}`;
    const text = `شاهد هذا الإعلان على منصة طير: ${listing.title} — ${listing.price_sar} ر.س\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    AnalyticsEvents.shareListing("whatsapp");
  };

  const [showReportUser, setShowReportUser] = useState(false);
  const [reportUserReason, setReportUserReason] = useState("fraud");
  const [reportUserNote, setReportUserNote] = useState("");
  const [reportingUser, setReportingUser] = useState(false);

  const submitReportUser = async () => {
    if (!listing) return;
    setReportingUser(true);
    try {
      await axios.post(
        `${API}/trust/report-user/${listing.seller_id}`,
        { reason: reportUserReason, note: reportUserNote, context_id: listing.listing_id },
        { params: { reporter_id: uid } },
      );
      toast({ title: "تم إرسال البلاغ", description: "سنراجعه في أقرب وقت." });
      setShowReportUser(false);
      setReportUserNote("");
    } catch (e) {
      toast({ title: "تعذّر الإرسال", description: e.response?.data?.detail || e.message, variant: "destructive" });
    } finally {
      setReportingUser(false);
    }
  };

  const blockSeller = async () => {
    if (!listing) return;
    if (!window.confirm("سيتم حظر هذا البائع ولن ترى إعلاناته لاحقاً. هل تريد المتابعة؟")) return;
    try {
      await axios.post(`${API}/trust/block/${listing.seller_id}`, null, { params: { blocker_id: uid } });
      toast({ title: "تم الحظر" });
      onBack?.();
    } catch (e) {
      toast({ title: "تعذّر الحظر", description: e.response?.data?.detail || e.message, variant: "destructive" });
    }
  };

  // Comments
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Like state
  const [liked, setLiked] = useState(false);
  const [favCount, setFavCount] = useState(0);

  const uid = user.id || user.user_id;

  const loadListing = useCallback(async () => {
    setLoading(true);
    try {
      const l = await tairApi.getListing(listingId, uid);
      setListing(l);
      setImgIdx(0);
      setFavCount(l.favorite_count || 0);
      const favs = await tairApi.myFavorites(uid).catch(() => []);
      setLiked(favs.some((f) => f.listing_id === l.listing_id));
    } catch (e) {
      setError(e.response?.data?.detail || "فشل تحميل الإعلان");
    } finally {
      setLoading(false);
    }
  }, [listingId, uid]);

  const loadComments = useCallback(async () => {
    try {
      const c = await tairApi.listingComments(listingId);
      setComments(c);
    } catch (e) { /* ignore */ }
  }, [listingId]);

  useEffect(() => { loadListing(); }, [loadListing]);
  useEffect(() => { loadComments(); }, [loadComments]);

  const toggleLike = async () => {
    if (!listing) return;
    try {
      const res = await tairApi.toggleFavorite(listing.listing_id, uid);
      setLiked(res.favorited);
      setFavCount((c) => c + (res.favorited ? 1 : -1));
    } catch (e) { /* silent */ }
  };

  const startChat = async (initialMessage) => {
    if (!listing || listing.seller_id === uid) return;
    try {
      const thread = await tairApi.chatStart(
        {
          peer_id: listing.seller_id,
          listing_id: listing.listing_id,
          listing_title: listing.title,
          listing_image: listing.cover_image,
          initial_message: initialMessage,
        },
        uid,
      );
      onOpenThread?.(thread.thread_id);
    } catch (e) { /* silent */ }
  };

  const openWhatsApp = () => {
    if (!listing?.seller_phone) return;
    const phone = String(listing.seller_phone).replace(/[^\d+]/g, "");
    const clean = phone.startsWith("+") ? phone.slice(1) : phone;
    const text = encodeURIComponent(`السلام عليكم، بخصوص إعلانك: ${listing.title}`);
    window.open(`https://wa.me/${clean}?text=${text}`, "_blank");
  };

  const postComment = async () => {
    const body = newComment.trim();
    if (!body) return;
    setPostingComment(true);
    try {
      const authorName = user?.name && user.name !== "زائر" ? user.name : null;
      await tairApi.addListingComment(listingId, body, uid, authorName);
      setNewComment("");
      await loadComments();
    } catch (e) { /* silent */ }
    finally { setPostingComment(false); }
  };

  const toggleCommentLike = async (commentId) => {
    try {
      const res = await tairApi.toggleCommentLike(commentId, uid);
      setComments((cs) => cs.map((c) => {
        if (c.comment_id !== commentId) return c;
        return {
          ...c,
          likes_count: (c.likes_count || 0) + (res.liked ? 1 : -1),
          liked_by: res.liked
            ? [...(c.liked_by || []), uid]
            : (c.liked_by || []).filter((u) => u !== uid),
        };
      }));
    } catch (e) { /* silent */ }
  };

  if (loading) {
    return (
      <div style={S.screen}>
        <TopBar title="تفاصيل الإعلان" onBack={onBack} />
        <div style={S.loadingText}>جاري التحميل…</div>
      </div>
    );
  }
  if (!listing || error) {
    return (
      <div style={S.screen}>
        <TopBar title="تفاصيل الإعلان" onBack={onBack} />
        <div style={{ padding: 40, textAlign: "center", color: T.danger }}>
          {error || "الإعلان غير موجود"}
        </div>
      </div>
    );
  }

  const isOwn = listing.seller_id === uid;
  const gallery = listing.images?.length ? listing.images : (listing.cover_image ? [listing.cover_image] : []);
  const activeImg = gallery[imgIdx];

  return (
    <div style={{ ...S.screen, paddingBottom: 100 }} data-testid="listing-details-screen">
      <TopBar title={listing.title} onBack={onBack} />

      <div style={S.container}>
        <div style={styles.gallery}>
          {activeImg ? (
            <img src={activeImg} alt={listing.title} style={styles.mainImg} />
          ) : (
            <div style={styles.placeholder}>
              <Bird size={72} strokeWidth={1.2} color={T.textFaint} />
            </div>
          )}
          {listing.price_negotiable && <div style={styles.negBadge}>قابل للتفاوض</div>}
          <button
            onClick={toggleLike}
            style={styles.floatLike}
            data-testid="like-btn"
            aria-label="إعجاب"
          >
            <Heart
              size={22}
              strokeWidth={2.2}
              fill={liked ? T.danger : "none"}
              color={liked ? T.danger : T.text}
            />
          </button>
        </div>

        {gallery.length > 1 && (
          <div style={styles.thumbRow}>
            {gallery.slice(0, 6).map((url, i) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                style={{ ...styles.thumb, borderColor: i === imgIdx ? T.primary : T.border }}
                data-testid={`thumb-${i}`}
              >
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </button>
            ))}
          </div>
        )}

        <div style={S.card}>
          <div style={{ display: "flex", flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
            <div style={styles.price}>
              {listing.price_sar} <span style={styles.currency}>ر.س</span>
            </div>
            <div style={styles.likeStat}>
              <Heart size={14} strokeWidth={0} fill={T.danger} color={T.danger} />
              <span>{favCount}</span>
            </div>
          </div>
          <div style={styles.location}>
            <MapPin size={13} strokeWidth={2.2} color={T.textMuted} />
            <span>{listing.city}{listing.district ? ` · ${listing.district}` : ""}</span>
          </div>
          <h1 style={styles.title}>{listing.title}</h1>
        </div>

        {/* Seller Card with Follow Button */}
        {!isOwn && (
          <SellerCard
            sellerId={listing.seller_id}
            sellerName={listing.seller_name}
            sellerAvatar={listing.seller_avatar}
            verifiedShop={listing.seller_verified_shop}
            verifiedCarrier={listing.seller_verified_carrier}
            currentUserId={uid}
            onOpenSeller={onOpenSeller}
          />
        )}

        <div style={S.card}>
          <h2 style={S.h2}>المواصفات</h2>
          <div style={styles.specGrid}>
            {listing.gender && <Spec Icon={User} label="الجنس" value={GENDER_LABEL[listing.gender]} />}
            {listing.age_months && <Spec Icon={Calendar} label="العمر" value={`${listing.age_months} شهر`} />}
            {listing.breed && <Spec Icon={Tag} label="السلالة" value={listing.breed} />}
            {listing.color && <Spec Icon={Palette} label="اللون" value={listing.color} />}
          </div>
        </div>

        <div style={S.card}>
          <h2 style={S.h2}>الوصف</h2>
          <p style={styles.desc}>{listing.description}</p>
        </div>

        {listing.health && (
          <div style={S.card}>
            <h2 style={S.h2}>الحالة الصحية</h2>
            <div style={styles.specGrid}>
              <Spec Icon={HeartPulse} label="الحالة" value={
                <StatusPill
                  label={HEALTH_LABEL[listing.health.status] || "-"}
                  color={HEALTH_COLOR[listing.health.status] || T.textMuted}
                />
              } />
              <Spec Icon={Syringe} label="محصّن" value={listing.health.vaccinated ? "نعم" : "لا"} />
              {listing.health.ring_number && (
                <Spec Icon={Fingerprint} label="رقم الخاتم" value={listing.health.ring_number} />
              )}
            </div>
            {listing.health.notes && (
              <p style={{ ...styles.desc, marginTop: 10 }}>{listing.health.notes}</p>
            )}
          </div>
        )}

        {/* Comments Section */}
        <div style={S.card}>
          <h2 style={S.h2}>
            التعليقات ({comments.length})
          </h2>
          {comments.length === 0 ? (
            <div style={styles.emptyComments}>لا توجد تعليقات بعد — كن أول من يعلّق</div>
          ) : (
            <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
              {comments.map((c) => (
                <CommentItem
                  key={c.comment_id}
                  comment={c}
                  isLiked={(c.liked_by || []).includes(uid)}
                  onToggleLike={() => toggleCommentLike(c.comment_id)}
                />
              ))}
            </div>
          )}
          <div style={styles.commentComposer}>
            <input
              style={styles.commentInput}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="اكتب تعليقاً…"
              onKeyDown={(e) => { if (e.key === "Enter") postComment(); }}
              data-testid="comment-input"
            />
            <button
              onClick={postComment}
              disabled={postingComment || !newComment.trim()}
              style={{ ...styles.commentSend, opacity: (postingComment || !newComment.trim()) ? 0.4 : 1 }}
              data-testid="comment-send"
              aria-label="إرسال"
            >
              <Send size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowReport(true)}
          style={styles.reportBtn}
          data-testid="report-btn"
        >
          <Flag size={13} strokeWidth={2.2} />
          <span>الإبلاغ عن هذا الإعلان</span>
        </button>

        {!isOwn && (
          <>
            <div style={styles.actionSubgrid}>
              <button onClick={handleShare} style={styles.subBtn} data-testid="share-listing-btn">
                <Share2 size={14} strokeWidth={2.2} /> مشاركة
              </button>
              <button onClick={shareToWhatsApp} style={styles.subBtnWa} data-testid="share-whatsapp-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.52 3.48A11.87 11.87 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.12.55 4.19 1.6 6.01L0 24l6.15-1.6A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52zM12 22a9.94 9.94 0 0 1-5.08-1.38l-.36-.22-3.65.95.98-3.56-.24-.37A9.98 9.98 0 1 1 22 12c0 5.52-4.48 10-10 10z"/>
                </svg>
                واتساب
              </button>
            </div>

            <div style={styles.actionSubgrid}>
              <button onClick={() => setShowReportUser(true)} style={styles.subBtnDanger} data-testid="report-user-btn">
                <UserX size={14} strokeWidth={2.2} /> بلّغ عن البائع
              </button>
              <button onClick={blockSeller} style={styles.subBtnDanger} data-testid="block-user-btn">
                <UserX size={14} strokeWidth={2.2} /> حظر البائع
              </button>
            </div>
          </>
        )}

        {isOwn && (
          <>
            <div style={styles.statsCard} data-testid="owner-stats">
              <div style={styles.statsTitle}>📊 إحصائيات إعلانك</div>
              <div style={styles.statsGrid}>
                <div style={styles.statBox}>
                  <div style={styles.statValue}>{listing.view_count || 0}</div>
                  <div style={styles.statLabel}>مشاهدة</div>
                </div>
                <div style={styles.statBox}>
                  <div style={styles.statValue}>{listing.likes_count || 0}</div>
                  <div style={styles.statLabel}>إعجاب</div>
                </div>
                <div style={styles.statBox}>
                  <div style={styles.statValue}>{listing.contacts_count || 0}</div>
                  <div style={styles.statLabel}>تواصل</div>
                </div>
              </div>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={styles.deleteBtn}
              data-testid="delete-listing-btn"
            >
              <Trash2 size={14} strokeWidth={2.2} />
              <span>{deleting ? "جاري الحذف…" : "حذف الإعلان نهائياً"}</span>
            </button>
          </>
        )}

        {/* Safety notice — always visible on non-owned listings */}
        {!isOwn && (
          <div style={styles.safetyNotice} data-testid="safety-notice">
            <div style={styles.safetyIcon}>⚠️</div>
            <div style={styles.safetyText}>
              <strong>تنبيه:</strong> منصة طير وسيط تقني فقط ولا تتحمّل أي تقصير من المُعلنين أو الموصّلين
              {" "}<strong>غير الموثّقين</strong>. تعامَل بحذر ولا تدفع قبل رؤية الطائر.
            </div>
          </div>
        )}
      </div>

      {/* Sticky contact bar (only if not own listing) */}
      {!isOwn && (
        <div style={styles.contactBar}>
          <div style={styles.contactInner}>
            <button
              onClick={() => startChat()}
              style={styles.chatBtn}
              data-testid="chat-seller-btn"
            >
              <MessageCircle size={18} strokeWidth={2.2} />
              <span>راسل البائع</span>
            </button>
            {listing.seller_phone && (
              <button
                onClick={openWhatsApp}
                style={styles.whatsappBtn}
                data-testid="whatsapp-btn"
                aria-label="واتساب"
              >
                <Phone size={18} strokeWidth={2.4} />
                <span>واتساب</span>
              </button>
            )}
          </div>
        </div>
      )}

      {showReport && (
        <ReportModal
          user={user}
          listingId={listing.listing_id}
          onClose={() => setShowReport(false)}
        />
      )}

      {showReportUser && (
        <div style={reportUserStyles.overlay} onClick={() => setShowReportUser(false)} data-testid="report-user-modal">
          <div style={reportUserStyles.card} onClick={(e) => e.stopPropagation()}>
            <div style={reportUserStyles.head}>
              <button onClick={() => setShowReportUser(false)} style={reportUserStyles.close}><X size={18} /></button>
              <h3 style={reportUserStyles.title}>الإبلاغ عن البائع</h3>
              <span style={{ width: 30 }} />
            </div>
            <div style={reportUserStyles.body}>
              <label style={reportUserStyles.label}>سبب البلاغ</label>
              <select
                value={reportUserReason}
                onChange={(e) => setReportUserReason(e.target.value)}
                style={reportUserStyles.select}
                data-testid="report-user-reason"
              >
                <option value="fraud">احتيال</option>
                <option value="fake_listing">إعلان مزيّف</option>
                <option value="harassment">إساءة أو تحرّش</option>
                <option value="prohibited_animal">حيوان محظور بيعه</option>
                <option value="spam">رسائل مزعجة</option>
                <option value="other">أخرى</option>
              </select>
              <label style={reportUserStyles.label}>تفاصيل إضافية (اختياري)</label>
              <textarea
                value={reportUserNote}
                onChange={(e) => setReportUserNote(e.target.value)}
                placeholder="اذكر أي معلومات تساعدنا في المراجعة…"
                style={reportUserStyles.textarea}
                data-testid="report-user-note"
              />
              <button
                onClick={submitReportUser}
                disabled={reportingUser}
                style={reportUserStyles.submit}
                data-testid="report-user-submit"
              >
                {reportingUser ? "جاري الإرسال…" : "إرسال البلاغ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const reportUserStyles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 16,
  },
  card: {
    background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420,
    boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
  },
  head: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px", borderBottom: `1px solid ${T.border}`,
  },
  title: { fontSize: 16, fontWeight: 900, color: T.textStrong, margin: 0 },
  close: {
    width: 30, height: 30, borderRadius: 15, border: "none",
    background: "#f8fafc", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  body: { padding: 16, display: "flex", flexDirection: "column", gap: 10 },
  label: { fontSize: 12, fontWeight: 800, color: T.textStrong, textAlign: "right" },
  select: {
    padding: "10px", borderRadius: 10, border: `1px solid ${T.border}`,
    background: "#fff", fontFamily: "inherit", fontSize: 13, textAlign: "right",
  },
  textarea: {
    padding: "10px", borderRadius: 10, border: `1px solid ${T.border}`,
    minHeight: 80, fontFamily: "inherit", fontSize: 13, textAlign: "right",
  },
  submit: {
    marginTop: 6,
    padding: "12px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
    color: "#fff", fontWeight: 900, fontSize: 14, fontFamily: "inherit",
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(220,38,38,0.35)",
  },
};

// ============ Seller Card with Follow button ============
function SellerCard({ sellerId, sellerName, sellerAvatar, verifiedShop, verifiedCarrier, currentUserId, onOpenSeller }) {
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) return;
    tairApi.followStatus(sellerId, currentUserId)
      .then((d) => {
        setFollowing(!!d.following);
        setFollowers(d.followers_count || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sellerId, currentUserId]);

  const toggle = async () => {
    setLoading(true);
    try {
      const d = await tairApi.toggleFollow(sellerId, currentUserId);
      setFollowing(!!d.following);
      setFollowers((n) => d.following ? n + 1 : Math.max(0, n - 1));
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  };

  const initial = (sellerName || sellerId || "?").charAt(0).toUpperCase();

  return (
    <div
      style={{ ...S.card, padding: 14, cursor: onOpenSeller ? "pointer" : "default" }}
      onClick={() => onOpenSeller && onOpenSeller(sellerId)}
      data-testid="seller-card"
    >
      <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 23,
          background: "#f0fdfa", color: T.primary,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 900, flexShrink: 0, overflow: "hidden",
        }}>
          {sellerAvatar ? (
            <img src={sellerAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : initial}
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
          <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>
              {sellerName || `مُعلن #${(sellerId || "").slice(-4)}`}
            </div>
            <VerifiedTick verified={verifiedShop} type="shop" size={16} title="متجر موثّق" />
            {!verifiedShop && (
              <VerifiedTick verified={verifiedCarrier} type="carrier" size={16} title="ناقل موثّق" />
            )}
            {verifiedShop && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#0891b2" }}>
                متجر موثّق
              </span>
            )}
            {!verifiedShop && verifiedCarrier && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#2563eb" }}>
                ناقل موثّق
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, fontWeight: 600 }}>
            {followers} متابع
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggle(); }}
          disabled={loading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: following ? "#f0fdfa" : T.primary,
            color: following ? T.primary : "#fff",
            border: following ? `1.5px solid ${T.primary}` : "none",
            borderRadius: 999,
            padding: "8px 14px",
            fontSize: 12, fontWeight: 800,
            cursor: loading ? "wait" : "pointer",
            fontFamily: "inherit",
            opacity: loading ? 0.7 : 1,
            flexShrink: 0,
          }}
          data-testid="follow-seller-btn"
        >
          {following ? <UserCheck size={14} strokeWidth={2.4} /> : <UserPlus size={14} strokeWidth={2.4} />}
          <span>{following ? "تتابعه" : "متابعة"}</span>
        </button>
      </div>
    </div>
  );
}

function Spec({ Icon, label, value }) {  return (
    <div style={styles.spec}>
      <div style={styles.specIcon}>
        <Icon size={16} strokeWidth={2} color={T.textMuted} />
      </div>
      <div style={{ flex: 1, textAlign: "right" }}>
        <div style={styles.specLabel}>{label}</div>
        <div style={styles.specValue}>{value}</div>
      </div>
    </div>
  );
}

function CommentItem({ comment, isLiked, onToggleLike }) {
  const initial = (comment.author_name || comment.author_id || "?").charAt(0).toUpperCase();
  return (
    <div style={styles.commentItem}>
      <div style={styles.commentAvatar}>{initial}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.commentTop}>
          <span style={styles.commentAuthor}>{comment.author_name || "مستخدم"}</span>
          <span style={styles.commentTime}>{timeAgo(comment.created_at)}</span>
        </div>
        <p style={styles.commentBody}>{comment.body}</p>
        <button
          onClick={onToggleLike}
          style={{
            ...styles.commentLike,
            color: isLiked ? T.danger : T.textMuted,
          }}
          data-testid={`comment-like-${comment.comment_id}`}
        >
          <Heart
            size={12}
            strokeWidth={2.2}
            fill={isLiked ? T.danger : "none"}
          />
          <span>{comment.likes_count || 0}</span>
        </button>
      </div>
    </div>
  );
}

function ReportModal({ user, listingId, onClose }) {
  const [reason, setReason] = useState("prohibited_species");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      await tairApi.reportListing(listingId, reason, note || null, user.id || user.user_id);
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (e) { setSending(false); }
  };

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()} data-testid="report-modal">
        <div style={modalStyles.header}>
          <button onClick={onClose} style={S.iconBtn} aria-label="إغلاق">
            <X size={18} strokeWidth={2.2} />
          </button>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, flex: 1, textAlign: "center" }}>
            الإبلاغ عن الإعلان
          </h3>
          <div style={{ width: 40 }} />
        </div>
        <div style={{ padding: 18 }}>
          {done ? (
            <div style={{ padding: 20, textAlign: "center", color: T.success, fontWeight: 700 }}>
              تم استلام بلاغك، شكراً لك.
            </div>
          ) : (
            <>
              <label style={S.label}>سبب البلاغ</label>
              <select style={S.input} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="report-reason">
                <option value="prohibited_species">نوع محظور (سايتس)</option>
                <option value="scam">احتيال</option>
                <option value="animal_abuse">إساءة للحيوان</option>
                <option value="wrong_info">معلومات خاطئة</option>
                <option value="other">أخرى</option>
              </select>
              <label style={{ ...S.label, marginTop: 12 }}>ملاحظات</label>
              <textarea style={{ ...S.input, minHeight: 70 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري…" data-testid="report-note" />
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={onClose} style={{ ...S.secondaryBtn, flex: 1 }}>إلغاء</button>
                <button onClick={submit} disabled={sending} style={{ ...S.primaryBtn, flex: 1, background: T.danger, opacity: sending ? 0.7 : 1 }} data-testid="submit-report">
                  {sending ? "جارٍ الإرسال…" : "إرسال البلاغ"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  gallery: {
    position: "relative",
    aspectRatio: "16/11",
    background: T.bgAlt,
    borderRadius: T.radiusMd,
    overflow: "hidden",
    marginBottom: 10,
    border: `1px solid ${T.border}`,
  },
  mainImg: { width: "100%", height: "100%", objectFit: "cover" },
  placeholder: {
    width: "100%", height: "100%",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  negBadge: {
    position: "absolute", top: 12, insetInlineStart: 12,
    background: "rgba(15, 23, 42, 0.8)", color: "#fff",
    fontSize: 11, fontWeight: 700, padding: "5px 12px",
    borderRadius: T.radiusPill, backdropFilter: "blur(4px)",
  },
  floatLike: {
    position: "absolute", top: 12, insetInlineEnd: 12,
    background: "rgba(255,255,255,0.95)", border: "none",
    width: 44, height: 44, borderRadius: 22,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", boxShadow: T.shadowMd,
    backdropFilter: "blur(6px)",
  },
  thumbRow: {
    display: "flex", flexDirection: "row-reverse", gap: 8,
    marginBottom: 14, overflowX: "auto",
  },
  thumb: {
    width: 64, height: 64, borderRadius: T.radiusSm,
    overflow: "hidden", borderWidth: 2, borderStyle: "solid",
    padding: 0, background: T.bgAlt, cursor: "pointer", flexShrink: 0,
  },
  price: {
    fontSize: 28, fontWeight: 900, color: T.primary,
    letterSpacing: "-0.02em", textAlign: "right",
  },
  currency: { fontSize: 14, fontWeight: 700, color: T.textMuted },
  likeStat: {
    display: "inline-flex", alignItems: "center", gap: 5,
    fontSize: 13, fontWeight: 800, color: T.danger,
  },
  location: {
    display: "inline-flex", alignItems: "center", gap: 4,
    color: T.textMuted, fontSize: 13, fontWeight: 600, marginTop: 4,
  },
  title: {
    margin: "12px 0 0", fontSize: 19, fontWeight: 800,
    color: T.textStrong, textAlign: "right", letterSpacing: "-0.01em",
  },
  specGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  spec: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    gap: 10, padding: 10, background: T.bgAlt, borderRadius: T.radius,
  },
  specIcon: {
    width: 32, height: 32, borderRadius: 8, background: T.surface,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  specLabel: { fontSize: 11, color: T.textMuted, fontWeight: 700 },
  specValue: { fontSize: 13, color: T.text, fontWeight: 700, marginTop: 2 },
  desc: {
    color: T.text, fontSize: 14, lineHeight: 1.75,
    textAlign: "right", margin: 0, whiteSpace: "pre-wrap",
  },

  // Comments
  emptyComments: {
    padding: 16, background: T.bgAlt, borderRadius: T.radius,
    color: T.textMuted, fontSize: 13, textAlign: "center", marginBottom: 10,
  },
  commentItem: {
    display: "flex", flexDirection: "row-reverse", gap: 10,
  },
  commentAvatar: {
    width: 34, height: 34, borderRadius: 17,
    background: "#f0fdfa", color: T.primary,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 800, flexShrink: 0,
  },
  commentTop: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "space-between", gap: 8, marginBottom: 3,
  },
  commentAuthor: { fontSize: 13, fontWeight: 800, color: T.text },
  commentTime: { fontSize: 10, color: T.textFaint, fontWeight: 600 },
  commentBody: {
    fontSize: 13, color: T.text, lineHeight: 1.65,
    textAlign: "right", margin: "0 0 4px", whiteSpace: "pre-wrap",
  },
  commentLike: {
    display: "inline-flex", alignItems: "center", gap: 4,
    background: "transparent", border: "none", padding: "4px 0",
    fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
  commentComposer: {
    display: "flex", flexDirection: "row-reverse",
    gap: 6, alignItems: "center",
    borderTop: `1px solid ${T.divider}`, paddingTop: 10,
  },
  commentInput: {
    flex: 1, padding: "10px 14px",
    border: `1.5px solid ${T.border}`, borderRadius: T.radiusPill,
    fontSize: 13, background: T.bgAlt, color: T.text,
    fontFamily: "inherit", textAlign: "right", outline: "none",
  },
  commentSend: {
    background: T.primary, color: T.textInverse, border: "none",
    width: 36, height: 36, borderRadius: 18,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
  },

  reportBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 6, width: "100%", background: "transparent",
    border: `1px solid ${T.border}`, color: T.textMuted,
    padding: "11px", borderRadius: T.radius, fontSize: 12,
    fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    marginTop: 12,
  },
  deleteBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 6, width: "100%",
    background: "rgba(239, 68, 68, 0.08)",
    border: `1px solid rgba(239, 68, 68, 0.35)`,
    color: T.danger,
    padding: "11px", borderRadius: T.radius, fontSize: 12,
    fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
    marginTop: 8,
  },
  actionSubgrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
    marginTop: 8,
  },
  subBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 6, background: "#f0fdfa", border: `1px solid ${T.primary}30`,
    color: T.primary, padding: "10px", borderRadius: T.radius,
    fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
  },
  subBtnWa: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 6, background: "#25D366", border: "none",
    color: "#fff", padding: "10px", borderRadius: T.radius,
    fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
  },
  subBtnDanger: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 6, background: "#fff", border: `1px solid ${T.border}`,
    color: T.textMuted, padding: "10px", borderRadius: T.radius,
    fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  },
  safetyNotice: {
    display: "flex", flexDirection: "row-reverse",
    gap: 10,
    background: "linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%)",
    border: "1px solid #fde68a",
    borderRadius: 12,
    padding: "12px 12px",
    marginTop: 14,
    textAlign: "right",
  },
  safetyIcon: { fontSize: 20, flexShrink: 0 },
  safetyText: {
    fontSize: 12, lineHeight: 1.65, color: "#78350f", fontWeight: 600,
  },

  // Owner stats card
  statsCard: {
    background: "linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)",
    border: `1px solid ${T.border}`,
    borderRadius: 14, padding: 14,
    marginTop: 14, marginBottom: 8,
  },
  statsTitle: {
    fontSize: 13, fontWeight: 900, color: T.textStrong,
    marginBottom: 12, textAlign: "right",
  },
  statsGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
  },
  statBox: {
    background: "#fff", border: `1px solid ${T.border}`,
    borderRadius: 10, padding: "10px 6px", textAlign: "center",
  },
  statValue: { fontSize: 20, fontWeight: 900, color: T.primary },
  statLabel: { fontSize: 11, fontWeight: 700, color: T.textMuted, marginTop: 2 },

  // Sticky contact bar
  contactBar: {
    position: "fixed", bottom: 78, left: 0, right: 0,
    background: T.surface, borderTop: `1px solid ${T.border}`,
    padding: "10px 12px", zIndex: 40,
    boxShadow: "0 -4px 16px rgba(15, 23, 42, 0.06)",
  },
  contactInner: {
    maxWidth: 900, margin: "0 auto",
    display: "flex", flexDirection: "row-reverse", gap: 8,
  },
  chatBtn: {
    flex: 1,
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    background: T.primary, color: T.textInverse, border: "none",
    borderRadius: T.radius, padding: "12px 18px",
    fontSize: 14, fontWeight: 800, cursor: "pointer",
    fontFamily: "inherit", boxShadow: T.shadowSm,
  },
  whatsappBtn: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    background: "#25d366", color: "#fff", border: "none",
    borderRadius: T.radius, padding: "12px 18px",
    fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
    boxShadow: T.shadowSm,
  },
};

const modalStyles = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(3, 7, 18, 0.55)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 16,
  },
  modal: {
    background: T.surface, borderRadius: T.radiusLg,
    maxWidth: 480, width: "100%",
    fontFamily: "'Tajawal', 'IBM Plex Sans Arabic', system-ui, sans-serif",
    direction: "rtl", overflow: "hidden",
  },
  header: {
    display: "flex", flexDirection: "row-reverse",
    alignItems: "center", justifyContent: "space-between",
    padding: "14px 18px", borderBottom: `1px solid ${T.divider}`,
  },
};
