"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Isolated so app/layout.tsx can stay a server component.
 *
 * next-themes injects a blocking inline script into <head> that sets
 * class="dark" before first paint — that, plus `background: var(--bg)` on body,
 * is what prevents a flash of the wrong theme. It also means <html> is mutated
 * before hydration, so layout.tsx must set suppressHydrationWarning.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
