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
  Car
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Directory", href: "/employees", icon: Users },
  { name: "Org Chart", href: "/departments", icon: Building2 },
  { name: "Attendance", href: "/attendance", icon: CalendarClock },
  { name: "Field Tracking", href: "/tracking", icon: MapPin },
  { name: "Vendor Visits", href: "/visits", icon: BriefcaseBusiness },
  { name: "Time Off", href: "/leaves", icon: Car },
  { name: "Expenses", href: "/expenses", icon: Banknote },
  { name: "Payroll", href: "/payroll", icon: Banknote },
  { name: "Recruitment", href: "/recruitment", icon: GraduationCap },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar">
      <div className="flex h-14 items-center border-b px-4">
        <div className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
          <div className="h-6 w-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs">
            H
          </div>
          HRMS Pro
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            
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
                    isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-sm">
            AD
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-none">Admin User</span>
            <span className="text-xs text-muted-foreground mt-1">Super Admin</span>
          </div>
        </div>
      </div>
    </div>
  );
}
