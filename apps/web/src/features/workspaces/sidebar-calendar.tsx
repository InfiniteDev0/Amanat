'use client';

import { RangeCalendar } from '@heroui/react';
import { parseDate } from '@internationalized/date';
import { useTranslations } from 'next-intl';

import { useShopDay } from '@/features/workspaces/shop-day';

/**
 * HeroUI's RangeCalendar, opened from the day's tile at the top of the
 * sidebar. It follows the shop day: it selects it and opens on its month
 * (keyed by the day, so it starts again from it). Picking one day here (the
 * same day twice) switches the shop day to it, then calls onPick.
 */
export function SidebarCalendar({ onPick }: { onPick?: () => void }) {
  const t = useTranslations('shell');
  const { day, setDay } = useShopDay();
  const date = parseDate(day);

  return (
    <RangeCalendar
      key={day}
      aria-label={t('dateRange')}
      firstDayOfWeek="mon"
      defaultValue={{ start: date, end: date }}
      defaultFocusedValue={date}
      onChange={({ start, end }) => {
        if (start.compare(end) !== 0) return;
        setDay(start.toString());
        onPick?.();
      }}
    >
      <RangeCalendar.Header>
        <RangeCalendar.Heading />
        <RangeCalendar.NavButton slot="previous" />
        <RangeCalendar.NavButton slot="next" />
      </RangeCalendar.Header>
      <RangeCalendar.Grid>
        <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
        <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
      </RangeCalendar.Grid>
    </RangeCalendar>
  );
}
