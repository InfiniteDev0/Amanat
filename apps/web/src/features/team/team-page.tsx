'use client';

import { type Invitation, type MemberRow, ROLES, type Role } from '@sarrif/core';
import { gooeyToast } from 'goey-toast';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { PlusIcon, Share2Icon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';

import { ActionSheet } from '@/components/action-sheet';
import { Button } from '@/components/ui/button';
import { PhoneField } from '@/features/auth/phone-field';
import { type PhoneInput, toE164 } from '@/features/auth/schemas';
import { useSession } from '@/features/auth/queries';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { formErrorKey, useMessage } from '@/lib/api/errors';
import { ltr } from '@/lib/ltr';
import { cn } from '@/lib/utils';

import { useCancelInvite, useInvite, useRemoveMember, useSetRole, useTeam } from './queries';

const prettyPhone = (phone: string) => ltr(parsePhoneNumberFromString(phone)?.formatInternational() ?? phone);

/** "3 hours ago", "2 days ago": how long since. */
function useAgo() {
  const locale = useLocale();
  return (iso: string) => {
    const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
    const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (Math.abs(minutes) < 60) return format.format(minutes, 'minute');
    if (Math.abs(minutes) < 60 * 24) return format.format(Math.round(minutes / 60), 'hour');
    return format.format(Math.round(minutes / (60 * 24)), 'day');
  };
}

/** The three rights as big buttons, each with what it allows. */
function RoleButtons({ value, onChange, disabled }: { value: Role; onChange: (role: Role) => void; disabled?: (role: Role) => boolean }) {
  const t = useTranslations('team');
  const tRoles = useTranslations('roles');
  return (
    <div role="radiogroup" aria-label={t('access')} className="flex flex-col gap-2">
      {ROLES.map((role) => {
        const picked = role === value;
        const off = disabled?.(role) ?? false;
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={picked}
            disabled={off}
            onClick={() => onChange(role)}
            className={cn(
              'flex min-h-16 flex-col justify-center rounded-xl px-4 py-2.5 text-start transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
              picked ? 'bg-primary text-primary-foreground' : 'bg-field text-foreground enabled:hover:bg-field-focus',
            )}
          >
            <span className="text-lg font-bold">{tRoles(role)}</span>
            <span className={cn('text-sm', picked ? 'opacity-90' : 'text-muted-foreground')}>{t(`roleHelp.${role}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The invitation as a WhatsApp message: which shop, which right, where to sign in. */
function useShareInvite() {
  const t = useTranslations('team');
  const tRoles = useTranslations('roles');
  const locale = useLocale();
  const { workspace } = useWorkspace();
  return (invitation: Invitation) => {
    const text = t('inviteMessage', { shop: workspace.name, role: tRoles(invitation.role), link: `${window.location.origin}/${locale}`, phone: prettyPhone(invitation.phone ?? '') });
    const to = (invitation.phone ?? '').replace(/^\+/, '');
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
}

/** Invite: their phone and their right; then Share to WhatsApp. */
function InviteSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('team');
  const message = useMessage();
  const { workspace } = useWorkspace();
  const invite = useInvite(workspace.id);
  const share = useShareInvite();
  const [phone, setPhone] = useState<PhoneInput>({ country: 'KE', number: '' });
  const [role, setRole] = useState<Role>('editor');
  const [tried, setTried] = useState(false);
  const e164 = toE164(phone);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (!e164) return;
    invite.mutateAsync({ phone: e164, role }).then(
      (invitation) => {
        gooeyToast.success(t('invited'));
        share(invitation);
        onOpenChange(false);
        setPhone({ country: phone.country, number: '' });
        setTried(false);
      },
      (error) => gooeyToast.error(message(formErrorKey(error))),
    );
  };

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange} title={t('inviteTitle')} closeLabel={t('close')}>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-lg font-semibold">{t('phone')}</span>
          <PhoneField id="invite-phone" value={phone} onChange={setPhone} error={tried && !e164 ? message(phone.number.trim() ? 'validation.phone' : 'validation.phoneRequired') : null} />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-lg font-semibold">{t('access')}</span>
          <RoleButtons value={role} onChange={setRole} />
        </div>
        <p className="text-muted-foreground text-base">{t('inviteHelp')}</p>
        <Button type="submit" disabled={invite.isPending} className="h-14 rounded-xl bg-[#25D366] text-lg font-bold text-white hover:bg-[#1ebe5a]">
          <Share2Icon data-icon="inline-start" />
          {t('sendInvite')}
        </Button>
      </form>
    </ActionSheet>
  );
}

/** One person, opened: change their right, or take them out of the shop. */
function MemberSheet({ row, onClose, lastOwner, isMe }: { row: MemberRow | null; onClose: () => void; lastOwner: boolean; isMe: boolean }) {
  const t = useTranslations('team');
  const message = useMessage();
  const { workspace } = useWorkspace();
  const setRole = useSetRole(workspace.id);
  const remove = useRemoveMember(workspace.id);
  const [shown, setShown] = useState<MemberRow | null>(null);
  if (row && row !== shown) setShown(row);
  const current = row ?? shown;

  const change = (role: Role) => {
    if (!current || role === current.member.role) return;
    setRole.mutateAsync({ memberId: current.member.id, role }).then(
      () => {
        gooeyToast.success(t('roleChanged'));
        onClose();
      },
      (error) => gooeyToast.error(message(formErrorKey(error))),
    );
  };

  const removeIt = () => {
    if (!current) return;
    remove.mutateAsync(current.member.id).then(
      () => {
        gooeyToast.success(t('removed', { name: current.user.name }));
        onClose();
      },
      (error) => gooeyToast.error(message(formErrorKey(error))),
    );
  };

  return (
    <ActionSheet open={row !== null} onOpenChange={(open) => (open ? undefined : onClose())} title={current?.user.name ?? ''} closeLabel={t('close')}>
      {current ? (
        <div className="flex flex-col gap-6">
          <p className="text-muted-foreground text-lg tabular-nums">{prettyPhone(current.user.phone)}</p>
          <div className="flex flex-col gap-2">
            <span className="text-lg font-semibold">{t('access')}</span>
            <RoleButtons value={current.member.role} onChange={change} disabled={(role) => lastOwner && role !== 'owner'} />
            {lastOwner ? <p className="text-muted-foreground text-sm">{t('lastOwner')}</p> : null}
          </div>
          {!lastOwner && !isMe ? (
            <Button type="button" variant="outline" onClick={removeIt} disabled={remove.isPending} className="h-14 rounded-xl text-lg font-bold text-red-600 dark:text-red-400">
              {t('remove')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </ActionSheet>
  );
}

const ROW_MOTION = {
  layout: true,
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, height: 0, marginBottom: 0 },
  transition: { type: 'spring' as const, duration: 0.35, bounce: 0 },
};

/**
 * People (Build Plan v4, 5), from the shop menu, for Owners: everyone in the
 * shop with their phone, right, when they were last active and who invited
 * them; tap one to change their right or remove them (the last Owner stays).
 * + Invite takes a phone and a right and sends it on WhatsApp; they get in
 * when they sign in with that number. Open invitations are listed to send
 * again or cancel.
 */
export function TeamPage() {
  const t = useTranslations('team');
  const tRoles = useTranslations('roles');
  const message = useMessage();
  const ago = useAgo();
  const { workspace, can } = useWorkspace();
  const me = useSession().data;
  const team = useTeam(workspace.id);
  const cancel = useCancelInvite(workspace.id);
  const share = useShareInvite();
  const [inviting, setInviting] = useState(false);
  const [opened, setOpened] = useState<MemberRow | null>(null);

  if (!can('manage_team')) return <p className="text-muted-foreground p-4 text-base lg:p-6">{t('ownersOnly')}</p>;

  const members = team.data?.members ?? [];
  const owners = members.filter((m) => m.member.role === 'owner');
  const lastOwner = (row: MemberRow | null) => row !== null && row.member.role === 'owner' && owners.length === 1;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 p-4 lg:p-6">
      <header className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground text-base">{t('count', { count: members.length })}</span>
        <Button type="button" onClick={() => setInviting(true)} className="h-9 rounded-lg px-3 text-sm font-semibold">
          <PlusIcon data-icon="inline-start" />
          {t('invite')}
        </Button>
      </header>

      {!team.data ? (
        <div className="bg-card h-40 animate-pulse rounded-xl" />
      ) : (
        <>
          <ul>
            <AnimatePresence initial={false}>
              {members.map((row) => (
                <motion.li key={row.member.id} {...ROW_MOTION} className="bg-card mb-2 overflow-hidden rounded-xl last:mb-0">
                  <button type="button" onClick={() => setOpened(row)} className="hover:bg-foreground/5 flex w-full items-center gap-4 px-4 py-3.5 text-start transition-colors">
                    <span className="bg-primary/15 text-primary flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold">{(row.user.name.trim()[0] ?? '?').toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold">
                        {row.user.name}
                        {row.user.id === me?.id ? <span className="text-muted-foreground ms-2 text-sm font-normal">{t('you')}</span> : null}
                      </span>
                      <span className="text-muted-foreground block text-sm tabular-nums">{prettyPhone(row.user.phone)}</span>
                      <span className="text-muted-foreground block text-sm">
                        {[row.lastActive ? t('lastActive', { when: ago(row.lastActive) }) : t('neverActive'), row.invitedBy ? t('invitedBy', { name: row.invitedBy.name }) : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className={cn('shrink-0 rounded-full px-3 py-1 text-sm font-semibold', row.member.role === 'owner' ? 'bg-primary/15 text-primary' : 'bg-foreground/5 text-muted-foreground')}>
                      {tRoles(row.member.role)}
                    </span>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          {team.data.invitations.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-muted-foreground text-sm font-semibold">{t('pending')}</h2>
              <ul>
                <AnimatePresence initial={false}>
                  {team.data.invitations.map((invitation) => (
                    <motion.li key={invitation.id} {...ROW_MOTION} className="bg-card mb-2 flex flex-wrap items-center gap-3 overflow-hidden rounded-xl px-4 py-3 last:mb-0">
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold tabular-nums">{prettyPhone(invitation.phone ?? '')}</span>
                        <span className="text-muted-foreground block text-sm">{t('invitedAs', { role: tRoles(invitation.role), when: ago(invitation.createdAt) })}</span>
                      </span>
                      <Button type="button" variant="outline" onClick={() => share(invitation)} className="h-9 rounded-lg px-3 text-sm font-semibold">
                        <Share2Icon data-icon="inline-start" />
                        {t('sendAgain')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => cancel.mutateAsync(invitation.id).then(() => gooeyToast.success(t('cancelled')), (error) => gooeyToast.error(message(formErrorKey(error))))}
                        className="h-9 rounded-lg px-3 text-sm font-semibold"
                      >
                        {t('cancel')}
                      </Button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ) : null}
        </>
      )}

      <InviteSheet open={inviting} onOpenChange={setInviting} />
      <MemberSheet row={opened} onClose={() => setOpened(null)} lastOwner={lastOwner(opened)} isMe={opened?.user.id === me?.id} />
    </div>
  );
}
