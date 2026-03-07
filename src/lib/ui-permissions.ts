export type FarmRole =
  | "OWNER"
  | "MANAGER"
  | "ASSISTANT_MANAGER"
  | "VIEWER"
  | "";

export function isOwner(role: FarmRole) {
  return role === "OWNER";
}

export function canFinishCropUi(role: FarmRole) {
  return role === "OWNER" || role === "MANAGER";
}

export function canOperateUi(role: FarmRole) {
  return (
    role === "OWNER" ||
    role === "MANAGER" ||
    role === "ASSISTANT_MANAGER"
  );
}

export function isReadOnlyUi(role: FarmRole) {
  return role === "VIEWER";
}