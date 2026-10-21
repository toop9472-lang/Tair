// نفس جمل المشاركة ورابط الصفحة المستخدم في التطبيق.
export const SHARE_ORIGIN = "https://saqr-ui-sync.emergent.host";
export const PLAY_URL = "https://play.google.com/store/apps/details?id=com.saqr.rewards&pcampaignid=web_share";
export const APPLE_URL = "https://apps.apple.com/sa/app/%D8%B7%D9%8A%D8%B1-%D8%B3%D9%88%D9%82-%D8%A7%D9%84%D8%B7%D9%8A%D9%88%D8%B1-%D9%88-%D8%A7%D9%84%D8%AD%D9%8A%D9%88%D8%A7%D9%86%D8%A7%D8%AA/id6758868843?l=ar";
export const APP_LOGO = `${SHARE_ORIGIN}/tair_logo.png`;

export const SHARE_HOOK = {
  listing: "انظر لهذا الإعلان، أعجبني",
  store: "انظر لهذا المتجر، أعجبني",
  trip: "هذه الرحلة نالت على اهتمامي",
  clinic: "هذا الموضوع في العيادة لفت انتباهي",
  auction: "هذا المزاد نال على اهتمامي",
  story: "هذه اللحظة على طير أعجبتني",
  app: "أعجبني هذا التطبيق",
};

export function pageLink(kind, id) {
  return `${SHARE_ORIGIN}/api/share/${kind}/${encodeURIComponent(String(id))}`;
}

export function buildSharePayload({ kind, id, title, lines = [], image }) {
  const link = pageLink(kind, id);
  const hook = SHARE_HOOK[kind] || "من تطبيق طير";
  const cleanTitle = (title || "طير").trim();
  const cleanLines = (lines || []).map((line) => String(line || "").trim()).filter(Boolean).slice(0, 4);
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

export async function shareNow(input) {
  const payload = input?.message ? input : buildSharePayload(input);
  try {
    if (navigator.share) {
      await navigator.share({ title: payload.hook || payload.title, text: payload.message });
      return "shared";
    }
    await navigator.clipboard.writeText(payload.message);
    return "copied";
  } catch (e) {
    if (e?.name === "AbortError") return "cancelled";
    throw e;
  }
}
