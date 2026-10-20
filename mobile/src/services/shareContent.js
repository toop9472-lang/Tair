/**
 * مشاركة من داخل التطبيق.
 * الرابط الذي يخرج هو saqr://… حتى يفتح المحتوى داخل طير،
 * وليس صفحة ويب.
 */
import { Alert, Platform, Share } from "react-native";

export const APP_SCHEME = "saqr";
export const SHARE_ORIGIN = "https://saqr-ui-sync.emergent.host";

const KINDS = new Set(["listing", "auction", "story", "trip", "store"]);

const KIND_LABEL = {
  listing: "إعلان",
  auction: "مزاد",
  story: "قصة",
  trip: "رحلة",
  store: "متجر",
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
  return `${SHARE_ORIGIN}/share/${kind}/${encodeURIComponent(String(id))}`;
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
  const cleanTitle = (title || KIND_LABEL[kind] || "طير").trim();
  const cleanLines = (lines || []).map((l) => String(l || "").trim()).filter(Boolean).slice(0, 4);
  const message = [cleanTitle, ...cleanLines, "", link].join("\n");
  return { kind, id, title: cleanTitle, lines: cleanLines, link, image: image || "", message };
}

export async function nativeShare(input) {
  if (!input?.kind || input.id == null || input.id === "") return null;
  const payload = input.message ? input : buildSharePayload(input);
  try {
    const result = await Share.share(
      Platform.OS === "ios"
        ? { title: payload.title, message: payload.message, url: payload.link }
        : { title: payload.title, message: payload.message },
      {
        dialogTitle: "مشاركة من طير",
        subject: payload.title,
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
