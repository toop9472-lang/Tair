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

  // سطوح وطبقات أدق — نفس العائلة، تباين أوضح
  cream: "#F7F1E8",
  creamDeep: "#EFE4D2",
  surface: "#FFFDF8",
  surfaceMuted: "#FBF6EE",
  ink: "#0F241C",
  muted: "#6B5E4A",
  faint: "#8A7B66",
  line: "#E6DCC8",
  goldWash: "rgba(198,161,91,0.16)",
  emeraldWash: "rgba(27,61,47,0.08)",
  dangerSoft: "#F8EBE7",
  successSoft: "#E7F2EB",
  warningSoft: "#FBF3E0",

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

// مسافات موحّدة — استخدمها بدل الأرقام العشوائية
export const TAIR_SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const TAIR_RADIUS = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

// سلم خطوط واثق وهادئ
export const TAIR_TYPE = {
  display: { fontSize: 28, lineHeight: 36, fontWeight: "800" },
  title: { fontSize: 20, lineHeight: 28, fontWeight: "800" },
  section: { fontSize: 16, lineHeight: 24, fontWeight: "800" },
  body: { fontSize: 15, lineHeight: 24, fontWeight: "600" },
  meta: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
  caption: { fontSize: 11, lineHeight: 16, fontWeight: "700" },
  price: { fontSize: 18, lineHeight: 24, fontWeight: "900" },
};

// عمق ناعم بلون الزمرد — لا ظلال رمادية ثقيلة ولا توهج سماوي
export const TAIR_ELEVATION = {
  none: {},
  hair: {
    shadowColor: "#1B3D2F",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  card: {
    shadowColor: "#1B3D2F",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  raised: {
    shadowColor: "#0F241C",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 6,
  },
  float: {
    shadowColor: "#0F241C",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 26,
    elevation: 10,
  },
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
