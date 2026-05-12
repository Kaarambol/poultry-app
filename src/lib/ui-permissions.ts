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

// Only OWNER sees financial costs (£/GBP)
export function canSeeCosts(role: FarmRole) {
  return role === "OWNER";
}

// OWNER and MANAGER can access the Total page
export function canAccessTotal(role: FarmRole) {
  return role === "OWNER" || role === "MANAGER";
}

// OWNER and MANAGER can add/edit/delete documents
export function canEditDocuments(role: FarmRole) {
  return role === "OWNER" || role === "MANAGER";
}