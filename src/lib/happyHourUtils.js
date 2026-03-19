import { HappyHourDB } from '@/components/HappyHourSettings';

let cachedRules = null;
let cacheTime = 0;

export async function getActiveHappyHour() {
  // Cache for 60s to avoid repeated requests
  if (cachedRules && Date.now() - cacheTime < 60000) {
    return findActive(cachedRules);
  }
  cachedRules = await HappyHourDB.filter({ active: true });
  cacheTime = Date.now();
  return findActive(cachedRules);
}

function findActive(rules) {
  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return rules.find(rule => {
    const days = rule.days_of_week;
    if (days && days.length > 0 && !days.includes(currentDay)) return false;

    const [sh, sm] = rule.start_time.split(':').map(Number);
    const [eh, em] = rule.end_time.split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;

    return currentMinutes >= start && currentMinutes < end;
  }) || null;
}

export function applyHappyHourPrice(product, happyHour) {
  if (!happyHour) return product.price;
  const cats = happyHour.categories;
  if (cats && cats.length > 0 && !cats.includes(product.category)) return product.price;
  return product.price * (1 - happyHour.discount_percent / 100);
}

export function invalidateHappyHourCache() {
  cachedRules = null;
  cacheTime = 0;
}
