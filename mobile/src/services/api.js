// API Service - Lightweight API handler with enhanced security
// Production Server - Emergent Host
import NetInfo from "@react-native-community/netinfo";

// Production Server - Emergent Host (24/7, no sleep)
// This is the ONLY backend URL. Preview is NEVER used from mobile.
const DEFAULT_API_URL = "https://saqr-ui-sync.emergent.host";
const normalizeApiBaseUrl = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  // In case someone sets ".../api" directly in env vars.
  if (trimmed.endsWith("/api")) return trimmed.slice(0, -4);
  // HARD GUARD: If any preview URL leaks in via env/build, force production.
  if (trimmed.includes("preview.emergentagent.com")) {
    return "https://saqr-ui-sync.emergent.host";
  }
  return trimmed;
};

const envCandidates = [
  process.env.EXPO_PUBLIC_BACKEND_URL,
]
  .map(normalizeApiBaseUrl)
  .filter(Boolean);

const API_URL = envCandidates[0] || DEFAULT_API_URL;
export { API_URL };
// IMPORTANT: never introduce alternate backend URLs here. Any fallback that
// points to a different deployment reads/writes a different database and
// causes "data appears then disappears" bugs. If REACT_APP_BACKEND_URL is
// unreachable, we surface the error to the user rather than silently
// switching databases.
const API_BASE_CANDIDATES = Array.from(
  new Set([API_URL, ...envCandidates].filter(Boolean)),
);
let activeApiBase = API_BASE_CANDIDATES[0] || API_URL;
const isHtmlContentType = (contentType = "") =>
  contentType.toLowerCase().includes("text/html");
const isApiEndpoint = (endpoint = "") =>
  typeof endpoint === "string" &&
  (/^\/api\//.test(endpoint) || /^\/backend\/api\//.test(endpoint));
const buildServiceUnavailableResponse = (
  message = "تعذر الوصول لخدمة تسجيل الدخول. تحقق من الخادم.",
) =>
  new Response(JSON.stringify({ detail: message }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });

// Connection check timeout - increased for better reliability
const CONNECTION_TIMEOUT = 20000; // 20 seconds

// Token storage
let accessToken = null;
let refreshToken = null;

// Connection status cache - longer cache to avoid frequent checks
let lastConnectionCheck = null;
let lastConnectionResult = null;
const CONNECTION_CACHE_DURATION = 60000; // 60 seconds (increased from 30s)
const debugLog = (...args) => {
  if (__DEV__) console.log(...args);
};

// Check network connectivity first
const checkNetworkConnectivity = async () => {
  try {
    const netState = await NetInfo.fetch();
    return netState.isConnected && netState.isInternetReachable !== false;
  } catch (error) {
    debugLog("NetInfo check failed:", error);
    return true; // Assume connected if check fails
  }
};

// Check if API is reachable - Real implementation with better error handling
const checkConnection = async () => {
  // Check network first
  const hasNetwork = await checkNetworkConnectivity();
  if (!hasNetwork) {
    debugLog("No network connectivity");
    lastConnectionCheck = Date.now();
    lastConnectionResult = false;
    return false;
  }

  // Use cached result if recent
  const now = Date.now();
  if (
    lastConnectionCheck &&
    now - lastConnectionCheck < CONNECTION_CACHE_DURATION
  ) {
    debugLog("Using cached connection result:", lastConnectionResult);
    return lastConnectionResult;
  }

  try {
    const healthEndpoints = ["/api/health", "/health"];
    let connected = false;
    const baseCandidates = Array.from(
      new Set([activeApiBase, ...API_BASE_CANDIDATES].filter(Boolean)),
    );

    for (const baseUrl of baseCandidates) {
      for (const endpoint of healthEndpoints) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
        try {
          debugLog("Checking connection to:", `${baseUrl}${endpoint}`);
          const response = await fetch(`${baseUrl}${endpoint}`, {
            method: "GET",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
              "Cache-Control": "no-cache",
            },
          });

          const contentType = response.headers?.get?.("content-type") || "";
          if (response.ok && !isHtmlContentType(contentType)) {
            connected = true;
            activeApiBase = baseUrl;
            break;
          }
        } catch (_) {
          // Try next health endpoint/base
        } finally {
          clearTimeout(timeoutId);
        }
      }
      if (connected) break;
    }

    lastConnectionCheck = now;
    lastConnectionResult = connected;
    debugLog("Connection check result:", connected);
    return connected;
  } catch (error) {
    debugLog("Connection check failed:", error.message);

    // Don't cache failures immediately - allow retry
    if (lastConnectionResult === null) {
      lastConnectionCheck = now;
      lastConnectionResult = false;
    }

    return lastConnectionResult ?? false;
  }
};

