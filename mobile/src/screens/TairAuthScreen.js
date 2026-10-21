// طير — Clean, Tair-branded auth screen for mobile.
// Email + password sign-in / register (no guest mode) with "remember me".
// Uses fetch directly to /api/auth/signin and /api/auth/register.
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { TAIR_PALETTE } from "../constants/tairDesign";

const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  "https://saqr4u.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function api(path, body) {
  const res = await fetch(`${API_URL.replace(/\/+$/, "")}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* noop */ }
  if (!res.ok) {
    const msg = data?.detail || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : (msg[0]?.msg || "خطأ"));
  }
  return data || {};
}

export default function TairAuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("signin");   // "signin" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("tair_saved_email").then((v) => { if (v) setEmail(v); }).catch(() => {});
  }, []);

  const validate = () => {
    if (!EMAIL_RE.test(email.trim())) return "البريد الإلكتروني غير صحيح";
    if (password.length < 6) return "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
    if (mode === "register" && name.trim().length < 2) return "أدخل اسمك الكامل";
    return null;
  };

  const finish = async (data) => {
    if (remember) {
      if (data.token) await AsyncStorage.setItem("saqr_token", data.token);
      if (data.refresh_token) await AsyncStorage.setItem("saqr_refresh", data.refresh_token);
      if (data.user) await AsyncStorage.setItem("saqr_user", JSON.stringify(data.user));
      await AsyncStorage.setItem("tair_saved_email", email.trim().toLowerCase());
    } else {
      await AsyncStorage.multiRemove(["saqr_token", "saqr_refresh", "tair_saved_email"]);
    }
    onAuthenticated?.(data.user, data.token, remember, data.refresh_token);
  };

  const submit = async () => {
    setError("");
    const v = validate();
    if (v) return setError(v);
    setBusy(true);
    try {
      const em = email.trim().toLowerCase();
      if (mode === "register") {
        await api("/api/auth/register", { email: em, password, name: name.trim() });
        const data = await api("/api/auth/signin", { email: em, password });
        await finish(data);
      } else {
        const data = await api("/api/auth/signin", { email: em, password });
        await finish(data);
      }
    } catch (e) {
      setError(e.message || "تعذّر إتمام العملية");
    } finally {
      setBusy(false);
    }
  };



  const forgot = () => {
    Alert.alert(
      "استعادة كلمة المرور",
      "لاستعادة كلمة المرور تواصل معنا على البريد: support@saqr4u.com",
      [{ text: "حسناً" }],
    );
  };

  return (
    <LinearGradient
      colors={["#0F241C", "#1B3D2F", "#3D6B54"]}
      style={s.wrap}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand hero */}
          <View style={s.hero}>
            <Text style={s.wordmark}>طير</Text>
            <Text style={s.tagline}>
              سوق الطيور والمستلزمات في المملكة
            </Text>
          </View>

          {/* Card */}
          <View style={s.card} testID="tair-auth-card">
            {/* Mode tabs */}
            <View style={s.tabRow}>
              <TouchableOpacity
                onPress={() => { setMode("signin"); setError(""); }}
                style={[s.tab, mode === "signin" && s.tabActive]}
                testID="tab-signin"
              >
                <Text style={[s.tabText, mode === "signin" && s.tabTextActive]}>
                  تسجيل الدخول
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setMode("register"); setError(""); }}
                style={[s.tab, mode === "register" && s.tabActive]}
                testID="tab-register"
              >
                <Text style={[s.tabText, mode === "register" && s.tabTextActive]}>
                  إنشاء حساب
                </Text>
              </TouchableOpacity>
            </View>

            {/* Name (register only) */}
            {mode === "register" && (
              <View style={s.field}>
                <Ionicons name="person-outline" size={18} color="#8A7B66" style={s.fieldIcon} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="الاسم الكامل"
                  placeholderTextColor="#8A7B66"
                  style={s.input}
                  autoCapitalize="words"
                  testID="input-name"
                />
              </View>
            )}

            {/* Email */}
            <View style={s.field}>
              <Ionicons name="mail-outline" size={18} color="#8A7B66" style={s.fieldIcon} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="البريد الإلكتروني"
                placeholderTextColor="#8A7B66"
                style={s.input}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                testID="input-email"
              />
            </View>

            {/* Password */}
            <View style={s.field}>
              <Ionicons name="lock-closed-outline" size={18} color="#8A7B66" style={s.fieldIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={mode === "register" ? "6 أحرف على الأقل" : "كلمة المرور"}
                placeholderTextColor="#8A7B66"
                style={[s.input, { paddingLeft: 42 }]}
                secureTextEntry={!showPw}
                testID="input-password"
              />
              <TouchableOpacity
                onPress={() => setShowPw((v) => !v)}
                style={s.eyeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color="#6B5E4A" />
              </TouchableOpacity>
            </View>

            {mode === "signin" && (
              <TouchableOpacity onPress={forgot} style={s.forgotWrap}>
                <Text style={s.forgotText}>نسيت كلمة المرور؟</Text>
              </TouchableOpacity>
            )}

            {error ? (
              <View style={s.errorBox} testID="auth-error">
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit */}
            <TouchableOpacity
              onPress={submit}
              disabled={busy}
              style={[s.submitBtn, busy && { opacity: 0.6 }]}
              testID="auth-submit"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.submitText}>
                  {mode === "signin" ? "دخول" : "إنشاء حساب"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Remember me */}
            <TouchableOpacity
              onPress={() => setRemember((v) => !v)}
              style={s.rememberRow}
              activeOpacity={0.7}
              testID="auth-remember"
            >
              <Ionicons name={remember ? "checkbox" : "square-outline"} size={22} color="#1B3D2F" />
              <Text style={s.rememberText}>تذكرني — دخول تلقائي في المرات القادمة</Text>
            </TouchableOpacity>

            {/* Terms note */}
            <Text style={s.termsNote}>
              باستمرارك فأنت توافق على{" "}
              <Text style={s.termsLink}>شروط الاستخدام</Text> و
              <Text style={s.termsLink}> سياسة الخصوصية</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  hero: { alignItems: "center", marginBottom: 24 },
  wordmark: {
    fontSize: 64,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 2,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  tagline: {
    marginTop: 6,
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFDF8",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E6DCC8",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  tabRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#F0EAD8",
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabActive: {
    backgroundColor: "#FFFDF8",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: { fontSize: 14, fontWeight: "700", color: "#8A6A2E" },
  tabTextActive: { color: TAIR_PALETTE.primary },
  field: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#F7F1E8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6DCC8",
    marginBottom: 12,
    paddingHorizontal: 12,
    minHeight: 50,
    position: "relative",
  },
  fieldIcon: { marginLeft: 8 },
  input: {
    flex: 1,
    color: "#1B3D2F",
    fontSize: 15,
    textAlign: "right",
    paddingVertical: 12,
  },
  eyeBtn: { position: "absolute", left: 12, top: 14 },
  forgotWrap: { alignSelf: "flex-start", marginBottom: 10 },
  forgotText: {
    fontSize: 12,
    color: TAIR_PALETTE.primary,
    fontWeight: "700",
    textAlign: "left",
  },
  errorBox: {
    backgroundColor: "#FDECEA",
    borderColor: "#F5B8AE",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  errorText: { color: "#8B3A2F", fontSize: 13, textAlign: "right", fontWeight: "600" },
  submitBtn: {
    backgroundColor: TAIR_PALETTE.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitText: { color: "#C6A15B", fontSize: 16, fontWeight: "800" },
  rememberRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, paddingVertical: 6 },
  rememberText: { color: "#1B3D2F", fontSize: 13, fontWeight: "700" },
  guestBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6DCC8",
    backgroundColor: "#FFFDF8",
  },
  guestText: { color: "#1B3D2F", fontSize: 14, fontWeight: "700" },
  termsNote: {
    marginTop: 16,
    fontSize: 11,
    color: "#E0C580",
    textAlign: "center",
    lineHeight: 16,
  },
  termsLink: { color: "#C6A15B", fontWeight: "700" },
});
