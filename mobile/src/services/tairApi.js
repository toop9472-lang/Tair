// طير — Bird marketplace API client
import api from "./api";

// Small helper — always returns parsed JSON or throws.
const req = async (path, opts = {}) => {
  const response = await api.fetch(path, opts);
  if (!response) {
    throw new Error("NO_RESPONSE");
  }
  // Some helpers return a stub Response for offline/HTML fallback — always try JSON.
  const contentType = response.headers?.get?.("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");
  let data = null;
  try {
    data = isJson ? await response.json() : await response.json().catch(() => null);
  } catch (_) {
    data = null;
  }
  if (!response.ok) {
    const err = new Error(data?.detail || `HTTP ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
};

// ==================== Species ====================
export const speciesApi = {
  list: (category, family) => {
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (family) qs.set("family", family);
    const s = qs.toString();
    return req(`/api/species/list${s ? `?${s}` : ""}`);
  },
  get: (id) => req(`/api/species/${id}`),
  families: () => req(`/api/species/families`),
};

// ==================== Listings ====================
export const listingsApi = {
  feed: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
    ).toString();
    return req(`/api/listings/feed${qs ? `?${qs}` : ""}`);
  },

  create: (userId, payload) =>
    req(`/api/listings/create?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  get: (id, viewerId) =>
    req(
      `/api/listings/${id}${
        viewerId ? `?viewer_id=${encodeURIComponent(viewerId)}` : ""
      }`,
    ),

  update: (id, userId, payload) =>
    req(`/api/listings/${id}?user_id=${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  remove: (id, userId) =>
    req(`/api/listings/${id}?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    }),

  bySeller: (sellerId, includeAll = false) =>
    req(`/api/listings/seller/${sellerId}?include_all=${includeAll}`),

  toggleFavorite: (id, userId) =>
    req(`/api/listings/${id}/favorite?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
    }),

  myFavorites: (userId) =>
    req(`/api/listings/favorites/me?user_id=${encodeURIComponent(userId)}`),

  delete: (id, userId) =>
    req(`/api/listings/${id}?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    }),
};

// ==================== Trips ====================
export const tripsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
    ).toString();
    return req(`/api/trips/list${qs ? `?${qs}` : ""}`);
  },
  create: (userId, payload) =>
    req(`/api/trips/create?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id, userId, payload) =>
    req(`/api/trips/${id}?user_id=${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  get: (id) => req(`/api/trips/${id}`),
  byCarrier: (carrierId, includeCompleted = false) =>
    req(`/api/trips/carrier/${carrierId}?include_completed=${includeCompleted}`),
  book: (id, userId) =>
    req(`/api/trips/${id}/book?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
    }),
  updateStatus: (id, userId, status, note, extra = {}) =>
    req(`/api/trips/${id}/status?user_id=${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status, note, motion: extra.motion, stop_index: extra.stop_index }),
    }),
  shareLocation: (id, userId, lat, lng) =>
    req(`/api/trips/${id}/location?user_id=${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({ lat, lng }),
    }),
  cancel: (id, userId) =>
    req(`/api/trips/${id}?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    }),
  listRequests: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
    ).toString();
    return req(`/api/trips/requests${qs ? `?${qs}` : ""}`);
  },
  createRequest: (userId, payload) =>
    req(`/api/trips/requests?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateRequestStatus: (id, userId, status, note) =>
    req(`/api/trips/requests/${id}/status?user_id=${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status, note: note || null }),
    }),
};

