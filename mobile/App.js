// طير — App root (Tair MVP)
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  I18nManager,
  Alert,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LanguageProvider } from "./src/i18n/LanguageContext";

import AuthScreen from "./src/screens/TairAuthScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import UserProfileScreen from "./src/screens/UserProfileScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import SupportScreen from "./src/screens/SupportScreen";
import PrivateMessagesScreen from "./src/screens/PrivateMessagesScreen";
import ClinicScreen from "./src/screens/ClinicScreen";
import ClinicLibraryScreen from "./src/screens/ClinicLibraryScreen";
import ClinicTopicCreateScreen from "./src/screens/ClinicTopicCreateScreen";
import ClinicTopicDetailsScreen from "./src/screens/ClinicTopicDetailsScreen";

import ListingsFeedScreen from "./src/screens/ListingsFeedScreen";
import MarketScreen from "./src/screens/MarketScreen";
import CreateListingScreen from "./src/screens/CreateListingScreen";
import ListingDetailsScreen from "./src/screens/ListingDetailsScreen";
import TripsScreen from "./src/screens/TripsScreen";
import TripDetailsScreen from "./src/screens/TripDetailsScreen";
import OrdersScreen from "./src/screens/OrdersScreen";

import TairBottomBar from "./src/components/TairBottomBar";
import MessagesFab from "./src/components/MessagesFab";
import LegalDisclaimerGate from "./src/components/LegalDisclaimerGate";
import SuccessStoriesScreen from "./src/screens/SuccessStoriesScreen";
import StoryViewerScreen from "./src/screens/StoryViewerScreen";
import AddStoryScreen from "./src/screens/AddStoryScreen";
import AuctionScreen from "./src/screens/AuctionScreen";
import SubmitAuctionScreen from "./src/screens/SubmitAuctionScreen";
import SellerStorefrontScreen from "./src/screens/SellerStorefrontScreen";
import SellerAnalyticsScreen from "./src/screens/SellerAnalyticsScreen";
import ForumScreen from "./src/screens/ForumScreen";
import CommunityScreen from "./src/screens/CommunityScreen";
import PrideScreen from "./src/screens/PrideScreen";
import AskExpertsScreen from "./src/screens/AskExpertsScreen";
import ForumPostScreen from "./src/screens/ForumPostScreen";
import ForumCategoryFeedScreen from "./src/screens/ForumCategoryFeedScreen";
import StorefrontManagerScreen from "./src/screens/StorefrontManagerScreen";
import AdminPanelScreen from "./src/screens/AdminPanelScreen";
import WholesaleScreen from "./src/screens/WholesaleScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import UpdateNoticeModal from "./src/components/UpdateNoticeModal";
import TairShareSheet from "./src/components/TairShareSheet";
import { parseIncomingLink } from "./src/services/shareContent";
import api from "./src/services/api";
import {
  installErrorReporter,
  setReporterUser,
  setReporterScreen,
} from "./src/services/errorReporter";
import {
  initPushNotifications,
  bindPushToUser,
  unregisterPushToken,
  onNotificationTap,
} from "./src/services/pushNotifications";

const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  "https://saqr-ui-sync.emergent.host";

// Install the JS error reporter as early as possible so we catch bootstrap crashes too.
try {
  installErrorReporter(API_URL);
} catch {}

// Force RTL for the whole app.
try {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
} catch {}

const TABS = ["listings", "trips", "messages", "forum", "account"];

