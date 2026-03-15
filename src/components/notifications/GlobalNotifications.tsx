import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { resolveApiBaseUrl } from '@/api/baseUrl';
import { getAccessToken, getAuthUser, getSiteIdStored } from '@/lib/auth';

const API_URL = resolveApiBaseUrl();

type StreamEvent = {
  type: 'cash_session_opened' | 'cash_threshold_alert';
  site_id: string;
  created_at: string;
  message: string;
  data: {
    connected?: boolean;
    opened_by_name?: string | null;
    terminal_id?: string;
    opening_cash_amount?: string;
    expected_cash_amount?: string;
    threshold_amount?: string;
  };
};

export function GlobalNotifications() {
  const location = useLocation();

  useEffect(() => {
    const user = getAuthUser();
    const token = getAccessToken();
    const siteId = getSiteIdStored();

    if (!user || !token || !siteId || location.pathname === '/login') {
      return;
    }

    const url = new URL(`${API_URL}/notifications/stream`);
    url.searchParams.set('site_id', siteId);
    url.searchParams.set('token', token);

    const source = new EventSource(url.toString());

    const onCashOpened = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as StreamEvent;
        if (payload.data?.connected) return;

        const openedBy = payload.data?.opened_by_name || 'Usuario';
        const openingCash = payload.data?.opening_cash_amount ?? '0.00';
        const terminal = payload.data?.terminal_id ? ` • Terminal ${payload.data.terminal_id}` : '';

        toast({
          title: 'Apertura de caja',
          description: `${openedBy} abrió caja con $${openingCash}${terminal}`,
          duration: 6500,
        });
      } catch {
        // Ignore malformed events
      }
    };

    const onCashThreshold = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as StreamEvent;
        if (payload.data?.connected) return;

        const expectedCash = payload.data?.expected_cash_amount ?? '0.00';
        const threshold = payload.data?.threshold_amount ?? '500000.00';

        toast({
          title: 'Mucho efectivo en caja',
          description: `Caja esperada $${expectedCash}. Se recomienda retiro parcial al superar $${threshold}.`,
          duration: 8000,
        });
      } catch {
        // Ignore malformed events
      }
    };

    source.addEventListener('cash_session_opened', onCashOpened as EventListener);
    source.addEventListener('cash_threshold_alert', onCashThreshold as EventListener);
    source.onerror = () => {
      source.close();
    };

    return () => {
      source.removeEventListener('cash_session_opened', onCashOpened as EventListener);
      source.removeEventListener('cash_threshold_alert', onCashThreshold as EventListener);
      source.close();
    };
  }, [location.pathname]);

  return null;
}
