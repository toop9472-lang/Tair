// طير — City Selector Bottom Sheet (Mobile)
// Two-icon design: press "من" or "إلى" to open a beautiful modal listing all cities.
import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LOCATION_GROUPS, normalizePlace } from "../constants/saudiCities";

/**
 * Trigger button — a large, tap-friendly icon+label pill.
 * Use two of them side-by-side for from/to route pickers.
 *
 * Props:
 *   iconName    → Ionicons name (e.g. "location", "flag")
 *   iconColor   → background tint (teal / pink)
 *   label       → "من" / "إلى"
 *   value       → currently selected city or null
 *   onPress     → open sheet
 *   testId      → data-testid
 */
export function CityTriggerButton({ iconName, iconColor, label, value, onPress, testId }) {
  return (
    <TouchableOpacity
      style={styles.trigger}
      activeOpacity={0.85}
      onPress={onPress}
      data-testid={testId}
    >
      <View style={[styles.triggerIcon, { backgroundColor: iconColor + "22" }]}>
        <Ionicons name={iconName} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Text style={styles.triggerLabel}>{label}</Text>
        <Text
          style={[
            styles.triggerValue,
            !value && styles.triggerValuePlaceholder,
          ]}
          numberOfLines={1}
        >
          {value || "اختر المدينة"}
        </Text>
      </View>
      <Ionicons name="chevron-down" size={18} color="#8A7B66" />
    </TouchableOpacity>
  );
}

/**
 * Bottom-sheet listing all Saudi cities + Gulf countries with search.
 */
export function CitySelectorSheet({
  visible,
  title = "اختر المدينة",
  selected,
  onSelect,
  onClose,
  allowAll = false,
  exclude = [],
}) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = normalizePlace(query);
    const skip = new Set(exclude);
    const out = [];
    if (allowAll && !q) out.push({ key: "all", type: "all" });
    LOCATION_GROUPS.forEach((group) => {
      const cities = group.cities.filter((c) => {
        if (skip.has(c)) return false;
        if (!q) return true;
        return normalizePlace(c).includes(q) || normalizePlace(group.label).includes(q);
      });
      if (!cities.length) return;
      out.push({ key: `h-${group.id}`, type: "header", label: group.label });
      cities.forEach((name) => out.push({ key: `${group.id}-${name}`, type: "city", name }));
    });
    return out;
  }, [query, allowAll, exclude]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              data-testid="city-sheet-close"
            >
              <Ionicons name="close" size={22} color="#6B5E4A" />
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#8A7B66" />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث عن مدينة…"
              placeholderTextColor="#8A7B66"
              value={query}
              onChangeText={setQuery}
              data-testid="city-sheet-search"
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color="#cbd5e1" />
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            data={rows}
            keyExtractor={(row) => row.key}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 460 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => {
              if (item.type === "header") {
                return <Text style={styles.group}>{item.label}</Text>;
              }
              if (item.type === "all") {
                const isActive = !selected;
                return (
                  <TouchableOpacity
                    style={[styles.item, isActive && styles.itemActive]}
                    activeOpacity={0.7}
                    onPress={() => {
                      onSelect?.(null);
                      onClose?.();
                    }}
                    data-testid="city-item-all"
                  >
                    <Ionicons name="earth-outline" size={18} color="#1B3D2F" />
                    <Text style={[styles.itemText, isActive && styles.itemTextActive]}>كل المدن</Text>
                  </TouchableOpacity>
                );
              }
              const isActive = item.name === selected;
              return (
                <TouchableOpacity
                  style={[styles.item, isActive && styles.itemActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelect?.(item.name);
                    onClose?.();
                  }}
                  data-testid={`city-item-${item.name}`}
                >
                  <Ionicons
                    name={isActive ? "checkmark-circle" : "location-outline"}
                    size={18}
                    color={isActive ? "#1B3D2F" : "#8A7B66"}
                  />
                  <Text style={[styles.itemText, isActive && styles.itemTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="search" size={40} color="#cbd5e1" />
                <Text style={styles.emptyText}>لا توجد مدن مطابقة</Text>
              </View>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    minHeight: 60,
    flex: 1,
  },
  triggerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerLabel: {
    fontSize: 11,
    color: "#6B5E4A",
    fontWeight: "700",
    marginBottom: 2,
  },
  triggerValue: {
    fontSize: 14,
    color: "#0F241C",
    fontWeight: "800",
  },
  triggerValuePlaceholder: {
    color: "#8A7B66",
    fontWeight: "600",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    maxHeight: "85%",
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    backgroundColor: "#e2e8f0",
    borderRadius: 2,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0F241C",
  },
  group: {
    textAlign: "right",
    color: "#8A6A2E",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    color: "#0F241C",
    padding: 0,
  },
  item: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  itemActive: {
    backgroundColor: "#f0fdfa",
  },
  itemText: {
    fontSize: 15,
    color: "#334155",
    fontWeight: "600",
  },
  itemTextActive: {
    color: "#1B3D2F",
    fontWeight: "800",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 8,
    color: "#8A7B66",
    fontWeight: "700",
  },
});
