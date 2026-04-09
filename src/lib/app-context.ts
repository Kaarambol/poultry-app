export const CURRENT_FARM_KEY = "currentFarmId";
export const CURRENT_CROP_KEY = "currentCropId";

export function getCurrentFarmId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(CURRENT_FARM_KEY) || "";
}

export function setCurrentFarmId(farmId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CURRENT_FARM_KEY, farmId);
}

export function getCurrentCropId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(CURRENT_CROP_KEY) || "";
}

export function setCurrentCropId(cropId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CURRENT_CROP_KEY, cropId);
}

export function clearCurrentCropId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CURRENT_CROP_KEY);
}

export const HISTORY_CROP_KEY = "historyCropId";

export function getHistoryCropId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(HISTORY_CROP_KEY) || "";
}

export function setHistoryCropId(cropId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_CROP_KEY, cropId);
}

export function clearHistoryCropId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_CROP_KEY);
}

export function isViewingHistory() {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(HISTORY_CROP_KEY);
}