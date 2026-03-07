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