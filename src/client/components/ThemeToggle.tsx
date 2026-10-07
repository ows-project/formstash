import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { Button } from "./ui/button";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <Button type="button" variant="glass" size="icon-sm" onClick={toggleTheme} aria-label={label} title={label}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
