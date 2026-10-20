// طير — Tair API client (backend base uses /api prefix via REACT_APP_BACKEND_URL)
import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;

const client = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,
});

// Inject JWT on every request — reads from localStorage.
// Priority: user_token → admin_token (admin can also act as user).
client.interceptors.request.use((config) => {
  try {
    const token =
      (typeof localStorage !== "undefined" && (localStorage.getItem("user_token") || localStorage.getItem("admin_token"))) ||
      null;
    if (token) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch (e) {
    // localStorage may be unavailable (SSR/incognito) — request proceeds unauthenticated.
  }
  return config;
});

export const tairApi = {
  // Species catalog
  listSpecies: async (category, family) => {
    const { data } = await client.get("/species/list", { params: { category, family } });
    return data.items || [];
  },
  listFamilies: async () => {
    const { data } = await client.get("/species/families");
    return data.items || [];
  },

  // Listings
  feedListings: async (params = {}) => {
    const { data } = await client.get("/listings/feed", { params });
    return data;
  },
  getListing: async (id, viewerId) => {
    const { data } = await client.get(`/listings/${id}`, {
      params: { viewer_id: viewerId },
    });
    return data;
  },
  createListing: async (payload, userId) => {
    const { data } = await client.post("/listings/create", payload, {
      params: { user_id: userId },
    });
    return data;
  },
  deleteListing: async (listingId, userId) => {
    const { data } = await client.delete(`/listings/${listingId}`, {
      params: { user_id: userId },
    });
    return data;
  },
  listingsBySeller: async (sellerId, includeAll = false) => {
    const { data } = await client.get(`/listings/seller/${sellerId}`, {
      params: { include_all: includeAll },
    });
    return data.items || [];
  },
  toggleFavorite: async (listingId, userId) => {
    const { data } = await client.post(
      `/listings/${listingId}/favorite`,
      null,
      { params: { user_id: userId } },
    );
    return data;
  },
  myFavorites: async (userId) => {
    const { data } = await client.get("/listings/favorites/me", {
      params: { user_id: userId },
    });
    return data.items || [];
  },
  uploadImage: async (file, userId) => {
    const form = new FormData();
    form.append("file", file);
    form.append("user_id", userId);
    const { data } = await client.post("/listings/upload-image", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.url;
  },
  uploadVideo: async (file, userId) => {
    const form = new FormData();
    form.append("file", file);
    form.append("user_id", userId);
    const { data } = await client.post("/listings/upload-video", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.url;
  },

  // Trips
  listTrips: async (params = {}) => {
    const { data } = await client.get("/trips/list", { params });
    return data;
  },
  getTrip: async (tripId) => {
    const { data } = await client.get(`/trips/${tripId}`);
    return data;
  },
  createTrip: async (payload, userId) => {
    const { data } = await client.post("/trips/create", payload, {
      params: { user_id: userId },
    });
    return data;
  },
  deleteTrip: async (tripId, userId) => {
    const { data } = await client.delete(`/trips/${tripId}`, {
      params: { user_id: userId },
    });
    return data;
  },
  tripsByCarrier: async (carrierId, includeCompleted = false) => {
    const { data } = await client.get(`/trips/carrier/${carrierId}`, {
      params: { include_completed: includeCompleted },
    });
    return data.items || [];
  },
  updateTripStatus: async (tripId, status, note, userId) => {
    const { data } = await client.patch(
      `/trips/${tripId}/status`,
      { status, note },
      { params: { user_id: userId } },
    );
    return data;
  },

  // Orders
  createOrder: async (payload, userId) => {
    const { data } = await client.post("/orders/create", payload, {
      params: { user_id: userId },
    });
    return data;
  },
  getOrder: async (orderId, userId) => {
    const { data } = await client.get(`/orders/${orderId}`, {
      params: { user_id: userId },
    });
    return data;
  },
  ordersByUser: async (userId, role = "all", status) => {
    const { data } = await client.get(`/orders/user/${userId}`, {
      params: { role, status },
    });
    return data.items || [];
  },
  orderAction: async (orderId, action, userId, extra = {}) => {
    const { data } = await client.post(`/orders/${orderId}/${action}`, null, {
      params: { user_id: userId, ...extra },
    });
    return data;
  },

  // Ratings
  createRating: async (payload, userId) => {
    const { data } = await client.post("/ratings/create", payload, {
      params: { user_id: userId },
    });
    return data;
  },
  ratingsForUser: async (userId, role) => {
    const { data } = await client.get(`/ratings/user/${userId}`, {
      params: { role },
    });
    return data.items || [];
  },

  // Reports
  reportListing: async (listingId, reason, note, userId) => {
    const { data } = await client.post(
      "/tair-reports/create",
      { target_type: "listing", target_id: listingId, reason, note },
      { params: { user_id: userId } },
    );
    return data;
  },

  // Forum
  forumCategories: async () => {
    const { data } = await client.get("/forum/categories");
    return data.items || [];
  },
  forumStats: async () => {
    const { data } = await client.get("/forum/stats");
    return data.items || [];
  },
  forumFeed: async (params = {}) => {
    const { data } = await client.get("/forum/feed", { params });
    return data;
  },
  forumCreatePost: async (payload, userId) => {
    const { data } = await client.post("/forum/create", payload, {
      params: { user_id: userId },
    });
    return data;
  },
  forumGetPost: async (postId, viewerId) => {
    const { data } = await client.get(`/forum/post/${postId}`, {
      params: { viewer_id: viewerId },
    });
    return data;
  },
  forumListReplies: async (postId) => {
    const { data } = await client.get(`/forum/post/${postId}/replies`);
    return data.items || [];
  },
  forumReply: async (postId, body, userId, authorName) => {
    const { data } = await client.post(
      `/forum/post/${postId}/reply`,
      { body, author_name: authorName },
      { params: { user_id: userId } },
    );
    return data;
  },
  forumToggleLike: async (postId, userId) => {
    const { data } = await client.post(`/forum/post/${postId}/like`, null, {
      params: { user_id: userId },
    });
    return data;
  },

  // Listing comments
  listingComments: async (listingId) => {
    const { data } = await client.get(`/listings/${listingId}/comments`);
    return data.items || [];
  },
  addListingComment: async (listingId, body, userId, authorName) => {
    const { data } = await client.post(
      `/listings/${listingId}/comment`,
      { body, author_name: authorName },
      { params: { user_id: userId } },
    );
    return data;
  },
  toggleCommentLike: async (commentId, userId) => {
    const { data } = await client.post(
      `/listings/comment/${commentId}/like`,
      null,
      { params: { user_id: userId } },
    );
    return data;
  },

  // Chat / Direct Messages
  chatStart: async (payload, userId) => {
    const { data } = await client.post("/chat/start", payload, {
      params: { user_id: userId },
    });
    return data;
  },
  chatThreads: async (userId) => {
    const { data } = await client.get("/chat/threads", {
      params: { user_id: userId },
    });
    return data.items || [];
  },
  chatMessages: async (threadId, userId) => {
    const { data } = await client.get(`/chat/thread/${threadId}/messages`, {
      params: { user_id: userId },
    });
    return data.items || [];
  },
  chatSend: async (threadId, body, userId, senderName) => {
    const { data } = await client.post(
      `/chat/thread/${threadId}/message`,
      { body, sender_name: senderName },
      { params: { user_id: userId } },
    );
    return data;
  },
  chatMarkRead: async (threadId, userId) => {
    await client.post(`/chat/thread/${threadId}/read`, null, {
      params: { user_id: userId },
    });
  },
  chatUnreadCount: async (userId) => {
    const { data } = await client.get("/chat/unread-count", {
      params: { user_id: userId },
    });
    return data.count || 0;
  },

  // Notifications
  myNotifications: async (userId, limit = 50) => {
    const { data } = await client.get("/tair-notifications/list", {
      params: { user_id: userId, limit },
    });
    return data;
  },
  markNotifRead: async (notifId, userId) => {
    await client.post(`/tair-notifications/${notifId}/read`, null, {
      params: { user_id: userId },
    });
  },
  markAllNotifsRead: async (userId) => {
    await client.post("/tair-notifications/read-all", null, {
      params: { user_id: userId },
    });
  },

  // Auctions (المزاد)
  auctionsWindowStatus: async () => {
    const { data } = await client.get("/auctions/window-status");
    return data;
  },
  auctionsOathStatus: async (userId) => {
    const { data } = await client.get("/auctions/oath/status", { params: { user_id: userId } });
    return data;
  },
  auctionsOathAccept: async (userId) => {
    const { data } = await client.post("/auctions/oath/accept", null, { params: { user_id: userId } });
    return data;
  },
  auctionsList: async (status = "all") => {
    const { data } = await client.get("/auctions/list", { params: { status } });
    return data;
  },
  auctionCreate: async (payload, userId) => {
    const { data } = await client.post("/auctions/create", payload, { params: { user_id: userId } });
    return data;
  },
  auctionGet: async (id) => {
    const { data } = await client.get(`/auctions/${id}`);
    return data;
  },
  auctionBid: async (id, amount, userId) => {
    const { data } = await client.post(`/auctions/${id}/bid`, { amount_sar: amount }, { params: { user_id: userId } });
    return data;
  },
  auctionCancel: async (id, userId) => {
    const { data } = await client.delete(`/auctions/${id}`, { params: { user_id: userId } });
    return data;
  },

  // Community
  communityStories: async () => {
    const { data } = await client.get("/community/stories/list");
    return data;
  },
  communityCreateStory: async (payload, userId) => {
    const { data } = await client.post("/community/stories/create", payload, { params: { user_id: userId } });
    return data;
  },
  communityDeleteStory: async (id, userId) => {
    const { data } = await client.delete(`/community/stories/${id}`, { params: { user_id: userId } });
    return data;
  },
  communityPride: async () => {
    const { data } = await client.get("/community/pride/list");
    return data;
  },

  // KYC
  getKyc: async (userId) => {
    const { data } = await client.get("/kyc/me", { params: { user_id: userId } });
    return data;
  },
  submitKyc: async (payload, userId) => {
    const { data } = await client.post("/kyc/submit", payload, {
      params: { user_id: userId },
    });
    return data;
  },
  uploadKycDoc: async (file, userId, docType) => {
    const form = new FormData();
    form.append("file", file);
    form.append("user_id", userId);
    form.append("doc_type", docType);
    const { data } = await client.post("/kyc/upload-doc", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.url;
  },

  // Public profile / update
  getPublicProfile: async (userId) => {
    const { data } = await client.get(`/phone/profile/${userId}`);
    return data;
  },
  updateProfile: async (payload, userId) => {
    const { data } = await client.post("/phone/update-profile", payload, {
      params: { user_id: userId },
    });
    return data;
  },

  // Orders
  createOrder: async (payload, userId) => {
    const { data } = await client.post("/orders/create", payload, {
      params: { user_id: userId },
    });
    return data;
  },
  myOrders: async (userId) => {
    const { data } = await client.get(`/orders/user/${userId}`);
    return data.items || [];
  },
  orderAcceptCarrier: async (orderId, userId) => {
    const { data } = await client.post(`/orders/${orderId}/accept-carrier`, null, { params: { user_id: userId } });
    return data;
  },
  orderStartTransit: async (orderId, userId) => {
    const { data } = await client.post(`/orders/${orderId}/start-transit`, null, { params: { user_id: userId } });
    return data;
  },
  orderMarkDelivered: async (orderId, userId) => {
    const { data } = await client.post(`/orders/${orderId}/mark-delivered`, null, { params: { user_id: userId } });
    return data;
  },
  orderComplete: async (orderId, userId) => {
    const { data } = await client.post(`/orders/${orderId}/complete`, null, { params: { user_id: userId } });
    return data;
  },
  orderCancel: async (orderId, userId, reason) => {
    const { data } = await client.post(`/orders/${orderId}/cancel`, null, {
      params: { user_id: userId, reason: reason || "" },
    });
    return data;
  },
  orderDispute: async (orderId, userId, payload) => {
    const { data } = await client.post(`/orders/${orderId}/dispute`, payload, {
      params: { user_id: userId },
    });
    return data;
  },

  // Trip status
  updateTripStatus: async (tripId, status, userId) => {
    const { data } = await client.patch(`/trips/${tripId}/status`, { status }, {
      params: { user_id: userId },
    });
    return data;
  },

  // Follow / unfollow
  toggleFollow: async (sellerId, userId) => {
    const { data } = await client.post(`/phone/follow/${sellerId}`, null, {
      params: { user_id: userId },
    });
    return data;
  },
  followStatus: async (sellerId, userId) => {
    const { data } = await client.get(`/phone/follow-status/${sellerId}`, {
      params: { user_id: userId },
    });
    return data;
  },

  // Wholesale suppliers
  wholesaleCategories: async () => {
    const { data } = await client.get("/wholesale/categories");
    return data.items || [];
  },
  listWholesaleSuppliers: async (params = {}) => {
    const { data } = await client.get("/wholesale/suppliers", { params });
    return data.items || [];
  },
  getWholesaleSupplier: async (supplierId) => {
    const { data } = await client.get(`/wholesale/suppliers/${supplierId}`);
    return data;
  },
  getMySupplier: async () => {
    const { data } = await client.get("/wholesale/suppliers/mine");
    return data?.supplier || null;
  },
  registerSupplier: async (payload) => {
    const { data } = await client.post("/wholesale/suppliers", payload);
    return data;
  },
  updateMySupplier: async (payload) => {
    const { data } = await client.patch("/wholesale/suppliers/mine", payload);
    return data;
  },

  // Seller storefronts + analytics
  getSellerProfile: async (userId, viewerId) => {
    const params = viewerId ? { viewer_id: viewerId } : {};
    const { data } = await client.get(`/sellers/${userId}`, { params });
    return data;
  },
  getSellerListings: async (userId, limit = 50) => {
    const { data } = await client.get(`/sellers/${userId}/listings`, { params: { limit } });
    return data.items || [];
  },
  getSellerReviews: async (userId, limit = 30) => {
    const { data } = await client.get(`/sellers/${userId}/reviews`, { params: { limit } });
    return data.items || [];
  },
  getSellerAnalyticsOverview: async (userId, days = 30) => {
    const { data } = await client.get(`/sellers/${userId}/analytics/overview`, {
      params: { requester_id: userId, days },
    });
    return data;
  },
  getSellerAnalyticsListings: async (userId, limit = 50) => {
    const { data } = await client.get(`/sellers/${userId}/analytics/listings`, {
      params: { requester_id: userId, limit },
    });
    return data.items || [];
  },

  // AI bird identification
  identifyBirdFromBase64: async (imageBase64, mimeType = "image/jpeg") => {
    const { data } = await client.post("/ai/identify-bird-b64", {
      image_base64: imageBase64,
      mime_type: mimeType,
    });
    return data;
  },
};

export { SAUDI_CITIES, GULF_COUNTRIES, ALL_LOCATIONS, LOCATION_GROUPS } from "./locations";

export const ORDER_STATUS_LABEL = {
  pending: "بانتظار الموصّل",
  accepted_by_carrier: "قبل الموصّل",
  in_transit: "في الطريق",
  delivered: "تم التسليم",
  completed: "مكتمل",
  disputed: "نزاع",
  cancelled: "ملغى",
};

export const ORDER_STATUS_COLOR = {
  pending: "#f59e0b",
  accepted_by_carrier: "#0891b2",
  in_transit: "#3b82f6",
  delivered: "#10b981",
  completed: "#065f46",
  disputed: "#dc2626",
  cancelled: "#64748b",
};

export const TRIP_STATUS_LABEL = {
  scheduled: "مجدولة",
  departed: "انطلقت",
  in_transit: "في الطريق",
  arrived: "وصلت",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

export default tairApi;
