export const LIMITS = {
  TITLE_MAX_CODE_POINTS: 200,
  BODY_MAX_CODE_POINTS: 10000,
  CHECKLIST_ITEM_MAX_CODE_POINTS: 80,
  MAX_CHECKLIST_ITEMS: 50,
} as const;

export function countCodePoints(str: string): number {
  return [...str].length;
}

export function truncateChecklistItemText(str: string): { text: string; wasTruncated: boolean } {
  const points = [...str];
  if (points.length <= LIMITS.CHECKLIST_ITEM_MAX_CODE_POINTS) {
    return { text: str, wasTruncated: false };
  }
  return {
    text: points.slice(0, LIMITS.CHECKLIST_ITEM_MAX_CODE_POINTS).join(''),
    wasTruncated: true,
  };
}