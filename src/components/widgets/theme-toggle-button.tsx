'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';

/**
 * Manual light/dark override, sized to sit inline in a nav bar (shadcn's
 * ghost icon-button variant, matching every other nav control). next-themes
 * persists the choice to localStorage under the shared ThemeProvider in
 * `src/app/layout.tsx`, so toggling here also applies across `/dashboard`
 * even though `DashboardNav` (a `@merqo/ui` shared shell with no free slot)
 * can't host a second copy of this button itself.
 */
export function ThemeToggleButton() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative overflow-hidden rounded-full"
      aria-label="Toggle theme"
    >
      <span
        className="flex-center absolute inset-0 transition-all duration-200"
        style={{
          opacity: isDark ? 1 : 0,
          transform: isDark ? 'translateY(0)' : 'translateY(-50%)',
        }}
      >
        <Sun className="size-4" fill="currentColor" />
      </span>
      <span
        className="flex-center absolute inset-0 transition-all duration-200"
        style={{
          opacity: isDark ? 0 : 1,
          transform: isDark ? 'translateY(50%)' : 'translateY(0)',
        }}
      >
        <Moon className="size-4" fill="currentColor" />
      </span>
    </Button>
  );
}
