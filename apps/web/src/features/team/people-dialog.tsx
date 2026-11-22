'use client';

import { type Invitation, type MemberRow, type Role, ROLES } from '@sarrif/core';
import { gooeyToast } from 'goey-toast';
import { ChevronDownIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';

import { colourFor } from '@/components/shop-badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSession } from '@/features/auth/queries';
import { PhoneField } from '@/features/auth/phone-field';
import { type PhoneInput, toE164 } from '@/features/auth/schemas';
import { phoneInputOf } from '@/features/onboarding/draft';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { CAN_INVITE } from '@/lib/api';
import { formErrorKey, useMessage } from '@/lib/api/errors';
import { ltr } from '@/lib/ltr';
import { cn } from '@/lib/utils';

import { useCancelInvite, useInvite, useRemoveMember, useSetRole, useTeam } from './queries';

// People, as a dialog in the manner of Milo's "Start your day": a title, one
// line saying how many and what you can do, a list of slim bordered rows (a
// coloured mark, the name, its control at the end), then Cancel and one solid
// button. Invite opens its two fields in place, at the top of the list.

const ROW = 'border-foreground/10 bg-card flex items-center gap-2.5 rounded-lg border p-2';
const MUTED_BUTTON = 'bg-muted hover:bg-muted/70 h-9 rounded-lg px-4 text-sm transition-colors';
const SOLID_BUTTON = 'bg-foreground text-background h-9 rounded-lg px-4 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40';

/** The person's first letter on their colour. */
function Mark({ id, name }: { id: string; name: string }) {
  return (
    <span aria-hidden className={cn('flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white', colourFor(id))}>
      {name.trim().charAt(0).toLocaleUpperCase() || '·'}
    </span>
  );
}

/** What someone may do, as a small pill that opens the three rights (and Remove). */
function RoleMenu({ role, onChange, onRemove, disabled }: { role: Role; onChange: (role: Role) => void; onRemove?: () => void; disabled?: boolean }) {
  const t = useTranslations('team');
  const tRoles = useTranslations('roles');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors disabled:pointer-events-none"
      >
        {tRoles(role)}
        {disabled ? null : <ChevronDownIcon className="size-3.5" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-lg border p-1.5 dark:bg-[#161616]">
        <DropdownMenuRadioGroup value={role} onValueChange={(value) => onChange(value as Role)}>
          {ROLES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} className="items-start py-2">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{tRoles(option)}</span>
                <span className="text-muted-foreground text-xs">{t(`roleHelp.${option}`)}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {onRemove ? (
          <>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem className="text-destructive gap-2 [&_svg]:text-destructive" onClick={onRemove}>
              <Trash2Icon className="size-4" />
              {t('remove')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MemberLine({ row, isYou }: { row: MemberRow; isYou: boolean }) {
  const t = useTranslations('team');
  const message = useMessage();
  const { workspace } = useWorkspace();
  const setRole = useSetRole(workspace.id);
  const remove = useRemoveMember(workspace.id);
  const done = (key: 'roleChanged' | 'removed') => () => gooeyToast.success(t(key));
  const failed = (error: unknown) => gooeyToast.error(message(formErrorKey(error)));

  return (
    <div className={ROW}>
      <Mark id={row.user.id} name={row.user.name} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">
          {row.user.name} {isYou ? <span className="text-muted-foreground font-normal">{t('you')}</span> : null}
        </span>
        <span className="text-muted-foreground truncate text-xs">{ltr(row.user.phone)}</span>
      </span>
      <RoleMenu
        role={row.member.role}
        disabled={isYou}
        onChange={(role) => setRole.mutateAsync({ memberId: row.member.id, role }).then(done('roleChanged'), failed)}
        onRemove={() => remove.mutateAsync(row.member.id).then(done('removed'), failed)}
      />
    </div>
  );
}

function InvitationLine({ invitation }: { invitation: Invitation }) {
  const t = useTranslations('team');
  const tRoles = useTranslations('roles');
  const message = useMessage();
  const { workspace } = useWorkspace();
  const cancel = useCancelInvite(workspace.id);
  return (
    <div className={cn(ROW, 'border-dashed')}>
      <Mark id={invitation.id} name={invitation.phone ?? '?'} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{ltr(invitation.phone ?? '')}</span>
        <span className="text-muted-foreground truncate text-xs">
          {tRoles(invitation.role)} · {t('pending')}
        </span>
      </span>
      <button
        type="button"
        onClick={() => cancel.mutateAsync(invitation.id).then(() => gooeyToast.success(t('cancelled')), (error) => gooeyToast.error(message(formErrorKey(error))))}
        aria-label={t('cancel')}
        title={t('cancel')}
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 items-center justify-center rounded-md transition-colors"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}

/**
 * People in the shop: everyone and the invitations still open, each a row
 * with what they may do; Invite asks for a phone and a right, then opens
 * WhatsApp with the invitation to send. Owners only. With the real backend,
 * inviting comes with team roles (1e): until then the list is just you.
 */
export function PeopleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('team');
  const tRoles = useTranslations('roles');
  const locale = useLocale();
  const message = useMessage();
  const { workspace, role } = useWorkspace();
  const user = useSession().data;
  const team = useTeam(workspace.id).data;
  const invite = useInvite(workspace.id);
  const [inviting, setInviting] = useState(false);
  const [phone, setPhone] = useState<PhoneInput>(phoneInputOf(''));
  const [inviteRole, setInviteRole] = useState<Role>('editor');
  const [error, setError] = useState<string | null>(null);

  const members = team?.members ?? [];
  // Before team roles are in the database the list comes back empty: you are still in it.
  const youListed = members.some((m) => m.user.id === user?.id);
  const count = members.length + (youListed || !user ? 0 : 1);
  const invitations = team?.invitations ?? [];

  const close = (next: boolean) => {
    if (!next) {
      setInviting(false);
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const e164 = toE164(phone);
    if (!e164) return setError(message(phone.number.trim() ? 'validation.phone' : 'validation.phoneRequired'));
    invite.mutateAsync({ phone: e164, role: inviteRole }).then(
      () => {
        gooeyToast.success(t('invited'));
        const text = t('inviteMessage', { shop: workspace.name, role: tRoles(inviteRole), link: `${window.location.origin}/${locale}`, phone: e164 });
        window.open(`https://wa.me/${e164.replace('+', '')}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        setInviting(false);
        setPhone(phoneInputOf(''));
      },
      (failure) => setError(message(formErrorKey(failure))),
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('summary', { count, shop: workspace.name })}</DialogDescription>
        </DialogHeader>

        <form id="invite-form" onSubmit={submit} className="flex flex-col gap-1.5">
          {inviting ? (
            <div className="border-foreground/10 bg-card flex flex-col gap-3 rounded-lg border p-3">
              <PhoneField
                id="invite-phone"
                value={phone}
                onChange={(value) => {
                  setError(null);
                  setPhone(value);
                }}
                error={error}
              />
              <div role="radiogroup" aria-label={t('access')} className="bg-foreground/5 flex gap-0.5 rounded-lg p-1">
                {(['editor', 'viewer', 'owner'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={inviteRole === option}
                    onClick={() => setInviteRole(option)}
                    className={cn(
                      'flex-1 rounded-md px-3 py-1.5 text-sm transition-colors',
                      inviteRole === option ? 'bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.12)]' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tRoles(option)}
                  </button>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                {t(`roleHelp.${inviteRole}`)} {t('inviteHelp')}
              </p>
            </div>
          ) : null}

          {user && !youListed ? (
            <div className={ROW}>
              <Mark id={user.id} name={user.name} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {user.name} <span className="text-muted-foreground font-normal">{t('you')}</span>
                </span>
                <span className="text-muted-foreground truncate text-xs">{ltr(user.phone)}</span>
              </span>
              <span className="text-muted-foreground px-2 text-xs font-medium">{tRoles(role)}</span>
            </div>
          ) : null}
          {members.map((row) => (
            <MemberLine key={row.member.id} row={row} isYou={row.user.id === user?.id} />
          ))}
          {invitations.map((invitation) => (
            <InvitationLine key={invitation.id} invitation={invitation} />
          ))}
          {CAN_INVITE ? null : <p className="text-muted-foreground px-1 pt-2 text-xs">{t('inviteSoon')}</p>}
        </form>

        <DialogFooter>
          {inviting ? (
            <>
              <button type="button" onClick={() => setInviting(false)} className={MUTED_BUTTON}>
                {t('cancel')}
              </button>
              <button type="submit" form="invite-form" disabled={invite.isPending} className={SOLID_BUTTON}>
                {t('sendInvite')}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => close(false)} className={MUTED_BUTTON}>
                {t('close')}
              </button>
              <button type="button" onClick={() => setInviting(true)} disabled={!CAN_INVITE || role !== 'owner'} className={SOLID_BUTTON}>
                {t('invite')}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
