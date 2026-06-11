import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function ProtectedRouter() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppLayout>
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
