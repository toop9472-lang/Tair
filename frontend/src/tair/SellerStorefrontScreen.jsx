// طير — Seller storefront: modern immersive identity-driven design
import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, MapPin, Star, Package, Clock, ShieldCheck, UserPlus, UserCheck, Users, Store, Award, Heart, Eye, MessageCircle, Phone, Megaphone, Ticket, Truck } from "lucide-react";
import { T, S } from "./tairTheme";
import { tairApi } from "./tairApi";
import { EmptyState } from "./TairUI";
import VerifiedTick from "./VerifiedTick";
import { toWhatsAppPhone } from "./contactPhone";

const money = (v) => new Intl.NumberFormat("ar-SA").format(v || 0);

// ------- color helpers -------
const hexToRgb = (hex) => {
  if (!hex) return { r: 15, g: 118, b: 110 };
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const int = parseInt(v, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
};
const rgba = (hex, a) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
// perceived luminance to pick contrast
const luminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
const darken = (hex, amt = 0.3) => {
  const { r, g, b } = hexToRgb(hex);
  const f = (c) => Math.max(0, Math.floor(c * (1 - amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};

// ------- business-hours grouping (weekly summary) -------
const DAY_AR = { sat: "السبت", sun: "الأحد", mon: "الاثنين", tue: "الثلاثاء", wed: "الأربعاء", thu: "الخميس", fri: "الجمعة" };
const DAY_ORDER = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];

const summarizeHours = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const map = {};
  arr.forEach((h) => { if (h && h.day) map[h.day] = h; });
  // Group consecutive days with identical open/close (or "closed")
  const groups = [];
  let cur = null;
  DAY_ORDER.forEach((d) => {
    const h = map[d];
    const sig = !h ? "none" : h.closed ? "closed" : `${h.open}-${h.close}`;
    if (cur && cur.sig === sig) {
      cur.end = d;
    } else {
      if (cur) groups.push(cur);
      cur = { sig, start: d, end: d, h };
    }
  });
  if (cur) groups.push(cur);
  return groups
    .filter((g) => g.sig !== "none")
    .map((g) => {
      const label = g.start === g.end ? DAY_AR[g.start] : `${DAY_AR[g.start]} – ${DAY_AR[g.end]}`;
      const value = g.sig === "closed" ? "مغلق" : `${g.h.open} – ${g.h.close}`;
      return { label, value };
    });
};

function StoreFacts({ profile, brand }) {
  const paused = !!profile.store_paused;
  const cities = Array.isArray(profile.delivery_cities) ? profile.delivery_cities : [];
  const sales = Array.isArray(profile.flash_sales) ? profile.flash_sales : [];
  const coupons = Array.isArray(profile.coupons) ? profile.coupons : [];
  const hasPolicy = profile.shipping_note || profile.return_note || cities.length || profile.pickup_enabled || profile.location?.city;
  if (!paused && !profile.announcement && !sales.length && !coupons.length && !hasPolicy && !profile.response_promise) return null;
  const copy = async (code) => {
    try { await navigator.clipboard.writeText(code); } catch { /* the code stays visible */ }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }} data-testid="store-facts">
      {(paused || profile.announcement) && (
        <div style={{ padding: 12, borderRadius: 14, background: "#FFF8EC", textAlign: "right" }}>
          <div style={{ display: "flex", flexDirection: "row-reverse", gap: 8, alignItems: "center", color: "#8A6A2E", fontWeight: 900, fontSize: 13 }}>
            <Megaphone size={16} />
            <span>{paused ? "المتجر متوقف مؤقتاً" : "من المتجر"}</span>
          </div>
          {profile.announcement ? <div style={{ marginTop: 6, color: "#334155", fontSize: 13, lineHeight: 1.6 }}>{profile.announcement}</div> : null}
        </div>
      )}
      {profile.response_promise ? (
        <div style={{ textAlign: "right", color: brand, fontWeight: 800, fontSize: 12.5 }}>يرد {profile.response_promise}</div>
      ) : null}
      {sales.map((sale) => (
        <div key={sale.id} style={{ display: "flex", flexDirection: "row-reverse", gap: 10, alignItems: "center", padding: 10, borderRadius: 12, background: "#F7F1E8" }}>
          <div style={{ background: "#8B3A2F", color: "#fff", borderRadius: 10, minWidth: 46, textAlign: "center", fontWeight: 900, padding: "6px 4px" }}>{sale.discount_pct}%</div>
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontWeight: 900, color: "#0F241C" }}>{sale.title}</div>
            <div style={{ fontSize: 11, color: "#6B5E4A" }}>
              {sale.listing_titles?.length ? sale.listing_titles.slice(0, 2).join("، ") : "عرض على واجهة المتجر"}
            </div>
          </div>
        </div>
      ))}
      {coupons.map((c) => (
        <button key={c.code} type="button" onClick={() => copy(c.code)} data-testid={`coupon-${c.code}`} style={{ display: "flex", flexDirection: "row-reverse", gap: 10, alignItems: "center", padding: 10, borderRadius: 12, border: `1px dashed ${brand}`, background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
          <Ticket size={16} color={brand} />
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontWeight: 900, color: brand, letterSpacing: 1 }}>{c.code}</div>
            <div style={{ fontSize: 11, color: "#6B5E4A" }}>خصم {c.discount_pct}% — اضغط للنسخ واذكره عند التواصل</div>
          </div>
        </button>
      ))}
      {hasPolicy ? (
        <div style={{ textAlign: "right", fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
          <div style={{ display: "flex", flexDirection: "row-reverse", gap: 6, alignItems: "center", color: brand, fontWeight: 900, marginBottom: 4 }}>
            <Truck size={15} />
            <span>التوصيل والاستلام</span>
          </div>
          {profile.location?.city ? <div>{profile.location.city}{profile.location.address_label && profile.location.address_label !== profile.location.city ? ` — ${profile.location.address_label}` : ""}</div> : null}
          {profile.pickup_enabled ? <div>الاستلام من المتجر متاح{profile.pickup_note ? `: ${profile.pickup_note}` : ""}</div> : null}
          {cities.length ? <div>التوصيل إلى: {cities.join(" · ")}</div> : null}
          {profile.shipping_note ? <div>{profile.shipping_note}</div> : null}
          {profile.return_note ? <div>{profile.return_note}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export default function SellerStorefrontScreen({ userId, viewerId, onBack, onOpenListing, onContactSeller }) {
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [tab, setTab] = useState("listings");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);
  const [openHighlight, setOpenHighlight] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [p, ls, rs] = await Promise.all([
          tairApi.getSellerProfile(userId, viewerId),
          tairApi.getSellerListings(userId, 40),
          tairApi.getSellerReviews(userId, 20),
        ]);
        if (!alive) return;
        setProfile(p);
        setListings(ls || []);
        setReviews(rs || []);
      } catch (e) {
        if (alive) setErr(e?.response?.data?.detail || "تعذّر تحميل البروفايل");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  // Load follow status + followers count
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const vid = viewerId || `guest_public_${Math.random().toString(36).slice(2, 8)}`;
        const s = await tairApi.followStatus(userId, vid);
        if (!alive) return;
        // Only reflect "following" for a real logged-in viewer
        if (viewerId && viewerId !== userId) setFollowing(!!s?.following);
        setFollowersCount(s?.followers_count || 0);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [userId, viewerId]);

  const isSelf = viewerId && viewerId === userId;
  const canFollow = !!viewerId && !isSelf;

  const onToggleFollow = async () => {
    if (!canFollow || followBusy) return;
    setFollowBusy(true);
    // optimistic
    const prev = following;
    setFollowing(!prev);
    setFollowersCount((c) => Math.max(0, c + (prev ? -1 : 1)));
    try {
      const r = await tairApi.toggleFollow(userId, viewerId);
      setFollowing(!!r?.following);
    } catch {
      // rollback
      setFollowing(prev);
      setFollowersCount((c) => Math.max(0, c + (prev ? 1 : -1)));
    } finally {
      setFollowBusy(false);
    }
  };

  const brand = profile?.identity_color || "#0f766e";
  const brandDark = useMemo(() => darken(brand, 0.35), [brand]);
  const isDarkBrand = useMemo(() => luminance(brand) < 0.55, [brand]);
  const heroText = isDarkBrand ? "#ffffff" : "#0b1116";
  const heroSubText = isDarkBrand ? "rgba(255,255,255,0.82)" : "rgba(11,17,22,0.72)";
  const glassBg = isDarkBrand ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.55)";
  const glassBorder = isDarkBrand ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.7)";

  const hoursSummary = useMemo(() => summarizeHours(profile?.business_hours), [profile]);

  const backgroundImage = profile?.profile_bg_url || profile?.bg_image;

  // Page style: if bg image → put image as background layer (no identity tint).
  // Otherwise → soft identity gradient as fallback.
  const pageStyle = backgroundImage
    ? {
        minHeight: "100vh",
        background: "#f6f7f9",
        position: "relative",
        overflow: "hidden",
      }
    : {
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${brand} 0%, ${brand} 22%, ${rgba(brand, 0.55)} 40%, ${rgba(brand, 0.12)} 70%, #f6f7f9 100%)`,
        position: "relative",
        overflow: "hidden",
      };

  if (loading) {
    return (
      <div style={pageStyle} data-testid="seller-storefront">
        <TopBar onBack={onBack} textColor={heroText} />
        <div style={{ padding: 60, textAlign: "center", color: heroSubText, fontWeight: 700 }}>جاري التحميل…</div>
      </div>
    );
  }

  if (err || !profile) {
    return (
      <div style={pageStyle} data-testid="seller-storefront">
        <TopBar onBack={onBack} textColor={heroText} />
        <div style={{ padding: 40 }}>
          <EmptyState icon={<Package size={36} strokeWidth={1.5} />} title={err || "لم يتم العثور على البائع"} />
        </div>
      </div>
    );
  }

  const rating = profile.rating_avg;

  return (
    <div style={pageStyle} data-testid="seller-storefront">
      {/* Full-page background image (heavy top, transparent bottom) — NO identity tint */}
      {backgroundImage && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
          filter: "blur(3px)",
          transform: "scale(1.03)",
        }} />
      )}
      {backgroundImage && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.28) 25%, rgba(246,247,249,0.82) 60%, rgba(246,247,249,0.98) 100%)",
        }} />
      )}

      {/* Subtle radial highlights for depth (no borders) */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background:
          `radial-gradient(60% 40% at 85% -5%, ${rgba("#ffffff", 0.18)} 0%, transparent 60%),` +
          `radial-gradient(50% 30% at 10% 8%, ${rgba("#ffffff", 0.10)} 0%, transparent 55%)`,
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        <TopBar onBack={onBack} textColor={heroText} />

        {/* HERO — logo + name + verified + business hours chip */}
        <section style={styles.hero}>
          <div style={{
            ...styles.logoRing,
            background: rgba(isDarkBrand ? "#ffffff" : "#0b1116", 0.14),
            borderColor: rgba(isDarkBrand ? "#ffffff" : "#0b1116", 0.28),
          }}>
            {profile.logo_url || profile.avatar ? (
              <img src={profile.logo_url || profile.avatar} alt={profile.name} style={styles.logoImg} />
            ) : (
              <div style={{ ...styles.logoPh, color: heroText }}>{(profile.name || "؟")[0]}</div>
            )}
          </div>

          <div style={{ ...styles.nameRow, color: heroText }}>
            <span style={styles.name}>{profile.name}</span>
            {profile.is_verified_merchant && (
              <VerifiedTick verified type="shop" size={20} title="متجر موثّق" />
            )}
            {!profile.is_verified_merchant && profile.is_verified_carrier && (
              <VerifiedTick verified type="carrier" size={20} title="ناقل موثّق" />
            )}
          </div>

          {(profile.city || hoursSummary?.length) && (
            <div style={{ ...styles.metaRow, color: heroSubText }}>
              {profile.city && (
                <>
                  <MapPin size={13} strokeWidth={2.4} />
                  <span>{profile.city}</span>
                </>
              )}
              {rating != null && (
                <>
                  <Dot color={heroSubText} />
                  <Star size={13} strokeWidth={2.4} fill={heroText} color={heroText} />
                  <span style={{ color: heroText, fontWeight: 800 }}>{rating.toFixed(1)}</span>
                  <span>({profile.rating_count})</span>
                </>
              )}
              {hoursSummary?.length > 0 && (
                <>
                  <Dot color={heroSubText} />
                  <Clock size={12} strokeWidth={2.6} />
                  <span style={{ color: heroText, fontWeight: 800 }}>
                    {hoursSummary[0].label} · {hoursSummary[0].value}
                  </span>
                </>
              )}
            </div>
          )}

          {profile.about_text || profile.bio ? null : null}

          {/* Follow button + followers count — brand-tinted */}
          {canFollow && (
            <button
              onClick={onToggleFollow}
              disabled={followBusy}
              data-testid="storefront-follow-btn"
              style={{
                marginTop: 14,
                display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8,
                padding: "10px 22px",
                borderRadius: 999,
                border: `1.5px solid ${following ? glassBorder : rgba(heroText, 0.35)}`,
                background: following ? glassBg : heroText,
                color: following ? heroText : brand,
                fontSize: 14, fontWeight: 900,
                cursor: followBusy ? "wait" : "pointer",
                boxShadow: following ? "none" : `0 10px 24px -10px ${rgba("#000", 0.35)}`,
                transition: "all 0.2s ease",
                fontFamily: "inherit",
                backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              }}
            >
              {following ? <UserCheck size={16} strokeWidth={2.6} /> : <UserPlus size={16} strokeWidth={2.6} />}
              <span>{following ? "متابع" : "متابعة"}</span>
              {followersCount > 0 && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  padding: "2px 8px",
                  background: following ? rgba(heroText, 0.14) : rgba(brand, 0.12),
                  borderRadius: 999,
                  fontSize: 11, fontWeight: 900,
                }}>
                  <Users size={11} strokeWidth={2.6} />
                  {new Intl.NumberFormat("ar-SA").format(followersCount)}
                </span>
              )}
            </button>
          )}
          {!canFollow && followersCount > 0 && (
            <div style={{
              marginTop: 10,
              display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 5,
              color: heroSubText, fontSize: 12, fontWeight: 800,
            }}>
              <Users size={13} strokeWidth={2.4} />
              <span>{new Intl.NumberFormat("ar-SA").format(followersCount)} متابع</span>
            </div>
          )}

          {/* About Us message card — merchant-written */}
          {profile.about_text || profile.bio ? (
            <div style={{
              marginTop: 16,
              display: "flex", flexDirection: "row-reverse", gap: 12,
              padding: 14,
              borderRadius: 16,
              background: "rgba(255,255,255,0.92)",
              border: `1px solid ${rgba(brand, 0.18)}`,
              boxShadow: `0 10px 30px -18px ${rgba(brand, 0.4)}`,
              textAlign: "right",
              width: "100%",
              maxWidth: 380,
              alignItems: "flex-start",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: rgba(brand, 0.14),
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <ShieldCheck size={20} color={brand} strokeWidth={2.4} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 900, color: brand, marginBottom: 4 }}>من نحن</div>
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.65 }}>
                  {profile.about_text || profile.bio}
                </div>
              </div>
            </div>
          ) : null}

          {/* Contact bar — WhatsApp / Call / Chat (respects seller contact_prefs) */}
          <ContactBar profile={profile} viewerId={viewerId} onContactSeller={onContactSeller} brand={brand} />

          {/* KPI floating cards — merchant identity */}
          <div style={styles.kpiRow}>
            <Kpi icon="storefront" label="بضاعة" value={profile.listings_count || 0} textColor={heroText} subColor={heroSubText} glassBg={glassBg} glassBorder={glassBorder} />
            <Kpi icon="ribbon" label="صفقات" value={profile.sold_count || 0} textColor={heroText} subColor={heroSubText} glassBg={glassBg} glassBorder={glassBorder} />
            <Kpi
              icon="heart"
              label="رضا"
              value={rating != null ? rating.toFixed(1) : "—"}
              sub={rating != null ? `${profile.rating_count}` : null}
              textColor={heroText} subColor={heroSubText} glassBg={glassBg} glassBorder={glassBorder}
            />
            <Kpi
              icon="eye"
              label="زيارة"
              value={new Intl.NumberFormat("ar-SA").format(profile.visits_count || 0)}
              textColor={heroText} subColor={heroSubText} glassBg={glassBg} glassBorder={glassBorder}
            />
          </div>
        </section>

        {/* Highlights row (Instagram-style) */}
        {Array.isArray(profile.highlights) && profile.highlights.length > 0 && (
          <div style={styles.highlightsRow}>
            {profile.highlights.map((h, i) => (
              <button
                key={i}
                onClick={() => setOpenHighlight(h)}
                style={{ ...styles.highlightItem, borderColor: "transparent" }}
                data-testid={`storefront-highlight-${i}`}
              >
                <div style={{
                  ...styles.highlightRing,
                  background: `conic-gradient(from 180deg, ${brand}, ${rgba(brand, 0.55)}, ${brand})`,
                }}>
                  <div style={styles.highlightInner}>
                    {h.cover ? (
                      <img src={h.cover} alt={h.title || ""} style={styles.highlightImg} />
                    ) : (
                      <div style={{
                        ...styles.highlightImg,
                        background: rgba(brand, 0.15),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: brand, fontWeight: 900,
                      }}>★</div>
                    )}
                  </div>
                </div>
                <div style={styles.highlightLabel}>{h.title || "—"}</div>
              </button>
            ))}
          </div>
        )}

        {/* Banner slides carousel */}
        {Array.isArray(profile.banner_slides) && profile.banner_slides.length > 0 && (
          <BannerSlider slides={profile.banner_slides} brand={brand} />
        )}

        {/* Content pane — floating rounded surface, no hard borders */}
        <section style={styles.pane}>
          <div style={{ padding: "14px 14px 0" }}>
            <StoreFacts profile={profile} brand={brand} />
          </div>
          {/* Pill tabs — no borders, only pill background on active */}
          <div style={styles.tabs}>
            <button
              onClick={() => setTab("listings")}
              style={{
                ...styles.tabBtn,
                background: tab === "listings" ? brand : "transparent",
                color: tab === "listings" ? "#fff" : "#334155",
                boxShadow: tab === "listings" ? `0 8px 20px -8px ${rgba(brand, 0.55)}` : "none",
              }}
              data-testid="storefront-tab-listings"
            >
              <Package size={14} strokeWidth={2.6} />
              الإعلانات ({profile.listings_count || 0})
            </button>
            <button
              onClick={() => setTab("reviews")}
              style={{
                ...styles.tabBtn,
                background: tab === "reviews" ? brand : "transparent",
                color: tab === "reviews" ? "#fff" : "#334155",
                boxShadow: tab === "reviews" ? `0 8px 20px -8px ${rgba(brand, 0.55)}` : "none",
              }}
              data-testid="storefront-tab-reviews"
            >
              <Star size={14} strokeWidth={2.6} />
              المراجعات ({profile.rating_count || 0})
            </button>
          </div>

          <div style={{ padding: "14px 14px 40px" }}>
            {tab === "listings" ? (
              listings.length === 0 ? (
                <EmptyState icon={<Package size={36} strokeWidth={1.5} />} title="لا توجد إعلانات حالياً" />
              ) : (
                <div style={styles.grid}>
                  {listings.map((l) => (
                    <button
                      key={l.listing_id}
                      onClick={() => onOpenListing && onOpenListing(l.listing_id)}
                      style={{ ...styles.card, boxShadow: `0 10px 30px -14px ${rgba(brandDark, 0.35)}, 0 2px 6px rgba(15,23,42,0.04)` }}
                      data-testid={`storefront-listing-${l.listing_id}`}
                    >
                      <div style={styles.cardImg}>
                        {l.images?.[0] || l.cover_image ? (
                          <img src={l.images?.[0] || l.cover_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <Package size={26} color="#94a3b8" />
                        )}
                        {l.status === "sold" && <div style={styles.soldPill}>مباع</div>}
                        <div style={{ ...styles.pricePill, background: brand }}>{money(l.price_sar)} ر.س</div>
                      </div>
                      <div style={styles.cardBody}>
                        <div style={styles.cardTitle}>{l.title}</div>
                        {l.city && (
                          <div style={styles.cardMeta}>
                            <MapPin size={11} strokeWidth={2.4} />
                            <span>{l.city}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )
            ) : reviews.length === 0 ? (
              <EmptyState icon={<Star size={36} strokeWidth={1.5} />} title="لا توجد مراجعات بعد" />
            ) : (
              <div style={styles.reviews}>
                {reviews.map((r, i) => (
                  <div key={i} style={{ ...styles.reviewCard, boxShadow: `0 6px 20px -12px ${rgba(brandDark, 0.25)}` }}>
                    <div style={styles.reviewHead}>
                      <div style={{ ...styles.stars, color: brand }}>
                        {"★".repeat(r.stars || 0)}<span style={{ color: "#e2e8f0" }}>{"★".repeat(5 - (r.stars || 0))}</span>
                      </div>
                      <div style={styles.reviewDate}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString("ar-SA") : ""}
                      </div>
                    </div>
                    {r.comment && <div style={styles.reviewText}>{r.comment}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Highlight viewer modal */}
      <HighlightViewer highlight={openHighlight} brand={brand} onClose={() => setOpenHighlight(null)} />
    </div>
  );
}

function TopBar({ onBack, textColor }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 12px", position: "sticky", top: 0, zIndex: 5 }}>
      <button
        onClick={onBack}
        data-testid="storefront-back"
        aria-label="رجوع"
        style={{
          width: 40, height: 40, borderRadius: 20,
          background: "rgba(255,255,255,0.20)",
          border: "1px solid rgba(255,255,255,0.35)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <ArrowRight size={20} strokeWidth={2.6} color={textColor} />
      </button>
    </div>
  );
}

function ContactBar({ profile, viewerId, onContactSeller, brand }) {
  const isSelf = viewerId && viewerId === profile.user_id;
  if (isSelf) return null;
  const prefs = profile.contact_prefs || { whatsapp: true, call: false, chat: true };
  const rawPhone = profile.whatsapp || profile.phone;
  const digits = toWhatsAppPhone(rawPhone);
  const openWhatsapp = () => {
    if (!digits) return;
    const msg = encodeURIComponent(`السلام عليكم، أنا مهتم بمتجرك: ${profile.name || ""}`);
    window.open(`https://wa.me/${digits}?text=${msg}`, "_blank");
  };
  const openCall = () => {
    if (!digits) return;
    window.location.href = `tel:${digits.startsWith("966") ? `+${digits}` : digits}`;
  };
  const openChat = () => {
    if (onContactSeller) onContactSeller(profile.user_id, profile.name);
  };
  const hasAny = (prefs.whatsapp && digits) || (prefs.call && digits) || prefs.chat;
  if (!hasAny) return null;
  return (
    <div
      style={{
        marginTop: 14,
        display: "flex",
        flexDirection: "row-reverse",
        gap: 8,
        width: "100%",
        maxWidth: 380,
      }}
      data-testid="storefront-contact-bar"
    >
      {prefs.whatsapp && digits ? (
        <button
          onClick={openWhatsapp}
          data-testid="storefront-whatsapp"
          style={{ ...contactBtnStyle, background: "#25D366", color: "#fff" }}
        >
          <WhatsAppIcon size={18} />
          <span>واتساب</span>
        </button>
      ) : null}
      {prefs.call && digits ? (
        <button
          onClick={openCall}
          data-testid="storefront-call"
          style={{ ...contactBtnStyle, background: "#0ea5e9", color: "#fff" }}
        >
          <Phone size={16} strokeWidth={2.6} />
          <span>اتصال</span>
        </button>
      ) : null}
      {prefs.chat ? (
        <button
          onClick={openChat}
          data-testid="storefront-chat"
          style={{ ...contactBtnStyle, background: brand, color: "#fff" }}
        >
          <MessageCircle size={16} strokeWidth={2.6} />
          <span>مراسلة</span>
        </button>
      ) : null}
    </div>
  );
}

// Inline WhatsApp glyph (lucide's icon is not perfect for the brand tone; use bare SVG)
function WhatsAppIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20.52 3.48A11.87 11.87 0 0012 0C5.37 0 0 5.37 0 12c0 2.11.55 4.16 1.6 5.96L0 24l6.2-1.63A11.94 11.94 0 0012 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52zM12 21.82a9.82 9.82 0 01-5.01-1.37l-.36-.21-3.68.97.98-3.58-.23-.37A9.82 9.82 0 012.18 12 9.82 9.82 0 0112 2.18 9.82 9.82 0 0121.82 12 9.82 9.82 0 0112 21.82zm5.4-7.36c-.29-.15-1.72-.85-1.99-.95-.27-.1-.46-.15-.66.15-.19.29-.75.94-.92 1.13-.17.19-.34.22-.63.07-.29-.15-1.22-.45-2.33-1.43-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.44.13-.59.13-.13.29-.34.44-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.15-.66-1.59-.91-2.18-.24-.57-.48-.49-.66-.5h-.56c-.19 0-.5.07-.76.36-.26.29-1 1-1 2.43s1.02 2.82 1.16 3.02c.15.19 2 3.06 4.85 4.29.68.29 1.21.46 1.62.59.68.22 1.3.19 1.79.11.55-.08 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.38-.07-.12-.27-.19-.56-.34z"
        fill="currentColor"
      />
    </svg>
  );
}

const contactBtnStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "row-reverse",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "12px 10px",
  borderRadius: 12,
  border: "none",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: "0 10px 22px -12px rgba(15,23,42,0.5)",
};


function Dot({ color = "#94a3b8" }) {
  return <span style={{ width: 3, height: 3, borderRadius: 2, background: color, display: "inline-block", margin: "0 4px", opacity: 0.7 }} />;
}

function Kpi({ icon, label, value, sub, textColor, subColor, glassBg, glassBorder }) {
  const iconMap = { storefront: Store, ribbon: Award, heart: Heart, eye: Eye };
  const Icon = iconMap[icon] || Package;
  return (
    <div style={{
      flex: 1,
      background: glassBg,
      border: `1px solid ${glassBorder}`,
      borderRadius: 16,
      padding: "10px 6px",
      textAlign: "center",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    }}>
      <Icon size={16} strokeWidth={2.4} color={textColor} style={{ opacity: 0.9 }} />
      <div style={{ fontSize: 20, fontWeight: 900, color: textColor, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: subColor, marginTop: 1, letterSpacing: "0.02em" }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: subColor, marginTop: 1, opacity: 0.75 }}>{sub}</div>}
    </div>
  );
}


function BannerSlider({ slides, brand }) {
  const [idx, setIdx] = useState(0);
  const n = slides.length;
  useEffect(() => {
    if (n <= 1) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), 4200);
    return () => clearInterval(t);
  }, [n]);
  return (
    <div style={{
      marginTop: 8, marginBottom: 4, position: "relative",
      borderRadius: 20, overflow: "hidden",
      marginInline: 12,
      boxShadow: `0 20px 40px -22px ${rgba(brand, 0.55)}`,
    }}>
      <div style={{
        display: "flex", transition: "transform 0.6s ease",
        transform: `translateX(${idx * 100}%)`,
      }}>
        {slides.map((u, i) => (
          <div key={i} style={{ minWidth: "100%", height: 170, position: "relative" }}>
            <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {/* subtle bottom-fade only for dot readability — NO identity tint on images */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.35) 100%)",
              pointerEvents: "none",
            }} />
          </div>
        ))}
      </div>
      {/* dots */}
      {n > 1 && (
        <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
          {slides.map((_, i) => (
            <span key={i} style={{
              width: i === idx ? 20 : 6, height: 6, borderRadius: 3,
              background: i === idx ? "#fff" : "rgba(255,255,255,0.55)",
              transition: "width 0.3s ease",
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

function HighlightViewer({ highlight, brand, onClose }) {
  const items = ((highlight && highlight.items) || []).filter((x) => x && x.image);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [highlight]);
  useEffect(() => {
    if (!highlight || items.length === 0) return undefined;
    const t = setTimeout(() => {
      if (idx + 1 < items.length) setIdx(idx + 1);
      else onClose && onClose();
    }, 4500);
    return () => clearTimeout(t);
  }, [idx, items.length, highlight, onClose]);
  if (!highlight) return null;
  const active = items[idx];
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "#000", zIndex: 999,
        display: "flex", flexDirection: "column",
      }}
      data-testid="highlight-viewer"
    >
      {/* Progress bars */}
      <div style={{ display: "flex", gap: 4, padding: "12px 12px 0" }}>
        {items.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.28)", overflow: "hidden" }}>
            <div style={{
              width: i < idx ? "100%" : i === idx ? "60%" : 0,
              height: "100%", background: "#fff",
              transition: "width 4.5s linear",
            }} />
          </div>
        ))}
      </div>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", padding: 12 }}>
        <div style={{ color: "#fff", fontWeight: 900, fontSize: 15 }}>{highlight.title || "إبراز"}</div>
        <button onClick={onClose} style={{
          width: 36, height: 36, borderRadius: 18,
          background: "rgba(255,255,255,0.14)", border: "none",
          color: "#fff", fontSize: 20, cursor: "pointer",
        }}>×</button>
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, position: "relative" }}
      >
        {active?.image ? (
          <img src={active.image} alt={active.caption || ""} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12 }} />
        ) : null}
        {/* Tap regions */}
        <button
          aria-label="prev"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "35%", background: "transparent", border: "none", cursor: "pointer" }}
        />
        <button
          aria-label="next"
          onClick={() => (idx + 1 < items.length ? setIdx(idx + 1) : onClose && onClose())}
          style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "35%", background: "transparent", border: "none", cursor: "pointer" }}
        />
      </div>
      {active?.caption ? (
        <div style={{
          margin: 12, padding: 12, borderRadius: 12,
          background: "rgba(255,255,255,0.08)",
          borderLeft: `3px solid ${brand}`,
          color: "#fff", fontSize: 13, lineHeight: 1.7, textAlign: "right",
        }}>{active.caption}</div>
      ) : null}
    </div>
  );
}

