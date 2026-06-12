import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import UsersPage from "@/pages/users";
import { AppLayout } from "@/components/layout/app-layout";
import Dashboard from "@/pages/dashboard";
import Employees from "@/pages/employees";
import EmployeeProfile from "@/pages/employee-profile";
import Departments from "@/pages/departments";
import Attendance from "@/pages/attendance";
import Tracking from "@/pages/tracking";
import Visits from "@/pages/visits";
import Leaves from "@/pages/leaves";
import Expenses from "@/pages/expenses";
import Payroll from "@/pages/payroll";
import Recruitment from "@/pages/recruitment";
import Settings from "@/pages/settings";
import MyProfile from "@/pages/my-profile";
import { ShieldOff } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// ── Route permission map ───────────────────────────────────────────────────────
// Lists which roles are ALLOWED for each route prefix.
// Routes not listed here are accessible to all authenticated users.
// More specific paths must come before broader ones (e.g. /employees/:id before /employees).
type Role = "SUPER_ADMIN" | "ADMIN" | "HR" | "MANAGER" | "TEAM_LEADER" | "EMPLOYEE" | "INTERN";

const ROUTE_PERMISSIONS: Array<{ pattern: RegExp; allowed: Role[] }> = [
  // Directory — not for employees/interns
  {
    pattern: /^\/employees(\/new)?$/,
    allowed: ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "TEAM_LEADER"],
  },
  // Individual employee profile — employees can see their own (handled inside the page),
  // but we allow the route so the page-level guard can show a proper message
  {
    pattern: /^\/employees\/\d+$/,
    allowed: ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "TEAM_LEADER", "EMPLOYEE", "INTERN"],
  },
  // Users management
  {
    pattern: /^\/users$/,
    allowed: ["SUPER_ADMIN", "ADMIN", "HR"],
  },
  // Org chart / Departments
  {
    pattern: /^\/departments$/,
    allowed: ["SUPER_ADMIN", "ADMIN", "HR"],
  },
  // Field tracking
  {
    pattern: /^\/field-tracking$/,
    allowed: ["SUPER_ADMIN", "ADMIN", "MANAGER", "TEAM_LEADER"],
  },
  // Vendor visits
  {
    pattern: /^\/visits$/,
    allowed: ["SUPER_ADMIN", "ADMIN", "MANAGER", "TEAM_LEADER"],
  },
  // Payroll
  {
    pattern: /^\/payroll$/,
    allowed: ["SUPER_ADMIN", "ADMIN", "HR"],
  },
  // Recruitment
  {
    pattern: /^\/recruitment$/,
    allowed: ["SUPER_ADMIN", "ADMIN", "HR"],
  },
  // Settings
  {
    pattern: /^\/settings$/,
    allowed: ["SUPER_ADMIN", "ADMIN", "HR"],
  },
];

// ── AccessDenied component ─────────────────────────────────────────────────────
function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-muted-foreground">
      <ShieldOff className="h-14 w-14 opacity-30" />
      <div className="text-center">
        <p className="text-xl font-semibold text-foreground">Access Denied</p>
        <p className="text-sm mt-1">You don't have permission to view this page.</p>
      </div>
    </div>
  );
}

// ── RouteGuard — wraps every route render ──────────────────────────────────────
function RouteGuard({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const role = (user?.role ?? "EMPLOYEE") as Role;

  // Check if this route has a permission rule
  for (const rule of ROUTE_PERMISSIONS) {
    if (rule.pattern.test(location)) {
      if (!rule.allowed.includes(role)) {
        return <AccessDenied />;
      }
      break;
    }
  }

  return <>{children}</>;
}

// ── ProtectedRouter ────────────────────────────────────────────────────────────
function ProtectedRouter() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppLayout>
      <RouteGuard>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/profile" component={MyProfile} />
          <Route path="/employees/new" component={Employees} />
          <Route path="/employees/:id" component={EmployeeProfile} />
          <Route path="/employees" component={Employees} />
          <Route path="/departments" component={Departments} />
          <Route path="/users" component={UsersPage} />
          <Route path="/attendance" component={Attendance} />
          <Route path="/field-tracking" component={Tracking} />
          <Route path="/visits" component={Visits} />
          <Route path="/leaves" component={Leaves} />
          <Route path="/expenses" component={Expenses} />
          <Route path="/payroll" component={Payroll} />
          <Route path="/recruitment" component={Recruitment} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </RouteGuard>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ProtectedRouter />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
