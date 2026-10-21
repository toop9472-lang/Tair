// طير — Main shell (bottom nav + all screens). Checkout/Orders flow removed.
import React, { useEffect, useState } from "react";
import HomeScreen from "./HomeScreen";
import TairMarket from "./TairMarket";
import CreateListingScreen from "./CreateListingScreen";
import TripsScreen from "./TripsScreen";
import ProfileScreen from "./ProfileScreen";
import SuccessStoriesScreen from "./SuccessStoriesScreen";
import CommunityScreen from "./CommunityScreen";
import PrideScreen from "./PrideScreen";
import AskExpertsScreen from "./AskExpertsScreen";
import MessagesScreen, { ChatThreadScreen } from "./MessagesScreen";
import ListingDetailsScreen from "./ListingDetailsScreen";
import KycScreen from "./KycScreen";
import NotificationsScreen from "./NotificationsScreen";
import OrdersScreen from "./MyRequestsScreen";
import OnboardingScreen from "./OnboardingScreen";
import WholesaleScreen from "./WholesaleScreen";
import SellerStorefrontScreen from "./SellerStorefrontScreen";
import SellerAnalyticsScreen from "./SellerAnalyticsScreen";
import StorefrontManagerScreen from "./StorefrontManagerScreen";
import IdentifyBirdModal from "./IdentifyBirdModal";
import AuctionScreen from "./AuctionScreen";
import AddStoryModal from "./AddStoryModal";
import { InjectAnimations } from "./TairUI";
import { tairApi } from "./tairApi";
import { TairAppBottomBar } from "./TairAppChrome";

const ONBOARDING_KEY = "tair_onboarding_done";