// ==================== Orders ====================
export const ordersApi = {
  create: (userId, payload) =>
    req(`/api/orders/create?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  get: (id, userId) =>
    req(`/api/orders/${id}?user_id=${encodeURIComponent(userId)}`),
  byUser: (userId, role = "all", status) => {
    const qs = new URLSearchParams({ role });
    if (status) qs.set("status", status);
    return req(`/api/orders/user/${userId}?${qs.toString()}`);
  },
  acceptCarrier: (id, userId) =>
    req(
      `/api/orders/${id}/accept-carrier?user_id=${encodeURIComponent(userId)}`,
      { method: "POST" },
    ),
  startTransit: (id, userId) =>
    req(
      `/api/orders/${id}/start-transit?user_id=${encodeURIComponent(userId)}`,
      { method: "POST" },
    ),
  markDelivered: (id, userId) =>
    req(
      `/api/orders/${id}/mark-delivered?user_id=${encodeURIComponent(userId)}`,
      { method: "POST" },
    ),
  complete: (id, userId) =>
    req(`/api/orders/${id}/complete?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
    }),
  cancel: (id, userId, note) =>
    req(
      `/api/orders/${id}/cancel?user_id=${encodeURIComponent(userId)}${
        note ? `&note=${encodeURIComponent(note)}` : ""
      }`,
      { method: "POST" },
    ),
  dispute: (id, userId, reason, details) =>
    req(
      `/api/orders/${id}/dispute?user_id=${encodeURIComponent(
        userId,
      )}&reason=${encodeURIComponent(reason)}${
        details ? `&details=${encodeURIComponent(details)}` : ""
      }`,
      { method: "POST" },
    ),
};

// ==================== Ratings ====================
export const ratingsApi = {
  create: (userId, payload) =>
    req(`/api/ratings/create?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  forUser: (userId, role) =>
    req(`/api/ratings/user/${userId}${role ? `?role=${role}` : ""}`),
};

// ==================== Reports ====================
export const tairReportsApi = {
  create: (userId, payload) =>
    req(`/api/tair-reports/create?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ==================== Storefront (comprehensive merchant customization) ====================
export const storefrontApi = {
  getSettings: (userId) => req(`/api/storefront/settings?user_id=${encodeURIComponent(userId)}`),
  updateSettings: (userId, payload) =>
    req(`/api/storefront/settings?user_id=${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  uploadMedia: async (userId, kind, fileUri) => {
    const { default: api } = await import("./api");
    const filename = (fileUri || "").split("/").pop() || `${kind}-${Date.now()}.jpg`;
    const formData = new FormData();
    formData.append("file", { uri: fileUri, name: filename, type: "image/jpeg" });
    const resp = await api.fetch(
      `/api/storefront/upload-media?user_id=${encodeURIComponent(userId)}&kind=${kind}`,
      { method: "POST", body: formData, headers: { Accept: "application/json" } },
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  },
  createFlashSale: (userId, payload) =>
    req(`/api/storefront/flash-sales?user_id=${encodeURIComponent(userId)}`, {
      method: "POST", body: JSON.stringify(payload),
    }),
  deleteFlashSale: (userId, saleId) =>
    req(`/api/storefront/flash-sales/${saleId}?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    }),
  createCoupon: (userId, payload) =>
    req(`/api/storefront/coupons?user_id=${encodeURIComponent(userId)}`, {
      method: "POST", body: JSON.stringify(payload),
    }),
  setCouponActive: (userId, code, active) =>
    req(`/api/storefront/coupons/${encodeURIComponent(code)}?user_id=${encodeURIComponent(userId)}`, {
      method: "PATCH", body: JSON.stringify({ active }),
    }),
  deleteCoupon: (userId, code) =>
    req(`/api/storefront/coupons/${encodeURIComponent(code)}?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    }),
  updateInventory: (userId, payload) =>
    req(`/api/storefront/inventory?user_id=${encodeURIComponent(userId)}`, {
      method: "POST", body: JSON.stringify(payload),
    }),
  analytics: (userId, days = 30) =>
    req(`/api/storefront/analytics?user_id=${encodeURIComponent(userId)}&days=${days}`),
  trackVisit: (sellerId, visitorId, city = "") =>
    req(`/api/storefront/analytics/visit?seller_id=${encodeURIComponent(sellerId)}&visitor_id=${encodeURIComponent(visitorId || "")}&city=${encodeURIComponent(city)}`, {
      method: "POST",
    }).catch(() => null),
  registerPushToken: (userId, token, platform = "ios") =>
    req(`/api/storefront/push-token?user_id=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}&platform=${platform}`, {
      method: "POST",
    }),
};

export const priceAlertsApi = {
  create: (payload) =>
    req(`/api/storefront/price-alerts`, {
      method: "POST", body: JSON.stringify(payload),
    }),
  list: (userId) =>
    req(`/api/storefront/price-alerts?user_id=${encodeURIComponent(userId)}`),
  delete: (alertId) =>
    req(`/api/storefront/price-alerts/${alertId}`, { method: "DELETE" }),
};

// ==================== Profile ====================
export const profileApi = {
  getPublic: (userId) => req(`/api/users/${encodeURIComponent(userId)}/public`),
  update: (userId, payload) =>
    req(`/api/phone/update-profile?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  uploadAvatar: async (userId, fileUri) => {
    const { default: api } = await import("./api");
    const filename = (fileUri || "").split("/").pop() || `avatar-${Date.now()}.jpg`;
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: filename,
      type: "image/jpeg",
    });
    const response = await api.fetch(`/api/users/upload-avatar?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
  uploadProfileBg: async (userId, fileUri) => {
    const { default: api } = await import("./api");
    const filename = (fileUri || "").split("/").pop() || `bg-${Date.now()}.jpg`;
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: filename,
      type: "image/jpeg",
    });
    const response = await api.fetch(`/api/users/upload-profile-bg?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
};

// ==================== Forum ====================
export const forumApi = {
  categories: () => req(`/api/forum/categories`),
  stats: () => req(`/api/forum/stats`),
  feed: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
    ).toString();
    return req(`/api/forum/feed${qs ? `?${qs}` : ""}`);
  },
  create: (payload, userId) =>
    req(`/api/forum/create?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getPost: (postId, viewerId) =>
    req(
      `/api/forum/post/${postId}${
        viewerId ? `?viewer_id=${encodeURIComponent(viewerId)}` : ""
      }`,
    ),
  listReplies: (postId) => req(`/api/forum/post/${postId}/replies`),
  reply: (postId, payload, userId) =>
    req(`/api/forum/post/${postId}/reply?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  like: (postId, userId) =>
    req(`/api/forum/post/${postId}/like?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
    }),
  deletePost: (postId, userId) =>
    req(`/api/forum/post/${postId}?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    }),
  deleteReply: (replyId, userId) =>
    req(`/api/forum/reply/${replyId}?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    }),
};

export const communityApi = {
  stories: async () => req("/api/community/stories/list"),
  createStory: async (payload, userId) =>
    req(`/api/community/stories/create?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    }),
  pride: async () => req("/api/community/pride/list"),
  viewStory: async (storyId, userId) =>
    req(`/api/community/stories/${storyId}/view?user_id=${encodeURIComponent(userId)}`, { method: "POST" }),
};

