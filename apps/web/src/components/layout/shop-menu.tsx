"use client";

import {
  ChevronDownIcon,
  PlusIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { AccountItems } from "@/components/layout/account-items";
import { ShopBadge } from "@/components/shop-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  // DropdownMenuGroup,
  DropdownMenuItem,
  // DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStartNewShop } from "@/features/onboarding/setup-wizard";
import { useMyWorkspaces } from "@/features/workspaces/queries";
import { Link } from "@/i18n/navigation";

/** Settings and People: two quiet buttons side by side under the shop's name. */
const MENU_BUTTON_CLASS =
  "bg-foreground/8 hover:bg-foreground/12 focus:bg-foreground/12 dark:bg-muted dark:hover:bg-accent dark:focus:bg-accent flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium [&_svg]:size-4";

/**
 * At the start of the top bar, before the breadcrumb: the shop's badge and
 * name with a chevron, always on a soft fill. It opens downwards: the shop (big badge,
 * name, your role · plan), its Settings and People (switching shops is off for
 * now), Create shop (opens the setup wizard), then your language, theme
 * and sign out.
 */
export function ShopMenu({
  workspaceId,
  shopName,
}: {
  workspaceId: string;
  shopName: string;
}) {
  const t = useTranslations();
  // const router = useRouter();
  const startNewShop = useStartNewShop();
  const shops = useMyWorkspaces().data ?? [];
  const role = shops.find(
    ({ workspace }) => workspace.id === workspaceId,
  )?.role;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("shell.switchShop")}
        // As wide as the sidebar card under it (72 - its 2 + 2 padding).
        className="bg-foreground/5 hover:bg-foreground/10 aria-expanded:bg-foreground/10 dark:bg-white/10 dark:hover:bg-white/15 dark:aria-expanded:bg-white/15 flex h-10 w-68 min-w-0 shrink-0 items-center gap-2.5 rounded-lg px-2 text-start text-[15px] font-semibold transition-colors"
      >
        <ShopBadge id={workspaceId} name={shopName} />
        <span className="flex-1 truncate">{shopName}</span>
        <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="border-border bg-popover w-80 rounded-xl border p-2 shadow-none ring-0 dark:bg-black"
      >
        <div className="flex items-center gap-3 p-2">
          <ShopBadge
            id={workspaceId}
            name={shopName}
            className="size-11 rounded-xl text-lg"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{shopName}</p>
            <p className="text-muted-foreground truncate text-xs">
              {role
                ? `${t(`roles.${role}`)} · ${t("brand.plan")}`
                : t("brand.plan")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 p-2 pt-1">
          <DropdownMenuItem
            className={MENU_BUTTON_CLASS}
            render={<Link href={`/w/${workspaceId}/settings`} />}
          >
            <SettingsIcon />
            {t("nav.settings")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={MENU_BUTTON_CLASS}
            render={<Link href={`/w/${workspaceId}/team`} />}
          >
            <UsersIcon />
            {t("shell.people")}
          </DropdownMenuItem>
        </div>

        {/* Switch shops, off for now.
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground text-xs">{t('shell.switchShops')}</DropdownMenuLabel>
          {shops.map(({ workspace }) => (
            <DropdownMenuItem key={workspace.id} className="h-9 gap-2.5" onClick={() => router.push(`/w/${workspace.id}`)}>
              <ShopBadge id={workspace.id} name={workspace.name} />
              <span className="flex-1 truncate">{workspace.name}</span>
              {workspace.id === workspaceId ? <CheckIcon className="ms-auto" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1" /> */}

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          className="text-muted-foreground h-9 gap-2.5"
          onClick={startNewShop}
        >
          <span className="border-border flex size-6 items-center justify-center rounded-md border border-dashed">
            <PlusIcon className="size-3.5" />
          </span>
          {t("shell.createShop")}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <AccountItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
