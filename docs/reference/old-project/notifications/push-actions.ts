'use server';

import { requireUser } from '@/features/auth/session';
import { createClient } from '@/lib/supabase/server';

import { sendPush } from './push';

// This device and push notifications (Settings › Notifications): saying yes
// (the browser's subscription is kept), no, and a test. Each runs as the
// signed-in user, so RLS keeps every agency to its own devices.

type Result = { error: string | null };

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSubscription(subscription: BrowserSubscription, device: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      device: device.slice(0, 80),
    },
    { onConflict: 'endpoint' },
  );
  return { error: error ? error.message : null };
}

export async function removeSubscription(endpoint: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  return { error: error ? error.message : null };
}

/** How many devices get the morning summary. */
export async function countDevices(): Promise<number> {
  await requireUser();
  const supabase = await createClient();
  const { count } = await supabase.from('push_subscriptions').select('id', { count: 'exact', head: true });
  return count ?? 0;
}

/** A test push to every device that said yes. */
export async function sendTestPush(): Promise<Result & { sent: number }> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth');
  if (error) return { error: error.message, sent: 0 };
  if (!data || data.length === 0) return { error: 'No device is on yet — turn it on for this one first.', sent: 0 };
  try {
    const { sent, gone } = await sendPush(data, {
      title: 'Manasik',
      body: 'Notifications are on — your morning summary will look like this.',
      url: '/workspace',
      tag: 'test',
    });
    if (gone.length > 0) await supabase.from('push_subscriptions').delete().in('endpoint', gone);
    return { error: sent === 0 ? 'The push didn’t reach any device.' : null, sent };
  } catch (failure) {
    return { error: failure instanceof Error ? failure.message : 'Couldn’t send.', sent: 0 };
  }
}
