// طير — Profile (professional, lucide icons, sign-in prompt for guests)
import React, { useEffect, useState } from "react";
import {
  User, Star, Bird, Truck, LogOut, ChevronLeft,
  ShieldCheck, FileText, Trash2, HelpCircle, LogIn, Fingerprint,
  Camera, Store, Package, Bell, BellOff, Sparkles, BarChart3,
} from "lucide-react";
import { T, S } from "./tairTheme";
import { tairApi } from "./tairApi";
import { StatusPill } from "./TairUI";
import accountHeader from "../assets/tair-design/headers/account.jpg";
import shukrStrip from "../assets/tair-design/shukr_strip.jpg";
import { TAIR_PAGE_STYLE, TairAppHeader } from "./TairAppChrome";
import { isPushSupported, subscribeToPush, unsubscribeFromPush } from "./pushClient";
import { toast } from "../hooks/use-toast";

export default function ProfileScreen({ user, onOpenListing, onOpenTrip, onLogout, onOpenKyc, onOpenOrders, onOpenStories, onOpenAnalytics, onOpenNotifications }) {
  const uid = user.id || user.user_id;
  const isGuest = !!user.isGuest;
  const [pushEnabled, setPushEnabled] = useState(
    typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted",
  );
  const [pushBusy, setPushBusy] = useState(false);

  const togglePush = async () => {
    if (pushBusy || !isPushSupported()) {
      toast({ title: "المتصفح لا يدعم الإشعارات الفورية", variant: "destructive" });
      return;
    }
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
        toast({ title: "تم إيقاف الإشعارات" });
      } else {
        const res = await subscribeToPush(uid);
        if (res.ok) {
          setPushEnabled(true);
          toast({ title: "تم تفعيل الإشعارات الفورية ✅", description: "ستصلك رسائل وطلبات جديدة حتى مع إغلاق التطبيق." });
        } else if (res.reason === "denied") {
          toast({ title: "تم رفض الأذونات", description: "فعّل الإشعارات من إعدادات المتصفح", variant: "destructive" });
        } else {
          toast({ title: "تعذّر تفعيل الإشعارات", description: res.reason, variant: "destructive" });
        }
      }
    } finally {
      setPushBusy(false);
    }
  };

  const [tab, setTab] = useState("listings");
  const [myListings, setMyListings] = useState([]);
  const [myTrips, setMyTrips] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [avg, setAvg] = useState({ seller: 0, carrier: 0 });
  const [profileBg, setProfileBg] = useState(user.profile_bg_url || null);
  const [avatar, setAvatar] = useState(user.avatar || null);
  const [bgUploading, setBgUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [isVerifiedShop, setIsVerifiedShop] = useState(!!user.is_verified_shop);
  const [isVerifiedCarrier, setIsVerifiedCarrier] = useState(!!user.is_verified_carrier);
  const [followers, setFollowers] = useState(0);
  const bgInputRef = React.useRef(null);
  const avatarInputRef = React.useRef(null);

  useEffect(() => {
    if (isGuest) return;
    tairApi.listingsBySeller(uid, true).then(setMyListings).catch(() => {});
    tairApi.tripsByCarrier(uid, true).then(setMyTrips).catch(() => {});
    tairApi
      .ratingsForUser(uid)
      .then((rs) => {
        setRatings(rs);
        const bySeller = rs.filter((r) => r.rated_role === "seller");
        const byCarrier = rs.filter((r) => r.rated_role === "carrier");
        const avgOf = (arr) => arr.length ? Math.round((arr.reduce((s, r) => s + r.stars, 0) / arr.length) * 10) / 10 : 0;
        setAvg({ seller: avgOf(bySeller), carrier: avgOf(byCarrier) });
      })
      .catch(() => {});
    // Refresh verified flags + bg from server
    tairApi.getPublicProfile(uid).then((u) => {
      if (u.profile_bg_url) setProfileBg(u.profile_bg_url);
      if (u.avatar) setAvatar(u.avatar);
      if (u.is_verified_shop) setIsVerifiedShop(true);
      if (u.is_verified_carrier) setIsVerifiedCarrier(true);
      setFollowers(u.followers_count || 0);
    }).catch(() => {});
  }, [uid, isGuest]);

  const uploadBg = async (file) => {
    if (!file) return;
    setBgUploading(true);
    try {
      const url = await tairApi.uploadImage(file, uid);
      await tairApi.updateProfile({ profile_bg_url: url }, uid);
      setProfileBg(url);
    } catch (e) {
      // ignore
    } finally {
      setBgUploading(false);
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    setAvatarUploading(true);
    try {
      const url = await tairApi.uploadImage(file, uid);
      await tairApi.updateProfile({ avatar: url }, uid);
      setAvatar(url);
    } catch (e) {
      // ignore
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div style={{ ...S.screen, ...TAIR_PAGE_STYLE }} data-testid="profile-screen">
      <TairAppHeader image={accountHeader} onBell={onOpenNotifications} />
      <header style={{
        ...styles.hero,
        backgroundImage: profileBg
          ? `linear-gradient(180deg, rgba(15,23,42,0.10) 0%, rgba(255,255,255,0.85) 65%, #ffffff 100%), url(${profileBg})`
          : "linear-gradient(135deg, #f0fdfa 0%, #ffffff 55%, #fdf2f8 100%)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}>
        {!isGuest && (
          <>
            <button
              onClick={() => bgInputRef.current?.click()}
              style={styles.bgUploadBtn}
              data-testid="profile-bg-upload"
              title="تغيير خلفية المتجر"
              disabled={bgUploading}
            >
              <Camera size={14} strokeWidth={2.4} />
              <span>{bgUploading ? "جاري الرفع…" : (profileBg ? "تغيير الخلفية" : "أضف خلفية متجرك")}</span>
            </button>
            <input
              ref={bgInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBg(f); }}
            />
          </>
        )}

        <div style={styles.avatarWrap}>
          <div style={styles.avatar}>
            {avatar ? (
              <img src={avatar} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <User size={40} strokeWidth={1.8} color={T.primary} />
            )}
          </div>
          {!isGuest && (
            <>
              <button
                onClick={() => avatarInputRef.current?.click()}
                style={styles.avatarEditBtn}
                data-testid="profile-avatar-upload"
                title="تغيير الصورة الشخصية"
                disabled={avatarUploading}
                aria-label="تغيير الصورة الشخصية"
              >
                <Camera size={14} strokeWidth={2.4} color="#fff" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }}
              />
            </>
          )}
        </div>
        <div style={styles.nameRow}>
          <h1 style={styles.name}>{user.name || "زائر"}</h1>
          {isVerifiedShop && (
            <span style={styles.badgeShop} title="متجر موثوق" data-testid="badge-verified-shop">
              <Store size={11} strokeWidth={2.5} />
              <span>متجر موثوق</span>
            </span>
          )}
          {!isVerifiedShop && isVerifiedCarrier && (
            <span style={styles.badgeCarrier} title="ناقل موثوق" data-testid="badge-verified-carrier">
              <Truck size={11} strokeWidth={2.5} />
              <span>ناقل موثوق</span>
            </span>
          )}
        </div>
        <p style={styles.email}>{isGuest ? "حساب زائر — سجّل للحصول على كامل الميزات" : (user.phone || user.email || uid)}</p>

        {isGuest && (
          <button
            onClick={() => (window.location.href = "/auth")}
            style={styles.signInBtn}
            data-testid="signin-cta"
          >
            <LogIn size={16} strokeWidth={2.4} />
            <span>إنشاء حساب / تسجيل الدخول</span>
          </button>
        )}

        {!isGuest && (
          <div style={styles.stats}>
            <Stat label="إعلانات" value={myListings.length} Icon={Bird} />
            <Stat label="رحلات" value={myTrips.length} Icon={Truck} />
            <Stat label="بائع" value={avg.seller > 0 ? avg.seller : "—"} Icon={Star} suffix="⭐" />
            <Stat label="موصّل" value={avg.carrier > 0 ? avg.carrier : "—"} Icon={Star} suffix="⭐" />
          </div>
        )}
      </header>

      <div style={S.container}>
        {!isGuest && (
          <>
            <div style={styles.tabsRow}>
              {[
                { id: "listings", label: `إعلاناتي (${myListings.length})` },
                { id: "trips", label: `رحلاتي (${myTrips.length})` },
                { id: "ratings", label: `تقييماتي (${ratings.length})` },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }}
                  data-testid={`profile-tab-${t.id}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "listings" && (
              <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                {myListings.length === 0 ? (
                  <div style={styles.emptyCard}>لم تنشر إعلانات بعد.</div>
                ) : (
                  myListings.map((l) => (
                    <button
                      key={l.listing_id}
                      onClick={() => onOpenListing(l.listing_id)}
                      style={styles.row}
                      data-testid={`my-listing-${l.listing_id}`}
                    >
                      <div style={styles.rowThumb}>
                        {l.cover_image ? (
                          <img src={l.cover_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <Bird size={22} strokeWidth={1.5} color={T.textFaint} />
                        )}
                      </div>
                      <div style={{ flex: 1, textAlign: "right", minWidth: 0 }}>
                        <div style={styles.rowTitle}>{l.title}</div>
                        <div style={styles.rowMeta}>
                          {l.price_sar} ر.س · {l.status}
                        </div>
                      </div>
                      <ChevronLeft size={18} strokeWidth={2} color={T.textFaint} />
                    </button>
                  ))
                )}
              </div>
            )}

            {tab === "trips" && (
              <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                {myTrips.length === 0 ? (
                  <div style={styles.emptyCard}>لم تسجّل رحلات بعد.</div>
                ) : (
                  myTrips.map((t) => (
                    <button
                      key={t.trip_id}
                      onClick={() => onOpenTrip(t.trip_id)}
                      style={styles.row}
                      data-testid={`my-trip-${t.trip_id}`}
                    >
                      <div style={styles.rowThumb}>
                        <Truck size={22} strokeWidth={1.8} color={T.primary} />
                      </div>
                      <div style={{ flex: 1, textAlign: "right", minWidth: 0 }}>
                        <div style={styles.rowTitle}>
                          {t.from_city} → {t.to_city}
                        </div>
                        <div style={styles.rowMeta}>
                          {new Date(t.depart_at).toLocaleDateString("ar-SA")} · {t.status}
                        </div>
                      </div>
                      <ChevronLeft size={18} strokeWidth={2} color={T.textFaint} />
                    </button>
                  ))
                )}
              </div>
            )}

            {tab === "ratings" && (
              <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                {ratings.length === 0 ? (
                  <div style={styles.emptyCard}>لا توجد تقييمات بعد.</div>
                ) : (
                  ratings.map((r) => (
                    <div key={r.rating_id} style={styles.ratingCard}>
                      <div style={styles.ratingTop}>
                        <div style={styles.starsRow}>
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} size={14} strokeWidth={0}
                              fill={i < r.stars ? T.accent : T.border}
                              color={i < r.stars ? T.accent : T.border} />
                          ))}
                        </div>
                        <StatusPill
                          label={`كـ${r.rated_role === "seller" ? "بائع" : r.rated_role === "carrier" ? "موصّل" : "مشتري"}`}
                          color={T.primary}
                        />
                      </div>
                      {r.comment && (
                        <p style={styles.ratingComment}>&ldquo;{r.comment}&rdquo;</p>
                      )}
                      {r.tags?.length > 0 && (
                        <div style={styles.tagsRow}>
                          {r.tags.map((t, i) => (
                            <span key={i} style={S.pill}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* Settings menu */}
        <div style={styles.menuCard}>
          {onOpenOrders && (
            <MenuLink
              icon={<Package size={20} strokeWidth={1.8} />}
              label="طلباتي"
              onClick={onOpenOrders}
              testId="menu-orders"
            />
          )}
          {onOpenAnalytics && (
            <MenuLink
              icon={<BarChart3 size={20} strokeWidth={1.8} />}
              label="إحصائيات إعلاناتي"
              onClick={onOpenAnalytics}
              testId="menu-analytics"
            />
          )}
          {onOpenKyc && (
            <MenuLink
              icon={<Fingerprint size={20} strokeWidth={1.8} />}
              label="التحقق من الهوية (KYC)"
              onClick={onOpenKyc}
              testId="menu-kyc"
            />
          )}
          <MenuLink
            icon={pushEnabled ? <Bell size={20} strokeWidth={1.8} /> : <BellOff size={20} strokeWidth={1.8} />}
            label={pushEnabled ? "الإشعارات الفورية: مفعّلة" : "تفعيل الإشعارات الفورية"}
            onClick={togglePush}
            testId="menu-push"
          />
          {onOpenStories && (
            <MenuLink
              icon={<Sparkles size={20} strokeWidth={1.8} />}
              label="قصص نجاح من المجتمع"
              onClick={onOpenStories}
              testId="menu-stories"
            />
          )}
          <MenuLink
            icon={<ShieldCheck size={20} strokeWidth={1.8} />}
            label="سياسة الخصوصية"
            onClick={() => window.location.assign("/privacy-policy")}
            testId="menu-privacy"
          />
          <MenuLink
            icon={<FileText size={20} strokeWidth={1.8} />}
            label="الشروط والأحكام"
            onClick={() => window.location.assign("/terms-of-service")}
            testId="menu-terms"
          />
          <MenuLink
            icon={<HelpCircle size={20} strokeWidth={1.8} />}
            label="المساعدة والدعم"
            onClick={() => window.location.assign("/support")}
            testId="menu-support"
          />
          <MenuLink
            icon={<Trash2 size={20} strokeWidth={1.8} />}
            label="حذف الحساب"
            onClick={() => window.location.assign("/delete-account")}
            danger
            testId="menu-delete"
          />
        </div>

        {!isGuest && (
          <button
            onClick={onLogout}
            style={styles.logoutBtn}
            data-testid="logout-btn"
          >
            <LogOut size={16} strokeWidth={2.4} />
            <span>تسجيل الخروج</span>
          </button>
        )}
      </div>

      {/* شريحة "شكر" مصغّرة تذوب في الخلفية الكريمية بالكامل */}
      <div
        aria-hidden="true"
        style={{
          margin: "18px auto 12px",
          maxWidth: 320,
          background: "transparent",
          pointerEvents: "none",
          padding: "0 20px",
        }}
        data-testid="account-shukr-strip"
      >
        <img
          src={shukrStrip}
          alt="شكراً لك"
          style={{
            width: "100%",
            display: "block",
            background: "transparent",
            mixBlendMode: "multiply",
            WebkitMaskImage: "radial-gradient(ellipse 78% 70% at center, #000 30%, transparent 100%)",
            maskImage: "radial-gradient(ellipse 78% 70% at center, #000 30%, transparent 100%)",
          }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, Icon, suffix }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statVal}>
        {value}
        {suffix && <span style={{ marginRight: 3, fontSize: 12 }}>{suffix}</span>}
      </div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function MenuLink({ icon, label, onClick, danger, testId }) {
  return (
    <button onClick={onClick} style={{
      ...styles.menuLink,
      color: danger ? T.danger : T.text,
    }} data-testid={testId}>
      <span style={{
        ...styles.menuIcon,
        color: danger ? T.danger : T.primary,
        background: danger ? "#fef2f2" : "#f0fdfa",
      }}>{icon}</span>
      <span style={{ flex: 1, textAlign: "right", fontWeight: 700 }}>{label}</span>
      <ChevronLeft size={18} strokeWidth={2} color={T.textFaint} />
    </button>
  );
}

const styles = {
  hero: {
    position: "relative",
    padding: "40px 20px 24px",
    textAlign: "center",
    borderBottom: `1px solid ${T.divider}`,
    minHeight: 240,
  },
  bgUploadBtn: {
    position: "absolute",
    top: 12,
    insetInlineStart: 12,
    display: "inline-flex", alignItems: "center", gap: 6,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(8px)",
    color: T.primaryDark,
    border: `1px solid ${T.primary}44`,
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 11, fontWeight: 800,
    cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 2px 8px rgba(15,23,42,0.10)",
    zIndex: 2,
  },
  avatarWrap: {
    position: "relative",
    width: 84,
    height: 84,
    margin: "0 auto 12px",
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    background: "#f0fdfa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `3px solid #fff`,
    boxShadow: "0 4px 14px rgba(15,23,42,0.10)",
    overflow: "hidden",
    position: "relative",
    zIndex: 1,
  },
  avatarEditBtn: {
    position: "absolute",
    bottom: 0,
    insetInlineStart: -4,
    width: 30, height: 30, borderRadius: 15,
    background: T.primary,
    border: "2px solid #fff",
    boxShadow: "0 2px 8px rgba(15,23,42,0.20)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
    fontFamily: "inherit",
    zIndex: 2,
  },
  nameRow: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "center", gap: 8, flexWrap: "wrap",
    position: "relative", zIndex: 1,
  },
  name: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
    color: T.textStrong,
    letterSpacing: "-0.01em",
  },
  badgeShop: {
    display: "inline-flex", alignItems: "center", gap: 3,
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#fff", fontSize: 10, fontWeight: 800,
    padding: "3px 8px", borderRadius: 999,
    boxShadow: "0 3px 8px rgba(5,150,105,0.30)",
  },
  badgeCarrier: {
    display: "inline-flex", alignItems: "center", gap: 3,
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "#fff", fontSize: 10, fontWeight: 800,
    padding: "3px 8px", borderRadius: 999,
    boxShadow: "0 3px 8px rgba(37,99,235,0.30)",
  },
  email: {
    margin: "4px 0 0",
    fontSize: 12,
    color: T.textMuted,
    fontWeight: 600,
    position: "relative", zIndex: 1,
  },
  signInBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
    background: T.primary,
    color: T.textInverse,
    border: "none",
    borderRadius: T.radius,
    padding: "11px 22px",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: T.shadowSm,
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
    marginTop: 20,
    background: T.bgAlt,
    borderRadius: T.radiusMd,
    padding: 14,
  },
  stat: { textAlign: "center" },
  statVal: {
    fontSize: 18,
    fontWeight: 900,
    color: T.textStrong,
    letterSpacing: "-0.01em",
  },
  statLabel: { fontSize: 10, color: T.textMuted, marginTop: 2, fontWeight: 700 },

  tabsRow: {
    display: "flex",
    flexDirection: "row-reverse",
    gap: 4,
    background: T.bgAlt,
    padding: 4,
    borderRadius: T.radius,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    padding: "9px 4px",
    border: "none",
    borderRadius: T.radiusSm,
    background: "transparent",
    color: T.textMuted,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  tabActive: {
    background: T.surface,
    color: T.text,
    boxShadow: T.shadowXs,
  },
  emptyCard: {
    padding: 22,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusMd,
    textAlign: "center",
    color: T.textMuted,
    fontSize: 13,
  },
  row: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusMd,
    padding: "10px 12px",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "right",
  },
  rowThumb: {
    width: 50,
    height: 50,
    borderRadius: T.radius,
    background: T.bgAlt,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowTitle: {
    fontWeight: 800,
    fontSize: 14,
    color: T.text,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  rowMeta: { fontSize: 11, color: T.textMuted, marginTop: 2, fontWeight: 600 },

  ratingCard: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusMd,
    padding: 14,
  },
  ratingTop: {
    display: "flex",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  starsRow: { display: "flex", flexDirection: "row-reverse", gap: 2 },
  ratingComment: {
    color: T.textMuted,
    fontSize: 13,
    textAlign: "right",
    margin: "8px 0 0",
    lineHeight: 1.6,
  },
  tagsRow: {
    display: "flex",
    flexDirection: "row-reverse",
    gap: 4,
    flexWrap: "wrap",
    marginTop: 8,
  },

  menuCard: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusMd,
    overflow: "hidden",
    marginTop: 10,
    marginBottom: 16,
  },
  menuLink: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "14px 16px",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${T.divider}`,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 14,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    background: T.surface,
    border: `1.5px solid ${T.danger}`,
    color: T.danger,
    borderRadius: T.radius,
    padding: "13px 18px",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
