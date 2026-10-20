import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  Alert,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode } from "expo-av";
import api from "../services/api";
import { DetailSkeleton, ErrorState } from "../components/TairUI";

const PLACEHOLDER_SIGNATURES = [
  "static.prod-images.emergentagent.com/jobs/3943d011-4c0b-4252-9b99-046dc8",
  "example.com/t.jpg",
  "example.com/thumbnail",
];

const isPlaceholderThumb = (url) => {
  if (!url) return true;
  const lower = String(url).toLowerCase();
  return PLACEHOLDER_SIGNATURES.some((sig) => lower.includes(sig.toLowerCase()));
};

const toAbsoluteUrl = (value) => {
  const normalized = (value || "").trim();
  if (!normalized) return "";
  if (normalized.startsWith("http")) return normalized;
  if (normalized.startsWith("/")) return `${api.getActiveBaseUrl()}${normalized}`;
  return normalized;
};

// Returns the REAL thumbnail URL only; if none, returns null so the UI can
// render a neutral dark play-icon tile instead of a random fallback image.
const resolveClipThumb = (clip) => {
  const direct = toAbsoluteUrl(clip?.thumbnail_url);
  if (direct && !isPlaceholderThumb(direct)) return direct;
  return null;
};

const { width: screenWidth } = Dimensions.get("window");
const GRID_COLUMN_COUNT = 3;
const GRID_GAP = 2;
const GRID_TILE_SIZE = (screenWidth - GRID_GAP * (GRID_COLUMN_COUNT + 1)) / GRID_COLUMN_COUNT;

/**
 * Public profile view for another user (opened from Reels caption / Chat avatar).
 * Shows their public stats + grid of their reels.
 * Allows the viewer to follow / unfollow / send a private message.
 */
