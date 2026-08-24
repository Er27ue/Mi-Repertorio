export function getPageCount(itemCount, pageSize = 10) {
  const safePageSize = Math.max(1, Number(pageSize) || 1);
  return Math.max(1, Math.ceil(Math.max(0, Number(itemCount) || 0) / safePageSize));
}

export function clampPage(page, totalPages) {
  const safeTotal = Math.max(1, Number(totalPages) || 1);
  return Math.min(safeTotal, Math.max(1, Math.trunc(Number(page) || 1)));
}

export function paginateItems(items, page, pageSize = 10) {
  const safeItems = Array.isArray(items) ? items : [];
  const safePageSize = Math.max(1, Number(pageSize) || 1);
  const safePage = clampPage(page, getPageCount(safeItems.length, safePageSize));
  const start = (safePage - 1) * safePageSize;
  return safeItems.slice(start, start + safePageSize);
}
