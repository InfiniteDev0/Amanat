"use client";

// What the setup wizard hands back — the only place blocks come into existence, so an empty account is truly empty.

import { useCallback } from "react";
import { createBlocks, createTasks } from "@/lib/db/blocks";
import { writeNow } from "@/lib/db/sync";

export function useSetup({ userId, blocks, setProfile, setBlocks, setTasks }) {
  return useCallback(
    ({ year, month, blocks: chosen, tasksByBlock = {}, keepExisting = false }) => {
      // the month carries the calendar month it was chosen in, which is how the review knows a month turned over
      const now = new Date();
      setProfile({
        year,
        month: { ...month, stamp: month.stamp ?? `${now.getFullYear()}-${now.getMonth() + 1}` },
      });

      const rows = chosen.map((b, i) => ({
        ...b,
        id: crypto.randomUUID(),
        seedId: b.id,
        name: b.name.endsWith(" Block") ? b.name : `${b.name} Block`,
        status: keepExisting ? "todo" : i === 0 ? "ongoing" : "todo",
      }));

      // no invented duration: nobody was asked, so Milo doesn't answer for them
      const taskRows = rows.flatMap((b) =>
        (tasksByBlock[b.seedId] ?? []).map((name) => ({
          id: crypto.randomUUID(),
          blockId: b.id,
          name,
          reason: "",
          note: "",
          minutes: null,
          status: "todo",
          kind: "routine",
          days: [],
          steps: [],
        })),
      );

      // keepExisting is the month review adding to a shelf that already has things on it
      const fresh = rows.map(({ seedId, ...b }) => b);
      setBlocks((prev) => (keepExisting ? [...prev, ...fresh] : fresh));
      setTasks((prev) => (keepExisting ? [...prev, ...taskRows] : taskRows));

      // written at once: everything after this is an update against these ids
      if (userId) {
        writeNow("setup:blocks", () => createBlocks(userId, fresh, keepExisting ? blocks.length : 0));
        if (taskRows.length) writeNow("setup:tasks", () => createTasks(userId, taskRows));
      }
    },
    [userId, blocks, setProfile, setBlocks, setTasks],
  );
}
