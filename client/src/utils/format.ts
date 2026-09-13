export function formatPrice(value: number): string {
  const grouped = value.toLocaleString('mn-MN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${grouped}₮`;
}

export function rentalUnitLabel(unit: string | null | undefined): string {
  switch (unit) {
    case 'hour':
      return 'цаг';
    case 'month':
      return 'сар';
    case 'day':
    default:
      return 'өдөр';
  }
}

export function formatRentalPrice(price: number, unit: string | null | undefined): string {
  return `${formatPrice(price)}/${rentalUnitLabel(unit)}`;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'дөнгөж сая';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} минутын өмнө`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} цагийн өмнө`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} өдрийн өмнө`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} долоо хоногийн өмнө`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} сарын өмнө`;
  return `${Math.floor(days / 365)} жилийн өмнө`;
}

export function offerCountdown(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const remaining = then - Date.now();
  if (remaining <= 0) return 'Хугацаа дууссан';
  const hours = Math.floor(remaining / 3600000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} өдөр ${hours % 24} цаг үлдсэн`;
  }
  if (hours >= 1) return `${hours} цаг үлдсэн`;
  return `${Math.max(1, Math.floor(remaining / 60000))} минут үлдсэн`;
}