// Force refresh connection status
const refreshConnectionStatus = () => {
  lastConnectionCheck = null;
  lastConnectionResult = null;
};

export const api = {
  baseUrl: activeApiBase,
  BASE_URL: activeApiBase,

  // Check connection
  async checkConnection() {
    const connected = await checkConnection();
    this.baseUrl = activeApiBase;
    this.BASE_URL = activeApiBase;
    return connected;
  },

  // Force refresh connection
  refreshConnection: refreshConnectionStatus,

  // Expose current/fallback API hosts for OAuth/web flows.
  getBaseCandidates() {
    return Array.from(
      new Set(
        [this.baseUrl, activeApiBase, ...API_BASE_CANDIDATES].filter(Boolean),
      ),
    );
  },

  getActiveBaseUrl() {
    return activeApiBase || this.baseUrl || API_URL;
  },

  async resolveApiBase() {
    try {
      await this.checkConnection();
    } catch (_) {
      // Keep last known reachable base.
    }
    return this.getActiveBaseUrl();
  },

  // Set tokens
  setTokens(access, refresh = null) {
    accessToken = access;
    if (refresh) refreshToken = refresh;
  },

  // Clear tokens (logout)
  clearTokens() {
    accessToken = null;
    refreshToken = null;
  },

  // Refresh access token
  async refreshAccessToken() {
    if (!refreshToken) return null;

    try {
      const baseCandidates = Array.from(
        new Set(
          [this.baseUrl, activeApiBase, ...API_BASE_CANDIDATES].filter(Boolean),
        ),
      );
      for (const baseUrl of baseCandidates) {
        try {
          const response = await fetch(`${baseUrl}/api/auth/refresh-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          if (!response.ok) continue;

          const data = await response.json();
          accessToken = data.token;
          activeApiBase = baseUrl;
          this.baseUrl = baseUrl;
          this.BASE_URL = baseUrl;
          return accessToken;
        } catch (_) {
          // Try next candidate base URL.
        }
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
    }
    return null;
  },

  // Generic fetch with error handling and auto token refresh
  async fetch(endpoint, options = {}) {
    const buildConnectionError = (error) => {
      if (error?.name === "AbortError") return new Error("CONNECTION_TIMEOUT");
      if (
        error?.message === "Network request failed" ||
        error?.message === "Failed to fetch"
      ) {
        return new Error("NO_CONNECTION");
      }
      return error;
    };

    try {
      const isFormData =
        typeof FormData !== "undefined" && options.body instanceof FormData;
      const headers = {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
      };
      // If caller supplied FormData but a stale Content-Type slipped in,
      // strip it so the platform can set the correct multipart boundary.
      if (isFormData) {
        delete headers["Content-Type"];
        delete headers["content-type"];
      }

      // Add access token if available
      if (accessToken && !headers.Authorization) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const doRequest = async (baseUrl) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          CONNECTION_TIMEOUT,
        );
        try {
          return await fetch(`${baseUrl}${endpoint}`, {
            ...options,
            headers,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
      };

      const baseCandidates = Array.from(
        new Set(
          [this.baseUrl, activeApiBase, ...API_BASE_CANDIDATES].filter(Boolean),
        ),
      );
      let response = null;
      let lastNetworkError = null;
      let lastNotFoundResponse = null;
      let lastHtmlApiResponse = null;

      for (const baseUrl of baseCandidates) {
        // Log the request in development only
        debugLog(`API Request: ${baseUrl}${endpoint}`);
        try {
          const candidateResponse = await doRequest(baseUrl);
          // If this base returns endpoint-not-found, try next base before failing auth/login flows.
          if ([404, 405].includes(candidateResponse.status)) {
            lastNotFoundResponse = candidateResponse;
            continue;
          }
          const candidateContentType =
            candidateResponse.headers?.get?.("content-type") || "";
          // Some fallback domains return SPA HTML with 200 for API paths.
          // Treat as invalid API target and continue probing other bases.
          if (
            isApiEndpoint(endpoint) &&
            candidateResponse.ok &&
            isHtmlContentType(candidateContentType)
          ) {
            lastHtmlApiResponse = candidateResponse;
            continue;
          }
          response = candidateResponse;
          activeApiBase = baseUrl;
          this.baseUrl = baseUrl;
          this.BASE_URL = baseUrl;
          break;
        } catch (initialError) {
          const normalizedError = buildConnectionError(initialError);
          if (
            ["NO_CONNECTION", "CONNECTION_TIMEOUT"].includes(
              normalizedError?.message,
            )
          ) {
            lastNetworkError = normalizedError;
            refreshConnectionStatus();
            await new Promise((resolve) => setTimeout(resolve, 250));
            continue;
          }
          throw normalizedError;
        }
      }

      if (!response) {
        if (lastHtmlApiResponse) {
          throw new Error("API_UNAVAILABLE");
        }
        if (lastNotFoundResponse) return lastNotFoundResponse;
        throw lastNetworkError || new Error("NO_CONNECTION");
      }

      // Log response status in development only
      debugLog(`API Response: ${response.status} for ${endpoint}`);

      // If token expired, try refresh
      if (response.status === 401 && refreshToken) {
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          headers.Authorization = `Bearer ${newToken}`;
          response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
          });
        }
      }

      return response;
    } catch (error) {
      // Log error for debugging
      console.error(`API Error for ${endpoint}:`, error.message);

      const normalizedError = buildConnectionError(error);
      if (
        normalizedError?.message === "CONNECTION_TIMEOUT" ||
        normalizedError?.message === "NO_CONNECTION"
      ) {
        throw normalizedError;
      }
      console.error("API Error:", error);
      throw error;
    }
  },

  // Try multiple API paths for backward compatibility
  async fetchWithFallback(endpoints, options = {}) {
    const candidates = Array.isArray(endpoints) ? endpoints : [endpoints];
    let lastResponse = null;
    let lastError = null;

    for (const endpoint of candidates) {
      try {
        const response = await this.fetch(endpoint, options);
        lastResponse = response;
        if (![404, 405].includes(response.status)) {
          return response;
        }
      } catch (error) {
        lastError = error;
        // Continue trying alternative endpoints for connectivity fluctuations.
        if (
          ["NO_CONNECTION", "CONNECTION_TIMEOUT", "API_UNAVAILABLE"].includes(
            error?.message,
          )
        ) {
          continue;
        }
        throw error;
      }
    }

    if (!lastResponse && lastError) {
      throw lastError;
    }
    return lastResponse;
  },

  // Auth
  async getAuthProvidersStatus() {
    return this.fetch("/api/auth/providers-status");
  },

  async login(email, password) {
    const response = await this.fetchWithFallback(
      ["/api/auth/signin", "/api/auth/login"],
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );

    // Clone response to read body without consuming it
    const clonedResponse = response.clone();

    if (response.ok) {
      const contentType = response.headers?.get?.("content-type") || "";
      if (isHtmlContentType(contentType)) {
        return buildServiceUnavailableResponse();
      }
      try {
        const data = await clonedResponse.json();
        if (!data?.token) {
          return buildServiceUnavailableResponse();
        }
        this.setTokens(data.token, data.refresh_token);
      } catch (e) {
        return buildServiceUnavailableResponse();
      }
    }

    return response;
  },

  async register(email, password, name) {
    const response = await this.fetchWithFallback(
      ["/api/auth/register", "/api/auth/signup"],
      {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      },
    );

    // Clone response to read body without consuming it
    const clonedResponse = response.clone();

    if (response.ok) {
      const contentType = response.headers?.get?.("content-type") || "";
      if (isHtmlContentType(contentType)) {
        return buildServiceUnavailableResponse(
          "تعذر الوصول لخدمة التسجيل. تحقق من الخادم.",
        );
      }
      try {
        const data = await clonedResponse.json();
        if (!data || typeof data !== "object") {
          return buildServiceUnavailableResponse(
            "تعذر الوصول لخدمة التسجيل. تحقق من الخادم.",
          );
        }
        if (data.token) {
          this.setTokens(data.token, data.refresh_token);
        }
      } catch (e) {
        return buildServiceUnavailableResponse(
          "تعذر الوصول لخدمة التسجيل. تحقق من الخادم.",
        );
      }
    }

    return response;
  },

  async logout() {
    this.clearTokens();
  },

  async deleteAccount(confirmationText, password = null) {
    return this.fetch("/api/auth/delete-account", {
      method: "POST",
      body: JSON.stringify({
        confirmation_text: confirmationText,
        password,
      }),
    });
  },

  // Get current user from server
  async getCurrentUser() {
    return this.fetch("/api/auth/me");
  },

  // Ads
  async getAds() {
    return this.fetch("/api/ads");
  },

  // Settings
  async getRewardsSettings() {
    return this.fetch("/api/settings/public/rewards");
  },

  // AI Chat (conversation-aware)
  async sendChatConversation(
    messages = [],
    token = null,
    systemMessage = null,
  ) {
    const safeMessages = Array.isArray(messages)
      ? messages
          .filter((item) => item?.content && item?.role)
          .map((item) => ({ role: item.role, content: item.content }))
      : [];

    const normalizedMessages =
      safeMessages.length > 0
        ? safeMessages
        : [{ role: "user", content: "مرحباً" }];

    const lastUserMessage =
      [...normalizedMessages].reverse().find((item) => item.role === "user")
        ?.content || "مرحباً";

    const endpoint =
      token || accessToken
        ? "/api/claude-ai/chat"
        : "/api/claude-ai/chat/guest";
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const primaryResponse = await this.fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: normalizedMessages,
        system_message:
          systemMessage ||
          "أنت مساعد صقر الذكي لتطبيق منصة صقر العربية (إعلانات AdMob + ريلز 15 ثانية + دردشة عامة). كل إعلان AdMob مكتمل = 5 جواهر، و 500 جوهرة = 3 ريال. كن احترافياً وواضحاً، وقدّم ردوداً قصيرة بالعربية الفصحى. تعامل مع التحية والشكر بأسلوب طبيعي ثم اقترح المساعدة المناسبة.",
      }),
    });

    // توافق خلفي مع المسار القديم في بعض بيئات الخادم
    if ([404, 405].includes(primaryResponse.status)) {
      return this.fetch("/api/claude/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: lastUserMessage,
          system_message:
            systemMessage ||
            "أنت مساعد صقر الذكي لتطبيق منصة صقر العربية (إعلانات AdMob + ريلز 15 ثانية + دردشة عامة). كل إعلان AdMob مكتمل = 5 جواهر، و 500 جوهرة = 3 ريال. كن احترافياً وواضحاً، وقدّم ردوداً قصيرة بالعربية الفصحى. تعامل مع التحية والشكر بأسلوب طبيعي ثم اقترح المساعدة المناسبة.",
        }),
      });
    }

    return primaryResponse;
  },

  async sendChatMessage(message, token = null, systemMessage = null) {
    return this.sendChatConversation(
      [{ role: "user", content: message }],
      token,
      systemMessage,
    );
  },

  // Record ad view
  async recordAdView(adId, watchDuration, token, pointsEarned = 0) {
    return this.fetch("/api/rewarded-ads/complete", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({
        ad_type: "video",
        ad_id: adId,
        completed: true,
        watch_duration: watchDuration,
        points_earned: pointsEarned,
      }),
    });
  },

  // Submit advertiser ad
  async submitAdvertiserAd(adData, token = null) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return this.fetch("/api/advertiser/create-ad", {
      method: "POST",
      headers,
      body: JSON.stringify(adData),
    });
  },

  // Get packages from server
  async getPackages() {
    return this.fetch("/api/payments/packages");
  },

  // Support tickets
  async getSupportTickets(token) {
    return this.fetch("/api/support/tickets", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  async createSupportTicket(payload, token) {
    return this.fetch("/api/support/tickets", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(payload),
    });
  },

  async getSupportTicket(ticketId, token) {
    return this.fetch(`/api/support/tickets/${ticketId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  async replySupportTicket(ticketId, message, token) {
    return this.fetch(`/api/support/tickets/${ticketId}/reply`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({ message }),
    });
  },

  async closeSupportTicket(ticketId, token) {
    return this.fetch(`/api/support/tickets/${ticketId}/close`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  // Advertiser
  async getAdvertiserAnalytics(advertiserEmail) {
    return this.fetch(
      `/api/analytics/advertiser/${encodeURIComponent(advertiserEmail)}`,
    );
  },

  async createAdvertiserAd(payload) {
    return this.fetch("/api/advertiser/ads", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ---- Premium features (Stories, Hashtags, Push, Creator Fund) ----
  async getStoriesFeed(viewerId) {
    const q = viewerId ? `?viewer_id=${encodeURIComponent(viewerId)}` : "";
    return this.fetch(`/api/stories/feed${q}`);
  },
  async createStory(payload) {
    return this.fetch("/api/stories/create", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async viewStory(storyId, viewerId) {
    return this.fetch(
      `/api/stories/${encodeURIComponent(storyId)}/view?viewer_id=${encodeURIComponent(viewerId || "")}`,
      { method: "POST" },
    );
  },
  async deleteStory(storyId, userId) {
    return this.fetch(
      `/api/stories/${encodeURIComponent(storyId)}?user_id=${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
  },
  async getTrendingHashtags(limit = 20) {
    return this.fetch(`/api/hashtags/trending?limit=${limit}`);
  },
  async getClipsByHashtag(tag, viewerId) {
    const q = viewerId ? `&viewer_id=${encodeURIComponent(viewerId)}` : "";
    return this.fetch(`/api/hashtags/${encodeURIComponent(tag)}/clips?limit=40${q}`);
  },
  async registerPushToken(userId, expoPushToken, platform = "ios") {
    return this.fetch("/api/push/register", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        expo_push_token: expoPushToken,
        platform,
      }),
    });
  },
  async getCreatorFundStatus(userId) {
    return this.fetch(`/api/creator-fund/me?user_id=${encodeURIComponent(userId)}`);
  },
  async getShareClip(clipId) {
    return this.fetch(`/api/share/clip/${encodeURIComponent(clipId)}`);
  },

  async boostAdvertiserAd(adId, payload = {}) {
    return this.fetch(`/api/advertiser/ads/${encodeURIComponent(adId)}/boost`, {
      method: "POST",
      body: JSON.stringify({ payment_method: 'manual', ...payload }),
    });
  },

  async uploadAdvertiserVideo(fileUri, thumbnailUri = null) {
    const formData = new FormData();
    const videoFilename =
      (fileUri || "").split("/").pop() || `advertiser-${Date.now()}.mp4`;
    formData.append("file", {
      uri: fileUri,
      name: videoFilename,
      type: "video/mp4",
    });
    if (thumbnailUri) {
      const thumbFilename =
        (thumbnailUri || "").split("/").pop() || `thumb-${Date.now()}.jpg`;
      formData.append("thumbnail", {
        uri: thumbnailUri,
        name: thumbFilename,
        type: "image/jpeg",
      });
    }

    const headers = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const baseCandidates = Array.from(
      new Set(
        [this.baseUrl, activeApiBase, ...API_BASE_CANDIDATES].filter(Boolean),
      ),
    );
    const endpointCandidates = [
      "/api/advertiser/upload-video",
      "/backend/api/advertiser/upload-video",
      "/advertiser/upload-video",
    ];
    let lastError = null;
    let lastResponse = null;
    let receivedHtmlInsteadOfApi = false;

    for (const baseUrl of baseCandidates) {
      for (const endpoint of endpointCandidates) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(),
            CONNECTION_TIMEOUT,
          );
          const response = await fetch(`${baseUrl}${endpoint}`, {
            method: "POST",
            headers,
            body: formData,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          const contentType = response.headers?.get?.("content-type") || "";
          if (response.ok && isHtmlContentType(contentType)) {
            // Misconfigured target serving SPA HTML instead of API JSON.
            receivedHtmlInsteadOfApi = true;
            continue;
          }
          if ([404, 405].includes(response.status)) {
            lastResponse = response;
            continue;
          }
          activeApiBase = baseUrl;
          this.baseUrl = baseUrl;
          this.BASE_URL = baseUrl;
          return response;
        } catch (error) {
          lastError = error;
        }
      }
    }

    if (lastError) throw lastError;
    if (receivedHtmlInsteadOfApi) {
      return new Response(
        JSON.stringify({ detail: "خدمة رفع الفيديو غير متاحة حالياً على الخادم." }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }
    if (lastResponse) return lastResponse;
    return new Response(
      JSON.stringify({ detail: "تعذر رفع فيديو الإعلان حالياً." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  },

  async createAdvertiserCheckout(packageId, adId, originUrl, advertiserEmail) {
    return this.fetch("/api/payments/checkout", {
      method: "POST",
      body: JSON.stringify({
        package_id: packageId,
        ad_id: adId,
        origin_url: originUrl,
        advertiser_email: advertiserEmail,
      }),
    });
  },

  // Check password strength
  async checkPasswordStrength(password) {
    return this.fetch("/api/auth/check-password-strength", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },

  // Change password
  async changePassword(data, token) {
    return this.fetch("/api/auth/change-password", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  },

  // Request withdrawal
  async requestWithdrawal(data, token) {
    return this.fetch("/api/withdrawals/request", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  },

  // Comments API
  async getComments(adId) {
    return this.fetch(`/api/comments/ad/${adId}`);
  },

  async createComment(adId, content, token) {
    return this.fetch("/api/comments/", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ad_id: adId, content }),
    });
  },

  async likeComment(commentId, token) {
    return this.fetch("/api/comments/like", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ comment_id: commentId }),
    });
  },

  // ==================== Clips (short videos/reels) ====================

  async getClips(limit = 30, viewerId = null) {
    const clipsBase = `/api/clips/feed?limit=${encodeURIComponent(limit)}`;
    const reelsBase = `/api/reels/feed?limit=${encodeURIComponent(limit)}`;
    const clipsWithViewer = viewerId
      ? `${clipsBase}&viewer_id=${encodeURIComponent(viewerId)}`
      : clipsBase;
    const reelsWithViewer = viewerId
      ? `${reelsBase}&viewer_id=${encodeURIComponent(viewerId)}`
      : reelsBase;
    return this.fetchWithFallback([clipsWithViewer, reelsWithViewer]);
  },

  async createClip(payload) {
    return this.fetch("/api/clips/create", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async uploadClipVideo(fileUri, userId) {
    const formData = new FormData();
    const filename = (fileUri || "").split("/").pop() || `clip-${Date.now()}.mp4`;
    formData.append("user_id", String(userId || ""));
    formData.append("file", {
      uri: fileUri,
      name: filename,
      type: "video/mp4",
    });

    const headers = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const preferredBaseCandidates = Array.from(
      new Set([activeApiBase, this.baseUrl, ...API_BASE_CANDIDATES].filter(Boolean)),
    );
    const apiHostCandidates = preferredBaseCandidates.filter(
      (baseUrl) => typeof baseUrl === "string" && /\/\//.test(baseUrl) && !/\/backend$/i.test(baseUrl),
    );
    const baseCandidates = apiHostCandidates.length
      ? apiHostCandidates
      : preferredBaseCandidates;
    const endpointCandidates = [
      "/api/clips/upload",
    ];
    let lastError = null;
    let lastResponse = null;
    let receivedHtmlInsteadOfApi = false;

    // Video uploads can take significantly longer than regular API calls.
    // Use a much larger timeout (3 minutes) to accommodate slower networks.
    const UPLOAD_TIMEOUT = 180000;

    for (const baseUrl of baseCandidates) {
      for (const endpoint of endpointCandidates) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(),
            UPLOAD_TIMEOUT,
          );
          console.log(`[uploadClipVideo] attempting ${baseUrl}${endpoint}`);
          const response = await fetch(`${baseUrl}${endpoint}`, {
            method: "POST",
            headers,
            body: formData,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          const contentType = response.headers?.get?.("content-type") || "";
          console.log(
            `[uploadClipVideo] ${baseUrl}${endpoint} status=${response.status} ct=${contentType}`,
          );
          if (response.ok && isHtmlContentType(contentType)) {
            // Misconfigured target serving SPA HTML instead of API JSON.
            receivedHtmlInsteadOfApi = true;
            continue;
          }
          if ([404, 405].includes(response.status)) {
            lastResponse = response;
            continue;
          }
          activeApiBase = baseUrl;
          this.baseUrl = baseUrl;
          this.BASE_URL = baseUrl;
          return response;
        } catch (error) {
          console.log(
            `[uploadClipVideo] error on ${baseUrl}: ${error?.name} ${error?.message}`,
          );
          lastError = error;
        }
      }
    }

    if (lastError) throw lastError;
    if (receivedHtmlInsteadOfApi) {
      return new Response(
        JSON.stringify({ detail: "خدمة رفع المقاطع غير متاحة حالياً على الخادم." }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }
    if (lastResponse) return lastResponse;
    return new Response(
      JSON.stringify({ detail: "تعذر رفع الفيديو حالياً." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  },

  async uploadClipThumbnail(fileUri, userId) {
    // Upload an extracted video first-frame as the clip's thumbnail.
    const formData = new FormData();
    const filename = (fileUri || "").split("/").pop() || `thumb-${Date.now()}.jpg`;
    formData.append("user_id", String(userId || ""));
    formData.append("file", {
      uri: fileUri,
      name: filename,
      type: "image/jpeg",
    });
    const headers = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const r = await fetch(`${this.baseUrl}/api/clips/upload-thumb`, {
        method: "POST",
        headers,
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!r.ok) return null;
      const d = await r.json().catch(() => null);
      return d?.thumbnail_url || null;
    } catch (e) {
      console.log("[uploadClipThumbnail] failed:", e?.message || e);
      return null;
    }
  },

  async toggleClipLike(clipId, userId) {
    return this.fetch("/api/clips/like", {
      method: "POST",
      body: JSON.stringify({ clip_id: clipId, user_id: userId }),
    });
  },

  async addClipComment(clipId, payload) {
    return this.fetch("/api/clips/comment", {
      method: "POST",
      body: JSON.stringify({ clip_id: clipId, ...(payload || {}) }),
    });
  },

  async toggleClipFollow(viewerUserId, targetUserId) {
    return this.fetch("/api/clips/follow/toggle", {
      method: "POST",
      body: JSON.stringify({
        viewer_user_id: viewerUserId,
        target_user_id: targetUserId,
      }),
    });
  },

  async getClipProfileStats(userId, viewerId = null) {
    const base = `/api/clips/profile-stats/${encodeURIComponent(userId)}`;
    const withViewer = viewerId
      ? `${base}?viewer_id=${encodeURIComponent(viewerId)}`
      : base;
    return this.fetch(withViewer);
  },

  // ==================== Phone Authentication ====================

  // Send OTP for registration
  async sendOTP(phone) {
    return this.fetch("/api/phone/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  },

  // Verify OTP
  async verifyOTP(phone, otp) {
    return this.fetch("/api/phone/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, otp }),
    });
  },

  // Register with phone
  async registerWithPhone(phone, otp, name, password) {
    const response = await this.fetch("/api/phone/register", {
      method: "POST",
      body: JSON.stringify({ phone, otp, name, password }),
    });
    const clonedResponse = response.clone();

    if (response.ok) {
      try {
        const data = await clonedResponse.json();
        this.setTokens(data.token, data.refresh_token);
      } catch (e) {
        debugLog("Token setting skipped for registerWithPhone");
      }
    }

    return response;
  },

  // Login with phone (Step 1 - sends OTP)
  async loginWithPhone(phone, password) {
    return this.fetch("/api/phone/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    });
  },

  // Verify login OTP (Step 2 - complete login)
  async verifyLoginOTP(phone, otp, sessionToken) {
    const response = await this.fetch("/api/phone/verify-login", {
      method: "POST",
      body: JSON.stringify({ phone, otp, session_token: sessionToken }),
    });
    const clonedResponse = response.clone();

    if (response.ok) {
      try {
        const data = await clonedResponse.json();
        this.setTokens(data.token, data.refresh_token);
      } catch (e) {
        debugLog("Token setting skipped for verifyLoginOTP");
      }
    }

    return response;
  },

  // Forgot password
  async forgotPassword(phone) {
    return this.fetch("/api/phone/forgot-password", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  },

  // Reset password
  async resetPassword(phone, otp, newPassword) {
    return this.fetch("/api/phone/reset-password", {
      method: "POST",
      body: JSON.stringify({ phone, otp, new_password: newPassword }),
    });
  },

  // Check if phone exists
  async checkPhone(phone) {
    return this.fetch(`/api/phone/check/${encodeURIComponent(phone)}`);
  },

  // ==================== Economy System ====================

  // Get user balance
  async getBalance(userId) {
    return this.fetch(`/api/economy/balance/${userId}`);
  },

  // Initialize user economy (on first login)
  async initializeUserEconomy(userId) {
    return this.fetch(`/api/economy/initialize-user/${userId}`, {
      method: "POST",
    });
  },

  // Admin login
  async adminLogin(email, password) {
    return this.fetch("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  // Add Saqr Gems (for ad rewards - exchangeable for cash)
  async addSaqrGems(userId, amount, source = "ad_reward") {
    return this.fetch(`/api/economy/add-saqr-gems`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, amount, source }),
    });
  },

  // ==================== Ad Watch Rewards ====================

  // Claim ad watch reward (fixed 5 Saqr gems)
  async claimAdWatchReward(userId, watchDurationSeconds, adType = "video") {
    return this.fetch("/api/economy/ad-watch-reward", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        watch_duration_seconds: watchDurationSeconds,
        ad_type: adType,
      }),
    });
  },

  // Get ad watching stats
  async getAdStats(userId) {
    return this.fetch(`/api/economy/ad-stats/${userId}`);
  },

  // Get daily AdMob challenge status (30 gems/day target)
  async getAdChallengeStatus(userId) {
    return this.fetch(`/api/economy/ad-challenge/${userId}`);
  },

};

export default api;
