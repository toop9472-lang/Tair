// طير — Google Analytics 4 wrapper
// Tracks pageviews + key user events for post-launch decisions.
import ReactGA from "react-ga4";

const GA_ID = process.env.REACT_APP_GA_MEASUREMENT_ID;
let inited = false;

export function initGA() {
  if (inited || !GA_ID) return;
  try {
    ReactGA.initialize(GA_ID, {
      // Anonymize IP for KSA PDPL compliance
      gtagOptions: { anonymize_ip: true },
    });
    inited = true;
    // Send initial pageview
    trackPageview(window.location.pathname + window.location.search);
  } catch (e) {
    /* silent */
  }
}

export function trackPageview(path) {
  if (!inited) return;
  try {
    ReactGA.send({ hitType: "pageview", page: path });
  } catch (e) { /* silent */ }
}

export function trackEvent(name, params = {}) {
  if (!inited) return;
  try {
    ReactGA.event(name, params);
  } catch (e) { /* silent */ }
}

// ── Named events — call these instead of raw trackEvent for consistency ──
export const AnalyticsEvents = {
  signup: (method = "email") => trackEvent("sign_up", { method }),
  login: (method = "email") => trackEvent("login", { method }),
  guestEntry: () => trackEvent("guest_entry"),
  listingCreated: (family) => trackEvent("listing_created", { family }),
  listingViewed: (listingId, family) => trackEvent("listing_viewed", { listing_id: listingId, family }),
  listingDeleted: () => trackEvent("listing_deleted"),
  chatStarted: () => trackEvent("chat_started"),
  tripCreated: (fromCity, toCity) => trackEvent("trip_created", { from_city: fromCity, to_city: toCity }),
  tripDeleted: () => trackEvent("trip_deleted"),
  orderCreated: () => trackEvent("order_created"),
  orderStatusChanged: (status) => trackEvent("order_status_changed", { status }),
  reportSubmitted: (type) => trackEvent("report_submitted", { type }),
  shareListing: (channel) => trackEvent("share_listing", { channel }), // native | whatsapp | copy
  kycSubmitted: (role) => trackEvent("kyc_submitted", { role }),
  pushEnabled: () => trackEvent("push_notifications_enabled"),
  wholesaleBannerClick: () => trackEvent("wholesale_banner_click"),
};
