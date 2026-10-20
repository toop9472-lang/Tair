// طير — Home / Marketplace (polished, modern design)
import React, { useEffect, useMemo, useState } from "react";
import {
  MapPin, Bird, Plus, Heart, Clock, MessageCircle, Bell,
  Music2, Feather, Fish, Rabbit, Shell, Bug, Cat, Dog,
  Wheat, Package, ShoppingBag, Trees, Wrench, Milk, Drumstick,
  Store, Truck, LayoutGrid, Search, Boxes, Bed, GraduationCap, Zap, Footprints,
} from "lucide-react";
import { T, S } from "./tairTheme";
import { tairApi, ALL_LOCATIONS } from "./tairApi";
import { BottomSheet, SelectorItem, SearchField, EmptyState } from "./TairUI";
import TairBanner, { BannerCircleBtn, PAGE_BG_STYLE } from "./TairBanner";
import { Parrot, Canary, Dove, Falcon } from "./BirdArt";
import { toast } from "../hooks/use-toast";
import { AnalyticsEvents } from "./analytics";
import VerifiedTick from "./VerifiedTick";
import AppDownloadBanner from "./AppDownloadBanner";
const FAMILY_ICONS = {
  livestock: Milk, horses: Footprints, songbirds: Music2, poultry: Drumstick, pigeons: Feather,
  parrots: Bird, falcons: Zap, fish: Fish, small_mammals: Rabbit, pets: Heart,
  reptiles: Shell, insects: Bug, cats: Cat, dogs: Dog, feed: Wheat,
  bird_supplies: Package, animal_supplies: ShoppingBag, reserves: Trees, services: Wrench,
  hotel_services: Bed, training: GraduationCap,
};

function timeAgo(iso) {
  if (!iso) return "الآن";
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  if (diff < 86400 * 30) return `قبل ${Math.floor(diff / 86400)} يوم`;
  return new Date(iso).toLocaleDateString("ar-SA");
}

