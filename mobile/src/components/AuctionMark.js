/**
 * ختم المزاد — ميدالية زمرد وذهب مع نبض خفيف.
 * النص العربي يُرسم فوق الصورة داخل التطبيق حتى يبقى واضحاً.
 */
import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { TAIR } from "../constants/tairTheme";

const MARK = require("../../assets/tair-design/auction/mark.jpg");

export default function AuctionMark({ size = 64 }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
      <Image
        source={MARK}
        style={{
          width: size * 0.86,
          height: size * 0.86,
          borderRadius: size * 0.43,
          borderWidth: 1.5,
          borderColor: TAIR.gold,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
    backgroundColor: TAIR.gold,
  },
});
