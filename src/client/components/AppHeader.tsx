import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Activity, ChevronDown, Inbox, LogOut, Menu, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { UserInfo } from "../auth";
import { cn } from "../lib/cn";
import { Brand } from "./Brand";
import { useForms } from "./FormsProvider";
import { ThemeToggle } from "./ThemeToggle";
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
  const [location, navigate] = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const transition = useRef<ViewTransition | null>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const { forms } = useForms();
  const unread = forms?.reduce((sum, form) => sum + form.unreadCount, 0) ?? 0;
  const items = [
    { href: formsHref, label: "Forms", icon: Inbox, active: isFormsPath(location), badge: unread },
    { href: "/activity", label: "Activity", icon: Activity, active: location.startsWith("/activity") },
    { href: "/settings", label: "Settings", icon: Settings, active: location.startsWith("/settings") },
  ];

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      setIndicator(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const link of nav.querySelectorAll("a")) observer.observe(link);
    return () => observer.disconnect();
  }, [location, unread]);

  useEffect(() => () => {
    transition.current?.skipTransition();
    delete document.documentElement.dataset.navigationDirection;
  }, []);

  function changeMenu(event: MouseEvent<HTMLAnchorElement>, href: string, index: number) {
    // Preserve native new-tab/modifier behavior and instant reduced-motion navigation.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const previous = items.findIndex((item) => item.active);
    if (previous === index) {
      transition.current?.skipTransition();
      transition.current = null;
      delete document.documentElement.dataset.navigationDirection;
      return;
    }
    event.preventDefault();
    transition.current?.skipTransition();
    document.documentElement.dataset.navigationDirection = index > previous ? "forward" : "backward";
    const next = document.startViewTransition(() => {
      if (transition.current === next) flushSync(() => navigate(href));
    });
    transition.current = next;
    // Skipping an in-flight transition rejects ready, even when navigation succeeds.
    void next.ready.catch(() => undefined);
    void next.finished.catch(() => undefined).finally(() => {
      if (transition.current !== next) return;
      transition.current = null;
      delete document.documentElement.dataset.navigationDirection;
    });
  }

  return (
    <header className="relative z-30 shrink-0 bg-chrome text-white shadow-[0_10px_30px_-18px_rgb(3_11_34/0.9)]">
      <div className="flex h-15 items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <div className="size-8 shrink-0 lg:hidden">
          {onOpenForms && (
            <Button variant="glass" size="icon-sm" className="border-transparent bg-transparent" onClick={onOpenForms} aria-label="Open forms list">
              <Menu />
            </Button>
          )}
        </div>
        <Link href="/" className="rounded-lg">
          <Brand tone="light" compact />
        </Link>
        <nav ref={navRef} aria-label="Main" className="relative ml-auto flex items-center gap-1 sm:ml-6">
          {indicator && (
            <span aria-hidden="true" className="main-nav-indicator pointer-events-none absolute top-0 left-0 h-9 rounded-lg bg-white/15 shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]" style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }} />
          )}
          {items.map(({ href, label, icon: Icon, active, badge }, index) => (
            <Link
              key={label}
              href={href}
              onClick={(event) => changeMenu(event, href, index)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-brand-100/80 transition-colors hover:bg-white/10 hover:text-white sm:px-3",
                active && "text-white hover:bg-transparent",
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
        <div className="flex items-center gap-2 sm:ml-auto">
          <ThemeToggle />
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
