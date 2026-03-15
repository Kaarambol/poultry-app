type PlacementRemovalInput = {
  birdsPlaced: number;
  thinDate?: Date | string | null;
  thinBirds?: number | null;
  thin2Date?: Date | string | null;
  thin2Birds?: number | null;
  clearDate?: Date | string | null;
  clearBirds?: number | null;
};

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getPlacementRemovedBirdsUntilDate(
  placement: PlacementRemovalInput,
  upToDate: Date | string
) {
  const targetDate = normalizeDate(upToDate);
  if (!targetDate) return 0;

  let removed = 0;

  const thinDate = normalizeDate(placement.thinDate);
  const thin2Date = normalizeDate(placement.thin2Date);
  const clearDate = normalizeDate(placement.clearDate);

  if (thinDate && thinDate <= targetDate) {
    removed += Math.max(0, Number(placement.thinBirds || 0));
  }

  if (thin2Date && thin2Date <= targetDate) {
    removed += Math.max(0, Number(placement.thin2Birds || 0));
  }

  if (clearDate && clearDate <= targetDate) {
    removed += Math.max(0, Number(placement.clearBirds || 0));
  }

  return removed;
}

export function getPlacementBirdsAvailableOnDate(
  placement: PlacementRemovalInput,
  upToDate: Date | string
) {
  const placed = Math.max(0, Number(placement.birdsPlaced || 0));
  const removed = getPlacementRemovedBirdsUntilDate(placement, upToDate);
  return Math.max(0, placed - removed);
}