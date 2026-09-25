"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

const ORDER = ["system", "light", "dark"] as const;

/** false during SSR, true once hydrated — same job as the usual
 *  useState+useEffect "mounted" flag, without a cascading render. */
const subscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

const ICON = { system: Monitor, light: Sun, dark: Moon };
const LABEL = { system: "System", light: "Light", dark: "Dark" };

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  // `theme` is undefined until next-themes reads localStorage on the client.
  // Rendering a same-size placeholder avoids both a hydration mismatch and a
  // layout shift in the TopBar.
  if (!mounted) return <div className="w-8 h-8" aria-hidden />;

  const current = (ORDER as readonly string[]).includes(theme ?? "")
    ? (theme as (typeof ORDER)[number])
    : "system";
  const Icon = ICON[current];
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={`Theme: ${LABEL[current]} — switch to ${LABEL[next]}`}
      aria-label={`Theme: ${LABEL[current]}. Switch to ${LABEL[next]}.`}
      className="w-8 h-8 grid place-items-center rounded-lg text-fg-muted
                 border border-border-base bg-surface-2
                 hover:text-accent hover:border-border-strong transition-colors"
    >
      <Icon className="w-4 h-4" aria-hidden />
    </button>
  );
}
