// طير — النظام البصري الرسمي (Emerald + Cream + Gold)
// المرجع: tayr-مواصفات-شاملة.md — الملف هو الحكم عند أي تعارض

export const TAIR = {
  // ========== ألوان ==========
  bg: "#F7F1E8",
  card: "#FFFDF8",

  emerald: "#1B3D2F",
  emeraldDeep: "#0F241C",
  emeraldSoft: "#3D6B54",

  gold: "#C6A15B",
  goldLight: "#E0C580",
  goldDark: "#8A6A2E",

  text: "#1B3D2F",
  textSoft: "#6B5E4A",
  textOnEmerald: "#F7F1E8",

  error: "#8B3A2F",
  success: "#2F6B45",
  divider: "#E6DCC8",
  shadow: "rgba(27,61,47,0.08)",

  // ========== مقاسات ==========
  pagePadX: 16,
  cardGap: 12,
  cardRadius: 18,
  pillRadius: 22,
  storyRingDiameter: 56,
  storyRingWidth: 2,
  dotSmall: 8,
  headerDot: 3,
  goldDividerH: 10,
  goldDividerMaxW: 120,
  searchH: 44,
  categoriesBtn: 44,
  emeraldRibbonH: 40,
  ribbonWingW: 28,
  ribbonWingH: 16,
  headerH: 158,
  headerBellSize: 40,
  tabBarH: 64,
  activeTabH: 48,
  tabIcon: 22,
  listingCardH: 120,
  listingImg: 96,
  listingImgRadius: 12,
  inboxCardH: 72,
  inboxAvatar: 48,
  tripStripH: 44,

  // ========== خطوط ==========
  fontLogo: 30,
  fontPageName: 15,
  fontSection: 16,
  fontItemTitle: 16,
  fontPrice: 18,
  fontMeta: 12,
  fontInbox: 13,
  fontGoldBtn: 14,
  fontBadge: 11,
  fontQuote: 13,
  fontOath: 14,
  fontTab: 10,
  fontPlaceholder: 14,
  fontAuctionCounter: 20,
};

// عربية شرقية للتواريخ والعدادات
export function toArabicNumerals(str) {
  return String(str).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[parseInt(d, 10)]);
}

// أصول مركزية
export const TAIR_HEADERS = {
  market: require("../../assets/tair-design/headers/market.jpg"),
  trips: require("../../assets/tair-design/headers/trips.jpg"),
  messages: require("../../assets/tair-design/headers/messages.jpg"),
  community: require("../../assets/tair-design/headers/community.jpg"),
  clinic: require("../../assets/tair-design/headers/clinic.jpg"),
  auction: require("../../assets/tair-design/headers/auction.jpg"),
  account: require("../../assets/tair-design/headers/account.jpg"),
  store: require("../../assets/tair-design/headers/store.jpg"),
};

export const TAIR_ORNAMENTS = {
  emeraldRibbon: require("../../assets/tair-design/ornaments/emerald_ribbon.jpg"),
  goldDivider: require("../../assets/tair-design/ornaments/gold_divider.jpg"),
  goldWing: require("../../assets/tair-design/ornaments/gold_wing.jpg"),
  categoriesIcon: require("../../assets/tair-design/ornaments/categories_icon.jpg"),
  accountTagline: require("../../assets/tair-design/ornaments/account_tagline.jpg"),
  auctionBanner: require("../../assets/tair-design/ornaments/auction_banner.jpg"),
};