const styles = {
  hero: {
    padding: "6px 18px 24px",
    textAlign: "center",
    display: "flex", flexDirection: "column", alignItems: "center",
  },
  logoRing: {
    width: 96, height: 96, borderRadius: 48,
    display: "flex", alignItems: "center", justifyContent: "center",
    border: "2px solid transparent",
    boxShadow: "0 20px 40px -18px rgba(0,0,0,0.35)",
    overflow: "hidden",
  },
  logoImg: { width: "100%", height: "100%", borderRadius: 48, objectFit: "cover" },
  logoPh: { fontSize: 36, fontWeight: 900 },

  nameRow: {
    marginTop: 12,
    display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 8,
  },
  name: { fontSize: 22, fontWeight: 900, letterSpacing: "-0.01em", textShadow: "0 1px 6px rgba(0,0,0,0.15)" },
  metaRow: {
    marginTop: 6,
    display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 4,
    fontSize: 12, fontWeight: 700,
  },
  bio: {
    marginTop: 10, fontSize: 13, lineHeight: 1.65,
    maxWidth: 340, padding: "0 6px",
  },

  hoursChip: {
    marginTop: 14,
    display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 10,
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid transparent",
    boxShadow: "0 8px 20px -12px rgba(0,0,0,0.3)",
  },
  hoursIcon: { display: "flex", alignItems: "center", justifyContent: "center" },
  hoursLines: { display: "flex", flexDirection: "column", gap: 2, textAlign: "right" },
  hoursLine: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 6,
    fontSize: 12, fontWeight: 700,
  },
  hoursDay: { fontSize: 11, fontWeight: 700 },
  hoursDot: { width: 3, height: 3, borderRadius: 2, background: "currentColor", opacity: 0.5 },
  hoursTime: { fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums" },

  kpiRow: {
    marginTop: 18,
    display: "flex", flexDirection: "row-reverse", gap: 8,
    width: "100%",
    maxWidth: 340,
  },

  highlightsRow: {
    display: "flex", flexDirection: "row-reverse",
    gap: 14, padding: "14px 16px 8px",
    overflowX: "auto",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },
  highlightItem: {
    display: "flex", flexDirection: "column", alignItems: "center",
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontFamily: "inherit",
    minWidth: 72,
  },
  highlightRing: {
    width: 68, height: 68, borderRadius: 34,
    padding: 3,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  highlightInner: {
    width: "100%", height: "100%", borderRadius: 32,
    background: "#fff",
    padding: 2,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  highlightImg: {
    width: "100%", height: "100%", borderRadius: 30,
    objectFit: "cover",
  },
  highlightLabel: {
    marginTop: 6, fontSize: 11, fontWeight: 800, color: "#334155",
    textAlign: "center",
    maxWidth: 74, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },

  pane: {
    marginTop: 4,
    background: "linear-gradient(180deg, #f8fafc 0%, #f4f6f8 100%)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    minHeight: 360,
    paddingTop: 14,
    boxShadow: "0 -12px 30px -10px rgba(15,23,42,0.08)",
  },

  tabs: {
    display: "flex", flexDirection: "row-reverse",
    gap: 6, padding: "4px 12px 10px",
  },
  tabBtn: {
    flex: 1,
    display: "flex", flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "10px 12px",
    borderRadius: 999,
    border: "none",
    fontSize: 13, fontWeight: 800,
    cursor: "pointer", fontFamily: "inherit",
    transition: "all 0.2s ease",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },
  card: {
    background: "#ffffff",
    borderRadius: 18,
    overflow: "hidden",
    cursor: "pointer",
    padding: 0,
    textAlign: "right",
    border: "none",
    display: "flex", flexDirection: "column",
    fontFamily: "inherit",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  cardImg: {
    position: "relative",
    height: 128,
    background: "#eef2f6",
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  pricePill: {
    position: "absolute",
    bottom: 8, insetInlineStart: 8,
    color: "#fff",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 11, fontWeight: 900,
    boxShadow: "0 6px 14px -6px rgba(0,0,0,0.35)",
    letterSpacing: "0.01em",
    fontVariantNumeric: "tabular-nums",
  },
  soldPill: {
    position: "absolute",
    top: 8, insetInlineEnd: 8,
    background: "rgba(239,68,68,0.95)",
    color: "#fff",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 10, fontWeight: 900,
  },
  cardBody: { padding: "10px 12px 12px" },
  cardTitle: {
    fontSize: 13, fontWeight: 800, color: "#0f172a", lineHeight: 1.4,
    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
  },
  cardMeta: {
    marginTop: 4,
    display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 3,
    fontSize: 11, fontWeight: 700, color: "#64748b",
  },

  reviews: { display: "flex", flexDirection: "column", gap: 10 },
  reviewCard: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 14,
    border: "none",
  },
  reviewHead: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
  },
  stars: { fontSize: 15, letterSpacing: 2, fontWeight: 800 },
  reviewDate: { fontSize: 11, color: "#94a3b8", fontWeight: 700 },
  reviewText: { marginTop: 6, fontSize: 13, color: "#334155", lineHeight: 1.7, textAlign: "right" },
};
