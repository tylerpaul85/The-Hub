import { Moon, Sun, Laptop } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-9 w-9 text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors ${className ?? ""}`}
          aria-label="Toggle theme"
        >
          {resolvedTheme === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32 bg-surface-1 border-border text-text-primary">
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={`gap-2 cursor-pointer text-xs ${theme === "dark" ? "text-accent font-semibold" : "text-text-secondary"}`}
        >
          <Moon className="h-3.5 w-3.5" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={`gap-2 cursor-pointer text-xs ${theme === "light" ? "text-accent font-semibold" : "text-text-secondary"}`}
        >
          <Sun className="h-3.5 w-3.5" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={`gap-2 cursor-pointer text-xs ${theme === "system" ? "text-accent font-semibold" : "text-text-secondary"}`}
        >
          <Laptop className="h-3.5 w-3.5" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