export const clinicApi = {
  settings: async () => req("/api/clinic/settings"),
  updateSettings: async (enabled, userId) =>
    req(`/api/clinic/settings?user_id=${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
      headers: { "Content-Type": "application/json" },
    }),
  messages: async (userId, limit = 100) =>
    req(`/api/clinic/messages?user_id=${encodeURIComponent(userId)}&limit=${limit}`),
  send: async (payload, userId) =>
    req(`/api/clinic/send?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    }),
  deleteMsg: async (msgId, userId) =>
    req(`/api/clinic/messages/${msgId}?user_id=${encodeURIComponent(userId)}`, { method: "DELETE" }),
  ban: async (targetUserId, userId) =>
    req(`/api/clinic/ban?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify({ user_id: targetUserId }),
      headers: { "Content-Type": "application/json" },
    }),
  unban: async (targetUserId, userId) =>
    req(`/api/clinic/ban/${targetUserId}?user_id=${encodeURIComponent(userId)}`, { method: "DELETE" }),
};

export const adminExtApi = {
  fullStats: async (userId) => req(`/api/admin/stats/full?user_id=${encodeURIComponent(userId)}`),
  broadcast: async (payload, userId) =>
    req(`/api/admin/broadcast?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    }),
  verificationList: async (userId, status = "pending") =>
    req(`/api/admin/verification/list?user_id=${encodeURIComponent(userId)}&status=${status}`),
  verificationRequest: async (payload, userId) =>
    req(`/api/admin/verification/request?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    }),
  verificationApprove: async (id, userId) =>
    req(`/api/admin/verification/${id}/approve?user_id=${encodeURIComponent(userId)}`, { method: "POST" }),
  verificationReject: async (id, userId, reason = "") =>
    req(`/api/admin/verification/${id}/reject?user_id=${encodeURIComponent(userId)}&reason=${encodeURIComponent(reason)}`, { method: "POST" }),
  moderatorsList: async (userId) => req(`/api/admin/moderators/list?user_id=${encodeURIComponent(userId)}`),
  moderatorsAssign: async (targetUserId, scopes, userId) =>
    req(`/api/admin/moderators/assign?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify({ user_id: targetUserId, scopes }),
      headers: { "Content-Type": "application/json" },
    }),
  moderatorsRevoke: async (targetUserId, userId) =>
    req(`/api/admin/moderators/${targetUserId}?user_id=${encodeURIComponent(userId)}`, { method: "DELETE" }),
  myScopes: async (userId) => req(`/api/admin/moderators/my-scopes?user_id=${encodeURIComponent(userId)}`),
  publishUpdate: async (payload) =>
    req(`/api/admin/app-update`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    }),
  latestUpdate: async () => req(`/api/app/latest-update`),
  clinicBotStatus: async () => req(`/api/clinic/bot/status`),
  clinicBotToggle: async (enabled, userId) =>
    req(`/api/clinic/bot/toggle?enabled=${enabled ? "true" : "false"}&user_id=${encodeURIComponent(userId)}`, { method: "POST" }),
  // Scope-based user bans
  scopeBanCreate: async (targetUserId, scope, reason, userId) =>
    req(`/api/admin/scope-bans/create?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify({ user_id: targetUserId, scope, reason: reason || "" }),
      headers: { "Content-Type": "application/json" },
    }),
  scopeBanRemove: async (targetUserId, scope, userId) =>
    req(`/api/admin/scope-bans/remove?user_id=${encodeURIComponent(userId)}&target_user_id=${encodeURIComponent(targetUserId)}&scope=${scope}`, { method: "DELETE" }),
  scopeBansList: async (scope, userId) =>
    req(`/api/admin/scope-bans/list?user_id=${encodeURIComponent(userId)}&scope=${scope}`),
  scopeBanCheck: async (targetUserId, scope) =>
    req(`/api/admin/scope-bans/check?target_user_id=${encodeURIComponent(targetUserId)}&scope=${scope}`),
};

export const storiesApi = {
  like: async (storyId, userId) =>
    req(`/api/community/stories/${storyId}/like?user_id=${encodeURIComponent(userId)}`, { method: "POST" }),
  listComments: async (storyId) => req(`/api/community/stories/${storyId}/comments`),
  addComment: async (storyId, text, userId) =>
    req(`/api/community/stories/${storyId}/comments?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify({ text }),
      headers: { "Content-Type": "application/json" },
    }),
  deleteComment: async (commentId, userId) =>
    req(`/api/community/stories/comments/${commentId}?user_id=${encodeURIComponent(userId)}`, { method: "DELETE" }),
  topToday: async () => req(`/api/community/stories/top-today`),
};

