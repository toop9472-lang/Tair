import { TAIR } from "../constants/tairTheme";

export function tripPhase(status) {
  if (status === "completed") {
    return { key: "completed", label: "مكتملة", bg: TAIR.successSoft, fg: TAIR.success };
  }
  if (status === "arrived") {
    return { key: "arrived", label: "وصلت", bg: TAIR.successSoft, fg: TAIR.success };
  }
  if (status === "cancelled") {
    return { key: "cancelled", label: "ملغاة", bg: TAIR.dangerSoft, fg: TAIR.error };
  }
  if (status === "scheduled") {
    return { key: "upcoming", label: "قادمة", bg: TAIR.goldWash, fg: TAIR.goldDark };
  }
  return { key: "active", label: "جارية", bg: TAIR.emeraldWash, fg: TAIR.emerald };
}

export const TRIP_FLOW = ["scheduled", "departed", "in_transit", "arrived", "completed"];

export const TRIP_STEP_LABEL = {
  scheduled: "قادمة",
  departed: "انطلقت",
  in_transit: "في الطريق",
  arrived: "وصلت",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

export const TRIP_NEXT = {
  scheduled: "departed",
  departed: "in_transit",
  in_transit: "arrived",
  arrived: "completed",
};

export const REQUEST_STATUS = {
  pending: { label: "بانتظار القبول", bg: TAIR.warningSoft, fg: TAIR.goldDark },
  accepted: { label: "مقبولة", bg: TAIR.emeraldWash, fg: TAIR.emerald },
  in_progress: { label: "في الطريق", bg: TAIR.successSoft, fg: TAIR.success },
  completed: { label: "مكتملة", bg: TAIR.successSoft, fg: TAIR.emeraldDeep },
  cancelled: { label: "ملغاة", bg: TAIR.dangerSoft, fg: TAIR.error },
};
