export function getDateRangeBoundaries(rangeType) {
  const now = new Date();
  let start = null;
  let end = null;

  switch (rangeType) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      break;
    case "this_week": {
      // Start of week (Monday)
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      // End of week (Sunday 23:59:59)
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
      end.setTime(end.getTime() - 1);
      break;
    }
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "all_time":
    default:
      start = null;
      end = null;
      break;
  }
  return { start, end };
}

export function isDateInRange(date, start, end) {
  if (!date) return false;
  const time = typeof date.toDate === "function" ? date.toDate().getTime() : new Date(date).getTime();
  
  if (start && time < start.getTime()) return false;
  if (end && time > end.getTime()) return false;
  
  return true;
}
