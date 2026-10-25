// Local YYYY-MM-DD (avoids the UTC shift of toISOString)
export const toDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getPresetRange = (preset) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  const end = new Date(today);

  switch (preset) {
    case 'yesterday':
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
      break;
    case 'thisWeek': {
      const day = today.getDay() === 0 ? 7 : today.getDay(); // Monday as first day
      start.setDate(today.getDate() - (day - 1));
      break;
    }
    case 'thisMonth':
      start.setDate(1);
      end.setMonth(today.getMonth() + 1, 0);
      break;
    case 'thisYear':
      start.setMonth(0, 1);
      end.setMonth(11, 31);
      break;
    default:
      break;
  }
  return { startDate: toDateString(start), endDate: toDateString(end) };
};

export const formatMoney = (value) =>
  `₹${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatAmount = (value) =>
  (Number(value) || 0) === 0
    ? '-'
    : (Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatDate = (value) => {
  if (!value) return '';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return d && m && y ? `${d}-${m}-${y}` : value;
};

export const PRESETS = ['today', 'yesterday', 'thisWeek', 'thisMonth', 'thisYear', 'custom'];
