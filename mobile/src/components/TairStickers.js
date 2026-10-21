// ملصقات طير — طائر زمردي بمنقار ذهبي على بطاقة كريمية.
// الرسالة تُخزَّن كنص [[tair:id]] حتى تعمل في الدردشة الخاصة والعامة دون صور.
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { TAIR } from "../constants/tairTheme";

export const TAIR_STICKERS = [
  { id: "hello", label: "سلام" },
  { id: "thanks", label: "شكراً" },
  { id: "laugh", label: "ضحك" },
  { id: "love", label: "إعجاب" },
  { id: "wow", label: "واو" },
  { id: "sad", label: "حزين" },
  { id: "ok", label: "تمام" },
  { id: "deal", label: "صفقة" },
  { id: "fly", label: "على الطريق" },
  { id: "care", label: "عناية" },
  { id: "ask", label: "سؤال" },
  { id: "celebrate", label: "مبروك" },
];

const EM = "#1B3D2F";
const GOLD = "#C6A15B";
const GOLDL = "#E0C580";
const CREAM = "#F7F1E8";
const CARD = "#FFFDF8";
const INK = "#0F241C";

export function stickerToken(id) {
  return `[[tair:${id}]]`;
}

export function parseSticker(text) {
  const match = String(text || "").trim().match(/^\[\[tair:([a-z0-9_]+)\]\]$/);
  if (!match) return null;
  return TAIR_STICKERS.find((s) => s.id === match[1]) || null;
}

export function stickerPreview(text) {
  if (!text) return "";
  return String(text).replace(/\[\[tair:([a-z0-9_]+)\]\]/g, (full, id) => {
    const sticker = TAIR_STICKERS.find((s) => s.id === id);
    return sticker ? `ملصق: ${sticker.label}` : full;
  });
}

function Box({ p, x, y, w, h, r, color, rotate, border }) {
  return (
    <View
      style={{
        position: "absolute",
        left: p(x),
        top: p(y),
        width: p(w),
        height: p(h),
        borderRadius: p(r || 0),
        backgroundColor: color,
        transform: rotate ? [{ rotate }] : undefined,
        borderWidth: border ? Math.max(1, p(1.2)) : 0,
        borderColor: border || "transparent",
      }}
    />
  );
}

function Beak({ p }) {
  return (
    <View
      style={{
        position: "absolute",
        left: p(4),
        top: p(22),
        width: 0,
        height: 0,
        borderTopWidth: p(4.5),
        borderBottomWidth: p(4.5),
        borderRightWidth: p(13),
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        borderRightColor: GOLD,
      }}
    />
  );
}

function Crest({ p }) {
  return (
    <View
      style={{
        position: "absolute",
        left: p(30),
        top: p(3),
        width: 0,
        height: 0,
        borderLeftWidth: p(4),
        borderRightWidth: p(4),
        borderBottomWidth: p(11),
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderBottomColor: GOLD,
      }}
    />
  );
}

function Eye({ p, x, y, s = 8, look = 0, shut = false }) {
  if (shut) {
    return (
      <View
        style={{
          position: "absolute",
          left: p(x),
          top: p(y + 2),
          width: p(s),
          height: p(s * 0.55),
          borderBottomWidth: Math.max(1.6, p(1.7)),
          borderBottomColor: INK,
          borderBottomLeftRadius: p(s),
          borderBottomRightRadius: p(s),
        }}
      />
    );
  }
  return (
    <View
      style={{
        position: "absolute",
        left: p(x),
        top: p(y),
        width: p(s),
        height: p(s),
        borderRadius: p(s),
        backgroundColor: CARD,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: p(s * 0.46),
          height: p(s * 0.46),
          borderRadius: p(s),
          backgroundColor: INK,
          transform: [{ translateX: p(look) }],
        }}
      />
    </View>
  );
}

function Heart({ p, x, y, s = 8 }) {
  const lobe = s * 0.62;
  return (
    <View style={{ position: "absolute", left: p(x), top: p(y), width: p(s), height: p(s) }}>
      <View style={{ position: "absolute", left: 0, top: 0, width: p(lobe), height: p(lobe), borderRadius: p(lobe), backgroundColor: GOLD }} />
      <View style={{ position: "absolute", right: 0, top: 0, width: p(lobe), height: p(lobe), borderRadius: p(lobe), backgroundColor: GOLD }} />
      <View style={{ position: "absolute", left: p(s * 0.18), top: p(s * 0.28), width: p(s * 0.62), height: p(s * 0.62), backgroundColor: GOLD, transform: [{ rotate: "45deg" }] }} />
    </View>
  );
}

function Smile({ p, frown = false }) {
  return (
    <View
      style={{
        position: "absolute",
        left: p(24),
        top: p(frown ? 34 : 33),
        width: p(9),
        height: p(5),
        borderBottomWidth: frown ? 0 : Math.max(1.5, p(1.6)),
        borderTopWidth: frown ? Math.max(1.5, p(1.6)) : 0,
        borderBottomColor: GOLD,
        borderTopColor: GOLD,
        borderBottomLeftRadius: p(8),
        borderBottomRightRadius: p(8),
        borderTopLeftRadius: p(8),
        borderTopRightRadius: p(8),
      }}
    />
  );
}

