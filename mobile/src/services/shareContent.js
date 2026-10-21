/**
 * مشاركة من داخل التطبيق.
 * الرابط الذي يخرج هو saqr://… حتى يفتح المحتوى داخل طير،
 * وليس صفحة ويب.
 */
import { Alert, Share } from "react-native";

export const APP_SCHEME = "saqr";
export const SHARE_ORIGIN = "https://saqr-ui-sync.emergent.host";
export const PLAY_URL = "https://play.google.com/store/apps/details?id=com.saqr.rewards&pcampaignid=web_share";
export const APPLE_URL = "https://apps.apple.com/sa/app/%D8%B7%D9%8A%D8%B1-%D8%B3%D9%88%D9%82-%D8%A7%D9%84%D8%B7%D9%8A%D9%88%D8%B1-%D9%88-%D8%A7%D9%84%D8%AD%D9%8A%D9%88%D8%A7%D9%86%D8%A7%D8%AA/id6758868843?l=ar";
export const APP_LOGO = `${SHARE_ORIGIN}/tair_logo.png`;

const KINDS = new Set(["listing", "auction", "story", "trip", "store", "clinic", "app"]);

export const SHARE_HOOK = {
  listing: "انظر لهذا الإعلان، أعجبني",
  store: "انظر لهذا المتجر، أعجبني",
  trip: "هذه الرحلة نالت على اهتمامي",
  clinic: "هذا الموضوع في العيادة لفت انتباهي",
  auction: "هذا المزاد نال على اهتمامي",
  story: "هذه اللحظة على طير أعجبتني",
  app: "أعجبني هذا التطبيق",
};

let presentShare = null;

export function bindShareSheet(fn) {
  presentShare = fn;
  return () => {
    if (presentShare === fn) presentShare = null;
  };
}

function decodeId(raw) {
  if (!raw) return "";
  try { return decodeURIComponent(raw); } catch { return raw; }
}

export function deepLink(kind, id) {
  return `${APP_SCHEME}://${kind}/${encodeURIComponent(String(id))}`;
}

export function pageLink(kind, id) {
  return `${SHARE_ORIGIN}/api/share/${kind}/${encodeURIComponent(String(id))}`;
}

export function parseIncomingLink(raw) {
  if (!raw || typeof raw !== "string") return null;
  let url;
  try { url = new URL(raw.trim()); } catch { return null; }
  const scheme = (url.protocol || "").replace(":", "").toLowerCase();

  if (scheme === "saqr" || scheme === "tair") {
    const host = (url.hostname || "").toLowerCase();
    if (!KINDS.has(host)) return null;
    const id = decodeId((url.pathname || "").replace(/^\//, "").split("/").filter(Boolean)[0] || "");
    if (!id) return null;
    return { kind: host, id };
  }

  if (scheme === "http" || scheme === "https") {
    const parts = (url.pathname || "").split("/").filter(Boolean).map(decodeId);
    const at = parts.indexOf("share");
    if (at < 0) return null;
    const kind = (parts[at + 1] || "").toLowerCase();
    const id = parts[at + 2] || "";
    if (!KINDS.has(kind) || !id) return null;
    return { kind, id };
  }

  return null;
}

export function buildSharePayload({ kind, id, title, lines = [], image }) {
  const link = pageLink(kind, id);
  const hook = SHARE_HOOK[kind] || "من تطبيق طير";
  const cleanTitle = (title || "طير").trim();
  const cleanLines = (lines || []).map((l) => String(l || "").trim()).filter(Boolean).slice(0, 4);
  const message = [hook, cleanTitle, ...cleanLines, "", link].join("\n");
  return {
    kind,
    id,
    hook,
    title: cleanTitle,
    lines: cleanLines,
    link,
    image: image || (kind === "app" ? APP_LOGO : ""),
    message,
  };
}

export function shareAppPayload() {
  return buildSharePayload({
    kind: "app",
    id: "download",
    title: "طير — سوق الطيور والحيوانات",
    image: APP_LOGO,
    lines: ["اضغط ايفون أو اندرويد للتحميل"],
  });
}

export async function nativeShare(input) {
  if (!input?.kind || input.id == null || input.id === "") return null;
  const payload = input.message ? input : buildSharePayload(input);
  try {
    const result = await Share.share(
      { title: payload.hook || payload.title, message: payload.message },
      {
        dialogTitle: "مشاركة من طير",
        subject: payload.hook || payload.title,
        tintColor: "#1B3D2F",
      },
    );
    return result;
  } catch (e) {
    const msg = String(e?.message || "");
    if (/cancel|dismiss|لم يكتمل/i.test(msg)) return null;
    Alert.alert("تعذّرت المشاركة", "أعد المحاولة من داخل التطبيق.");
    return null;
  }
}

export function shareInApp(input) {
  if (!input?.kind || input.id == null || input.id === "") return Promise.resolve(null);
  const payload = buildSharePayload(input);
  if (presentShare) {
    presentShare(payload);
    return Promise.resolve({ action: "presented" });
  }
  return nativeShare(payload);
}
