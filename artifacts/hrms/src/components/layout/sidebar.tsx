import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarClock,
  MapPin,
  BriefcaseBusiness,
  Banknote,
  GraduationCap,
  Settings,
  Car,
  LogOut,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

// ── Role type helpers ─────────────────────────────────────────────────────────
type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "HR"
  | "MANAGER"
  | "TEAM_LEADER"
  | "EMPLOYEE"
  | "INTERN";

// visibleTo: which roles can see this nav item.
// If omitted, all roles can see it.
const ALL_NAV = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    // Everyone sees the dashboard
  },
  {
    name: "Directory",
    href: "/employees",
    icon: Users,
    // SUPER_ADMIN, ADMIN, HR see all employees.
    // MANAGER, TEAM_LEADER see only their team (filtered on the page itself).
    // EMPLOYEE / INTERN do NOT get a directory link — they use their own profile.
    visibleTo: ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "TEAM_LEADER"] as Role[],
  },
  {
    name: "Org Chart",
    href: "/departments",
    icon: Building2,
    // HR deals with org structure but you said HR cannot see it.
    // Only admins manage departments/designations.
    visibleTo: ["SUPER_ADMIN", "ADMIN"] as Role[],
  },
  {
    name: "Attendance",
    href: "/attendance",
    icon: CalendarClock,
    // Everyone tracks attendance
  },
  {
    name: "Field Tracking",
    href: "/field-tracking",
    icon: MapPin,
    // Managers track field staff. HR and employees don't need it.
    visibleTo: ["SUPER_ADMIN", "ADMIN", "MANAGER", "TEAM_LEADER"] as Role[],
  },
  {
    name: "Vendor Visits",
    href: "/visits",
    icon: BriefcaseBusiness,
    // Managers oversee vendor visits. HR doesn't manage visits.
    visibleTo: ["SUPER_ADMIN", "ADMIN", "MANAGER", "TEAM_LEADER"] as Role[],
  },
  {
    name: "Time Off",
    href: "/leaves",
    icon: Car,
    // Everyone applies for / approves leaves
  },
  {
    name: "Expenses",
    href: "/expenses",
    icon: Receipt,
    // Everyone submits / approves expenses
  },
  {
    name: "Payroll",
    href: "/payroll",
    icon: Banknote,
    // Only HR and admins manage payroll. Managers don't see it.
    visibleTo: ["SUPER_ADMIN", "ADMIN", "HR"] as Role[],
  },
  {
    name: "Recruitment",
    href: "/recruitment",
    icon: GraduationCap,
    // Only HR and admins manage hiring. Managers don't see it.
    visibleTo: ["SUPER_ADMIN", "ADMIN", "HR"] as Role[],
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    // Only admins and HR manage system settings.
    visibleTo: ["SUPER_ADMIN", "ADMIN", "HR"] as Role[],
  },
] as const;

// ── Sidebar ───────────────────────────────────────────────────────────────────
export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const role = (user?.role ?? "EMPLOYEE") as Role;

  // Filter nav items by role
  const navigation = ALL_NAV.filter((item) => {
    if (!("visibleTo" in item)) return true; // no restriction → show to all
    return (item.visibleTo as readonly Role[]).includes(role);
  });

  const handleLogout = () => {
    logout();
    queryClient.clear();
  };

  const initials = user
    ? (user.firstName?.[0] ?? user.name?.[0] ?? "?").toUpperCase() +
      (user.lastName?.[0] ?? user.name?.split(" ")[1]?.[0] ?? "").toUpperCase()
    : "?";

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : (user?.name ?? "User");

  // Human-readable role label
  const roleLabel: Record<Role, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    HR: "HR",
    MANAGER: "Manager",
    TEAM_LEADER: "Team Leader",
    EMPLOYEE: "Employee",
    INTERN: "Intern",
  };

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <div className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
          <div className="h-6 w-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs">
            H
          </div>
          HRMS Pro
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {navigation.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-4 w-4 flex-shrink-0",
                    isActive
                      ? "text-primary"
                      : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User panel */}
      <div className="border-t p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-sm shrink-0">
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium leading-none truncate">
              {displayName}
            </span>
            <span className="text-xs text-muted-foreground mt-1 truncate">
              {roleLabel[role] ?? role}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