function TairApp() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [seenOnboarding, setSeenOnboarding] = useState(false);
  const [currentPage, setCurrentPage] = useState("listings");
  // Modal stack (route + params)
  const [modal, setModal] = useState(null);

  // Boot: load token and user
  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem("tair_seen_onboarding");
        setSeenOnboarding(seen === "1");
        const savedUser = await AsyncStorage.getItem("saqr_user");
        const token = await AsyncStorage.getItem("saqr_token");
        const refreshTok = await AsyncStorage.getItem("saqr_refresh");
        // Hydrate in-memory tokens so api.fetch attaches Authorization header
        if (token) {
          try { api.setTokens(token, refreshTok || null); } catch {}
        }
        if (savedUser && token) {
          const parsed = JSON.parse(savedUser);
          setUser(parsed);
          try { setReporterUser(parsed?.user_id || parsed?.id); } catch {}
          // Register for native push (guest users are supported too)
          initPushNotifications({
            apiUrl: API_URL,
            userId: parsed?.user_id || parsed?.id || "guest",
          }).catch(() => {});
          // ---------------- SELF-HEAL ----------------
          // Silently refresh /me so we always pick up backend fixes
          // (e.g. corrected user_id for admins whose old cache had null).
          // If the fresh response has a real user_id and it differs from
          // the cached one, we overwrite the cache immediately.
          (async () => {
            try {
              const r = await api.fetch("/api/auth/me");
              if (r?.ok) {
                const j = await r.json().catch(() => null);
                const fresh = j?.user;
                if (fresh && (fresh.user_id || fresh.id)) {
                  const merged = { ...parsed, ...fresh };
                  setUser(merged);
                  await AsyncStorage.setItem("saqr_user", JSON.stringify(merged));
                }
              }
            } catch {}
          })();
        } else {
          initPushNotifications({ apiUrl: API_URL, userId: "guest" }).catch(() => {});
        }
      } catch (e) {
        console.warn("boot error", e?.message);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const pendingUrl = useRef(null);
  const openFromLink = useCallback((url) => {
    const parsed = parseIncomingLink(url);
    if (!parsed) return;
    if (parsed.kind === "listing") setModal({ name: "listing_details", params: { listingId: parsed.id } });
    else if (parsed.kind === "trip") setModal({ name: "trip_details", params: { tripId: parsed.id } });
    else if (parsed.kind === "store") setModal({ name: "seller_profile", params: { userId: parsed.id } });
    else if (parsed.kind === "story") setModal({ name: "story_viewer", params: { storyId: parsed.id } });
    else if (parsed.kind === "auction") setModal({ name: "auction", params: { auctionId: parsed.id } });
  }, []);

  useEffect(() => {
    let alive = true;
    const take = (url) => {
      if (!url || !alive) return;
      if (booting || !user) {
        pendingUrl.current = url;
        return;
      }
      openFromLink(url);
    };
    Linking.getInitialURL().then(take).catch(() => {});
    const sub = Linking.addEventListener("url", (event) => take(event?.url));
    return () => {
      alive = false;
      sub.remove();
    };
  }, [booting, user, openFromLink]);

  useEffect(() => {
    if (booting || !user || !pendingUrl.current) return;
    const url = pendingUrl.current;
    pendingUrl.current = null;
    openFromLink(url);
  }, [booting, user, openFromLink]);

  // Handle notification taps — navigate to the right screen based on payload.type
  useEffect(() => {
    const unsub = onNotificationTap((data) => {
      try {
        const t = data?.type || "";
        if (t === "admin_broadcast" || t === "app_update") setModal({ name: "notifications" });
        else if (t === "clinic_topic" || t === "clinic_reply") {
          if (data?.topic_id) setModal({ name: "clinic_topic", params: { topicId: data.topic_id } });
          else setCurrentPage("clinic");
        }
        else if (t === "listing_new" && data?.listing_id) setModal({ name: "listing_details", params: { listingId: data.listing_id } });
        else if (t === "story_new") setCurrentPage("forum");
        else if (t.startsWith("chat")) setCurrentPage("messages");
        else if (t.startsWith("order")) setCurrentPage("orders");
        else if (t.startsWith("trip")) {
          if (data?.trip_id) setModal({ name: "trip_details", params: { tripId: data.trip_id } });
          else setCurrentPage("trips");
        }
        else if (t === "community_chat") setCurrentPage("forum");
        else if (t.startsWith("listing") && data?.listing_id) {
          setModal({ name: "listing_details", params: { listingId: data.listing_id } });
        }
      } catch {}
    });
    return unsub;
  }, []);

  // Keep the reporter's "current screen" tag in sync with active tab / modal
  useEffect(() => {
    try {
      setReporterScreen(modal ? `modal:${modal.name}` : `tab:${currentPage}`);
    } catch {}
  }, [currentPage, modal]);

  // Register Expo push notifications when a user is signed in
  useEffect(() => {
    const uid = user?.id || user?.user_id;
    if (!uid || String(uid).startsWith("guest_")) return;
    import("./src/services/pushService")
      .then((m) => m.registerForPushNotifications(uid).catch(() => null))
      .catch(() => null);
  }, [user]);

  const finishOnboarding = useCallback(async () => {
    await AsyncStorage.setItem("tair_seen_onboarding", "1");
    setSeenOnboarding(true);
  }, []);

  const onAuthed = useCallback(async (u, token) => {
    await AsyncStorage.setItem("saqr_user", JSON.stringify(u));
    if (token) await AsyncStorage.setItem("saqr_token", token);
    // Hydrate api tokens immediately so subsequent calls carry Authorization header
    if (token) { try { api.setTokens(token); } catch {} }
    setUser(u);
    try { setReporterUser(u?.user_id || u?.id); } catch {}
    try { bindPushToUser(u?.user_id || u?.id); } catch {}
    setCurrentPage("listings");
  }, []);

  const logout = useCallback(async () => {
    try { await unregisterPushToken(); } catch {}
    await AsyncStorage.multiRemove(["saqr_user", "saqr_token", "saqr_refresh", "admin_token"]);
    try { api.clearTokens(); } catch {}
    setUser(null);
    try { setReporterUser(null); } catch {}
    setModal(null);
    setCurrentPage("listings");
  }, []);

  // Merge partial patch into the user object + AsyncStorage. Used by ProfileScreen
  // and StorefrontManager after saves so all screens see the same identity.
  const updateUser = useCallback(async (patch) => {
    if (!patch || typeof patch !== "object") return;
    setUser((prev) => {
      const next = { ...(prev || {}), ...patch };
      AsyncStorage.setItem("saqr_user", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Refetch the full user from backend and persist. Called after profile / storefront
  // edits or on pull-to-refresh in ProfileScreen.
  const refreshUser = useCallback(async () => {
    try {
      const { default: api } = await import("./src/services/api");
      const resp = await api.fetch("/api/auth/me");
      if (!resp?.ok) return null;
      const data = await resp.json().catch(() => null);
      const fresh = data?.user;
      if (!fresh) return null;
      setUser((prev) => {
        const next = { ...(prev || {}), ...fresh };
        AsyncStorage.setItem("saqr_user", JSON.stringify(next)).catch(() => {});
        return next;
      });
      return fresh;
    } catch {
      return null;
    }
  }, []);

  // Navigation helpers ---------------
  const openListing = (listingOrId) => {
    if (!listingOrId) return;
    const listingId = typeof listingOrId === "string"
      ? listingOrId
      : (listingOrId.listing_id || listingOrId.id);
    if (!listingId) return;
    setModal({ name: "listing_details", params: { listingId } });
  };
  const openCreateListing = () => setModal({ name: "create_listing" });
  const closeModal = () => setModal(null);

  const openChat = (otherUserId, otherUserName) =>
    setModal({ name: "private_chat", params: { otherUserId, otherUserName } });

  const openOrder = (order) =>
    setModal({ name: "order_details", params: { orderId: order.order_id } });

  const openTrip = (trip) =>
    setModal({ name: "trip_details", params: { tripId: trip.trip_id } });

  const orderListing = (listing) => {
    Alert.alert(
      "طلب جديد",
      "سيتم فتح محادثة مع البائع لإتمام الطلب. تابع في تبويب طلباتي.",
      [
        { text: "إلغاء", style: "cancel" },
        { text: "متابعة", onPress: () => openChat(listing.seller_id) },
      ],
    );
  };

  // ---------------- Render ----------------
  if (booting) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#1B3D2F" />
      </View>
    );
  }

  if (!seenOnboarding) {
    return <OnboardingScreen onComplete={finishOnboarding} />;
  }

  if (!user) {
    return <AuthScreen onAuthenticated={onAuthed} />;
  }

  // Modal stack
  if (modal) {
    switch (modal.name) {
      case "create_listing":
        return (
          <CreateListingScreen
            user={user}
            existingListing={modal.params?.listing || null}
            onCancel={closeModal}
            onDone={() => {
              closeModal();
              setCurrentPage("listings");
            }}
          />
        );
      case "listing_details":
        return (
          <ListingDetailsScreen
            user={user}
            listingId={modal.params.listingId}
            onBack={closeModal}
            onContactSeller={(sellerId, sellerName) => openChat(sellerId, sellerName)}
            onOrder={orderListing}
            onOpenSeller={(sellerId) => setModal({ name: "seller_profile", params: { userId: sellerId } })}
          />
        );
      case "trip_details":
        return (
          <TripDetailsScreen
            user={user}
            tripId={modal.params.tripId}
            onBack={closeModal}
            onContactCarrier={(carrierId, carrierName) => openChat(carrierId, carrierName)}
            onOpenCarrier={(carrierId) => setModal({ name: "seller_profile", params: { userId: carrierId } })}
          />
        );
      case "private_chat":
        return (
          <PrivateMessagesScreen
            user={user}
            initialFriend={
              modal.params?.otherUserId
                ? {
                    id: modal.params.otherUserId,
                    from_user_id: modal.params.otherUserId,
                    from_user_name: modal.params.otherUserName || "المستخدم",
                    name: modal.params.otherUserName || "المستخدم",
                  }
                : null
            }
            onClose={closeModal}
            onOpenUserProfile={(uid) =>
              setModal({ name: "seller_profile", params: { userId: uid, returnTo: modal } })
            }
          />
        );
      case "settings":
        return (
          <SettingsScreen
            user={user}
            onBack={closeModal}
            onLogout={logout}
          />
        );
      case "support":
        return <SupportScreen user={user} onBack={closeModal} />;
      case "stories":
        return <SuccessStoriesScreen onBack={closeModal} />;
      case "story_viewer":
        return <StoryViewerScreen initialStoryId={modal.params?.storyId} onClose={closeModal} />;
      case "add_story":
        return <AddStoryScreen user={user} onClose={closeModal} />;
      case "auction":
        return <AuctionScreen user={user} onBack={closeModal}
          focusAuctionId={modal.params?.auctionId}
          onOpenSubmit={() => setModal({ name: "submit_auction" })} />;
      case "submit_auction":
        return <SubmitAuctionScreen user={user}
          onClose={() => setModal({ name: "auction" })}
          onSubmitted={() => setModal({ name: "auction" })} />;
      case "wholesale":
        return <WholesaleScreen user={user} onBack={closeModal} />;
      case "user_profile":
        return (
          <UserProfileScreen
            userId={modal.params.userId}
            currentUser={user}
            onBack={closeModal}
          />
        );
      case "seller_profile":
        return (
          <SellerStorefrontScreen
            userId={modal.params?.userId}
            viewerId={user?.user_id || user?.id}
            onBack={modal.params?.returnTo ? () => setModal(modal.params.returnTo) : closeModal}
            onOpenListing={openListing}
            onContactSeller={(sellerId, sellerName) => openChat(sellerId, sellerName)}
          />
        );
      case "seller_analytics":
        return (
          <SellerAnalyticsScreen
            user={user}
            onBack={closeModal}
          />
        );
      case "forum_post":
        return (
          <ForumPostScreen
            user={user}
            postId={modal.params?.postId}
            onBack={closeModal}
          />
        );
      case "forum_category":
        return (
          <ForumCategoryFeedScreen
            category={modal.params?.category}
            categoryName={modal.params?.categoryName}
            onBack={closeModal}
            onOpenPost={(postId) =>
              setModal({ name: "forum_post", params: { postId } })
            }
            onCreate={(cid) =>
              setModal({ name: "forum_post_create", params: { category: cid } })
            }
          />
        );
      case "storefront_manager":
        return (
          <StorefrontManagerScreen
            user={user}
            onBack={async () => {
              closeModal();
              await refreshUser();
            }}
            onUserChanged={updateUser}
          />
        );
      case "admin_panel":
        return <AdminPanelScreen user={user} onBack={closeModal} />;
      case "edit_trip":
        return (
          <TripsScreen
            user={user}
            editingTrip={modal.params?.trip}
            onOpenTrip={openTrip}
            initialCreateOpen={true}
            onDone={closeModal}
          />
        );
      case "forum_post_create":
        return (
          <ForumScreen
            user={user}
            onOpenPost={(postId) => setModal({ name: "forum_post", params: { postId } })}
            onOpenCategory={(cid, cname) =>
              setModal({ name: "forum_category", params: { category: cid, categoryName: cname } })
            }
            initialCreateFor={modal.params?.category || null}
            initialCreateOpen={true}
          />
        );
      case "order_details":
        // Orders module deprecated in Tair pivot — route back to messages tab
        closeModal();
        setCurrentPage("messages");
        return null;
      case "pride":
        return <PrideScreen onBack={closeModal} onOpenListing={openListing} />;
      case "ask_experts":
        return <AskExpertsScreen user={user} onBack={closeModal} />;
      case "clinic_library":
        return <ClinicLibraryScreen user={user} onBack={closeModal} />;
      case "clinic_create_topic":
        return (
          <ClinicTopicCreateScreen
            user={user}
            onBack={closeModal}
            onCreated={(tid) => setModal({ name: "clinic_topic", params: { topicId: tid } })}
          />
        );
      case "clinic_topic":
        return (
          <ClinicTopicDetailsScreen
            user={user}
            topicId={modal.params?.topicId}
            onBack={closeModal}
            onOpenProfile={(uid) => setModal({ name: "seller_profile", params: { userId: uid, returnTo: modal } })}
          />
        );
      case "notifications":
        return <NotificationsScreen user={user} onBack={closeModal} />;
      default:
        return null;
    }
  }

  // Main tabs
  let content = null;
  switch (currentPage) {
    case "listings":
      content = (
        <MarketScreen
          user={user}
          activeTab="market"
          onTabChange={(k) => {
            const map = {
              market: "listings",
              trips: "trips",
              messages: "messages",
              community: "forum",
              account: "account",
            };
            setCurrentPage(map[k] || "listings");
          }}
          onOpenListing={openListing}
          onOpenTrips={() => setCurrentPage("trips")}
          onOpenAuction={() => setModal({ name: "auction" })}
          onOpenNotifications={() => setModal({ name: "notifications" })}
          onOpenMessages={() => setCurrentPage("messages")}
          onOpenAskExperts={() => setModal({ name: "ask_experts" })}
          onCreateListing={() => setModal({ name: "create_listing" })}
        />
      );
      break;
    case "trips":
      content = (
        <TripsScreen
          user={user}
          onOpenTrip={openTrip}
          onContactCarrier={(carrierId, carrierName) => openChat(carrierId, carrierName)}
          onOpenNotifications={() => setModal({ name: "notifications" })}
          onOpenMessages={() => setCurrentPage("messages")}
          onOpenAskExperts={() => setModal({ name: "ask_experts" })}
        />
      );
      break;
    case "messages":
      content = (
        <PrivateMessagesScreen
          user={user}
          onClose={() => setCurrentPage("listings")}
          onOpenNotifications={() => setModal({ name: "notifications" })}
          onOpenMessages={() => setCurrentPage("messages")}
          onOpenAskExperts={() => setModal({ name: "ask_experts" })}
          onOpenUserProfile={(userId) =>
            setModal({ name: "seller_profile", params: { userId } })
          }
        />
      );
      break;
    case "clinic":
      content = (
        <ClinicScreen
          user={user}
          onBellPress={() => setModal({ name: "notifications" })}
          onOpenMessages={() => setCurrentPage("messages")}
          onCreateTopic={() => setModal({ name: "clinic_create_topic" })}
          onOpenLibrary={() => setModal({ name: "clinic_library" })}
          onOpenTopic={(tid) => setModal({ name: "clinic_topic", params: { topicId: tid } })}
        />
      );
      break;
    case "forum":
      content = (
        <CommunityScreen
          user={user}
          onOpenStories={(storyId) => setModal({ name: "story_viewer", params: { storyId } })}
          onOpenPride={() => setModal({ name: "pride" })}
          onOpenAskExperts={() => setModal({ name: "ask_experts" })}
          onOpenNotifications={() => setModal({ name: "notifications" })}
          onOpenMessages={() => setCurrentPage("messages")}
          onOpenListing={openListing}
          onAddStory={() => setModal({ name: "add_story" })}
          onOpenProfile={(uid) => setModal({ name: "seller_profile", params: { userId: uid } })}
        />
      );
      break;
    case "orders":
      content = <OrdersScreen user={user} onOpenOrder={openOrder} />;
      break;
    case "account":
      content = (
        <ProfileScreen
          user={user}
          onOpenSettings={() => setModal({ name: "settings" })}
          onOpenSupport={() => setModal({ name: "support" })}
          onLogout={logout}
          onRefreshUser={refreshUser}
          onUserChanged={updateUser}
          onEditListing={(listing) => setModal({ name: "create_listing", params: { listing } })}
          onEditTrip={(trip) => setModal({ name: "edit_trip", params: { trip } })}
          onNavigate={(page) => {
            if (page === "settings") setModal({ name: "settings" });
            else if (page === "support") setModal({ name: "support" });
            else if (page === "chat") openChat(null);
            else if (page === "success_stories") setModal({ name: "stories" });
            else if (page === "seller_analytics") setModal({ name: "seller_analytics" });
            else if (page === "storefront_manager") setModal({ name: "storefront_manager" });
            else if (page === "admin_panel") setModal({ name: "admin_panel" });
            else if (page === "orders") setCurrentPage("orders");
            else if (page === "wholesale") setModal({ name: "wholesale" });
            else if (page === "forum") setCurrentPage("forum");
            else if (page === "messages") setCurrentPage("messages");
          }}
        />
      );
      break;
    default:
      content = null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F1E8" }}>
      <StatusBar style="dark" backgroundColor="transparent" translucent />
      {content}
      <UpdateNoticeModal />
      {!modal && (
        <TairBottomBar
          active={
            currentPage === "listings" ? "market" :
            currentPage === "trips" ? "trips" :
            currentPage === "clinic" ? "clinic" :
            currentPage === "forum" ? "community" :
            currentPage === "account" ? "account" : "market"
          }
          onChange={(k) => {
            const map = {
              market: "listings",
              trips: "trips",
              clinic: "clinic",
              community: "forum",
              account: "account",
            };
            setCurrentPage(map[k] || "listings");
          }}
        />
      )}
      {/* زر الرسائل العائم — أسفل يمين، فوق شريط التنقل، مع نقطة حمراء للرسائل الجديدة */}
      {!modal && user && currentPage !== "messages" && currentPage !== "forum" && (
        <MessagesFab user={user} onPress={() => setCurrentPage("messages")} />
      )}
    </View>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <LegalDisclaimerGate>
        <TairApp />
        <TairShareSheet />
      </LegalDisclaimerGate>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F1E8",
  },
});
