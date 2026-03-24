import { useSettings } from '@/hooks/useSettings';

export function useBranding() {
  const { data: settings } = useSettings();
  return {
    barName:   settings?.bar_name   || 'BarMaster',
    logoUrl:   settings?.logo_url   || null,
    bannerUrl: settings?.banner_url || '/banner-emporiopires.webp',
  };
}
