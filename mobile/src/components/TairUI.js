/**
 * طير — مكوّنات الواجهة الموحّدة.
 * لغة واحدة: كريمي + زمرد، والذهب للتأكيد فقط.
 * الصور عبر Image مع ذاكرة تخزين مؤقت وتدرّج ظهور وبديل عند الفشل
 * (بدون expo-image حتى لا نُلزم البناء المنشور بمكتبة أصلية جديدة).
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { TAIR, TAIR_ELEVATION, TAIR_RADIUS } from "../constants/tairTheme";

export function tapLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const warmedMedia = new Set();

export function warmMedia(uris) {
  (uris || []).forEach((uri) => {
    if (!uri || warmedMedia.has(uri)) return;
    Image.prefetch(uri).then(() => warmedMedia.add(uri)).catch(() => {});
  });
}

export function SoftPulse({ color = TAIR.gold, size = 10 }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.15] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const dot = Math.max(4, size * 0.5);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
          transform: [{ scale }],
        }}
      />
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
    </View>
  );
}

export function PressableScale({
  children,
  style,
  onPress,
  disabled,
  scaleTo = 0.98,
  haptic = false,
  ...rest
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 28,
      bounciness: 5,
    }).start();
  };
  return (
    <AnimatedTouchable
      activeOpacity={1}
      disabled={disabled}
      onPress={(e) => {
        if (haptic) tapLight();
        onPress?.(e);
      }}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[style, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedTouchable>
  );
}

export function TairImage({
  uri,
  style,
  resizeMode = "cover",
  icon = "image-outline",
  iconSize = 22,
}) {
  const known = !!(uri && warmedMedia.has(uri));
  const [phase, setPhase] = useState(!uri ? "empty" : known ? "ready" : "loading");
  const fade = useRef(new Animated.Value(known ? 1 : 0)).current;

  useEffect(() => {
    if (!uri) {
      setPhase("empty");
      return;
    }
    if (warmedMedia.has(uri)) {
      fade.setValue(1);
      setPhase("ready");
      return;
    }
    fade.setValue(0);
    setPhase("loading");
  }, [uri, fade]);

  const onLoad = () => {
    if (uri) warmedMedia.add(uri);
    setPhase("ready");
    Animated.timing(fade, {
      toValue: 1,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={[styles.imgWrap, style]}>
      {uri && phase !== "error" ? (
        <Animated.Image
          source={{ uri, cache: "force-cache" }}
          style={[StyleSheet.absoluteFill, { opacity: fade }]}
          resizeMode={resizeMode}
          onLoad={onLoad}
          onError={() => setPhase("error")}
        />
      ) : null}
      {phase !== "ready" ? (
        <View style={styles.imgPh} pointerEvents="none">
          <Ionicons
            name={phase === "error" ? "cloud-offline-outline" : icon}
            size={iconSize}
            color={TAIR.faint}
          />
        </View>
      ) : null}
    </View>
  );
}

function usePulse() {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 720, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.42, duration: 720, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}

export function Skeleton({ width, height, radius = 12, style }) {
  const opacity = usePulse();
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: TAIR.creamDeep,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function ListingSkeleton({ count = 5 }) {
  return (
    <View style={{ paddingTop: 12, paddingHorizontal: 16, gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.skelCard}>
          <Skeleton width={104} height={104} radius={16} />
          <View style={{ flex: 1, alignItems: "flex-end", gap: 8 }}>
            <Skeleton width={54} height={18} radius={999} />
            <Skeleton width="88%" height={16} radius={8} />
            <Skeleton width="46%" height={12} radius={8} />
            <Skeleton width="62%" height={18} radius={8} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ListSkeleton({ count = 4 }) {
  return (
    <View style={{ padding: 16, gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.skelRow}>
          <Skeleton width={52} height={52} radius={14} />
          <View style={{ flex: 1, alignItems: "flex-end", gap: 8 }}>
            <Skeleton width="70%" height={14} radius={8} />
            <Skeleton width="42%" height={12} radius={8} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function DetailSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: TAIR.bg }}>
      <Skeleton width="100%" height={280} radius={0} />
      <View style={{ padding: 16, gap: 12, alignItems: "flex-end" }}>
        <Skeleton width="40%" height={28} radius={8} />
        <Skeleton width="78%" height={20} radius={8} />
        <Skeleton width="50%" height={14} radius={8} />
        <View style={{ flexDirection: "row-reverse", gap: 8, width: "100%", marginTop: 8 }}>
          <Skeleton style={{ flex: 1 }} height={72} radius={14} />
          <Skeleton style={{ flex: 1 }} height={72} radius={14} />
        </View>
        <Skeleton width="100%" height={96} radius={16} />
      </View>
    </View>
  );
}

export function EmptyState({
  icon = "file-tray-outline",
  title,
  subtitle,
  actionLabel,
  onAction,
  testID,
}) {
  return (
    <View style={styles.state} testID={testID}>
      <View style={styles.stateIcon}>
        <Ionicons name={icon} size={28} color={TAIR.goldDark} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      {subtitle ? <Text style={styles.stateSub}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} haptic style={styles.stateBtn} scaleTo={0.97}>
          <Text style={styles.stateBtnText}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function ErrorState({
  title = "تعذّر التحميل",
  subtitle = "تحقق من الاتصال ثم أعد المحاولة.",
  onRetry,
  testID,
}) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title={title}
      subtitle={subtitle}
      actionLabel={onRetry ? "إعادة المحاولة" : undefined}
      onAction={onRetry}
      testID={testID}
    />
  );
}

export function TairButton({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled,
  loading,
  style,
  testID,
}) {
  const palette = {
    primary: { bg: TAIR.emerald, fg: TAIR.gold, border: TAIR.gold },
    gold: { bg: TAIR.gold, fg: TAIR.emeraldDeep, border: TAIR.goldDark },
    ghost: { bg: TAIR.card, fg: TAIR.emerald, border: TAIR.divider },
    danger: { bg: TAIR.dangerSoft, fg: TAIR.error, border: "transparent" },
  }[variant] || { bg: TAIR.emerald, fg: TAIR.gold, border: TAIR.gold };

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic
      testID={testID}
      scaleTo={0.97}
      style={[
        styles.btn,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.55 : 1 },
        variant === "primary" && TAIR_ELEVATION.hair,
        style,
      ]}
    >
      {loading ? (
        <Text style={[styles.btnText, { color: palette.fg }]}>…</Text>
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={palette.fg} /> : null}
          <Text style={[styles.btnText, { color: palette.fg }]}>{label}</Text>
        </>
      )}
    </PressableScale>
  );
}

export function TairBadge({ label, tone = "gold", icon }) {
  const tones = {
    gold: { bg: TAIR.goldWash, fg: TAIR.goldDark, border: "rgba(198,161,91,0.45)" },
    emerald: { bg: TAIR.emerald, fg: TAIR.gold, border: TAIR.gold },
    new: { bg: "#F6E7C4", fg: TAIR.goldDark, border: "transparent" },
    sold: { bg: TAIR.error, fg: "#FFFDF8", border: "transparent" },
    soft: { bg: TAIR.creamDeep, fg: TAIR.muted, border: "transparent" },
    success: { bg: TAIR.successSoft, fg: TAIR.success, border: "transparent" },
  };
  const t = tones[tone] || tones.gold;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }]}>
      {icon ? <Ionicons name={icon} size={11} color={t.fg} /> : null}
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function TairChip({ label, active, onPress, icon, testID }) {
  return (
    <PressableScale
      onPress={onPress}
      haptic
      testID={testID}
      scaleTo={0.97}
      style={[styles.chip, active && styles.chipOn]}
    >
      {icon ? (
        <Ionicons name={icon} size={14} color={active ? TAIR.gold : TAIR.muted} />
      ) : null}
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  imgWrap: {
    overflow: "hidden",
    backgroundColor: TAIR.creamDeep,
  },
  imgPh: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  skelCard: {
    flexDirection: "row-reverse",
    gap: 12,
    backgroundColor: TAIR.card,
    borderRadius: TAIR_RADIUS.lg,
    padding: 10,
    ...TAIR_ELEVATION.hair,
  },
  skelRow: {
    flexDirection: "row-reverse",
    gap: 12,
    backgroundColor: TAIR.card,
    borderRadius: TAIR_RADIUS.md,
    padding: 12,
    alignItems: "center",
    ...TAIR_ELEVATION.hair,
  },
  state: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 36,
    gap: 8,
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: TAIR.card,
    borderWidth: 1,
    borderColor: TAIR.divider,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    ...TAIR_ELEVATION.hair,
  },
  stateTitle: {
    color: TAIR.emerald,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  stateSub: {
    color: TAIR.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    fontWeight: "600",
  },
  stateBtn: {
    marginTop: 8,
    backgroundColor: TAIR.emerald,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: TAIR.gold,
  },
  stateBtnText: { color: TAIR.gold, fontWeight: "800", fontSize: 13 },
  btn: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnText: { fontSize: 15, fontWeight: "800" },
  badge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "flex-end",
  },
  badgeText: { fontSize: 11, fontWeight: "800" },
  chip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: TAIR.creamDeep,
    borderWidth: 1,
    borderColor: TAIR.divider,
  },
  chipOn: { backgroundColor: TAIR.emerald, borderColor: TAIR.gold },
  chipText: { color: TAIR.muted, fontWeight: "700", fontSize: 12.5 },
  chipTextOn: { color: TAIR.gold, fontWeight: "800" },
});

// إعادة تصدير الصورة الكلاسيكية عند الحاجة لنفس الـ API
export { Image as NativeImage };
