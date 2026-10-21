// لمسة بصرية موحّدة: الشاشة تصعد عند الفتح، وخيط ذهبي يمر على الهيدر.
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export function ScreenArrive({ active = true, children, style }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return undefined;
    opacity.setValue(0);
    rise.setValue(18);
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [active, opacity, rise]);

  return (
    <Animated.View style={[{ flex: 1 }, style, { opacity, transform: [{ translateY: rise }] }]}>
      {children}
    </Animated.View>
  );
}

export function HeaderSheen() {
  const travel = useRef(new Animated.Value(-220)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(travel, {
          toValue: 520,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(2400),
        Animated.timing(travel, {
          toValue: -220,
          duration: 1,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [travel]);

  return (
    <View pointerEvents="none" style={styles.clip}>
      <Animated.View style={[styles.band, { transform: [{ translateX: travel }, { rotate: "16deg" }] }]}>
        <LinearGradient
          colors={["transparent", "rgba(255,248,220,0.15)", "rgba(255,248,220,0.82)", "rgba(198,161,91,0.18)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 3,
  },
  band: {
    position: "absolute",
    top: "-10%",
    bottom: "-10%",
    width: 86,
  },
});