export default function HomeScreen({ user, onOpenListing, onCreateListing, onOpenMessages, onOpenNotifications, onOpenWholesale, unreadMessages = 0, unreadNotifs = 0 }) {
  const [families, setFamilies] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [city, setCity] = useState(null);
  const [familyId, setFamilyId] = useState(null);
  const [citySheet, setCitySheet] = useState(false);

  useEffect(() => {
    tairApi.listFamilies().then(setFamilies).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { limit: 40 };
    if (city) params.city = city;
    if (familyId) params.family = familyId;
    if (q.trim()) params.q = q.trim();
    tairApi
      .feedListings(params)
      .then((d) => setListings(d.items || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [city, familyId, q]);

  return (
    <div style={{ ...S.screen, ...PAGE_BG_STYLE }} data-testid="home-screen">
      {/* Ambient wavy gradient wash (crimson + green) — behind everything */}
      <div style={styles.wavyBg} aria-hidden="true" />

      {/* Subtle real bird decorations scattered across the page */}
      <div style={styles.ambientBirds} aria-hidden="true">
        <div style={{ position: "absolute", top: 220, insetInlineEnd: -18, transform: "rotate(-12deg)", opacity: 0.09 }}>
          <Parrot size={130} />
        </div>
        <div style={{ position: "absolute", top: 480, insetInlineStart: -20, transform: "rotate(14deg)", opacity: 0.08 }}>
          <Falcon size={140} />
        </div>
        <div style={{ position: "absolute", top: 780, insetInlineEnd: -10, transform: "rotate(-8deg)", opacity: 0.08 }}>
          <Canary size={110} />
        </div>
        <div style={{ position: "absolute", top: 1120, insetInlineStart: -12, transform: "rotate(20deg)", opacity: 0.09 }}>
          <Dove size={130} />
        </div>
      </div>

      <TairBanner
        tall
        rightSlot={
          <button
            onClick={() => setCitySheet(true)}
            style={styles.bannerCityBtn}
            data-testid="home-city-btn"
            aria-label="اختر المدينة"
          >
            <MapPin size={14} strokeWidth={2.4} color="#fff" />
            <span style={styles.bannerCityText}>{city || "جميع المدن"}</span>
          </button>
        }
        leftSlot={
          <BannerCircleBtn
            onClick={onCreateListing}
            testId="home-create-btn"
            ariaLabel="إعلان جديد"
          >
            <Plus size={22} strokeWidth={2.6} color="#fff" />
          </BannerCircleBtn>
        }
      />

      {/* Categories horizontal scroll (includes Suppliers as first item) */}
      <div style={styles.categoriesBar}>
        <div style={styles.categoriesScroll}>
          <CategoryButton
            Icon={Bird}
            label="الكل"
            active={!familyId}
            onClick={() => setFamilyId(null)}
            testId="cat-all"
          />
          {onOpenWholesale && (
            <CategoryButton
              Icon={Boxes}
              label="الموردون"
              active={false}
              onClick={() => {
                AnalyticsEvents.wholesaleBannerClick();
                onOpenWholesale();
              }}
              testId="cat-wholesale"
              accent
            />
          )}
          {families.map((f) => {
            const Icon = FAMILY_ICONS[f.family_id] || Bird;
            return (
              <CategoryButton
                key={f.family_id}
                Icon={Icon}
                label={f.name_ar}
                active={familyId === f.family_id}
                onClick={() => setFamilyId(f.family_id)}
                testId={`cat-${f.family_id}`}
              />
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={S.container}>
        <div style={styles.resultBar}>
          <span style={styles.count}>
            {loading ? "جاري التحميل…" : `${listings.length} إعلان`}
          </span>
          <button
            onClick={onCreateListing}
            style={styles.newListingBtn}
            data-testid="create-listing-btn"
          >
            <Plus size={16} strokeWidth={2.6} />
            <span>إعلان جديد</span>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>جاري التحميل…</div>
        ) : listings.length === 0 ? (
          <EmptyState
            icon={<Bird size={36} strokeWidth={1.5} />}
            title="لا توجد إعلانات مطابقة"
            desc="جرّب تغيير الفئة أو المدينة، أو انشر أول إعلان"
            action={
              <button onClick={onCreateListing} style={S.primaryBtn} data-testid="empty-state-action">
                <Plus size={16} strokeWidth={2.6} />
                <span>انشر إعلان</span>
              </button>
            }
          />
        ) : (
          <div style={styles.list}>
            {listings.map((l) => (
              <ListingRow
                key={l.listing_id}
                item={l}
                onClick={() => onOpenListing(l.listing_id)}
              />
            ))}
          </div>
        )}

        {/* App download banner (App Store + Google Play) */}
        <AppDownloadBanner />
      </div>

      {/* City sheet */}
      <BottomSheet
        open={citySheet}
        onClose={() => setCitySheet(false)}
        title="اختر المدينة أو الدولة"
      >
        <SelectorItem
          icon={<MapPin size={16} strokeWidth={2.2} />}
          label="جميع المدن والدول"
          active={!city}
          onClick={() => { setCity(null); setCitySheet(false); }}
          testId="city-item-all"
        />
        {ALL_LOCATIONS.map((c) => (
          <SelectorItem
            key={c}
            icon={<MapPin size={16} strokeWidth={2.2} />}
            label={c}
            active={city === c}
            onClick={() => { setCity(c); setCitySheet(false); }}
            testId={`city-item-${c}`}
          />
        ))}
      </BottomSheet>
    </div>
  );
}

function CategoryButton({ Icon, label, active, onClick, testId, accent }) {
  const base = accent ? "#ec4899" : T.primary;
  return (
    <button
      onClick={onClick}
      style={{
        ...catStyles.btn,
        background: active ? base : T.surface,
        borderColor: active ? base : (accent ? "rgba(236,72,153,0.35)" : T.border),
      }}
      data-testid={testId}
    >
      <div style={{
        ...catStyles.iconWrap,
        background: active ? "rgba(255,255,255,0.18)" : (accent ? "rgba(236,72,153,0.12)" : T.bgAlt),
      }}>
        <Icon
          size={20}
          strokeWidth={active ? 2.4 : 1.9}
          color={active ? "#fff" : base}
        />
      </div>
      <span style={{
        ...catStyles.label,
        color: active ? "#fff" : (accent ? "#ec4899" : T.text),
        fontWeight: active ? 800 : (accent ? 800 : 700),
      }}>
        {label}
      </span>
    </button>
  );
}

const catStyles = {
  btn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    minWidth: 72,
    padding: "8px 10px 10px",
    borderRadius: T.radiusMd,
    borderWidth: 1.5,
    borderStyle: "solid",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
    flexShrink: 0,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s",
  },
  label: {
    fontSize: 11,
    letterSpacing: "-0.005em",
    whiteSpace: "nowrap",
  },
};

function ListingRow({ item, onClick }) {
  const sellerInitial = (item.seller_id || "?").replace(/^user_?/, "").charAt(0).toUpperCase() || "؟";
  const isShopVerified = item.seller_verified_shop;
  const isCarrierVerified = item.seller_verified_carrier;
  return (
    <div
      onClick={onClick}
      style={styles.rowCard}
      data-testid={`listing-card-${item.listing_id}`}
    >
      <div style={styles.rowImg}>
        {item.cover_image ? (
          <img src={item.cover_image} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Bird size={40} strokeWidth={1.2} color={T.textFaint} />
        )}
        <div style={styles.gradientOverlay} />
        {item.price_negotiable && <div style={styles.negBadge}>تفاوض</div>}
      </div>

      <div style={styles.rowBody}>
        <div style={styles.rowTitle}>{item.title}</div>

        <div style={styles.rowPrice}>
          <span style={styles.priceValue}>{item.price_sar}</span>
          <span style={styles.priceCurr}>ر.س</span>
        </div>

        <div style={styles.rowMetaRow}>
          <span style={styles.metaChip}>
            <Clock size={11} strokeWidth={2.2} color={T.textMuted} />
            <span>{timeAgo(item.posted_at)}</span>
          </span>
          <span style={styles.metaChip}>
            <MapPin size={11} strokeWidth={2.2} color={T.textMuted} />
            <span>{item.city}</span>
          </span>
        </div>

        <div style={styles.rowFooter}>
          <div style={styles.sellerRow}>
            {item.seller_avatar ? (
              <img src={item.seller_avatar} alt="" style={{ width: 22, height: 22, borderRadius: 11, objectFit: "cover" }} />
            ) : (
              <div style={styles.avatar}>{sellerInitial}</div>
            )}
            <span style={styles.sellerName}>
              {item.seller_name || `مُعلن #${(item.seller_id || "").slice(-4)}`}
            </span>
            <VerifiedTick verified={isShopVerified} type="shop" size={13} title="متجر موثّق" />
            {!isShopVerified && (
              <VerifiedTick verified={isCarrierVerified} type="carrier" size={13} title="ناقل موثّق" />
            )}
          </div>
          <div style={styles.rowStats}>
            <span style={styles.statItem}>
              <Heart size={11} strokeWidth={2.2} />
              {item.favorite_count || 0}
            </span>
            <span style={styles.statItem}>
              <MessageCircle size={11} strokeWidth={2.2} />
              {item.comments_count || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wavyBg: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(80% 40% at 90% 5%, rgba(220,38,127,0.10) 0%, transparent 60%)," +
      "radial-gradient(80% 40% at 5% 30%, rgba(15,118,110,0.10) 0%, transparent 60%)," +
      "radial-gradient(60% 40% at 60% 65%, rgba(236,72,153,0.06) 0%, transparent 60%)," +
      "radial-gradient(80% 50% at 20% 95%, rgba(20,184,166,0.09) 0%, transparent 60%)",
  },
  ambientBirds: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 1,
    overflow: "hidden",
  },
  banner: {
    background: "linear-gradient(135deg, #0f766e 0%, #0d9488 45%, #14b8a6 100%)",
    padding: "18px 16px 22px",
    position: "sticky",
    top: 0,
    zIndex: 30,
    boxShadow: "0 4px 20px rgba(15,118,110,0.25)",
    borderBottom: "3px solid rgba(255,255,255,0.15)",
  },
  bannerRow: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 900,
    margin: "0 auto",
    gap: 12,
  },
  circleBtn: {
    position: "relative",
    width: 46, height: 46, borderRadius: 23,
    background: "rgba(255,255,255,0.15)",
    border: "1.5px solid rgba(255,255,255,0.35)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", flexShrink: 0,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
  },
  circleBtnBadge: {
    position: "absolute",
    top: -2,
    insetInlineStart: -2,
    background: "#ef4444",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    padding: "0 5px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid rgba(15,118,110,1)",
  },
  brandCenter: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  brandWordmark: {
    fontSize: 44,
    fontWeight: 900,
    color: "#ffffff",
    letterSpacing: "-0.04em",
    textShadow: "0 3px 12px rgba(0,0,0,0.20)",
    lineHeight: 1,
    fontFamily: "'Tajawal', 'Cairo', 'Amiri', system-ui, sans-serif",
  },
  brandUnderscore: {
    width: 46,
    height: 3,
    marginTop: 4,
    background: "rgba(255,255,255,0.7)",
    borderRadius: 2,
  },
  subBar: {
    background: "rgba(255,255,255,0.9)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    borderBottom: `1px solid ${T.border}`,
    padding: "8px 14px",
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    position: "sticky",
    top: 68,
    zIndex: 20,
  },
  cityBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: T.bgAlt,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    cursor: "pointer",
    fontFamily: "inherit",
    minWidth: 0,
  },
  cityLabel: { fontSize: 10, color: T.textFaint, fontWeight: 700, textAlign: "right" },
  cityValue: {
    fontSize: 13, fontWeight: 800, color: T.text, textAlign: "right",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  iconRoundBtn: {
    position: "relative",
    width: 40, height: 40, borderRadius: 20,
    background: T.bgAlt, border: "none",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", flexShrink: 0,
  },
  iconBadge: {
    position: "absolute", top: -2, insetInlineStart: 0,
    background: T.danger, color: "#fff",
    fontSize: 9, fontWeight: 800,
    minWidth: 16, height: 16, borderRadius: 8, padding: "0 4px",
    display: "flex", alignItems: "center", justifyContent: "center",
    border: "1.5px solid #fff",
  },

  // City button inside the banner (opposite to the + button)
  bannerCityBtn: {
    display: "inline-flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    height: 42,
    padding: "0 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.18)",
    border: "1.5px solid rgba(255,255,255,0.4)",
    color: "#fff",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 800,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    maxWidth: 160,
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  bannerCityText: {
    color: "#fff",
    fontWeight: 800,
    fontSize: 12,
    maxWidth: 110,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  // Categories bar
  categoriesBar: {
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    borderBottom: `1px solid ${T.border}`,
    padding: "8px 0 10px",
    position: "relative",
    zIndex: 5,
  },
  categoriesScroll: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "0 12px",
    display: "flex",
    flexDirection: "row-reverse",
    gap: 8,
    overflowX: "auto",
    scrollbarWidth: "none",
  },

  // City pill (compact, sits under the banner)
  cityBarWrap: {
    display: "flex",
    justifyContent: "center",
    marginTop: -22,
    marginBottom: 12,
    position: "relative",
    zIndex: 20,
    padding: "0 14px",
  },
  cityPill: {
    display: "inline-flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    background: "#fff",
    border: `1px solid ${T.border}`,
    borderRadius: 999,
    padding: "8px 6px 8px 16px",
    boxShadow: "0 6px 16px rgba(15,118,110,0.18)",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  cityIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    background: `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryLight} 100%)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 6px rgba(15,118,110,0.35)",
  },
  cityPillText: {
    fontWeight: 800,
    fontSize: 13,
    color: T.text,
  },

  resultBar: {
    display: "flex", flexDirection: "row-reverse",
    justifyContent: "space-between", alignItems: "center",
    marginBottom: 14, padding: "0 2px",
    position: "relative", zIndex: 5,
  },
  count: { color: T.textMuted, fontSize: 13, fontWeight: 700 },
  newListingBtn: {
    display: "inline-flex", alignItems: "center", gap: 6,
    background: `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryLight} 100%)`,
    color: T.textInverse, border: "none",
    borderRadius: T.radiusPill, padding: "8px 14px",
    fontSize: 13, fontWeight: 800, cursor: "pointer",
    fontFamily: "inherit", boxShadow: "0 4px 12px rgba(15,118,110,0.25)",
  },

  list: { display: "flex", flexDirection: "column", gap: 16, position: "relative", zIndex: 5 },

  // Wholesale suppliers promo card
  wholesaleCard: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
    width: "100%",
    padding: "14px 16px",
    marginBottom: 14,
    background: `url("https://customer-assets-4nw71qhi.emergentagent.net/job_40eca190-5242-4463-8c95-bc5f66df29cb/artifacts/fittm2tg_IMG_7868.jpeg") center 35% / cover no-repeat, #0f766e`,
    border: "none",
    borderRadius: 20,
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "right",
    boxShadow: "0 10px 30px rgba(15,118,110,0.28), 0 2px 6px rgba(15,118,110,0.15)",
    position: "relative",
    zIndex: 5,
    overflow: "hidden",
  },
  wholesaleOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(120deg, rgba(15,118,110,0.55) 0%, rgba(15,118,110,0.35) 100%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  wholesaleLeft: {
    width: 64, height: 64, borderRadius: 18,
    background: "rgba(255,255,255,0.18)",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    border: "1.5px solid rgba(255,255,255,0.32)",
    position: "relative",
    zIndex: 1,
    boxShadow: "inset 0 -6px 12px rgba(0,0,0,0.08)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
  },
  wholesaleLogoInner: {
    position: "relative",
    width: "100%", height: "100%",
    display: "flex", alignItems: "center", justifyContent: "center",
    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
  },
  wholesaleBody: {
    flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4,
    position: "relative", zIndex: 1,
  },
  wholesaleBadge: {
    display: "inline-block",
    background: "linear-gradient(135deg, #facc15 0%, #f59e0b 100%)",
    color: "#7c2d12",
    fontSize: 10,
    fontWeight: 900,
    padding: "3px 10px",
    borderRadius: 999,
    alignSelf: "flex-end",
    letterSpacing: 0.5,
    boxShadow: "0 2px 6px rgba(245,158,11,0.4)",
  },
  wholesaleTitle: {
    fontSize: 16, fontWeight: 900, color: "#fff",
    letterSpacing: "-0.01em",
    textShadow: "0 2px 6px rgba(0,0,0,0.35)",
    lineHeight: 1.3,
  },
  wholesaleSubtitle: {
    fontSize: 12, color: "rgba(255,255,255,0.95)", fontWeight: 600,
    lineHeight: 1.5,
    textShadow: "0 1px 3px rgba(0,0,0,0.35)",
  },

  rowCard: {
    display: "flex", flexDirection: "row-reverse", gap: 12,
    background: "transparent", border: "none",
    padding: "4px 0 16px",
    cursor: "pointer",
    borderBottom: `1px solid ${T.divider}`,
    transition: "opacity 0.15s",
  },
  rowImg: {
    position: "relative",
    width: 116, height: 116, minWidth: 116,
    borderRadius: 12, overflow: "hidden",
    background: T.bgAlt,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
  },
  gradientOverlay: {
    position: "absolute", inset: 0,
    pointerEvents: "none",
    background:
      "linear-gradient(135deg, rgba(220,38,127,0) 0%, rgba(220,38,127,0) 55%, rgba(15,118,110,0.12) 90%, rgba(15,118,110,0.2) 100%)",
  },
  negBadge: {
    position: "absolute", top: 6, insetInlineStart: 6,
    background: "rgba(15, 23, 42, 0.75)", color: "#fff",
    fontSize: 9, fontWeight: 800, padding: "2px 8px",
    borderRadius: T.radiusPill, backdropFilter: "blur(4px)",
    zIndex: 2,
  },
  rowBody: {
    flex: 1, minWidth: 0,
    display: "flex", flexDirection: "column", gap: 5,
    textAlign: "right",
  },
  rowTitle: {
    fontSize: 15, fontWeight: 800, color: T.primary,
    lineHeight: 1.4,
    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
    overflow: "hidden", letterSpacing: "-0.005em",
  },
  rowPrice: {
    display: "flex", flexDirection: "row-reverse", alignItems: "baseline", gap: 3,
  },
  priceValue: {
    fontSize: 18, fontWeight: 900, color: T.text, letterSpacing: "-0.01em",
  },
  priceCurr: {
    fontSize: 12, fontWeight: 700, color: T.textMuted,
  },
  rowMetaRow: {
    display: "flex", flexDirection: "row-reverse", gap: 10,
    color: T.textMuted, fontSize: 11, fontWeight: 600,
  },
  metaChip: {
    display: "inline-flex", alignItems: "center", gap: 3,
  },
  rowFooter: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    justifyContent: "space-between", gap: 8,
    marginTop: "auto", paddingTop: 8,
  },
  sellerRow: {
    display: "flex", flexDirection: "row-reverse", alignItems: "center",
    gap: 6, color: T.textMuted, fontSize: 12, fontWeight: 700,
    minWidth: 0, flex: 1,
  },
  avatar: {
    width: 22, height: 22, borderRadius: 11,
    background: T.bgAlt, color: T.textMuted,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 10, fontWeight: 800, flexShrink: 0,
  },
  sellerName: {
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    color: T.textMuted, minWidth: 0,
  },
  verifiedShop: {
    display: "inline-flex", alignItems: "center", gap: 3,
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#fff", fontSize: 9, fontWeight: 800,
    padding: "2px 6px", borderRadius: 6,
    boxShadow: "0 2px 4px rgba(5,150,105,0.25)",
    flexShrink: 0,
  },
  verifiedCarrier: {
    display: "inline-flex", alignItems: "center", gap: 3,
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "#fff", fontSize: 9, fontWeight: 800,
    padding: "2px 6px", borderRadius: 6,
    boxShadow: "0 2px 4px rgba(37,99,235,0.25)",
    flexShrink: 0,
  },
  rowStats: {
    display: "flex", flexDirection: "row-reverse", gap: 8,
    fontSize: 11, color: T.textFaint, fontWeight: 700, flexShrink: 0,
  },
  statItem: {
    display: "inline-flex", alignItems: "center", gap: 3,
  },
};
