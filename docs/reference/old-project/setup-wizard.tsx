"use client";

/* First run. Over the app, not instead of it — the dashboard sits blurred
 * behind so you can see what you're setting up.
 *
 * Every question here is SETUP, not a survey: the answer to each one shows up
 * in the product. Name your year → the Yearly view. Name your month → Monthly.
 * Pick your blocks → the rail and the board. Nothing is asked that Milo then
 * ignores, and nothing at the end says "we built your plan for you" — the last
 * screen shows the blocks you just chose, in your words.
 *
 * No database yet. Choices go into the blocks provider and a localStorage flag.
 */

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Plus, X } from "lucide-react";
import MiloFace from "@/components/MiloFace";
import { playLock } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/ui/icon-input";
import { useBlocks } from "./blocks-provider";

const ICONS = ["🌱", "🔥", "🌊", "⛰️", "✨", "🎯", "📚", "🛠️"];

const STARTER_BLOCKS = [
  { id: "morning", name: "Morning", bg: "#F5C542", ink: "#1a1400" },
  { id: "deep", name: "Deep Work", bg: "#2E5BFF", ink: "#ffffff" },
  { id: "learning", name: "Learning", bg: "#5ECBA1", ink: "#04231a" },
  { id: "create", name: "Create", bg: "#F5836A", ink: "#2b0d05" },
  { id: "reading", name: "Reading", bg: "#7FC6F5", ink: "#04202b" },
  { id: "wind", name: "Wind Down", bg: "#A78BFA", ink: "#1c0f3d" },
];

const SPARE_COLOURS = [
  { bg: "#F0A5C8", ink: "#2b0416" },
  { bg: "#9BD17E", ink: "#0f2405" },
  { bg: "#F5B36A", ink: "#2b1704" },
];

