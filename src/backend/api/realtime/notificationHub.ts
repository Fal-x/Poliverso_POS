type NotificationType = 'cash_session_opened' | 'cash_threshold_alert';

export interface NotificationPayload {
  type: NotificationType;
  site_id: string;
  created_at: string;
  message: string;
  data: Record<string, unknown>;
}

type Client = {
  id: string;
  send: (payload: NotificationPayload) => void;
};

const clientsBySite = new Map<string, Map<string, Client>>();

export function subscribeSiteNotifications(siteId: string, clientId: string, send: (payload: NotificationPayload) => void) {
  const siteClients = clientsBySite.get(siteId) ?? new Map<string, Client>();
  siteClients.set(clientId, { id: clientId, send });
  clientsBySite.set(siteId, siteClients);

  return () => {
    const current = clientsBySite.get(siteId);
    if (!current) return;
    current.delete(clientId);
    if (current.size === 0) {
      clientsBySite.delete(siteId);
    }
  };
}

export function publishSiteNotification(siteId: string, payload: NotificationPayload) {
  const siteClients = clientsBySite.get(siteId);
  if (!siteClients?.size) return;

  for (const client of siteClients.values()) {
    try {
      client.send(payload);
    } catch {
      // Ignore write errors; connection cleanup happens on close.
    }
  }
}
