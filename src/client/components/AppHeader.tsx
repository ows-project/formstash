import { Activity, ChevronDown, Inbox, LogOut, Menu, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { UserInfo } from "../auth";
import { cn } from "../lib/cn";
import { Brand } from "./Brand";
import { useForms } from "./FormsProvider";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";

interface AppHeaderProps {
  user: UserInfo;
  formsHref: string;
  onOpenForms?: () => void;
  onSignOut: () => void;
}

function isFormsPath(location: string) {
  return location === "/" || location.startsWith("/forms");
}

export function AppHeader({ user, formsHref, onOpenForms, onSignOut }: AppHeaderProps) {
  const [location] = useLocation();
  const { forms } = useForms();
  const unread = forms?.reduce((sum, form) => sum + form.unreadCount, 0) ?? 0;
  const items = [
    { href: formsHref, label: "Forms", icon: Inbox, active: isFormsPath(location), badge: unread },
    { href: "/activity", label: "Activity", icon: Activity, active: location.startsWith("/activity") },
    { href: "/settings", label: "Settings", icon: Settings, active: location.startsWith("/settings") },
  ];

  return (
    <header className="relative z-30 shrink-0 bg-chrome text-white shadow-[0_10px_30px_-18px_rgb(3_11_34/0.9)]">
      <div className="flex h-15 items-center gap-2 px-3 sm:gap-3 sm:px-6">
        {onOpenForms && (
          <Button variant="glass" size="icon-sm" className="border-transparent bg-transparent lg:hidden" onClick={onOpenForms} aria-label="Open forms list">
            <Menu />
          </Button>
        )}
        <Link href="/" className="rounded-lg">
          <Brand tone="light" compact />
        </Link>
        <nav aria-label="Main" className="ml-auto flex items-center gap-1 sm:ml-6">
          {items.map(({ href, label, icon: Icon, active, badge }) => (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-brand-100/80 transition-colors hover:bg-white/10 hover:text-white sm:px-3",
                active && "bg-white/15 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]",
              )}
            >
              <Icon className="size-4" />
              <span className="max-sm:sr-only">{label}</span>
              {!!badge && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-[11px] font-bold text-brand-800 tabular-nums max-sm:absolute max-sm:-top-1 max-sm:-right-1 max-sm:h-4 max-sm:min-w-4 max-sm:px-1 max-sm:text-[10px]">
                  {badge > 99 ? "99+" : badge}
                  <span className="sr-only"> unread</span>
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sm:ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex h-10 cursor-pointer items-center gap-2 rounded-xl px-1.5 text-sm text-brand-50 hover:bg-white/10 data-[state=open]:bg-white/15" aria-label="Account menu">
                <span className="grid size-8 place-items-center rounded-full bg-white/15 text-xs font-bold text-white ring-1 ring-white/25">
                  {user.email.slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden max-w-48 truncate md:block">{user.email}</span>
                <ChevronDown className="hidden size-4 opacity-70 md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <span className="block text-xs text-muted">Signed in as</span>
                <span className="block truncate text-sm font-semibold text-ink">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onSignOut}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
