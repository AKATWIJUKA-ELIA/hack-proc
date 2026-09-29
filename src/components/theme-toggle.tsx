"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "quotebook-theme";

/**
 * Apply a theme by putting the matching class on <html>.
 *
 * "system" means *remove* both classes, which lets the
 * `prefers-color-scheme` block in globals.css take over. That is why the CSS
 * guards its media query with `:root:not(.light)` — an explicit light choice
 * has to beat an OS set to dark.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme !== "system") root.classList.add(theme);
}

function readStored(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") {
      return value;
    }
  } catch {
    // Private windows and blocked site data both throw here. Following the OS
    // is the right answer when the preference cannot be read.
  }
  return "system";
}

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** The theme switcher, rendered inside the account dropdown. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  // Read on mount rather than during render: localStorage does not exist on
  // the server, and reading it while rendering would mismatch the markup.
  useEffect(() => setTheme(readStored()), []);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies to this page; it just will not be remembered.
    }
  }

  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        Appearance
      </DropdownMenuLabel>
      {OPTIONS.map((option) => (
        <DropdownMenuItem
          key={option.value}
          onSelect={(event) => {
            // Keep the menu open so the change can be seen and revised.
            event.preventDefault();
            choose(option.value);
          }}
          className={cn(theme === option.value && "bg-accent")}
        >
          <option.icon />
          {option.label}
          {theme === option.value && (
            <span className="ml-auto text-xs text-muted-foreground">✓</span>
          )}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/**
 * Applies the stored theme before the first paint.
 *
 * Without this the page renders light, then corrects itself once React
 * hydrates — a white flash on every navigation for anyone who chose dark. It
 * has to be an inline script in <head> for the same reason: any later and the
 * flash has already happened.
 */
export function ThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="dark"||t==="light"){document.documentElement.classList.add(t)}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
