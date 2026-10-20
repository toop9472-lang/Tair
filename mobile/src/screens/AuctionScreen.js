/**
 * AuctionScreen (Mobile) — شاشة المزاد الاحترافية
 * - النافذة الزمنية: ٤:٠٠ عصراً – ٩:٠٠ مساءً بتوقيت السعودية
 * - كل مزاد يحصل على رقم متسلسل (#١، #٢...)
 * - المزاد الحي يظهر كبطاقة كبيرة مع كاروسيل صور + عدّاد + زر زايد
 * - زر "قدّم إعلانك للمزاد" للبائع
 * - المزادات القادمة تظهر مع أرقامها
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Modal, Image, Platform, Dimensions, FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAIR } from "../constants/tairTheme";
import { auctionsApi } from "../services/tairApi";

const { width: SCREEN_W } = Dimensions.get("window");

const arNum = (n) => String(n ?? "").replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

function countdown(ms) {
  if (ms <= 0) return "٠٠:٠٠:٠٠";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return arNum(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`);
}

function format12(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  let h = d.getHours();
  const ampm = h >= 12 ? "م" : "ص";
  h = h % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  return arNum(`${h}:${mm}`) + ` ${ampm}`;
}

export default function AuctionScreen({ user, onBack, onOpenSubmit }) {
  const uid = user?.id || user?.user_id || user?.email;
  const [oath, setOath] = useState({ accepted: null });
  const [win, setWin] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBid, setShowBid] = useState(null);
  const [bidAmount, setBidAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeImg, setActiveImg] = useState({});

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [o, w, l] = await Promise.all([
        uid ? auctionsApi.oathStatus(uid).catch(() => ({ accepted: false })) : Promise.resolve({ accepted: false }),
        auctionsApi.window().catch(() => null),
        auctionsApi.list().catch(() => ({ items: [] })),
      ]);
      setOath(o || { accepted: false });
      setWin(w);
      setList(l?.items || []);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [uid]);

  const acceptOath = async () => {
    try { await auctionsApi.oathAccept(uid); setOath({ accepted: true }); }
    catch { Alert.alert("خطأ", "تعذّر تسجيل الحلف"); }
  };

  const openBid = (a) => {
    const price = Number(a.current_bid_sar || a.starting_price_sar || 1);
    const inc = Number(a.min_increment_sar || 10);
    setBidAmount(String(price + inc));
    setShowBid(a);
  };

  const placeBid = async () => {
    if (!showBid) return;
    const amt = parseFloat(bidAmount);
    if (!Number.isFinite(amt) || amt <= 0) return Alert.alert("مبلغ غير صالح");
    const minNext = Number(showBid.current_bid_sar || showBid.starting_price_sar || 0) + Number(showBid.min_increment_sar || 10);
    if (amt < minNext) return Alert.alert("قيمة أقل من الحد الأدنى", `الحد الأدنى: ${arNum(minNext)} ر.س`);
    setBusy(true);
    try {
      await auctionsApi.bid(showBid.auction_id, amt, uid);
      setShowBid(null); setBidAmount(""); load();
    } catch (e) { Alert.alert("لم تُقبل المزايدة", e?.message || ""); }
    finally { setBusy(false); }
  };

  const isOpen = win?.is_open;
  const { live, upcoming } = useMemo(() => {
    const live = list.filter((a) => a.status === "live");
    const upcoming = list.filter((a) => a.status === "scheduled").sort(
      (a, b) => (a.sequence_number || 999) - (b.sequence_number || 999)
    );
    return { live, upcoming };
  }, [list]);

  return (
    <View style={s.page}>
      {/* هدر */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12} testID="auction-back-btn">
          <Ionicons name="chevron-forward" size={26} color={TAIR.gold} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
          <Ionicons name="hammer" size={22} color={TAIR.gold} />
          <Text style={s.headerTitle}>المزاد العام</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      {/* حالة النافذة */}
      <View style={[s.statusBar, isOpen ? { backgroundColor: "#E0F0E3" } : { backgroundColor: "#FDECEA" }]}>
        <Ionicons name={isOpen ? "checkmark-circle" : "time-outline"} size={16} color={isOpen ? "#2F6B45" : "#8B3A2F"} />
        <Text style={[s.statusText, { color: isOpen ? "#2F6B45" : "#8B3A2F" }]}>
          {isOpen ? "المزاد مفتوح الآن — زايد وأنت مطمئن" : `المزاد مغلق — يفتح ٤:٠٠ عصراً حتى ٩:٠٠ مساءً`}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={TAIR.emerald} />
      ) : !oath?.accepted ? (
        <View style={s.oathBox}>
          <View style={s.oathIcon}>
            <Ionicons name="shield-checkmark" size={40} color={TAIR.gold} />
          </View>
          <Text style={s.oathTitle}>حلف شرعي قبل الدخول</Text>
          <Text style={s.oathText}>
            أُقسم بالله العظيم أن ألتزم الصدق والأمانة في المزاد، وأنّ إعلاناتي ومزايداتي حقيقية دون تدليس أو نجش، وأتحمل كامل المسؤولية أمام الله ثم أمام النظام.
          </Text>
          <TouchableOpacity onPress={acceptOath} style={s.oathBtn}>
            <Text style={s.oathBtnText}>أَحلف وأدخل</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {/* زر تقديم إعلان */}
          <TouchableOpacity onPress={onOpenSubmit} activeOpacity={0.85} style={s.submitCta} testID="submit-auction-btn">
            <Ionicons name="add-circle" size={22} color={TAIR.gold} />
            <Text style={s.submitCtaText}>قدّم إعلانك للمزاد</Text>
            <Ionicons name="chevron-back" size={20} color={TAIR.gold} />
          </TouchableOpacity>

          {/* المزاد الحي — بطاقة كبيرة */}
          {live.length > 0 ? (
            <View style={{ paddingHorizontal: 14, paddingTop: 6 }}>
              <View style={s.sectionHeader}>
                <View style={s.liveDot} />
                <Text style={s.sectionTitle}>مزاد شغّال الآن</Text>
              </View>
              {live.map((a) => (
                <BigLiveCard key={a.auction_id} a={a} now={now} onBid={() => openBid(a)}
                  isOpen={isOpen} activeIdx={activeImg[a.auction_id] || 0}
                  onImgChange={(i) => setActiveImg((p) => ({ ...p, [a.auction_id]: i }))} />
              ))}
            </View>
          ) : (
            isOpen && (
              <View style={s.emptyLive}>
                <Ionicons name="hammer-outline" size={40} color={TAIR.divider} />
                <Text style={s.emptyText}>لا يوجد مزاد حي حالياً</Text>
              </View>
            )
          )}

          {/* المزادات القادمة — مع أرقام */}
          {upcoming.length > 0 && (
            <View style={{ paddingHorizontal: 14, marginTop: 20 }}>
              <View style={s.sectionHeader}>
                <Ionicons name="calendar" size={16} color={TAIR.emerald} />
                <Text style={s.sectionTitle}>المزادات القادمة</Text>
                <Text style={s.sectionCount}>{arNum(upcoming.length)}</Text>
              </View>
              {upcoming.map((a, i) => (
                <UpcomingCard key={a.auction_id} a={a} rank={i + 1} onOpen={() => openBid(a)} />
              ))}
            </View>
          )}

          {list.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="hammer-outline" size={54} color={TAIR.divider} />
              <Text style={s.emptyText}>لا توجد مزادات — كن أول من يقدّم</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* مودال المزايدة */}
      <Modal visible={!!showBid} transparent animationType="slide" onRequestClose={() => setShowBid(null)}>
        <View style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 14 }}>
              <Text style={s.modalTitle} numberOfLines={2}>
                مزاد #{arNum(showBid?.sequence_number || "?")} — {showBid?.title}
              </Text>
              <TouchableOpacity onPress={() => setShowBid(null)}>
                <Ionicons name="close" size={22} color={TAIR.emerald} />
              </TouchableOpacity>
            </View>
            <View style={s.modalPriceRow}>
              <Text style={s.modalPriceLabel}>السعر الحالي</Text>
              <Text style={s.modalPriceValue}>{arNum(Number(showBid?.current_bid_sar || 0).toFixed(0))} ر.س</Text>
            </View>
            <Text style={s.modalLabel}>مبلغ مزايدتك (ر.س)</Text>
            <TextInput
              value={bidAmount} onChangeText={setBidAmount} keyboardType="numeric"
              style={s.modalInput} textAlign="right"
              placeholder={String(Number(showBid?.current_bid_sar || 0) + Number(showBid?.min_increment_sar || 10))}
              placeholderTextColor={TAIR.textSoft}
            />
            <Text style={s.modalHint}>
              الحد الأدنى للزيادة: {arNum(showBid?.min_increment_sar || 10)} ر.س
            </Text>
            <TouchableOpacity onPress={placeBid} disabled={busy || !isOpen} style={[s.modalBtn, (!isOpen) && { opacity: 0.6 }]}>
              {busy ? <ActivityIndicator size="small" color={TAIR.gold} /> : (
                <>
                  <Ionicons name="hammer" size={18} color={TAIR.gold} />
                  <Text style={s.modalBtnText}>{isOpen ? "زايد الآن" : "المزاد مغلق"}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ----- Big Live Card -----
function BigLiveCard({ a, now, onBid, isOpen, activeIdx, onImgChange }) {
  const endsMs = a.end_at ? new Date(a.end_at).getTime() - now : 0;
  const price = Number(a.current_bid_sar || a.starting_price_sar || 0);
  const images = a.images || [];
  const w = SCREEN_W - 28;

  return (
    <View style={s.bigCard}>
      {/* Sequence badge */}
      <View style={s.seqBadge}>
        <Text style={s.seqBadgeText}>مزاد #{arNum(a.sequence_number || "?")}</Text>
      </View>

      {/* Image carousel */}
      {images.length > 0 ? (
        <>
          <FlatList
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            data={images}
            keyExtractor={(u, i) => String(i)}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / w);
              onImgChange(i);
            }}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={{ width: w, aspectRatio: 1.3 }} />
            )}
          />
          <View style={s.dotsRow}>
            {images.map((_, i) => (
              <View key={i} style={[s.dot, i === activeIdx && s.dotActive]} />
            ))}
          </View>
        </>
      ) : (
        <View style={[s.imgPlaceholder, { width: w }]}>
          <Ionicons name="image-outline" size={40} color={TAIR.divider} />
        </View>
      )}

      <View style={{ padding: 14 }}>
        <Text style={s.bigTitle} numberOfLines={2}>{a.title}</Text>

        {/* Info tags */}
        <View style={s.tagsRow}>
          {a.species ? <InfoTag icon="paw" text={a.species} /> : null}
          {a.gender ? <InfoTag icon="male-female" text={a.gender} /> : null}
          {a.age_months != null ? <InfoTag icon="hourglass" text={`${arNum(a.age_months)} شهر`} /> : null}
          {a.city ? <InfoTag icon="location" text={a.city} /> : null}
        </View>

        {a.description ? <Text style={s.desc} numberOfLines={3}>{a.description}</Text> : null}

        {/* Price + Countdown */}
        <View style={s.priceBox}>
          <View style={{ flex: 1 }}>
            <Text style={s.priceLabel}>السعر الحالي</Text>
            <Text style={s.priceValue}>{arNum(price.toFixed(0))} <Text style={s.priceCurrency}>ر.س</Text></Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={s.priceLabel}>ينتهي بعد</Text>
            <Text style={[s.timer, endsMs < 60000 && { color: "#EF4444" }]}>{countdown(endsMs)}</Text>
          </View>
        </View>

        {/* Bid Button */}
        <TouchableOpacity onPress={onBid} disabled={!isOpen || endsMs <= 0}
          activeOpacity={0.85}
          style={[s.bidBtnBig, (!isOpen || endsMs <= 0) && { opacity: 0.5 }]}>
          <Ionicons name="hammer" size={20} color={TAIR.gold} />
          <Text style={s.bidBtnBigText}>{endsMs <= 0 ? "انتهى المزاد" : "زايد الآن"}</Text>
        </TouchableOpacity>

        {a.highest_bidder_name ? (
          <Text style={s.leadingBidder}>الأعلى: {a.highest_bidder_name}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ----- Upcoming card -----
function UpcomingCard({ a, rank, onOpen }) {
  const price = Number(a.current_bid_sar || a.starting_price_sar || 0);
  const first = (a.images && a.images[0]) || null;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onOpen} style={s.upCard}>
      <View style={s.upRank}>
        <Text style={s.upRankText}>#{arNum(a.sequence_number || rank)}</Text>
      </View>
      {first ? (
        <Image source={{ uri: first }} style={s.upImg} />
      ) : (
        <View style={[s.upImg, { alignItems: "center", justifyContent: "center", backgroundColor: TAIR.divider }]}>
          <Ionicons name="image-outline" size={22} color={TAIR.textSoft} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.upTitle} numberOfLines={1}>{a.title}</Text>
        <View style={{ flexDirection: "row-reverse", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          {a.species ? <MiniTag text={a.species} /> : null}
          {a.gender ? <MiniTag text={a.gender} /> : null}
          {a.age_months != null ? <MiniTag text={`${arNum(a.age_months)}ش`} /> : null}
        </View>
        <Text style={s.upPrice}>{arNum(price.toFixed(0))} ر.س</Text>
      </View>
      <Ionicons name="chevron-back" size={18} color={TAIR.gold} />
    </TouchableOpacity>
  );
}

function InfoTag({ icon, text }) {
  return (
    <View style={s.infoTag}>
      <Ionicons name={icon} size={12} color={TAIR.emerald} />
      <Text style={s.infoTagText}>{text}</Text>
    </View>
  );
}

function MiniTag({ text }) {
  return (
    <View style={s.miniTag}>
      <Text style={s.miniTagText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },
  header: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 48 : 20, paddingBottom: 16,
    backgroundColor: TAIR.emerald, borderBottomWidth: 1.5, borderBottomColor: TAIR.gold,
  },
  headerTitle: { color: TAIR.gold, fontSize: 20, fontWeight: "900" },

  statusBar: {
    flexDirection: "row-reverse", alignItems: "center", gap: 8,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  statusText: { fontSize: 12, fontWeight: "800" },

  oathBox: { margin: 16, padding: 20, backgroundColor: TAIR.card, borderRadius: 16, borderWidth: 1, borderColor: TAIR.gold, alignItems: "center" },
  oathIcon: { width: 78, height: 78, borderRadius: 39, backgroundColor: TAIR.emerald, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  oathTitle: { color: TAIR.emerald, fontSize: 18, fontWeight: "900", marginBottom: 10 },
  oathText: { color: TAIR.text, fontSize: 14, lineHeight: 24, textAlign: "center", marginBottom: 18 },
  oathBtn: { backgroundColor: TAIR.emerald, paddingVertical: 12, paddingHorizontal: 32, borderRadius: 999, borderWidth: 1.5, borderColor: TAIR.gold },
  oathBtnText: { color: TAIR.gold, fontWeight: "900", fontSize: 15 },

  submitCta: {
    marginHorizontal: 14, marginTop: 12,
    flexDirection: "row-reverse", alignItems: "center", gap: 10,
    backgroundColor: TAIR.emerald, paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 999, borderWidth: 1.5, borderColor: TAIR.gold,
  },
  submitCtaText: { color: TAIR.gold, fontWeight: "900", fontSize: 14, flex: 1 },

  sectionHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 14, marginBottom: 8 },
  sectionTitle: { color: TAIR.emerald, fontSize: 15, fontWeight: "900" },
  sectionCount: { color: TAIR.textSoft, fontSize: 12, marginRight: 4 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },

  // ---- Big Card ----
  bigCard: {
    backgroundColor: TAIR.card, borderRadius: 18, overflow: "hidden",
    borderWidth: 1.5, borderColor: TAIR.gold,
    shadowColor: TAIR.emerald, shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  seqBadge: {
    position: "absolute", top: 12, right: 12, zIndex: 10,
    backgroundColor: TAIR.emerald, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, borderColor: TAIR.gold,
  },
  seqBadgeText: { color: TAIR.gold, fontWeight: "900", fontSize: 13 },
  imgPlaceholder: { aspectRatio: 1.3, alignItems: "center", justifyContent: "center", backgroundColor: TAIR.divider },
  dotsRow: {
    position: "absolute", top: 210, left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { backgroundColor: TAIR.gold, width: 18 },
  bigTitle: { color: TAIR.emerald, fontSize: 18, fontWeight: "900", textAlign: "right", marginBottom: 8 },
  tagsRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  infoTag: {
    flexDirection: "row-reverse", alignItems: "center", gap: 4,
    backgroundColor: "#F0EAD8", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  infoTagText: { color: TAIR.emerald, fontSize: 11.5, fontWeight: "800" },
  desc: { color: TAIR.text, fontSize: 13, lineHeight: 20, textAlign: "right", marginBottom: 10 },
  priceBox: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    backgroundColor: TAIR.bg, padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: TAIR.divider,
  },
  priceLabel: { color: TAIR.textSoft, fontSize: 11, fontWeight: "700" },
  priceValue: { color: TAIR.gold, fontSize: 22, fontWeight: "900", marginTop: 2 },
  priceCurrency: { fontSize: 13, color: TAIR.gold },
  timer: { color: TAIR.emerald, fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums"], marginTop: 2 },
  bidBtnBig: {
    marginTop: 12, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: TAIR.emerald, paddingVertical: 15, borderRadius: 999,
    borderWidth: 1.5, borderColor: TAIR.gold,
  },
  bidBtnBigText: { color: TAIR.gold, fontWeight: "900", fontSize: 16 },
  leadingBidder: { color: TAIR.textSoft, fontSize: 12, textAlign: "center", marginTop: 8 },

  // ---- Upcoming ----
  upCard: {
    flexDirection: "row-reverse", alignItems: "center", gap: 10,
    backgroundColor: TAIR.card, padding: 10, borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: TAIR.divider,
  },
  upRank: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: TAIR.emerald, borderWidth: 1.5, borderColor: TAIR.gold,
    alignItems: "center", justifyContent: "center",
  },
  upRankText: { color: TAIR.gold, fontWeight: "900", fontSize: 12 },
  upImg: { width: 60, height: 60, borderRadius: 10 },
  upTitle: { color: TAIR.emerald, fontSize: 14, fontWeight: "800", textAlign: "right" },
  upPrice: { color: TAIR.gold, fontSize: 14, fontWeight: "900", marginTop: 4, textAlign: "right" },
  miniTag: { backgroundColor: "#F0EAD8", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  miniTagText: { color: TAIR.emerald, fontSize: 10.5, fontWeight: "700" },

  emptyLive: { padding: 30, alignItems: "center", gap: 8 },
  empty: { padding: 60, alignItems: "center", gap: 12 },
  emptyText: { color: TAIR.textSoft, fontSize: 13 },

  // ---- Modal ----
  modalWrap: { flex: 1, backgroundColor: "rgba(15,36,28,0.55)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: TAIR.card, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 34 },
  modalTitle: { color: TAIR.emerald, fontSize: 15, fontWeight: "900", flex: 1, textAlign: "right" },
  modalPriceRow: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    backgroundColor: TAIR.bg, padding: 10, borderRadius: 10, marginBottom: 12,
    borderWidth: 1, borderColor: TAIR.divider,
  },
  modalPriceLabel: { color: TAIR.textSoft, fontSize: 12, fontWeight: "700" },
  modalPriceValue: { color: TAIR.gold, fontSize: 18, fontWeight: "900" },
  modalLabel: { color: TAIR.emerald, fontSize: 13, fontWeight: "800", marginBottom: 6, textAlign: "right" },
  modalInput: {
    minHeight: 52, borderWidth: 1.5, borderColor: TAIR.gold, borderRadius: 12,
    paddingHorizontal: 14, backgroundColor: TAIR.bg, color: TAIR.emerald,
    fontSize: 18, fontWeight: "900",
  },
  modalHint: { color: TAIR.textSoft, fontSize: 11.5, marginTop: 6, textAlign: "right" },
  modalBtn: {
    marginTop: 14, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: TAIR.emerald, paddingVertical: 14, borderRadius: 999,
    borderWidth: 1.5, borderColor: TAIR.gold,
  },
  modalBtnText: { color: TAIR.gold, fontWeight: "900", fontSize: 15 },
});