function expression(id, p) {
  if (id === "hello") {
    return (
      <>
        <Eye p={p} x={25} y={18} look={-1} />
        <Smile p={p} />
        <Box p={p} x={42} y={26} w={16} h={8} r={6} color={GOLD} rotate="-58deg" />
      </>
    );
  }
  if (id === "thanks") {
    return (
      <>
        <Eye p={p} x={24} y={18} shut />
        <Smile p={p} />
        <Heart p={p} x={30} y={40} s={9} />
      </>
    );
  }
  if (id === "laugh") {
    return (
      <>
        <Eye p={p} x={23} y={17} shut />
        <Box p={p} x={22} y={32} w={12} h={7} r={6} color={GOLD} />
        <Box p={p} x={16} y={30} w={5} h={3} r={2} color={GOLDL} />
      </>
    );
  }
  if (id === "love") {
    return (
      <>
        <Heart p={p} x={23} y={16} s={10} />
        <Smile p={p} />
        <Box p={p} x={16} y={28} w={5} h={3.2} r={2} color={GOLDL} />
      </>
    );
  }
  if (id === "wow") {
    return (
      <>
        <Eye p={p} x={23} y={16} s={11} />
        <Box p={p} x={24} y={33} w={7} h={7} r={4} color="transparent" border={GOLD} />
      </>
    );
  }
  if (id === "sad") {
    return (
      <>
        <Box p={p} x={24} y={15} w={8} h={1.6} r={1} color={GOLDL} rotate="18deg" />
        <Eye p={p} x={25} y={19} look={0} />
        <Smile p={p} frown />
        <Box p={p} x={22} y={30} w={2.4} h={6} r={2} color={GOLDL} />
      </>
    );
  }
  if (id === "ok") {
    return (
      <>
        <Eye p={p} x={24} y={18} shut />
        <Eye p={p} x={34} y={18} />
        <Smile p={p} />
        <Text style={{ position: "absolute", left: p(44), top: p(36), color: GOLD, fontSize: p(12), fontWeight: "900" }}>✓</Text>
      </>
    );
  }
  if (id === "deal") {
    return (
      <>
        <Eye p={p} x={25} y={18} />
        <Smile p={p} />
        <Box p={p} x={40} y={42} w={10} h={10} r={5} color={GOLD} />
        <Box p={p} x={46} y={40} w={10} h={10} r={5} color={GOLDL} border={EM} />
      </>
    );
  }
  if (id === "fly") {
    return (
      <>
        <Eye p={p} x={25} y={18} look={-1} />
        <Box p={p} x={40} y={22} w={18} h={8} r={6} color={GOLD} rotate="-36deg" />
        <Box p={p} x={48} y={18} w={7} h={1.4} r={1} color={GOLDL} />
        <Box p={p} x={50} y={22} w={6} h={1.4} r={1} color={GOLDL} />
        <Box p={p} x={46} y={26} w={5} h={1.4} r={1} color={GOLDL} />
      </>
    );
  }
  if (id === "care") {
    return (
      <>
        <Eye p={p} x={25} y={19} s={7} />
        <Smile p={p} />
        <Box p={p} x={36} y={40} w={12} h={7} r={2} color={CREAM} border={GOLD} />
        <Box p={p} x={41} y={40} w={1.6} h={7} r={0} color={GOLD} />
        <Box p={p} x={36} y={42.4} w={12} h={1.6} r={0} color={GOLD} />
      </>
    );
  }
  if (id === "ask") {
    return (
      <>
        <Box p={p} x={24} y={14} w={9} h={1.6} r={1} color={GOLDL} rotate="-16deg" />
        <Eye p={p} x={25} y={18} />
        <Text style={{ position: "absolute", left: p(44), top: p(6), color: GOLD, fontSize: p(16), fontWeight: "900" }}>؟</Text>
      </>
    );
  }
  return (
    <>
      <Eye p={p} x={24} y={18} shut />
      <Smile p={p} />
      <Box p={p} x={46} y={8} w={4} h={4} r={1} color={GOLD} rotate="45deg" />
      <Box p={p} x={8} y={14} w={3.2} h={3.2} r={1} color={GOLDL} rotate="45deg" />
      <Box p={p} x={50} y={28} w={3} h={3} r={1} color={GOLD} rotate="45deg" />
    </>
  );
}

function Falcon({ id, size }) {
  const p = (n) => (n * size) / 64;
  return (
    <View style={{ width: size, height: size, direction: "ltr" }}>
      <Box p={p} x={14} y={32} w={36} h={24} r={16} color={EM} />
      <Box p={p} x={20} y={40} w={18} h={12} r={8} color={CREAM} />
      <Box p={p} x={18} y={12} w={28} h={28} r={14} color={EM} />
      <Crest p={p} />
      <Beak p={p} />
      <Box p={p} x={24} y={54} w={2} h={6} r={1} color={GOLD} />
      <Box p={p} x={32} y={54} w={2} h={6} r={1} color={GOLD} />
      {expression(id, p)}
    </View>
  );
}

export function TairSticker({ id, size = 78 }) {
  const sticker = TAIR_STICKERS.find((s) => s.id === id);
  const label = sticker?.label || "ملصق";
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`ملصق ${label}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: CREAM,
        borderWidth: Math.max(1, size * 0.028),
        borderColor: GOLD,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Falcon id={id} size={size * 0.92} />
    </View>
  );
}

export function StickerTray({ onPick, disabled }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={tray.row}
      keyboardShouldPersistTaps="handled"
    >
      {TAIR_STICKERS.map((s) => (
        <TouchableOpacity
          key={s.id}
          style={tray.item}
          activeOpacity={0.75}
          disabled={disabled}
          onPress={() => onPick(stickerToken(s.id))}
          accessibilityLabel={`ملصق ${s.label}`}
        >
          <TairSticker id={s.id} size={48} />
          <Text style={tray.caption}>{s.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const tray = {
  row: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  item: { width: 58, alignItems: "center" },
  caption: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: "800",
    color: TAIR.muted,
    textAlign: "center",
  },
};