export const sellerRatingsApi = {
  rate: async (sellerId, stars, comment, userId) =>
    req(`/api/ratings/seller/rate?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify({ rated_id: sellerId, stars, comment: comment || "" }),
      headers: { "Content-Type": "application/json" },
    }),
  summary: async (sellerId) => req(`/api/ratings/seller/${sellerId}/summary`),
};

export const tairNotificationsApi = {
  list: async (userId, limit = 50) =>
    req(`/api/tair-notifications/list?user_id=${encodeURIComponent(userId)}&limit=${limit}`),
  markRead: async (notifId, userId) =>
    req(`/api/tair-notifications/${encodeURIComponent(notifId)}/read?user_id=${encodeURIComponent(userId)}`, { method: "POST" }),
  readAll: async (userId) =>
    req(`/api/tair-notifications/read-all?user_id=${encodeURIComponent(userId)}`, { method: "POST" }),
};

export const listingWatchApi = {
  list: async (userId) =>
    req(`/api/listing-watches?user_id=${encodeURIComponent(userId)}`),
  create: async (userId, payload) =>
    req(`/api/listing-watches?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    }),
  update: async (userId, watchId, payload) =>
    req(`/api/listing-watches/${encodeURIComponent(watchId)}?user_id=${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    }),
  remove: async (userId, watchId) =>
    req(`/api/listing-watches/${encodeURIComponent(watchId)}?user_id=${encodeURIComponent(userId)}`, { method: "DELETE" }),
};

export const clinicTopicsApi = {
  list: async (limit = 30, skip = 0) => req(`/api/clinic/topics?limit=${limit}&skip=${skip}`),
  get: async (id) => req(`/api/clinic/topics/${id}`),
  create: async (payload, uid) =>
    req(`/api/clinic/topics?user_id=${encodeURIComponent(uid)}`, {
      method: "POST", body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    }),
  delete: async (id, uid) =>
    req(`/api/clinic/topics/${id}?user_id=${encodeURIComponent(uid)}`, { method: "DELETE" }),
  listReplies: async (id) => req(`/api/clinic/topics/${id}/replies`),
  addReply: async (id, payload, uid) =>
    req(`/api/clinic/topics/${id}/replies?user_id=${encodeURIComponent(uid)}`, {
      method: "POST", body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    }),
  deleteReply: async (replyId, uid) =>
    req(`/api/clinic/replies/${replyId}?user_id=${encodeURIComponent(uid)}`, { method: "DELETE" }),
  aiAssist: async (topicId, uid) =>
    req(`/api/clinic/ai/assist/${topicId}?user_id=${encodeURIComponent(uid)}`, { method: "POST" }),
};

export const clinicLibraryApi = {
  list: async (q = "") => req(`/api/clinic/library${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  add: async (payload, uid) =>
    req(`/api/clinic/library?user_id=${encodeURIComponent(uid)}`, {
      method: "POST", body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    }),
  delete: async (id, uid) =>
    req(`/api/clinic/library/${id}?user_id=${encodeURIComponent(uid)}`, { method: "DELETE" }),
};

export const communityChatApi = {
  list: async (limit = 80) => req(`/api/community/chat?limit=${limit}`),
  send: async (text, uid) =>
    req(`/api/community/chat?user_id=${encodeURIComponent(uid)}`, {
      method: "POST", body: JSON.stringify({ text }),
      headers: { "Content-Type": "application/json" },
    }),
  delete: async (msgId, uid) =>
    req(`/api/community/chat/${msgId}?user_id=${encodeURIComponent(uid)}`, { method: "DELETE" }),
};

export const auctionsApi = {
  window: async () => req("/api/auctions/window-status"),
  oathStatus: async (userId) => req(`/api/auctions/oath/status?user_id=${encodeURIComponent(userId)}`),
  oathAccept: async (userId) => req(`/api/auctions/oath/accept?user_id=${encodeURIComponent(userId)}`, { method: "POST" }),
  list: async () => req("/api/auctions/list"),
  get: async (id) => req(`/api/auctions/${id}`),
  settings: async () => req("/api/auctions/settings"),
  updateSettings: async (payload, userId) =>
    req(`/api/auctions/settings?user_id=${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    }),
  submit: async (payload, userId) =>
    req(`/api/auctions/submit?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    }),
  pending: async (userId) => req(`/api/auctions/pending?user_id=${encodeURIComponent(userId)}`),
  approve: async (id, userId) =>
    req(`/api/auctions/${id}/approve?user_id=${encodeURIComponent(userId)}`, { method: "POST" }),
  reject: async (id, userId, reason = "") =>
    req(`/api/auctions/${id}/reject?user_id=${encodeURIComponent(userId)}&reason=${encodeURIComponent(reason)}`, { method: "POST" }),
  create: async (payload, userId) =>
    req(`/api/auctions/create?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    }),
  bid: async (id, amount, userId) =>
    req(`/api/auctions/${id}/bid?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      body: JSON.stringify({ amount_sar: amount }),
      headers: { "Content-Type": "application/json" },
    }),
};

export default {
  species: speciesApi,
  listings: listingsApi,
  trips: tripsApi,
  orders: ordersApi,
  ratings: ratingsApi,
  reports: tairReportsApi,
  forum: forumApi,
  community: communityApi,
  auctions: auctionsApi,
  clinic: clinicApi,
  adminExt: adminExtApi,
  stories: storiesApi,
  sellerRatings: sellerRatingsApi,
  clinicTopics: clinicTopicsApi,
  clinicLibrary: clinicLibraryApi,
  communityChat: communityChatApi,
};
