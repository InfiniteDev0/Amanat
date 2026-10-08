'use client';

import { gooeyToast } from 'goey-toast';
import { BellIcon, BellOffIcon, SendIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAgencySettings } from '@/features/workspace/records-store';
import { cn } from '@/lib/utils';

import { countDevices, removeSubscription, saveSubscription, sendTestPush } from './push-actions';

// Settings › Notifications (D17): the morning summary on or off, the hour it
// comes (Nairobi time, 5am unless changed), and this device — a browser only
// gets pushes once it has said yes here.

/** The public key, as the browser wants it. */
function applicationServerKey(base64: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/** "Chrome on Windows" — so the list of devices reads like devices. */
function deviceName(): string {
  const agent = navigator.userAgent;
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /Chrome\//.test(agent)
      ? 'Chrome'
      : /Firefox\//.test(agent)
        ? 'Firefox'
        : /Safari\//.test(agent)
          ? 'Safari'
          : 'Browser';
  const system = /Android/.test(agent)
    ? 'Android'
    : /iPhone|iPad/.test(agent)
      ? 'iPhone'
      : /Windows/.test(agent)
        ? 'Windows'
        : /Mac OS/.test(agent)
          ? 'Mac'
          : 'this device';
  return `${browser} on ${system}`;
}

const hourLabel = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour < 12 ? 'AM' : 'PM'}`;

type DeviceState = 'checking' | 'unsupported' | 'blocked' | 'off' | 'on';

export function NotificationSettings({
  Section,
}: {
  /** The Settings page's own section layout, so this reads like the rest of it. */
  Section: React.ComponentType<{ title: string; description: string; children: React.ReactNode }>;
}) {
  const [settings, save] = useAgencySettings();
  const enabled = settings?.notifyEnabled ?? true;
  const hour = settings?.notifyHour ?? 5;
  const [device, setDevice] = React.useState<DeviceState>('checking');
  const [devices, setDevices] = React.useState<number | null>(null);
  const [busy, startBusy] = React.useTransition();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  // Where this browser stands: can it take pushes, has it said yes or no.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !publicKey) {
        if (!cancelled) setDevice('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setDevice('blocked');
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (!cancelled) setDevice(subscription ? 'on' : 'off');
    })();
    countDevices()
      .then((count) => !cancelled && setDevices(count))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const turnOn = () =>
    startBusy(async () => {
      if (!publicKey) return;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setDevice(permission === 'denied' ? 'blocked' : 'off');
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(publicKey),
      });
      const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { error } = await saveSubscription(json, deviceName());
      if (error) {
        gooeyToast.error(error);
        return;
      }
      setDevice('on');
      setDevices(await countDevices());
      gooeyToast.success('Notifications on for this device');
    });

  const turnOff = () =>
    startBusy(async () => {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removeSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setDevice('off');
      setDevices(await countDevices());
      gooeyToast.success('Notifications off for this device');
    });

  const test = () =>
    startBusy(async () => {
      const { error, sent } = await sendTestPush();
      if (error) gooeyToast.error(error);
      else gooeyToast.success(`Sent to ${sent} device${sent === 1 ? '' : 's'}`);
    });

  return (
    <Section
      title="Notifications"
      description="A morning summary of what’s waiting — flights, money owed, suppliers to pay, visas — pushed to your phone or computer."
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Morning summary</span>
          <span className="text-muted-foreground text-sm">
            {enabled ? `Every day at ${hourLabel(hour)} (Nairobi time)` : 'Off'}
          </span>
        </div>
        {/* On or off for the whole agency — the devices below stay as they are. */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Morning summary"
          onClick={() => save({ notifyEnabled: !enabled })}
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors',
            enabled ? 'bg-primary' : 'bg-muted-foreground/30',
          )}
        >
          <span
            className={cn(
              'bg-background absolute left-0.5 top-0.5 size-5 rounded-full shadow transition-transform',
              enabled && 'translate-x-5',
            )}
          />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notify-hour" className="text-sm font-semibold">
          Time
        </Label>
        <Select
          value={String(hour)}
          disabled={!enabled}
          onValueChange={(next: string | null) => next && save({ notifyHour: Number(next) })}
        >
          <SelectTrigger id="notify-hour" className="h-11 w-full rounded-xl data-[size=default]:h-11 sm:w-56">
            <SelectValue>{hourLabel(hour)}</SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {Array.from({ length: 24 }, (_, value) => (
              <SelectItem key={value} value={String(value)}>
                {hourLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">This device</span>
          <span className="text-muted-foreground text-sm">
            {device === 'checking'
              ? 'Checking…'
              : device === 'unsupported'
                ? 'This browser can’t take notifications. On an iPhone, add Manasik to the Home Screen first (Share → Add to Home Screen), then open it from there.'
                : device === 'blocked'
                  ? 'Blocked in this browser’s settings — allow notifications for this site, then come back.'
                  : device === 'on'
                    ? 'On — the morning summary comes here.'
                    : 'Off — this device won’t get the morning summary.'}
            {devices !== null && devices > 0 ? ` · ${devices} device${devices === 1 ? '' : 's'} on in all` : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {device === 'on' ? (
            <>
              <Button variant="outline" disabled={busy} onClick={test}>
                <SendIcon />
                Send a test
              </Button>
              <Button variant="ghost" disabled={busy} onClick={turnOff}>
                <BellOffIcon />
                Turn off here
              </Button>
            </>
          ) : device === 'off' ? (
            <Button disabled={busy} onClick={turnOn}>
              <BellIcon />
              Turn on for this device
            </Button>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
