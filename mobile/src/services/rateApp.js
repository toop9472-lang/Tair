// طير — Smart in-app rating prompt for the mobile app.
//
// Apple/Google guidance:
// - Ask only after a positive moment (successful order completion, etc.)
// - Don't ask more than 3 times a year (iOS enforces this)
// - Don't nag: wait ≥ 14 days between prompts, and remember dismissals.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

const KEY_LAST_ASKED = "tair_rating_last_asked_at";
const KEY_TIMES_ASKED = "tair_rating_times_asked";
const KEY_POSITIVE_EVENTS = "tair_rating_positive_events";
const MIN_DAYS_BETWEEN_PROMPTS = 14;
const MAX_PROMPTS_PER_YEAR = 3;
const REQUIRED_POSITIVE_EVENTS = 2; // Only ask after 2 good moments

/**
 * Log a positive event (e.g. order completed). When enough good moments have
 * happened, we ask for a review at the next call to `maybeAskForReview`.
 */
export async function logPositiveEvent() {
  try {
    const cur = parseInt((await AsyncStorage.getItem(KEY_POSITIVE_EVENTS)) || "0", 10);
    await AsyncStorage.setItem(KEY_POSITIVE_EVENTS, String(cur + 1));
  } catch {}
}

async function shouldAsk() {
  try {
    const available = await StoreReview.isAvailableAsync();
    if (!available) return false;
    const hasAction = await StoreReview.hasAction();
    if (!hasAction) return false;

    const positive = parseInt(
      (await AsyncStorage.getItem(KEY_POSITIVE_EVENTS)) || "0",
      10,
    );
    if (positive < REQUIRED_POSITIVE_EVENTS) return false;

    const times = parseInt(
      (await AsyncStorage.getItem(KEY_TIMES_ASKED)) || "0",
      10,
    );
    if (times >= MAX_PROMPTS_PER_YEAR) return false;

    const lastRaw = await AsyncStorage.getItem(KEY_LAST_ASKED);
    if (lastRaw) {
      const last = new Date(lastRaw);
      const daysAgo = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
      if (daysAgo < MIN_DAYS_BETWEEN_PROMPTS) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Ask the OS to show the native rate-my-app prompt IF conditions are met.
 * Safe to call after any happy moment — no-op if we shouldn't ask.
 */
export async function maybeAskForReview() {
  try {
    const ok = await shouldAsk();
    if (!ok) return false;
    await StoreReview.requestReview();
    const times = parseInt(
      (await AsyncStorage.getItem(KEY_TIMES_ASKED)) || "0",
      10,
    );
    await AsyncStorage.multiSet([
      [KEY_LAST_ASKED, new Date().toISOString()],
      [KEY_TIMES_ASKED, String(times + 1)],
      // Reset positive counter so we require new happy moments next time.
      [KEY_POSITIVE_EVENTS, "0"],
    ]);
    return true;
  } catch {
    return false;
  }
}