export default function TairShell({ user, onLogout }) {
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem(ONBOARDING_KEY),
  );
  const [tab, setTab] = useState("home");
  const [focusTripId, setFocusTripId] = useState(null);
  const [overlay, setOverlay] = useState(null);
  const [unread, setUnread] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const uid = user?.id || user?.user_id;

  useEffect(() => {
    if (!uid) return;
    const load = () => {
      tairApi.chatUnreadCount(uid).then(setUnread).catch(() => {});
      tairApi.myNotifications(uid).then((d) => setUnreadNotifs(d.unread_count || 0)).catch(() => {});
    };
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [uid, tab, overlay]);

  // Global chat WebSocket — increment unread badges instantly
  useEffect(() => {
    if (!uid) return;
    const base = process.env.REACT_APP_BACKEND_URL || "";
    const wsUrl = base.replace(/^http/, "ws") + `/api/chat/ws?user_id=${encodeURIComponent(uid)}`;
    let ws;
    let reconnectTimer;
    let closed = false;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.type === "message") {
              // Refresh unread counts fast
              tairApi.chatUnreadCount(uid).then(setUnread).catch(() => {});
              tairApi.myNotifications(uid).then((d) => setUnreadNotifs(d.unread_count || 0)).catch(() => {});
            }
          } catch (e) { /* ignore */ }
        };
        ws.onclose = () => {
          if (!closed) reconnectTimer = setTimeout(connect, 4000);
        };
        ws.onerror = () => {};
      } catch (e) { /* ignore */ }
    };
    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      try { ws && ws.close(); } catch (e) { /* ignore */ }
    };
  }, [uid]);

  useEffect(() => {
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", "ar");
    document.title = "طير — سوق الطيور والحيوانات الأليفة";
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const listing = params.get("listing");
    const trip = params.get("trip");
    const nextTab = params.get("tab");
    if (listing) setOverlay({ name: "listing-details", payload: { listingId: listing } });
    if (trip) {
      setFocusTripId(trip);
      setTab("trips");
    } else if (nextTab === "messages") setTab("messages");
    else if (nextTab === "forum" || nextTab === "community") setTab("forum");
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return (
      <>
        <InjectAnimations />
        <div className="tair-arrive" style={{ minHeight: "100%" }}>
          <OnboardingScreen onComplete={completeOnboarding} />
        </div>
      </>
    );
  }

  const openListing = (listingId) =>
    setOverlay({ name: "listing-details", payload: { listingId } });
  const openTrip = (tripId) => {
    if (typeof tripId === "string" && tripId) setFocusTripId(tripId);
    setTab("trips");
  };
  const openPost = (postId) =>
    setOverlay({ name: "post-details", payload: { postId } });
  const openForumCategory = (category, categoryName) =>
    setOverlay({ name: "forum-category", payload: { category, categoryName } });
  const openThread = (threadId) =>
    setOverlay({ name: "chat-thread", payload: { threadId } });

  const frame = (stamp, node) => (
    <div key={stamp} className="tair-arrive" style={{ minHeight: "100%" }}>{node}</div>
  );

  if (overlay?.name === "create-listing") {
    return frame("create-listing", (
      <CreateListingScreen
        user={user}
        onBack={() => setOverlay(null)}
        onCreated={() => {
          setOverlay(null);
          setTab("home");
        }}
      />
    ));
  }
  if (overlay?.name === "listing-details") {
    return frame("listing-details", (
      <ListingDetailsScreen
        user={user}
        listingId={overlay.payload.listingId}
        onBack={() => setOverlay(null)}
        onOpenThread={(threadId) => setOverlay({ name: "chat-thread", payload: { threadId } })}
        onOpenSeller={(sellerId) => setOverlay({ name: "seller_profile", userId: sellerId })}
      />
    ));
  }
  if (overlay?.name === "post-details") {
    return frame("post-details", <AskExpertsScreen user={user} onBack={() => { setOverlay(null); setTab("forum"); }} />);
  }
  if (overlay?.name === "forum-category") {
    return frame("forum-category", <AskExpertsScreen user={user} onBack={() => { setOverlay(null); setTab("forum"); }} />);
  }
  if (overlay?.name === "chat-thread") {
    return frame("chat-thread", (
      <ChatThreadScreen
        user={user}
        threadId={overlay.payload.threadId}
        onBack={() => { setOverlay(null); setTab("messages"); }}
      />
    ));
  }
  if (overlay?.name === "kyc") {
    return frame("kyc", (
      <KycScreen
        user={user}
        onBack={() => setOverlay(null)}
      />
    ));
  }
  if (overlay?.name === "orders") {
    return frame("orders", (
      <OrdersScreen
        user={user}
        onBack={() => setOverlay(null)}
        onOpenThread={(threadId) => setOverlay({ name: "chat-thread", payload: { threadId } })}
      />
    ));
  }
  if (overlay?.name === "notifications") {
    return frame("notifications", (
      <NotificationsScreen
        user={user}
        onBack={() => setOverlay(null)}
        onOpenThread={(threadId) => setOverlay({ name: "chat-thread", payload: { threadId } })}
        onOpenListing={openListing}
      />
    ));
  }
  if (overlay?.name === "stories") {
    return frame("stories", <SuccessStoriesScreen onBack={() => setOverlay(null)} />);
  }
  if (overlay?.name === "add_story") {
    return frame("add_story", (
      <AddStoryModal
        user={user}
        onClose={() => setOverlay(null)}
        onCreated={() => setOverlay(null)}
      />
    ));
  }
  if (overlay?.name === "pride") {
    return frame("pride", (
      <PrideScreen
        onBack={() => setOverlay(null)}
        onOpenListing={openListing}
      />
    ));
  }
  if (overlay?.name === "ask_experts") {
    return frame("ask_experts", (
      <AskExpertsScreen
        user={user}
        onBack={() => setOverlay(null)}
      />
    ));
  }
  if (overlay?.name === "wholesale") {
    return frame("wholesale", <WholesaleScreen user={user} onBack={() => setOverlay(null)} />);
  }
  if (overlay?.name === "seller_profile") {
    return frame("seller_profile", (
      <SellerStorefrontScreen
        userId={overlay.userId}
        viewerId={user?.user_id || user?.id}
        onBack={() => setOverlay(overlay.fromManager ? { name: "storefront_manager" } : null)}
        onOpenListing={(id) => setOverlay({ name: "listing-details", payload: { listingId: id } })}
        onContactSeller={(sellerId) => {
          // start (or resume) chat with this seller
          tairApi
            .chatStart({ peer_id: sellerId }, user?.user_id || user?.id)
            .then((t) => t?.thread_id && setOverlay({ name: "chat-thread", payload: { threadId: t.thread_id } }))
            .catch(() => setTab("messages"));
        }}
      />
    ));
  }
  if (overlay?.name === "storefront_manager") {
    return frame("storefront_manager", (
      <StorefrontManagerScreen
        user={user}
        onBack={() => setOverlay(null)}
        onPreview={() => setOverlay({ name: "seller_profile", userId: uid, fromManager: true })}
      />
    ));
  }
  if (overlay?.name === "seller_analytics") {
    return frame("seller_analytics", (
      <SellerAnalyticsScreen
        user={user}
        onBack={() => setOverlay(null)}
        onOpenListing={(id) => setOverlay({ name: "listing-details", payload: { listingId: id } })}
      />
    ));
  }

  // Map internal screen name → bottom bar tab key
  const tabToKey = { home: "market", trips: "trips", messages: "messages", forum: "community", profile: "account" };
  const keyToTab = { market: "home", trips: "trips", messages: "messages", community: "forum", account: "profile" };

  const handleBottomBar = (k) => setTab(keyToTab[k] || "home");

  return (
    <>
      <InjectAnimations />
      <div key={tab} className="tair-arrive" style={{ minHeight: "100%" }}>
      {tab === "home" && (
        <TairMarket
          activeTab="market"
          onTabChange={handleBottomBar}
          onOpenListing={openListing}
          onOpenTrips={() => setTab("trips")}
          onOpenAuction={() => setTab("auction")}
          onOpenNotifications={() => setOverlay({ name: "notifications" })}
          unreadCount={unreadNotifs}
        />
      )}
      {tab === "trips" && (
        <TripsScreen user={user} focusTripId={focusTripId} onOpenTrip={openTrip} onOpenNotifications={() => setOverlay({ name: "notifications" })} unreadCount={unreadNotifs} />
      )}
      {tab === "messages" && (
        <MessagesScreen user={user} onOpenThread={openThread} onOpenNotifications={() => setOverlay({ name: "notifications" })} unreadCount={unreadNotifs} />
      )}
      {tab === "forum" && (
        <CommunityScreen
          user={user}
          onOpenStories={() => setOverlay({ name: "stories" })}
          onOpenPride={() => setOverlay({ name: "pride" })}
          onOpenAskExperts={() => setOverlay({ name: "ask_experts" })}
          onOpenNotifications={() => setOverlay({ name: "notifications" })}
          unreadCount={unreadNotifs}
          onOpenListing={openListing}
          onAddStory={() => setOverlay({ name: "add_story" })}
        />
      )}
      {tab === "profile" && (
        <ProfileScreen
          user={user}
          onOpenListing={openListing}
          onOpenTrip={openTrip}
          onLogout={onLogout}
          onOpenKyc={() => setOverlay({ name: "kyc" })}
          onOpenOrders={() => setOverlay({ name: "orders" })}
          onOpenStories={() => setOverlay({ name: "stories" })}
          onOpenAnalytics={() => setOverlay({ name: "seller_analytics" })}
          onOpenStore={() => setOverlay({ name: "storefront_manager" })}
          onOpenNotifications={() => setOverlay({ name: "notifications" })}
          unreadCount={unreadNotifs}
        />
      )}
      {tab === "auction" && (
        <AuctionScreen
          user={user}
          onBack={() => setTab("home")}
          onOpenNotifications={() => setOverlay({ name: "notifications" })}
          unreadCount={unreadNotifs}
        />
      )}
      </div>
      {tab !== "home" && tab !== "auction" && (
        <TairAppBottomBar active={tabToKey[tab] || "market"} onChange={handleBottomBar} messagesBadge={unread} />
      )}
    </>
  );
}
