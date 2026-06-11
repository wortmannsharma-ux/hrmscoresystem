import React from "react";
import { format } from "date-fns";
import {
  useGetHrDashboard,
  useGetTodayAttendance,
  useGetPendingApprovals,
  useGetRecentActivity,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, CalendarOff, Receipt, Clock, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/lib/auth-context";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))"
];

export default function Dashboard() {
  const today = new Date();
  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 18 ? "Good afternoon" : "Good evening";
  const { user } = useAuth();
  const displayName = user?.firstName
    ? user.firstName
    : user?.name?.split(" ")[0] ?? "there";

  const { data: dashboard, isLoading: isLoadingDash } = useGetHrDashboard();
  const { data: attendance, isLoading: isLoadingAtt } = useGetTodayAttendance();
  const { data: pending, isLoading: isLoadingPend } = useGetPendingApprovals();
  const { data: activity, isLoading: isLoadingAct } = useGetRecentActivity();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">{greeting}, {displayName}</h2>
          <p className="text-muted-foreground">{format(today, "EEEE, MMMM d, yyyy")}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingDash ? <Skeleton className="h-8 w-20" /> : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-employees">{dashboard?.totalEmployees || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboard?.openPositions || 0} open positions
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Today</CardTitle>
            <UserCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            {isLoadingDash ? <Skeleton className="h-8 w-20" /> : (
              <>
                <div className="text-2xl font-bold text-success" data-testid="text-present-today">{dashboard?.presentToday || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboard?.totalEmployees ? Math.round((dashboard.presentToday / dashboard.totalEmployees) * 100) : 0}% attendance
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Leave</CardTitle>
            <CalendarOff className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            {isLoadingDash ? <Skeleton className="h-8 w-20" /> : (
              <>
                <div className="text-2xl font-bold text-warning" data-testid="text-on-leave">{dashboard?.onLeaveToday || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboard?.pendingLeaves || 0} pending requests
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {isLoadingDash ? <Skeleton className="h-8 w-20" /> : (
              <>
                <div className="text-2xl font-bold" data-testid="text-pending-expenses">₹{Number(dashboard?.pendingExpenses || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">{(dashboard as any)?.pendingExpensesCount ?? 0} claims awaiting approval</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {/* Today's Attendance Summary */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Today's Attendance</CardTitle>
            <CardDescription>Live attendance tracking</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAtt ? (
              <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm font-medium">Present</span>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">{attendance?.presentCount || 0}</Badge>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm font-medium">Absent</span>
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">{attendance?.absentCount || 0}</Badge>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm font-medium">Late</span>
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">{attendance?.lateCount || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">On Field</span>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{attendance?.fieldCount || 0}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Action Required</CardTitle>
            <CardDescription>Pending approvals</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPend ? (
              <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 space-y-6">
                <div className="text-5xl font-bold text-primary">{pending?.total || 0}</div>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                    <Calendar className="h-5 w-5 mb-2 text-warning" />
                    <span className="text-2xl font-bold">{pending?.leaves || 0}</span>
                    <span className="text-xs text-muted-foreground">Leaves</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                    <Receipt className="h-5 w-5 mb-2 text-destructive" />
                    <span className="text-2xl font-bold">{pending?.expenses || 0}</span>
                    <span className="text-xs text-muted-foreground">Expenses</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest HR updates</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {isLoadingAct ? (
              <div className="space-y-4 px-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : (
              <div className="max-h-[250px] overflow-y-auto px-6 space-y-4">
                {(Array.isArray(activity) ? activity : []).map((item: any, i: number) => {
                  const Icon = item.type === 'leave' ? Calendar : item.type === 'expense' ? Receipt : Clock;
                  const colorClass = item.type === 'leave' ? 'text-warning bg-warning/10' : item.type === 'expense' ? 'text-destructive bg-destructive/10' : 'text-primary bg-primary/10';
                  return (
                    <div key={item.id || i} className="flex items-start gap-4" data-testid={`activity-${item.id || i}`}>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {item.timestamp ? new Date(item.timestamp).toLocaleString() : ""}
                        </p>
                      </div>
                    </div>
                  )
                })}
                {(!Array.isArray(activity) || activity.length === 0) && (
                  <div className="text-center text-muted-foreground text-sm py-4">No recent activity</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Attendance Trend Chart */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Attendance Trend</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingDash ? <Skeleton className="h-[300px] w-full" /> : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard?.attendanceTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Bar dataKey="present" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Present" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Department Breakdown */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Department Breakdown</CardTitle>
            <CardDescription>Employees by department</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingDash ? <Skeleton className="h-[300px] w-full" /> : (
              <div className="h-[300px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboard?.departmentBreakdown || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="department"
                    >
                      {(dashboard?.departmentBreakdown || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