export function SetupWizard() {
  const { completeSetup, blocks, hydrated, loadFailed } = useBlocks();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const [yearName, setYearName] = useState("");
  const [yearIcon, setYearIcon] = useState(ICONS[0]);
  const [goals, setGoals] = useState("");
  const [vision, setVision] = useState([]);
  const [visionDraft, setVisionDraft] = useState("");
  const [monthName, setMonthName] = useState("");
  const [monthIcon, setMonthIcon] = useState(ICONS[4]);
  const [picked, setPicked] = useState(["morning", "deep"]);
  const [customDraft, setCustomDraft] = useState("");
  // { [blockId]: [{ name, minutes }] } — assigned once at setup. MVP has no
  // add-task UI later, so this step is the only way tasks come into being.
  const [taskDraft, setTaskDraft] = useState({});
  const [tasksByBlock, setTasksByBlock] = useState({});
  const [custom, setCustom] = useState([]);

  /* Set up means HAVING BLOCKS. Not a flag, not a profile row — the thing
     itself. A separate done-marker can drift from the data and leave someone
     marked as finished with nothing to run, which is a worse state than
     being asked twice.

     Waits for `hydrated`, because before the blocks arrive an empty list and
     a real one look identical, and opening the wizard over somebody's
     existing day would be alarming. */
  useEffect(() => {
    if (!hydrated) return;

    /* `loadFailed` is the other half of this, and it was missing. Waiting for
       hydrated only rules out the moment BEFORE the blocks arrive — it says
       nothing about a read that arrived and failed, which leaves the same
       empty list behind. Both look like a new account; only one is.

       This is not theoretical. Adding a column to the tasks query before its
       migration had run put this wizard in front of a month-old account, and
       finishing it would have written a duplicate set of blocks. */
    setOpen(blocks.length === 0 && !loadFailed);
  }, [hydrated, loadFailed, blocks.length]);

  if (!open) return null;

  const allBlocks = [
    ...STARTER_BLOCKS.filter((b) => picked.includes(b.id)),
    ...custom,
  ];

  const addCustom = () => {
    const name = customDraft.trim();
    if (!name) return;
    const colour = SPARE_COLOURS[custom.length % SPARE_COLOURS.length];
    setCustom((c) => [...c, { id: `c${Date.now()}`, name, ...colour }]);
    setCustomDraft("");
  };

  const addVision = () => {
    const v = visionDraft.trim();
    if (!v) return;
    setVision((list) => [...list, v]);
    setVisionDraft("");
  };

  const addTask = (blockId) => {
    const name = (taskDraft[blockId] ?? "").trim();
    if (!name) return;
    setTasksByBlock((t) => ({ ...t, [blockId]: [...(t[blockId] ?? []), name] }));
    setTaskDraft((d) => ({ ...d, [blockId]: "" }));
  };

  /* The lock-in chime, not the completion fanfare. This is a beginning —
     you've just committed to a shape for the month — and the fanfare belongs
     to things that finished.

     It also does a second job. Browsers refuse to play audio until the user
     has interacted with the page, and this is the first real click Milo
     gets: it wakes the AudioContext, so the first finished task later in the
     day has sound ready instead of silently falling back. */
  const finish = () => {
    playLock();
    completeSetup({
      year: { name: yearName, icon: yearIcon, goals, vision },
      month: { name: monthName, icon: monthIcon },
      blocks: allBlocks,
      tasksByBlock,
    });
    setOpen(false);
  };

  const STEPS = [
    {
      /* 1 — the greeting. No question, just Milo. */
      body: (
        <div className="flex flex-col items-center gap-6 text-center">
          <MiloFace className="dark:rounded-[30%] dark:bg-chip size-28 touch-none select-none" />
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl">Hi, I&apos;m Milo.</h2>
            <p className="max-w-sm text-foreground/50">
              Let&apos;s shape your year, your month, and what your days are made
              of. Two minutes, and you can change any of it later.
            </p>
          </div>
        </div>
      ),
      can: true,
    },
    {
      title: "Name your year",
      hint: "Something you'll recognise when you look back at it.",
      body: (
        <div className="flex w-full max-w-sm flex-col gap-4">
          <IconInput
            value={yearName}
            onChange={(e) => setYearName(e.target.value)}
            placeholder="The year I finally ship"
            icon={<span className="text-base">{yearIcon}</span>}
          />
          <IconPicker value={yearIcon} onChange={setYearIcon} />
        </div>
      ),
      can: yearName.trim() !== "",
    },
    {
      title: "What do you want this year to be about?",
      hint: "Free text. Skip it if you'd rather not decide yet.",
      body: (
        <textarea
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={4}
          placeholder="Fewer, better things…"
          className="w-full max-w-sm resize-none rounded-[10px] border-[1.5px] border-foreground/20 p-3 text-sm outline-none transition-colors focus:border-[#5e17eb]"
        />
      ),
      can: true,
      skippable: true,
    },
    {
      title: "Your vision board",
      hint: "Things you want this year. Just names — no categories, no dates. Three or more, or skip it.",
      body: (
        <div className="flex w-full max-w-sm flex-col gap-3">
          <div className="flex gap-2">
            <IconInput
              value={visionDraft}
              onChange={(e) => setVisionDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addVision())}
              placeholder="Run a half marathon"
              icon={<Plus className="size-4" />}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={addVision}
              className="milo-lift h-[40px] shrink-0 border-0 bg-solid text-solid-ink hover:bg-solid-hover"
              style={{ "--lift": "var(--solid-lift)" }}
            >
              Add
            </Button>
          </div>
          <ul className="flex max-h-32 list-none flex-col gap-1.5 overflow-y-auto p-0">
            {vision.map((v, i) => (
              <li
                key={`${v}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg bg-foreground/[0.04] px-3 py-2 text-sm"
              >
                {v}
                <button
                  type="button"
                  onClick={() => setVision((l) => l.filter((_, k) => k !== i))}
                  className="cursor-pointer text-foreground/30 hover:text-foreground/60"
                  aria-label={`Remove ${v}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ),
      /* Three or none. One line is not a vision board, and a board with one
         line on it is a screen that will make someone feel like they failed
         at a list they wrote themselves.

         Skip stays, so nobody is trapped — a complete answer or no answer,
         and no half-finished version to feel bad about. */
      can: vision.length >= 3,
      skippable: true,
    },
    {
      title: "Name your month",
      hint: "Months get their own name in Milo. This one is yours to define.",
      body: (
        <div className="flex w-full max-w-sm flex-col gap-4">
          <IconInput
            value={monthName}
            onChange={(e) => setMonthName(e.target.value)}
            placeholder="Foundations"
            icon={<span className="text-base">{monthIcon}</span>}
          />
          <IconPicker value={monthIcon} onChange={setMonthIcon} />
        </div>
      ),
      can: monthName.trim() !== "",
    },
    {
      title: "What's your day made of?",
      hint: "Pick a few. You'll run one at a time, and you can swap them next month.",
      body: (
        <div className="flex w-full max-w-lg flex-col gap-4">
          <div className="flex flex-wrap justify-center gap-2">
            {STARTER_BLOCKS.map((b) => {
              const on = picked.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() =>
                    setPicked((p) =>
                      on ? p.filter((x) => x !== b.id) : [...p, b.id],
                    )
                  }
                  className="flex cursor-pointer items-center gap-2 rounded-full border-2 px-4 py-2 text-sm transition-all duration-200"
                  style={{
                    background: on ? b.bg : "transparent",
                    color: on ? b.ink : "#00000099",
                    borderColor: on ? b.bg : "#00000018",
                  }}
                >
                  {on && <Check className="size-3.5" />}
                  {b.name}
                </button>
              );
            })}
            {custom.map((b) => (
              <span
                key={b.id}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                style={{ background: b.bg, color: b.ink }}
              >
                <Check className="size-3.5" />
                {b.name}
                <button
                  type="button"
                  onClick={() => setCustom((c) => c.filter((x) => x.id !== b.id))}
                  className="cursor-pointer opacity-50 hover:opacity-100"
                  aria-label={`Remove ${b.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>

          <div className="mx-auto flex w-full max-w-sm gap-2">
            <IconInput
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
              placeholder="Or write your own"
              icon={<Plus className="size-4" />}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={addCustom}
              className="milo-lift h-[40px] shrink-0 border-0 bg-solid text-solid-ink hover:bg-solid-hover"
              style={{ "--lift": "var(--solid-lift)" }}
            >
              Add
            </Button>
          </div>
        </div>
      ),
      can: allBlocks.length > 0,
    },
    {
      title: "What goes in each block?",
      hint: "A few things per block. In this first version tasks are set here and stay put.",
      body: (
        <div className="flex w-full max-w-md flex-col gap-4 text-left">
          {allBlocks.map((b) => (
            <div key={b.id} className="flex flex-col gap-2">
              <span
                className="w-fit rounded-full px-3 py-1 text-xs"
                style={{ background: b.bg, color: b.ink }}
              >
                {b.name}
              </span>

              {(tasksByBlock[b.id] ?? []).length > 0 && (
                <ul className="flex list-none flex-wrap gap-1.5 p-0">
                  {(tasksByBlock[b.id] ?? []).map((t, i) => (
                    <li
                      key={`${t}-${i}`}
                      className="flex items-center gap-1.5 rounded-lg bg-foreground/[0.04] px-2.5 py-1 text-xs"
                    >
                      {t}
                      <button
                        type="button"
                        aria-label={`Remove ${t}`}
                        onClick={() =>
                          setTasksByBlock((all) => ({
                            ...all,
                            [b.id]: all[b.id].filter((_, k) => k !== i),
                          }))
                        }
                        className="cursor-pointer text-foreground/30 hover:text-foreground/60"
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <IconInput
                value={taskDraft[b.id] ?? ""}
                onChange={(e) =>
                  setTaskDraft((d) => ({ ...d, [b.id]: e.target.value }))
                }
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addTask(b.id))
                }
                placeholder={`Something you do in ${b.name}…`}
                icon={<Plus className="size-4" />}
              />
            </div>
          ))}
        </div>
      ),
      // at least one task somewhere — an empty day has nothing to run
      can: Object.values(tasksByBlock).some((t) => t.length > 0),
    },
    {
      /* Last screen shows THEIR choices back. Never "here's the plan we made". */
      title: "Here's your day",
      hint: `${monthIcon} ${monthName || "This month"} — one block at a time, and nothing goes overdue.`,
      body: (
        <div className="flex w-full max-w-sm flex-col gap-1.5">
          {allBlocks.map((b) => (
            <div
              key={b.id}
              className="rounded-lg px-4 py-2 text-sm"
              style={{ background: b.bg, color: b.ink }}
            >
              {b.name}
            </div>
          ))}
        </div>
      ),
      can: true,
      last: true,
    },
  ];

  /* Milo sits with you the whole way through, and warms up as the day takes
     shape. It only ever gets warmer — the same rule as the landing page's
     scroll ladder — so setup never has a face that looks disappointed in what
     you just typed.

     `idle` is deliberately absent: that is the anxious face, and it is
     retired. Nobody is greeted by worry. */
  /* Indexed by step, greeting included — it is step 0, and leaving it out
     put every mood one step early and dropped the last one off the end.

     It only ever gets warmer, the same rule as the landing page's scroll
     ladder, so setup never shows a face that looks disappointed in what you
     just typed. `idle` is absent on purpose: that is the anxious one, and it
     is retired. Nobody is greeted by worry. */
  const MOODS = [
    "content", // 0 — hi, I'm Milo
    "content", // 1 — name your year
    "focused", // 2 — what it's about
    "focused", // 3 — vision board
    "proud", //   4 — name your month
    "proud", //   5 — what your day is made of
    "happy", //   6 — what goes in each block
    "cheer", //   7 — here's your day
  ];

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm">
      {/* Six blocks is a normal answer, and at 560px the last one sat under
          the button with an inner scrollbar over it. */}
      <div className="flex h-[min(660px,92vh)] w-full max-w-2xl flex-col rounded-3xl bg-card shadow-2xl">
        <div className="flex shrink-0 items-center justify-between p-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="cursor-pointer rounded-full p-2 text-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
          ) : (
            <span className="size-8" />
          )}
          <span className="text-xs text-foreground/35">
            {step + 1} of {STEPS.length}
          </span>
        </div>

        {/* pt-4 is not spacing — it is clearance. MiloFace draws outside its
            own box by design (overflow: visible, because widening the viewBox
            to fit the brows shrinks every pose), and a scrolling container
            clips at its padding edge. Without this the brows are cut off. */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 pt-4 pb-2 text-center">
          {/* On every step except the greeting, which is nothing BUT a face
              and owns a bigger one of its own. Two Milos on one screen reads
              as a bug, which it was.

              No gaze and no scroll reaction: inside a modal there is nothing
              to look at and nothing to scroll, and a face tracking the cursor
              while you are typing your year into a box is distracting rather
              than warm. It blinks, and that is enough to be alive. */}
          {step > 0 && (
            <MiloFace
              mood={MOODS[step] ?? "cheer"}
              gaze={false}
              reactToScroll={false}
              className="dark:rounded-[30%] dark:bg-chip size-20 shrink-0"
            />
          )}

          {current.title && (
            <div className="flex flex-col gap-1.5">
              <h2 className="text-2xl">{current.title}</h2>
              {current.hint && (
                <p className="text-sm text-foreground/45">{current.hint}</p>
              )}
            </div>
          )}
          {current.body}
        </div>

        <div className="flex shrink-0 flex-col gap-4 p-6 pt-4">
          <div className="flex items-center justify-center gap-3">
            {current.skippable && (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="cursor-pointer px-3 text-sm text-foreground/40 transition-colors hover:text-foreground"
              >
                Skip
              </button>
            )}
            <Button
              type="button"
              disabled={!current.can}
              onClick={() => (current.last ? finish() : setStep((s) => s + 1))}
              /* Same two shades as the date button: a face light enough to
                 read as a surface, a side dark enough to look like a side.
                 disabled:shadow-none because a button that can't be pressed
                 shouldn't look like it's waiting to be. */
              className="milo-lift h-11 w-full max-w-xs rounded-full border-0 bg-solid text-md font-normal text-solid-ink hover:bg-solid-hover disabled:shadow-none"
              style={{ "--lift": "var(--solid-lift)" }}
            >
              {current.last ? "Start my day" : "Continue"}
            </Button>
          </div>

          <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/8">
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function IconPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onChange(icon)}
          className={`flex size-9 cursor-pointer items-center justify-center rounded-lg text-lg transition-colors ${
            value === icon ? "bg-foreground/10" : "hover:bg-foreground/5"
          }`}
          aria-label={`Pick ${icon}`}
          aria-pressed={value === icon}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
