// طير — Web landing + feed (matches mobile app)
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CITIES = [
  "الكل", "الرياض", "جدة", "مكة", "المدينة", "الدمام",
  "الأحساء", "الطائف", "بريدة", "تبوك", "أبها",
];

const statusColor = {
  scheduled: "#0891b2",
  departed: "#eab308",
  in_transit: "#f59e0b",
  arrived: "#10b981",
  completed: "#064e3b",
  cancelled: "#ef4444",
};
const statusLabel = {
  scheduled: "مجدولة",
  departed: "انطلقت",
  in_transit: "في الطريق",
  arrived: "وصلت",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

function TairPage() {
  const [tab, setTab] = useState("listings"); // listings | trips
  const [selectedCity, setSelectedCity] = useState("الكل");
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [q, setQ] = useState("");
  const [species, setSpecies] = useState([]);
  const [listings, setListings] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", "ar");
    document.title = "طير — سوق الطيور والحيوانات الأليفة";
  }, []);

  useEffect(() => {
    axios
      .get(`${API_URL}/api/species/list`)
      .then((r) => setSpecies(r.data.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { limit: 40 };
    if (selectedCity && selectedCity !== "الكل") params.city = selectedCity;
    if (selectedSpecies) params.species = selectedSpecies;
    if (q.trim()) params.q = q.trim();
    axios
      .get(`${API_URL}/api/listings/feed`, { params })
      .then((r) => setListings(r.data.items || []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [selectedCity, selectedSpecies, q]);

  useEffect(() => {
    axios
      .get(`${API_URL}/api/trips/list`, { params: { status: "active", limit: 40 } })
      .then((r) => setTrips(r.data.items || []))
      .catch(() => setTrips([]));
  }, []);

  const activeList = tab === "listings" ? listings : trips;

  return (
    <div style={styles.root}>
      <Hero
        tab={tab}
        setTab={setTab}
        q={q}
        setQ={setQ}
      />

      <div style={styles.filtersWrap}>
        <FiltersRow items={CITIES} value={selectedCity} onChange={setSelectedCity} label="المدينة" />
        {tab === "listings" && (
          <FiltersRow
            items={[{ id: null, label: "جميع الأنواع" }, ...species.map((s) => ({ id: s.species_id, label: s.name_ar }))]}
            value={selectedSpecies}
            onChange={setSelectedSpecies}
            isSpecies
            label="النوع"
          />
        )}
      </div>

      <div style={styles.container}>
        <div style={styles.resultBar}>
          <span style={styles.resultCount}>
            {loading ? "جاري التحميل…" : `${activeList.length} ${tab === "listings" ? "إعلان" : "رحلة"}`}
          </span>
        </div>

        {loading ? (
          <div style={styles.loadingBox}>
            <Spinner />
          </div>
        ) : activeList.length === 0 ? (
          <EmptyBox tab={tab} />
        ) : tab === "listings" ? (
          <div style={styles.grid}>
            {listings.map((l) => (
              <ListingCard key={l.listing_id} item={l} onClick={() => setSelected({ type: "listing", data: l })} />
            ))}
          </div>
        ) : (
          <div style={styles.tripList}>
            {trips.map((t) => (
              <TripCard key={t.trip_id} trip={t} onClick={() => setSelected({ type: "trip", data: t })} />
            ))}
          </div>
        )}
      </div>

      <Footer />

      {selected?.type === "listing" && (
        <ListingModal listing={selected.data} onClose={() => setSelected(null)} />
      )}
      {selected?.type === "trip" && (
        <TripModal trip={selected.data} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function Hero({ tab, setTab, q, setQ }) {
  return (
    <div style={styles.hero}>
      <div style={styles.heroInner}>
        <div style={styles.brandRow}>
          <img src="/tair_logo.png" alt="طير" style={styles.logo} />
          <div style={{ textAlign: "right" }}>
            <h1 style={styles.brandName}>طير</h1>
            <p style={styles.brandTag}>
              سوق الطيور والحيوانات الأليفة الموثوق في السعودية
            </p>
          </div>
        </div>

        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن كناري، كوكتيل، ببغاء…"
            style={styles.searchInput}
            data-testid="search-input"
          />
          {q && (
            <button style={styles.clearBtn} onClick={() => setQ("")}>
              ✕
            </button>
          )}
        </div>

        <div style={styles.tabsRow}>
          <button
            style={{
              ...styles.tab,
              ...(tab === "listings" ? styles.tabActive : {}),
            }}
            onClick={() => setTab("listings")}
            data-testid="tab-listings"
          >
            الإعلانات
          </button>
          <button
            style={{
              ...styles.tab,
              ...(tab === "trips" ? styles.tabActive : {}),
            }}
            onClick={() => setTab("trips")}
            data-testid="tab-trips"
          >
            الرحلات
          </button>
        </div>
      </div>
    </div>
  );
}

function FiltersRow({ items, value, onChange, isSpecies, label }) {
  return (
    <div style={styles.filterRow}>
      <span style={styles.filterLabel}>{label}:</span>
      <div style={styles.chipsScroll}>
        {items.map((item, i) => {
          const id = isSpecies ? item.id : item;
          const text = isSpecies ? item.label : item;
          const active = value === id;
          return (
            <button
              key={i}
              style={{
                ...styles.chip,
                ...(active ? styles.chipActive : {}),
              }}
              onClick={() => onChange(id)}
              data-testid={`filter-chip-${id || "all"}`}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListingCard({ item, onClick }) {
  return (
    <div style={styles.card} onClick={onClick} data-testid={`listing-card-${item.listing_id}`}>
      <div style={styles.imageBox}>
        {item.cover_image ? (
          <img src={item.cover_image} alt={item.title} style={styles.image} />
        ) : (
          <div style={styles.imagePlaceholder}>🐦</div>
        )}
        {item.price_negotiable && (
          <div style={styles.negotiablePill}>قابل للتفاوض</div>
        )}
      </div>
      <div style={styles.cardBody}>
        <div style={styles.cardTitle}>{item.title}</div>
        <div style={styles.cardMeta}>
          <span style={styles.cardLocation}>📍 {item.city}</span>
          {item.district && <span style={styles.cardDistrict}>· {item.district}</span>}
        </div>
        <div style={styles.cardBottom}>
          <span style={styles.price}>{item.price_sar} ر.س</span>
          <div style={styles.stats}>
            <span>👁 {item.view_count || 0}</span>
            <span>❤ {item.favorite_count || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TripCard({ trip, onClick }) {
  const dt = trip.depart_at ? new Date(trip.depart_at) : null;
  return (
    <div style={styles.tripCard} onClick={onClick} data-testid={`trip-card-${trip.trip_id}`}>
      <div style={styles.tripTop}>
        <div
          style={{
            ...styles.statusPill,
            background: (statusColor[trip.status] || "#64748b") + "22",
            color: statusColor[trip.status] || "#64748b",
          }}
        >
          {statusLabel[trip.status] || trip.status}
        </div>
        <div style={styles.cageBadge}>
          📦 {trip.available_cages}/{trip.total_cages} أقفاص
        </div>
      </div>

      <div style={styles.routeRow}>
        <div style={styles.cityBox}>
          <div style={styles.cityLabel}>من</div>
          <div style={styles.cityName}>{trip.from_city}</div>
        </div>
        <div style={styles.routeArrow}>←</div>
        <div style={styles.cityBox}>
          <div style={styles.cityLabel}>إلى</div>
          <div style={styles.cityName}>{trip.to_city}</div>
        </div>
      </div>

      <div style={styles.tripMeta}>
        <span>📅 {dt ? dt.toLocaleDateString("ar-SA") : "-"}</span>
        <span>🚗 {trip.vehicle_type}</span>
        {trip.has_ac && <span style={{ color: "#0891b2" }}>❄ مكيّف</span>}
      </div>

      {trip.notes && <p style={styles.tripNotes}>{trip.notes}</p>}
    </div>
  );
}

function ListingModal({ listing, onClose }) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} data-testid="listing-modal">
        <button style={styles.closeBtn} onClick={onClose} data-testid="modal-close-btn">✕</button>
        <div style={styles.modalImage}>
          {listing.cover_image ? (
            <img src={listing.cover_image} alt={listing.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ ...styles.imagePlaceholder, fontSize: 64 }}>🐦</div>
          )}
        </div>
        <div style={styles.modalBody}>
          <div style={styles.modalPrice}>{listing.price_sar} ر.س</div>
          {listing.price_negotiable && <div style={styles.negotiableText}>قابل للتفاوض</div>}
          <h2 style={styles.modalTitle}>{listing.title}</h2>
          <div style={styles.modalLocation}>📍 {listing.city}{listing.district ? ` · ${listing.district}` : ""}</div>

          <div style={styles.modalSpecs}>
            {listing.gender && <SpecRow icon="⚥" label="الجنس" value={{ male: "ذكر", female: "أنثى", pair: "زوج", unknown: "غير محدد" }[listing.gender]} />}
            {listing.age_months && <SpecRow icon="📅" label="العمر" value={`${listing.age_months} شهر`} />}
            {listing.breed && <SpecRow icon="🏷" label="السلالة" value={listing.breed} />}
            {listing.color && <SpecRow icon="🎨" label="اللون" value={listing.color} />}
          </div>

          <h3 style={styles.h3}>الوصف</h3>
          <p style={styles.desc}>{listing.description}</p>

          {listing.health && (
            <>
              <h3 style={styles.h3}>الحالة الصحية</h3>
              <div style={styles.healthBox}>
                <SpecRow icon="💗" label="الحالة" value={{ excellent: "ممتازة", good: "جيدة", needs_care: "تحتاج رعاية", special_needs: "احتياجات خاصة" }[listing.health.status] || "-"} />
                <SpecRow icon="💉" label="محصّن" value={listing.health.vaccinated ? "نعم" : "لا"} />
                {listing.health.ring_number && <SpecRow icon="🔖" label="رقم الخاتم" value={listing.health.ring_number} />}
                {listing.health.notes && <SpecRow icon="📝" label="ملاحظات" value={listing.health.notes} />}
              </div>
            </>
          )}

          <div style={styles.downloadCTA}>
            <p style={styles.ctaText}>لإتمام الطلب والتواصل مع البائع حمّل التطبيق</p>
            <div style={styles.ctaBtns}>
              <button style={styles.ctaBtn} data-testid="ios-download-btn">📱 تحميل لآيفون (قريباً)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TripModal({ trip, onClose }) {
  const dt = trip.depart_at ? new Date(trip.depart_at) : null;
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} data-testid="trip-modal">
        <button style={styles.closeBtn} onClick={onClose} data-testid="modal-close-btn">✕</button>
        <div style={styles.modalBody}>
          <div style={styles.routeRow}>
            <div style={styles.cityBox}>
              <div style={styles.cityLabel}>من</div>
              <div style={{ ...styles.cityName, fontSize: 26 }}>{trip.from_city}</div>
            </div>
            <div style={{ ...styles.routeArrow, fontSize: 32 }}>←</div>
            <div style={styles.cityBox}>
              <div style={styles.cityLabel}>إلى</div>
              <div style={{ ...styles.cityName, fontSize: 26 }}>{trip.to_city}</div>
            </div>
          </div>
          <div style={styles.modalSpecs}>
            <SpecRow icon="📅" label="موعد الانطلاق" value={dt ? dt.toLocaleString("ar-SA") : "-"} />
            <SpecRow icon="🚗" label="نوع المركبة" value={trip.vehicle_type} />
            <SpecRow icon="📦" label="الأقفاص المتاحة" value={`${trip.available_cages} من ${trip.total_cages}`} />
            <SpecRow icon="❄" label="مكيّف" value={trip.has_ac ? "نعم" : "لا"} />
            {trip.price_hint_sar && <SpecRow icon="💰" label="سعر إرشادي" value={`${trip.price_hint_sar} ر.س`} />}
          </div>
          {trip.notes && (
            <>
              <h3 style={styles.h3}>ملاحظات الموصل</h3>
              <p style={styles.desc}>{trip.notes}</p>
            </>
          )}
          <div style={styles.downloadCTA}>
            <p style={styles.ctaText}>لحجز مقعد مع الموصل حمّل التطبيق</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ icon, label, value }) {
  return (
    <div style={styles.specRow}>
      <span style={styles.specLeft}>
        <span>{icon}</span>
        <span style={styles.specLabel}>{label}</span>
      </span>
      <span style={styles.specValue}>{value}</span>
    </div>
  );
}

function EmptyBox({ tab }) {
  return (
    <div style={styles.emptyBox}>
      <div style={{ fontSize: 64 }}>🥚</div>
      <h3 style={styles.emptyTitle}>
        {tab === "listings" ? "لا توجد إعلانات مطابقة" : "لا توجد رحلات حالياً"}
      </h3>
      <p style={styles.emptyText}>
        {tab === "listings"
          ? "جرّب تغيير المدينة أو النوع"
          : "كن أول موصل! انشر رحلتك من التطبيق"}
      </p>
    </div>
  );
}

function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.footerInner}>
        <div style={styles.footerRow}>
          <img src="/tair_logo.png" alt="طير" style={styles.footerLogo} />
          <div style={{ flex: 1 }}>
            <div style={styles.footerBrand}>طير</div>
            <div style={styles.footerTag}>سوق الطيور والحيوانات الأليفة الأكثر ثقة</div>
          </div>
        </div>
        <div style={styles.maroofBadge}>
          🛡️ موثّق من وزارة التجارة · رقم التوثيق: <b>0000294044</b>
        </div>
        <div style={styles.footerLinks}>
          <a href="/privacy-policy.html" style={styles.footerLink}>سياسة الخصوصية</a>
          <span style={{ color: "#94a3b8" }}>·</span>
          <a href="/terms.html" style={styles.footerLink}>الشروط والأحكام</a>
          <span style={{ color: "#94a3b8" }}>·</span>
          <a href="/delete-account.html" style={styles.footerLink}>حذف الحساب</a>
        </div>
        <div style={styles.footerNote}>
          © 2026 طير · نحن وسيط تجاري فقط. لا نبيع ولا نشتري الحيوانات.
        </div>
      </div>
    </footer>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 20,
      border: "4px solid #a7f3d0",
      borderTopColor: "#10b981",
      animation: "tair-spin 0.8s linear infinite",
    }} />
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "'Tajawal', 'IBM Plex Sans Arabic', system-ui, sans-serif",
    direction: "rtl",
  },
  hero: {
    background: "linear-gradient(135deg, #c8fce6 0%, #a7f3d0 40%, #7dd3fc 100%)",
    paddingTop: 30,
    paddingBottom: 30,
  },
  heroInner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 24px",
  },
  brandRow: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 20,
    boxShadow: "0 12px 32px rgba(6, 95, 70, 0.25)",
  },
  brandName: {
    margin: 0,
    fontSize: 44,
    fontWeight: 900,
    color: "#065f46",
    lineHeight: 1,
  },
  brandTag: {
    margin: "6px 0 0",
    fontSize: 15,
    color: "#0f766e",
    fontWeight: 600,
  },
  searchWrap: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    background: "#fff",
    borderRadius: 20,
    padding: "14px 20px",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
  },
  searchIcon: { fontSize: 20 },
  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: 16,
    background: "transparent",
    textAlign: "right",
    fontFamily: "inherit",
    color: "#0f172a",
  },
  clearBtn: {
    background: "#f1f5f9",
    border: "none",
    width: 26,
    height: 26,
    borderRadius: 13,
    fontSize: 14,
    cursor: "pointer",
    color: "#64748b",
  },
  tabsRow: {
    display: "flex",
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: 16,
  },
  tab: {
    padding: "10px 24px",
    border: "none",
    borderRadius: 999,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    background: "rgba(255,255,255,0.65)",
    color: "#065f46",
    transition: "all 0.2s",
    fontFamily: "inherit",
  },
  tabActive: {
    background: "#065f46",
    color: "#fff",
    boxShadow: "0 6px 18px rgba(6, 95, 70, 0.35)",
  },

  filtersWrap: {
    background: "#fff",
    borderBottom: "1px solid #e2e8f0",
    padding: "10px 0",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  filterRow: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    padding: "6px 24px",
    maxWidth: 1200,
    margin: "0 auto",
  },
  filterLabel: { fontSize: 12, color: "#64748b", fontWeight: 700, minWidth: 40 },
  chipsScroll: {
    display: "flex",
    flexDirection: "row-reverse",
    gap: 6,
    overflowX: "auto",
    padding: "4px 0",
    scrollbarWidth: "none",
  },
  chip: {
    padding: "6px 14px",
    border: "1px solid #a5f3fc",
    borderRadius: 999,
    background: "#ecfeff",
    color: "#0e7490",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: "inherit",
  },
  chipActive: {
    background: "#06b6d4",
    color: "#fff",
    borderColor: "#06b6d4",
  },

  container: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "20px 24px 60px",
  },
  resultBar: {
    display: "flex",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  resultCount: { color: "#64748b", fontSize: 13, fontWeight: 600 },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 14,
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(15, 23, 42, 0.06)",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  imageBox: {
    position: "relative",
    aspectRatio: "1/1",
    background: "#f1f5f9",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%", objectFit: "cover" },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 48,
    color: "#94a3b8",
  },
  negotiablePill: {
    position: "absolute",
    top: 10,
    insetInlineStart: 10,
    background: "rgba(6, 95, 70, 0.9)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    padding: "3px 8px",
    borderRadius: 8,
  },
  cardBody: { padding: 12 },
  cardTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#0f172a",
    textAlign: "right",
    marginBottom: 6,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cardMeta: {
    display: "flex",
    flexDirection: "row-reverse",
    fontSize: 12,
    color: "#64748b",
    gap: 4,
  },
  cardLocation: { fontWeight: 600 },
  cardDistrict: { color: "#94a3b8" },
  cardBottom: {
    display: "flex",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  price: { fontSize: 18, fontWeight: 900, color: "#065f46" },
  stats: {
    display: "flex",
    flexDirection: "row-reverse",
    gap: 8,
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 600,
  },

  tripList: { display: "grid", gap: 12 },
  tripCard: {
    background: "#fff",
    borderRadius: 16,
    padding: 16,
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(15, 23, 42, 0.06)",
    transition: "transform 0.15s",
  },
  tripTop: {
    display: "flex",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusPill: {
    padding: "4px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },
  cageBadge: {
    background: "#ecfdf5",
    color: "#065f46",
    padding: "4px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  routeRow: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    padding: "8px 0",
  },
  cityBox: { flex: 1, textAlign: "center" },
  cityLabel: { fontSize: 10, color: "#94a3b8", fontWeight: 600 },
  cityName: { fontSize: 20, fontWeight: 900, color: "#0f172a", marginTop: 2 },
  routeArrow: { fontSize: 24, color: "#10b981" },
  tripMeta: {
    display: "flex",
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
    fontSize: 12,
    color: "#475569",
    fontWeight: 600,
  },
  tripNotes: { color: "#64748b", fontSize: 13, marginTop: 10, textAlign: "right" },

  loadingBox: {
    padding: 80,
    display: "flex",
    justifyContent: "center",
  },
  emptyBox: {
    padding: 60,
    textAlign: "center",
    background: "#fff",
    borderRadius: 20,
    color: "#334155",
  },
  emptyTitle: { fontSize: 18, fontWeight: 800, margin: "8px 0 4px" },
  emptyText: { color: "#64748b", fontSize: 14 },

  modalOverlay: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(15, 23, 42, 0.6)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 20,
  },
  modal: {
    background: "#fff",
    borderRadius: 20,
    maxWidth: 560,
    width: "100%",
    maxHeight: "90vh",
    overflow: "auto",
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    insetInlineStart: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    background: "rgba(255,255,255,0.92)",
    border: "none",
    fontSize: 16,
    cursor: "pointer",
    zIndex: 5,
    fontWeight: 800,
    color: "#0f172a",
  },
  modalImage: { aspectRatio: "16/12", background: "#f1f5f9", overflow: "hidden" },
  modalBody: { padding: 20 },
  modalPrice: { fontSize: 30, fontWeight: 900, color: "#065f46", textAlign: "right" },
  negotiableText: { color: "#0891b2", fontSize: 12, fontWeight: 700, textAlign: "right" },
  modalTitle: { fontSize: 22, fontWeight: 900, color: "#0f172a", margin: "10px 0", textAlign: "right" },
  modalLocation: { color: "#065f46", fontSize: 14, fontWeight: 700, textAlign: "right" },
  modalSpecs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 16,
    padding: 12,
    background: "#ecfdf5",
    borderRadius: 14,
  },
  specRow: {
    display: "flex",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 8px",
    background: "#fff",
    borderRadius: 10,
  },
  specLeft: { display: "flex", flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  specLabel: { fontSize: 11, color: "#64748b", fontWeight: 600 },
  specValue: { fontSize: 13, color: "#0f172a", fontWeight: 700 },
  h3: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
    margin: "20px 0 8px",
    textAlign: "right",
  },
  desc: { color: "#475569", fontSize: 14, lineHeight: 1.7, textAlign: "right" },
  healthBox: {
    background: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gap: 6,
  },
  downloadCTA: {
    marginTop: 24,
    padding: 16,
    background: "linear-gradient(135deg, #ecfdf5, #ecfeff)",
    borderRadius: 16,
    textAlign: "center",
  },
  ctaText: { color: "#065f46", fontWeight: 700, fontSize: 14, marginBottom: 10 },
  ctaBtns: { display: "flex", justifyContent: "center", gap: 8 },
  ctaBtn: {
    padding: "10px 20px",
    border: "none",
    borderRadius: 12,
    background: "linear-gradient(135deg, #10b981, #06b6d4)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
  },

  footer: {
    background: "linear-gradient(135deg, #064e3b, #0f172a)",
    color: "#fff",
    marginTop: 40,
    padding: "40px 0",
  },
  footerInner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 24px",
    textAlign: "center",
  },
  footerRow: {
    display: "flex",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginBottom: 16,
  },
  footerLogo: { width: 60, height: 60, borderRadius: 14 },
  footerBrand: { fontSize: 26, fontWeight: 900 },
  footerTag: { fontSize: 12, color: "#a7f3d0", marginTop: 2 },
  maroofBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    borderRadius: 999,
    background: "rgba(16, 185, 129, 0.15)",
    border: "1px solid rgba(16, 185, 129, 0.35)",
    color: "#a7f3d0",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 16,
  },
  footerLinks: { display: "flex", justifyContent: "center", gap: 8, marginBottom: 12 },
  footerLink: { color: "#a7f3d0", textDecoration: "none", fontSize: 13, fontWeight: 600 },
  footerNote: { color: "#64748b", fontSize: 11 },
};

// Global spinner animation
const styleSheet = document.styleSheets[0];
if (styleSheet) {
  try {
    styleSheet.insertRule(`@keyframes tair-spin { to { transform: rotate(360deg); } }`, 0);
  } catch {}
}

export default TairPage;
