export function getVisitsSalespersonFilterValue(
  viewingAs?: { name?: string } | null,
): string {
  return viewingAs?.name || 'all';
}

