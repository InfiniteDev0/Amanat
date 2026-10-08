import 'server-only';

import webpush from 'web-push';

// Sending Web Push (D17): the standard the browsers share — Chrome, Edge,
// Firefox, Android, and iPhone once the app is on the Home Screen. Each
// message is encrypted for its device with the keys it gave when it said yes.

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Where a tap opens. */
  url: string;
  /** Replaces an earlier message with the same tag instead of stacking. */
  tag?: string;
}

function configured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@manasik.app', publicKey, privateKey);
  return true;
}

/**
 * Sends one message to each device. Returns the endpoints that are gone for
 * good (the browser unsubscribed, or the app was removed), to be deleted.
 */
export async function sendPush(targets: PushTarget[], message: PushMessage): Promise<{ sent: number; gone: string[] }> {
  if (!configured()) throw new Error('Push keys are missing (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY).');
  const payload = JSON.stringify(message);
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    targets.map(async (target) => {
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          payload,
          { TTL: 60 * 60 * 6 },
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(target.endpoint);
      }
    }),
  );
  return { sent, gone };
}
