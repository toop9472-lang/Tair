/**
 * المزاد العام — بنر متبدّل، عدّاد، سعر، ومزايدة واضحة.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Modal, Platform, Dimensions, FlatList, Animated, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { TAIR, TAIR_ELEVATION } from "../constants/tairTheme";
import { auctionsApi } from "../services/tairApi";
import { EmptyState, ErrorState, ListSkeleton, PressableScale, TairImage } from "../components/TairUI";
import AuctionMark from "../components/AuctionMark";
import { shareInApp } from "../services/shareContent";

const { width: SCREEN_W } = Dimensions.get("window");
const BANNERS = [
  require("../../assets/tair-design/auction/falcon.jpg"),
  require("../../assets/tair-design/auction/songbirds.jpg"),
];

const arNum = (n) => String(n ?? "").replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

function countdown(ms) {
  if (ms <= 0) return "٠٠:٠٠:٠٠";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return arNum(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`);
}

function AuctionHero({ isOpen }) {
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 420, useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        setIdx((i) => (i + 1) % BANNERS.length);
        Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }).start();
      });
    }, 4600);
    return () => clearInterval(timer);
  }, [fade]);

  return (
    <View style={s.hero}>
      <Animated.Image source={BANNERS[idx]} style={[StyleSheet.absoluteFill, { opacity: fade }]} resizeMode="cover" />
      <LinearGradient
        colors={["rgba(15,36,28,0.05)", "rgba(15,36,28,0.78)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.heroBody}>
        <AuctionMark size={78} />
        <Text style={s.heroKicker}>طير · كل مساء</Text>
        <Text style={s.heroTitle}>المزاد العام</Text>
        <Text style={s.heroSub}>من الرابعة عصراً حتى التاسعة مساءً بتوقيت السعودية</Text>
        <View style={[s.heroStatus, isOpen ? s.heroOpen : s.heroClosed]}>
          <View style={[s.liveDot, !isOpen && { backgroundColor: TAIR.gold }]} />
          <Text style={s.heroStatusText}>
            {isOpen ? "النافذة مفتوحة — يمكنك المزايدة" : "النافذة مغلقة الآن"}
          </Text>
        </View>
      </View>
      <View style={s.heroDots}>
        {BANNERS.map((_, i) => (
          <View key={i} style={[s.heroDot, i === idx && s.heroDotOn]} />
        ))}
      </View>
    </View>
  );
}

function shareAuction(a) {
  if (!a?.auction_id) return;
  const price = Number(a.current_bid_sar || a.starting_price_sar || 0);
  shareInApp({
    kind: "auction",
    id: a.auction_id,
    title: a.title || "مزاد طير",
    image: typeof a.images?.[0] === "string" ? a.images[0] : "",
    lines: [
      a.sequence_number ? `مزاد رقم ${a.sequence_number}` : null,
      `${price} ر.س`,
      a.city || null,
    ],
  });
}

export default function AuctionScreen({ user, onBack, onOpenSubmit, focusAuctionId }) {
  const uid = user?.id || user?.user_id || user?.email;
  const [oath, setOath] = useState({ accepted: null });
  const [win, setWin] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showBid, setShowBid] = useState(null);
  const [bidAmount, setBidAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeImg, setActiveImg] = useState({});
  const [bidHistory, setBidHistory] = useState([]);
  const focused = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [o, w, l] = await Promise.all([
        uid ? auctionsApi.oathStatus(uid).catch(() => ({ accepted: false })) : Promise.resolve({ accepted: false }),
        auctionsApi.window().catch(() => null),
        auctionsApi.list(),
      ]);
      setOath(o || { accepted: false });
      setWin(w);
      setList(l?.items || []);
    } catch (e) {
      setLoadError(e?.message || "تعذّر تحميل المزاد");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [uid]);

  useEffect(() => {
    const id = showBid?.auction_id;
    if (!id) { setBidHistory([]); return; }
    let alive = true;
    auctionsApi.get(id).then((doc) => {
      if (!alive || !doc) return;
      setBidHistory(Array.isArray(doc.recent_bids) ? doc.recent_bids : []);
      setShowBid((prev) => (prev && prev.auction_id === id ? { ...prev, ...doc, recent_bids: undefined } : prev));
    }).catch(() => { if (alive) setBidHistory([]); });
    return () => { alive = false; };
  }, [showBid?.auction_id]);

  const acceptOath = async () => {
    try { await auctionsApi.oathAccept(uid); setOath({ accepted: true }); }
    catch (e) { Alert.alert("خطأ", e?.message || "تعذّر تسجيل الحلف"); }
  };

  useEffect(() => {
    if (focused.current || !focusAuctionId || oath?.accepted !== true || !list.length) return;
    const found = list.find((a) => a.auction_id === focusAuctionId);
    if (!found) return;
    focused.current = true;
    const price = Number(found.current_bid_sar || found.starting_price_sar || 1);
    const inc = Number(found.min_increment_sar || 10);
    setBidAmount(String(price + inc));
    setShowBid(found);
  }, [focusAuctionId, oath?.accepted, list]);

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
    } catch (e) { Alert.alert("لم تُقبل المزايدة", e?.message || "تعذّر تسجيل المزايدة"); }
    finally { setBusy(false); }
  };

  const isOpen = win?.is_open;
  const { live, upcoming } = useMemo(() => {
    const liveItems = list.filter((a) => a.status === "live");
    const upcomingItems = list.filter((a) => a.status === "scheduled").sort(
      (a, b) => (a.sequence_number || 999) - (b.sequence_number || 999)
    );
    return { live: liveItems, upcoming: upcomingItems };
  }, [list]);

  return (
    <View style={s.page}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12} testID="auction-back-btn" style={s.headerBtn}>
          <Ionicons name="chevron-forward" size={22} color={TAIR.gold} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>المزاد</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ListSkeleton count={3} />
      ) : loadError && list.length === 0 ? (
        <ErrorState
          title="تعذّر فتح المزاد"
          subtitle="تحقق من الاتصال ثم أعد المحاولة."
          onRetry={load}
          testID="auction-error"
        />
      ) : !oath?.accepted ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <AuctionHero isOpen={!!isOpen} />
          <View style={s.oathBox}>
            <View style={s.oathIcon}>
              <Ionicons name="shield-checkmark" size={34} color={TAIR.gold} />
            </View>
            <Text style={s.oathTitle}>حلف قبل الدخول</Text>
            <Text style={s.oathText}>
              أُقسم بالله العظيم أن ألتزم الصدق والأمانة في المزاد، وأن إعلاناتي ومزايداتي حقيقية دون تدليس أو نجش، وأتحمل كامل المسؤولية أمام الله ثم أمام النظام.
            </Text>
            <PressableScale onPress={acceptOath} haptic style={s.oathBtn} scaleTo={0.98}>
              <Text style={s.oathBtnText}>أَحلف وأدخل</Text>
            </PressableScale>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <AuctionHero isOpen={!!isOpen} />

          <PressableScale onPress={onOpenSubmit} haptic scaleTo={0.985} style={s.submitCta} testID="submit-auction-btn">
            <Ionicons name="add-circle" size={20} color={TAIR.gold} />
            <View style={{ flex: 1 }}>
              <Text style={s.submitCtaText}>قدّم طائرك للمزاد</Text>
              <Text style={s.submitCtaSub}>ثلاث صور على الأقل، ثم مراجعة الإدارة</Text>
            </View>
            <Ionicons name="chevron-back" size={18} color={TAIR.gold} />
          </PressableScale>

          <View style={s.section}>
            <View style={s.sectionHeader}>
              <View style={s.liveDot} />
              <Text style={s.sectionTitle}>الآن على المنصة</Text>
            </View>
            {live.length > 0 ? live.map((a) => (
              <BigLiveCard
                key={a.auction_id}
                a={a}
                now={now}
                onBid={() => openBid(a)}
                isOpen={isOpen}
                activeIdx={activeImg[a.auction_id] || 0}
                onImgChange={(i) => setActiveImg((p) => ({ ...p, [a.auction_id]: i }))}
                onShare={() => shareAuction(a)}
              />
            )) : (
              <EmptyState
                icon="hammer-outline"
                title={isOpen ? "لا يوجد مزاد حي هذه اللحظة" : "المزاد يفتح مساءً"}
                subtitle="قدّم إعلانك ليظهر في الدور القادم."
              />
            )}
          </View>

          {upcoming.length > 0 ? (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Ionicons name="calendar-outline" size={16} color={TAIR.emerald} />
                <Text style={s.sectionTitle}>في الانتظار</Text>
                <Text style={s.sectionCount}>{arNum(upcoming.length)}</Text>
              </View>
              {upcoming.map((a, i) => (
                <UpcomingCard key={a.auction_id} a={a} rank={i + 1} onOpen={() => openBid(a)} onShare={() => shareAuction(a)} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={!!showBid} transparent animationType="slide" onRequestClose={() => setShowBid(null)}>
        <View style={s.modalWrap}>
          <View style={s.modalCard}>
            <View style={s.modalGrab} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle} numberOfLines={2}>
                مزاد #{arNum(showBid?.sequence_number || "؟")} — {showBid?.title}
              </Text>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                <TouchableOpacity onPress={() => shareAuction(showBid)} hitSlop={10} testID="auction-share-btn">
                  <Ionicons name="share-social-outline" size={20} color={TAIR.goldDark} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowBid(null)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={TAIR.emerald} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.modalPriceRow}>
              <Text style={s.modalPriceLabel}>السعر الحالي</Text>
              <Text style={s.modalPriceValue}>{arNum(Number(showBid?.current_bid_sar || showBid?.starting_price_sar || 0).toFixed(0))} ر.س</Text>
            </View>
            <Text style={s.modalLabel}>مبلغ مزايدتك</Text>
            <TextInput
              value={bidAmount}
              onChangeText={setBidAmount}
              keyboardType="numeric"
              style={s.modalInput}
              textAlign="right"
              placeholder={String(Number(showBid?.current_bid_sar || 0) + Number(showBid?.min_increment_sar || 10))}
              placeholderTextColor={TAIR.textSoft}
            />
            <Text style={s.modalHint}>الحد الأدنى للزيادة {arNum(showBid?.min_increment_sar || 10)} ر.س</Text>

            {bidHistory.length > 0 ? (
              <View style={s.history}>
                <Text style={s.historyTitle}>آخر المزايدات</Text>
                {bidHistory.slice(0, 5).map((b, i) => (
                  <View key={b.bid_id || b.id || i} style={s.historyRow}>
                    <Text style={s.historyName} numberOfLines={1}>{b.bidder_name || b.user_name || "مزايد"}</Text>
                    <Text style={s.historyAmt}>{arNum(Number(b.amount_sar || b.amount || 0).toFixed(0))} ر.س</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <PressableScale onPress={placeBid} disabled={busy || !isOpen} haptic style={[s.modalBtn, !isOpen && { opacity: 0.55 }]}>
              {busy ? <ActivityIndicator size="small" color={TAIR.gold} /> : (
                <>
                  <Ionicons name="hammer" size={18} color={TAIR.gold} />
                  <Text style={s.modalBtnText}>{isOpen ? "تأكيد المزايدة" : "المزاد مغلق"}</Text>
                </>
              )}
            </PressableScale>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function BigLiveCard({ a, now, onBid, isOpen, activeIdx, onImgChange, onShare }) {
  const endsMs = a.end_at ? new Date(a.end_at).getTime() - now : 0;
  const price = Number(a.current_bid_sar || a.starting_price_sar || 0);
  const images = a.images?.length ? a.images : BANNERS;
  const local = !a.images?.length;
  const w = SCREEN_W - 32;

  return (
    <View style={s.bigCard}>
      <View>
        {local ? (
          <Image source={images[0]} style={{ width: w, height: w * 0.72 }} resizeMode="cover" />
        ) : (
          <FlatList
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            data={images}
            keyExtractor={(u, i) => String(i)}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / w);
              onImgChange(i);
            }}
            renderItem={({ item }) => (
              <TairImage uri={item} style={{ width: w, height: w * 0.72 }} iconSize={36} />
            )}
          />
        )}
        <LinearGradient colors={["transparent", "rgba(15,36,28,0.45)"]} style={s.imgFade} pointerEvents="none" />
        <View style={s.seqBadge}>
          <Text style={s.seqBadgeText}>#{arNum(a.sequence_number || "؟")}</Text>
        </View>
        <TouchableOpacity onPress={onShare} style={s.shareFab} hitSlop={8}>
          <Ionicons name="share-social-outline" size={16} color={TAIR.gold} />
        </TouchableOpacity>
        {!local && images.length > 1 ? (
          <View style={s.dotsRow}>
            {images.map((_, i) => (
              <View key={i} style={[s.dot, i === activeIdx && s.dotActive]} />
            ))}
          </View>
        ) : null}
      </View>

      <View style={s.cardBody}>
        <Text style={s.bigTitle} numberOfLines={2}>{a.title}</Text>
        <View style={s.tagsRow}>
          {a.species ? <InfoTag icon="paw-outline" text={a.species} /> : null}
          {a.gender ? <InfoTag icon="male-female" text={a.gender} /> : null}
          {a.age_months != null ? <InfoTag icon="hourglass-outline" text={`${arNum(a.age_months)} شهر`} /> : null}
          {a.city ? <InfoTag icon="location-outline" text={a.city} /> : null}
        </View>
        {a.description ? <Text style={s.desc} numberOfLines={2}>{a.description}</Text> : null}

        <View style={s.priceBox}>
          <View style={s.priceCol}>
            <Text style={s.priceLabel}>السعر الحالي</Text>
            <Text style={s.priceValue}>{arNum(price.toFixed(0))}</Text>
            <Text style={s.priceCurrency}>ريال سعودي</Text>
          </View>
          <View style={s.priceDivider} />
          <View style={s.priceCol}>
            <Text style={s.priceLabel}>الوقت المتبقي</Text>
            <Text style={[s.timer, endsMs < 60000 && endsMs > 0 && { color: TAIR.error }]}>{countdown(endsMs)}</Text>
            <Text style={s.priceCurrency}>{arNum(a.bids_count || 0)} مزايدة</Text>
          </View>
        </View>

        {a.highest_bidder_name ? (
          <Text style={s.leadingBidder}>الأعلى الآن: {a.highest_bidder_name}</Text>
        ) : (
          <Text style={s.leadingBidder}>لم تبدأ المزايدات بعد</Text>
        )}

        <PressableScale
          onPress={onBid}
          disabled={!isOpen || endsMs <= 0}
          haptic
          scaleTo={0.98}
          style={[s.bidBtnBig, (!isOpen || endsMs <= 0) && { opacity: 0.5 }]}
        >
          <Ionicons name="hammer" size={18} color={TAIR.gold} />
          <Text style={s.bidBtnBigText}>{endsMs <= 0 ? "انتهى هذا المزاد" : "زايد الآن"}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

function UpcomingCard({ a, rank, onOpen, onShare }) {
  const price = Number(a.current_bid_sar || a.starting_price_sar || 0);
  const first = (a.images && a.images[0]) || null;
  return (
    <PressableScale onPress={onOpen} haptic scaleTo={0.985} style={s.upCard}>
      <View style={s.upRank}>
        <Text style={s.upRankText}>#{arNum(a.sequence_number || rank)}</Text>
      </View>
      {first ? (
        <TairImage uri={first} style={s.upImg} />
      ) : (
        <Image source={BANNERS[rank % BANNERS.length]} style={s.upImg} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.upTitle} numberOfLines={1}>{a.title}</Text>
        <Text style={s.upMeta} numberOfLines={1}>
          {[a.species, a.city].filter(Boolean).join(" · ") || "بانتظار الافتتاح"}
        </Text>
        <Text style={s.upPrice}>{arNum(price.toFixed(0))} ر.س</Text>
      </View>
      <TouchableOpacity onPress={onShare} hitSlop={8} style={s.upShare}>
        <Ionicons name="share-social-outline" size={16} color={TAIR.goldDark} />
      </TouchableOpacity>
      <Ionicons name="chevron-back" size={18} color={TAIR.goldDark} />
    </PressableScale>
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

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: TAIR.bg },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "ios" ? 52 : 18,
    paddingBottom: 12,
    backgroundColor: TAIR.emeraldDeep,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(198,161,91,0.45)",
  },
  headerTitle: { color: TAIR.gold, fontSize: 17, fontWeight: "800" },

  hero: {
    height: 250,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: TAIR.emerald,
    ...TAIR_ELEVATION.raised,
  },
  heroBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 22,
    paddingHorizontal: 18,
    gap: 2,
  },
  heroKicker: { color: TAIR.goldLight, fontSize: 12, fontWeight: "700", marginTop: 8 },
  heroTitle: { color: "#FFFDF8", fontSize: 28, fontWeight: "800" },
  heroSub: { color: "rgba(247,241,232,0.82)", fontSize: 12, textAlign: "center", marginTop: 2 },
  heroStatus: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroOpen: { backgroundColor: "rgba(47,107,69,0.85)" },
  heroClosed: { backgroundColor: "rgba(15,36,28,0.55)", borderWidth: 1, borderColor: "rgba(198,161,91,0.45)" },
  heroStatusText: { color: "#FFFDF8", fontSize: 12, fontWeight: "700" },
  heroDots: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,253,248,0.45)" },
  heroDotOn: { width: 16, backgroundColor: TAIR.gold },

  oathBox: {
    margin: 16,
    padding: 22,
    backgroundColor: TAIR.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.45)",
    alignItems: "center",
    ...TAIR_ELEVATION.card,
  },
  oathIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: TAIR.emerald,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1, borderColor: TAIR.gold,
  },
  oathTitle: { color: TAIR.emerald, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  oathText: { color: TAIR.text, fontSize: 14, lineHeight: 24, textAlign: "center", marginBottom: 16 },
  oathBtn: {
    backgroundColor: TAIR.emerald,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TAIR.gold,
  },
  oathBtnText: { color: TAIR.gold, fontWeight: "800", fontSize: 15 },

  submitCta: {
    marginHorizontal: 16,
    marginTop: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: TAIR.emerald,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.65)",
    ...TAIR_ELEVATION.hair,
  },
  submitCtaText: { color: TAIR.gold, fontWeight: "800", fontSize: 15, textAlign: "right" },
  submitCtaSub: { color: "rgba(224,197,128,0.85)", fontSize: 11, marginTop: 2, textAlign: "right" },

  section: { paddingHorizontal: 16, marginTop: 8 },
  sectionHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionTitle: { color: TAIR.emerald, fontSize: 16, fontWeight: "800", flex: 1, textAlign: "right" },
  sectionCount: { color: TAIR.muted, fontSize: 12, fontWeight: "700" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#C4493A" },

  bigCard: {
    backgroundColor: TAIR.card,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.4)",
    marginBottom: 14,
    ...TAIR_ELEVATION.card,
  },
  imgFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 70 },
  shareFab: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(15,36,28,0.82)",
    borderWidth: 1,
    borderColor: "rgba(198,161,91,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  upShare: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TAIR.goldWash,
  },
  seqBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(15,36,28,0.82)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TAIR.gold,
  },
  seqBadgeText: { color: TAIR.gold, fontWeight: "800", fontSize: 13 },
  dotsRow: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },
  dotActive: { backgroundColor: TAIR.gold, width: 16 },
  cardBody: { padding: 14 },
  bigTitle: { color: TAIR.ink, fontSize: 18, fontWeight: "800", textAlign: "right", lineHeight: 26 },
  tagsRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 8 },
  infoTag: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: TAIR.creamDeep,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  infoTagText: { color: TAIR.emerald, fontSize: 11, fontWeight: "700" },
  desc: { color: TAIR.muted, fontSize: 13, lineHeight: 20, textAlign: "right", marginTop: 8 },
  priceBox: {
    flexDirection: "row-reverse",
    marginTop: 12,
    backgroundColor: TAIR.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TAIR.divider,
    overflow: "hidden",
  },
  priceCol: { flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 8 },
  priceDivider: { width: StyleSheet.hairlineWidth, backgroundColor: TAIR.divider, marginVertical: 10 },
  priceLabel: { color: TAIR.faint, fontSize: 11, fontWeight: "700" },
  priceValue: { color: TAIR.emerald, fontSize: 26, fontWeight: "800", marginTop: 2 },
  priceCurrency: { color: TAIR.goldDark, fontSize: 11, fontWeight: "700", marginTop: 1 },
  timer: { color: TAIR.emerald, fontSize: 22, fontWeight: "800", marginTop: 4, fontVariant: ["tabular-nums"] },
  leadingBidder: { color: TAIR.muted, fontSize: 12, textAlign: "center", marginTop: 10, fontWeight: "600" },
  bidBtnBig: {
    marginTop: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: TAIR.emerald,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TAIR.gold,
    ...TAIR_ELEVATION.hair,
  },
  bidBtnBigText: { color: TAIR.gold, fontWeight: "800", fontSize: 16 },

  upCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: TAIR.card,
    padding: 10,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: TAIR.divider,
    ...TAIR_ELEVATION.hair,
  },
  upRank: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: TAIR.emerald,
    borderWidth: 1, borderColor: TAIR.gold,
    alignItems: "center", justifyContent: "center",
  },
  upRankText: { color: TAIR.gold, fontWeight: "800", fontSize: 12 },
  upImg: { width: 58, height: 58, borderRadius: 12 },
  upTitle: { color: TAIR.ink, fontSize: 14, fontWeight: "800", textAlign: "right" },
  upMeta: { color: TAIR.faint, fontSize: 11, textAlign: "right", marginTop: 2 },
  upPrice: { color: TAIR.emerald, fontSize: 14, fontWeight: "800", marginTop: 4, textAlign: "right" },

  modalWrap: { flex: 1, backgroundColor: "rgba(15,36,28,0.5)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: TAIR.card,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  modalGrab: {
    alignSelf: "center",
    width: 42, height: 4, borderRadius: 2,
    backgroundColor: TAIR.divider,
    marginBottom: 12,
  },
  modalHead: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  modalTitle: { color: TAIR.ink, fontSize: 15, fontWeight: "800", flex: 1, textAlign: "right" },
  modalPriceRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: TAIR.bg,
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: TAIR.divider,
  },
  modalPriceLabel: { color: TAIR.muted, fontSize: 12, fontWeight: "700" },
  modalPriceValue: { color: TAIR.emerald, fontSize: 18, fontWeight: "800" },
  modalLabel: { color: TAIR.emerald, fontSize: 13, fontWeight: "800", marginBottom: 6, textAlign: "right" },
  modalInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: TAIR.gold,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: TAIR.bg,
    color: TAIR.emerald,
    fontSize: 20,
    fontWeight: "800",
  },
  modalHint: { color: TAIR.faint, fontSize: 12, marginTop: 6, textAlign: "right" },
  history: { marginTop: 14, gap: 6 },
  historyTitle: { color: TAIR.emerald, fontSize: 12, fontWeight: "800", textAlign: "right", marginBottom: 2 },
  historyRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TAIR.divider,
  },
  historyName: { color: TAIR.ink, fontSize: 13, fontWeight: "700", flex: 1, textAlign: "right" },
  historyAmt: { color: TAIR.goldDark, fontSize: 13, fontWeight: "800" },
  modalBtn: {
    marginTop: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: TAIR.emerald,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TAIR.gold,
  },
  modalBtnText: { color: TAIR.gold, fontWeight: "800", fontSize: 15 },
});