const UserProfileScreen = ({
  user,
  targetUserId,
  onClose,
  onOpenChat,
  onOpenClip,
}) => {
  const viewerId = user?.id || user?.user_id;
  const [profile, setProfile] = useState(null);
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [followListMode, setFollowListMode] = useState(null);
  const playLocal = () => {};

  const isSelf = useMemo(
    () => Boolean(viewerId && profile?.user_id === viewerId),
    [viewerId, profile?.user_id],
  );

  const loadProfile = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const profileRes = await api.fetch(
        `/api/users/public-profile/${encodeURIComponent(
          targetUserId,
        )}${viewerId ? `?viewer_id=${encodeURIComponent(viewerId)}` : ""}`,
      );
      if (!profileRes.ok) throw new Error("تعذر تحميل الملف الشخصي");
      const profileData = await profileRes.json();
      setProfile(profileData);

      if (profileData.can_view_clips) {
        const clipsRes = await api.fetch(
          `/api/users/clips/${encodeURIComponent(targetUserId)}${
            viewerId ? `?viewer_id=${encodeURIComponent(viewerId)}` : ""
          }`,
        );
        if (clipsRes.ok) {
          const clipsData = await clipsRes.json();
          setClips(clipsData?.clips || []);
        }
      } else {
        setClips([]);
      }
    } catch (e) {
      setProfile(null);
      setLoadError(e?.message || "تعذّر تحميل الملف الشخصي");
    } finally {
      setLoading(false);
    }
  }, [targetUserId, viewerId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleToggleFollow = useCallback(async () => {
    if (!viewerId || !profile?.user_id || followBusy) return;
    setFollowBusy(true);
    try {
      const response = await api.fetch("/api/clips/follow/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewer_user_id: viewerId,
          target_user_id: profile.user_id,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || "فشلت العملية");
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              followed_by_me: Boolean(data?.followed),
              followers_count: Number(
                data?.followers_count ?? prev.followers_count ?? 0,
              ),
            }
          : prev,
      );
    } catch (e) {
      Alert.alert("خطأ", String(e?.message || e));
    } finally {
      setFollowBusy(false);
    }
  }, [followBusy, profile?.user_id, viewerId]);

  const handleMessage = useCallback(() => {
    if (!profile?.user_id || isSelf) return;
    if (onOpenChat) {
      onOpenChat({
        id: profile.user_id,
        user_id: profile.user_id,
        name: profile.name,
        avatar: profile.avatar,
      });
    } else {
      Alert.alert("الرسائل الخاصة", "افتح صفحة الرسائل الخاصة من القائمة الرئيسية.");
    }
  }, [isSelf, onOpenChat, profile]);

  const renderClipTile = useCallback(
    ({ item }) => {
      const thumb = resolveClipThumb(item);
      const videoUrl = toAbsoluteUrl(item?.video_url);
      return (
        <TouchableOpacity
          style={styles.tile}
          activeOpacity={0.7}
          onPress={() => onOpenClip && onOpenClip(item)}
        >
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.tileImage} />
          ) : videoUrl ? (
            <Video
              source={{ uri: videoUrl }}
              style={styles.tileImage}
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
              isMuted
              positionMillis={300}
              useNativeControls={false}
            />
          ) : (
            <LinearGradient
              colors={["#0F241C", "#1B3D2F"]}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <View style={styles.tilePlayOverlay}>
            <Ionicons name="play" size={22} color="rgba(255,255,255,0.92)" />
          </View>
          <View style={styles.tileBadge}>
            <Ionicons name="heart" size={11} color="#fff" />
            <Text style={styles.tileBadgeText}>{item.likes_count || 0}</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [onOpenClip],
  );

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <DetailSkeleton />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loaderWrap}>
        <ErrorState
          title="تعذّر فتح الملف"
          subtitle={loadError || "تحقق من الاتصال ثم أعد المحاولة."}
          onRetry={loadProfile}
        />
        <TouchableOpacity style={styles.backBtn} onPress={onClose}>
          <Text style={styles.backBtnText}>عودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0F241C", "#1B3D2F"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {profile.name}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + info */}
        <View style={styles.profileTop}>
          <View style={styles.avatarWrap}>
            {profile.avatar ? (
              <Image source={{ uri: profile.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>
                  {(profile.name || "U")[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {profile.name}
          </Text>
          {profile.is_private && (
            <View style={styles.privateBadge}>
              <Ionicons name="lock-closed" size={11} color="#fbbf24" />
              <Text style={styles.privateBadgeText}>حساب خاص</Text>
            </View>
          )}
          {!!profile.bio && (
            <Text style={styles.bio} numberOfLines={3}>
              {profile.bio}
            </Text>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{profile.clips_count}</Text>
            <Text style={styles.statLabel}>ريلز</Text>
          </View>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.statCol}
            activeOpacity={0.7}
            onPress={() => setFollowListMode("followers")}
            accessibilityRole="button"
            accessibilityLabel="عرض المتابعين"
          >
            <Text style={styles.statValue}>{profile.followers_count}</Text>
            <Text style={styles.statLabel}>متابعون</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.statCol}
            activeOpacity={0.7}
            onPress={() => setFollowListMode("following")}
            accessibilityRole="button"
            accessibilityLabel="عرض قائمة المتابَعين"
          >
            <Text style={styles.statValue}>{profile.following_count}</Text>
            <Text style={styles.statLabel}>يتابع</Text>
          </TouchableOpacity>
        </View>

        {/* Action buttons */}
        {!isSelf && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              disabled={followBusy}
              style={[
                styles.actionBtn,
                profile.followed_by_me
                  ? styles.actionBtnSecondary
                  : styles.actionBtnPrimary,
              ]}
              onPress={handleToggleFollow}
              activeOpacity={0.8}
            >
              <Ionicons
                name={profile.followed_by_me ? "person-remove-outline" : "person-add"}
                size={17}
                color={profile.followed_by_me ? "#E0C580" : "#0F241C"}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  profile.followed_by_me ? { color: "#E0C580" } : { color: "#0F241C" },
                ]}
              >
                {profile.followed_by_me ? "إلغاء المتابعة" : "متابعة"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnGhost]}
              onPress={handleMessage}
              activeOpacity={0.8}
            >
              <Ionicons name="paper-plane-outline" size={17} color="#C6A15B" />
              <Text style={[styles.actionBtnText, { color: "#C6A15B" }]}>
                رسالة خاصة
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Clips grid */}
        <View style={styles.gridHeader}>
          <Ionicons name="grid-outline" size={16} color="#94a3b8" />
          <Text style={styles.gridHeaderText}>
            ريلز ({profile.clips_count})
          </Text>
        </View>

        {!profile.can_view_clips ? (
          <View style={styles.lockedWrap}>
            <Ionicons name="lock-closed-outline" size={30} color="#fbbf24" />
            <Text style={styles.lockedText}>هذا الحساب خاص</Text>
            <Text style={styles.lockedSub}>
              تابع المستخدم لعرض مقاطعه.
            </Text>
          </View>
        ) : clips.length === 0 ? (
          <View style={styles.lockedWrap}>
            <Ionicons name="film-outline" size={30} color="#64748b" />
            <Text style={styles.lockedText}>لم ينشر أي ريلز بعد</Text>
          </View>
        ) : (
          <FlatList
            data={clips}
            keyExtractor={(item) => item.clip_id}
            renderItem={renderClipTile}
            numColumns={GRID_COLUMN_COUNT}
            scrollEnabled={false}
            columnWrapperStyle={{ gap: GRID_GAP }}
            contentContainerStyle={{ gap: GRID_GAP, paddingHorizontal: GRID_GAP }}
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F241C" },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F1E8",
  },
  errorText: { color: "#fff", marginBottom: 16 },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#1B3D2F",
    borderWidth: 1,
    borderColor: "#C6A15B",
    borderRadius: 14,
  },
  backBtnText: { color: "#C6A15B", fontWeight: "800" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  scrollContent: { paddingBottom: 60 },
  profileTop: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  avatarWrap: {
    padding: 3,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "rgba(198,161,91,0.7)",
    marginBottom: 12,
  },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    backgroundColor: "#475569",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: { color: "#fff", fontSize: 38, fontWeight: "700" },
  name: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 4 },
  bio: {
    color: "rgba(226,232,240,0.78)",
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(251,191,36,0.18)",
    borderColor: "rgba(251,191,36,0.4)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 4,
  },
  privateBadgeText: { color: "#fbbf24", fontSize: 11, fontWeight: "600" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginVertical: 16,
    backgroundColor: "rgba(255,253,248,0.06)",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
  },
  statCol: { flex: 1, alignItems: "center" },
  statValue: { color: "#fff", fontSize: 18, fontWeight: "700" },
  statLabel: { color: "rgba(226,232,240,0.6)", fontSize: 11, marginTop: 2 },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 18,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionBtnPrimary: {
    backgroundColor: "#C6A15B",
    borderColor: "#C6A15B",
  },
  actionBtnSecondary: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.16)",
  },
  actionBtnGhost: {
    backgroundColor: "rgba(198,161,91,0.12)",
    borderColor: "rgba(198,161,91,0.45)",
  },
  actionBtnGift: {
    backgroundColor: "#ec4899",
    borderColor: "#db2777",
  },
  actionBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  gridHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  gridHeaderText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  tile: {
    width: GRID_TILE_SIZE,
    height: GRID_TILE_SIZE * 1.55,
    backgroundColor: "rgba(15,36,28,0.8)",
    overflow: "hidden",
    borderRadius: 4,
  },
  tileImage: { width: "100%", height: "100%", resizeMode: "cover" },
  tilePlayOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  tilePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(27,61,47,0.7)",
  },
  tileBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tileBadgeText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  lockedWrap: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  lockedText: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 10,
  },
  lockedSub: {
    color: "rgba(226,232,240,0.55)",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
});

export default UserProfileScreen;
