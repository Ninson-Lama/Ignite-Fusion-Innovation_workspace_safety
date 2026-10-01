"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  Award, BadgeCheck, BarChart3, BookOpen, ChartNoAxesCombined, ChevronDown, CircleHelp,
  ClipboardList, Gamepad2, Gauge, LogOut, Menu, ShieldCheck, Trophy, UserRound, UsersRound, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Brand } from "@/components/Brand";
import { NotificationBell } from "@/components/layout/NotificationBell";
import type { AssignmentNotification } from "@/lib/queries";
import { getRoleHome } from "@/lib/roles";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ViewerProfile } from "@/types";

interface NavItem { href: string; label: string; icon: LucideIcon; }

const traineeNavigation: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: Gauge },
  { href: "/training", label: "Training", icon: BookOpen },
  { href: "/games", label: "Mini-Game to Learn", icon: Gamepad2 },
  { href: "/progress", label: "Progress", icon: ChartNoAxesCombined },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/achievements", label: "Achievements", icon: Award },
  { href: "/certificates", label: "Certificates", icon: BadgeCheck },
];

const personalNavigation: NavItem[] = [
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/help", label: "Help & support", icon: CircleHelp },
];

const adminNavigation: NavItem[] = [
  { href: "/admin", label: "Management", icon: BarChart3 },
  { href: "/admin/users", label: "People", icon: UsersRound },
  { href: "/admin/training", label: "Modules", icon: ClipboardList },
  { href: "/admin/assignments", label: "Assignments", icon: ShieldCheck },
  { href: "/admin/results", label: "Results", icon: Gauge },
  { href: "/admin/reports", label: "Reports", icon: ChartNoAxesCombined },
];

function pathMatchesNavigation(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationList({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  const activeHref = items
    .filter((item) => pathMatchesNavigation(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <ul className="app-nav-list">
      {items.map((item) => {
        const active = item.href === activeHref;
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link className={active ? "active" : ""} href={item.href} aria-current={active ? "page" : undefined} onClick={onNavigate}>
              <Icon size={19} strokeWidth={1.8} /><span>{item.label}</span>{active && <i />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AccountMenu({
  viewer,
  accountLabel,
  pathname,
  onNavigate,
  onSignOut,
}: {
  viewer: ViewerProfile;
  accountLabel: string;
  pathname: string;
  onNavigate?: () => void;
  onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const shellRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function menuItems() {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  function closeMenu({ restoreFocus = false } = {}) {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openMenu(focus: "first" | "last" = "first") {
    setOpen(true);
    requestAnimationFrame(() => {
      const items = menuItems();
      (focus === "last" ? items.at(-1) : items[0])?.focus();
    });
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!shellRef.current?.contains(event.target as Node)) closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
        return;
      }

      const items = menuItems();
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      let nextIndex: number | undefined;

      if (event.key === "ArrowDown") nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
      if (event.key === "ArrowUp") nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = items.length - 1;

      if (nextIndex !== undefined && items[nextIndex]) {
        event.preventDefault();
        items[nextIndex].focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="account-menu-shell" ref={shellRef}>
      {open && (
        <div className="account-menu" id={menuId} ref={menuRef} role="menu" aria-label="Account options">
          {personalNavigation.map((item) => {
            const active = pathMatchesNavigation(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                className={active ? "active" : ""}
                href={item.href}
                key={item.href}
                role="menuitem"
                tabIndex={-1}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  closeMenu();
                  onNavigate?.();
                }}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="account-menu-divider" aria-hidden="true" />
          <button
            className="account-menu-signout"
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              closeMenu();
              onNavigate?.();
              void onSignOut();
            }}
          >
            <LogOut size={18} strokeWidth={1.8} />
            <span>Sign out</span>
          </button>
        </div>
      )}

      <button
        className="sidebar-user account-menu-trigger"
        type="button"
        ref={triggerRef}
        aria-label={`Open account options for ${viewer.fullName}`}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-expanded={open}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu(event.key === "ArrowUp" ? "last" : "first");
          }
        }}
      >
        <span aria-hidden="true">{viewer.fullName.slice(0, 1).toUpperCase()}</span>
        <div><strong>{viewer.fullName}</strong><small>{accountLabel}</small></div>
        <ChevronDown className="account-menu-chevron" size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

export function AppShell({
  viewer,
  notifications,
  children,
}: {
  viewer: ViewerProfile;
  notifications: AssignmentNotification[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = viewer.role === "admin";
  const primaryNavigation = isAdmin ? adminNavigation : traineeNavigation;
  const workspaceLabel = isAdmin ? "Administration" : "Training workspace";
  const accountLabel = isAdmin ? "Administrator" : "Trainee";
  const homeHref = getRoleHome(viewer.role);
  const isImmersiveScene = pathname === "/training/hazard-perception/scene";
  const isTraineeAssessment = !isAdmin && /^\/training\/[^/]+\/(?:quiz|activity)$/.test(pathname);
  const title = [...primaryNavigation, ...personalNavigation]
    .filter((item) => pathMatchesNavigation(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? "Safety360";

  async function signOut() {
    const client = getBrowserSupabaseClient();
    if (client) await client.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (isImmersiveScene) return <div className="immersive-route">{children}</div>;

  return (
    <div className={`app-frame app-frame-${isAdmin ? "admin" : "trainee"}${isTraineeAssessment ? " app-frame-assessment" : ""}`}>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <Brand href={homeHref} inverse />
          <span className="sidebar-product-label"><i aria-hidden="true" /> {accountLabel} portal</span>
        </div>
        <nav aria-label={`${isAdmin ? "Admin" : "Trainee"} navigation`}>
          <p className="nav-section-label">{workspaceLabel}</p>
          <NavigationList items={primaryNavigation} pathname={pathname} />
        </nav>
        <div className="sidebar-footer">
          <AccountMenu viewer={viewer} accountLabel={accountLabel} pathname={pathname} onSignOut={signOut} />
        </div>
      </aside>

      <div className="mobile-appbar">
        <Brand href={homeHref} compact />
        <span>{title}</span>
        {!isAdmin && <NotificationBell initialNotifications={notifications} compact />}
        <button aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu /></button>
      </div>

      {menuOpen && (
        <div className="mobile-drawer-layer">
          <button className="drawer-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
          <aside className="mobile-drawer" aria-label="Mobile navigation">
            <div className="drawer-header"><Brand href={homeHref} inverse /><button aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X /></button></div>
            <nav>
              <p className="nav-section-label">{workspaceLabel}</p>
              <NavigationList items={primaryNavigation} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            </nav>
            <AccountMenu
              viewer={viewer}
              accountLabel={accountLabel}
              pathname={pathname}
              onNavigate={() => setMenuOpen(false)}
              onSignOut={signOut}
            />
          </aside>
        </div>
      )}

      <div className="app-workspace">
        <header className="workspace-header">
          <div className="workspace-trail">
            <strong>{title}</strong>
          </div>
          {!isAdmin && <NotificationBell initialNotifications={notifications} />}
        </header>
        <main className={`workspace-main page-enter${isTraineeAssessment ? " workspace-main-assessment" : ""}`} id="main-content">{children}</main>
      </div>
    </div>
  );
}
