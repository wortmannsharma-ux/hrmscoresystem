import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListLeaves, useApproveLeave, useCreateLeave,
  useListHolidays, useListEmployees,
  getListLeavesQueryKey, getListHolidaysQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Check, X } from "lucide-react";
import { PaginationBar, usePagination } from "@/components/ui/pagination-bar";

export default function LeavesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = user?.role ?? "";

  // Role flags
  const isEmployee = role === "EMPLOYEE" || role === "INTERN";
  const isManager = role === "MANAGER" || role === "TEAM_LEADER";
  // Only these roles can approve/reject
  const canApprove = ["SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "TEAM_LEADER"].includes(role);

  const [activeTab, setActiveTab] = useState("all");
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  // Employees always locked to their own ID
  const [employeeId, setEmployeeId] = useState<string>(
    isEmployee && user?.employeeId ? user.employeeId.toString() : "all"
  );
  const [status, setStatus] = useState<string>("all");
  const [leaveType, setLeaveType] = useState<string>("all");
  const [year, setYear] = useState(new Date().getFullYear());

  const [isApplyDialog, setIsApplyDialog] = useState(false);
  const [applyData, setApplyData] = useState({
    employeeId: isEmployee && user?.employeeId ? user.employeeId.toString() : "",
    type: "Casual",
    fromDate: "",
    toDate: "",
    reason: "",
  });

  // ── Pagination ──────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset page when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setPage(1);
  };

  // Keep applyData.employeeId in sync when user loads
  useEffect(() => {
    if (isEmployee && user?.employeeId) {
      setApplyData((d) => ({ ...d, employeeId: user.employeeId!.toString() }));
      setEmployeeId(user.employeeId.toString());
    }
  }, [user?.employeeId, isEmployee]);

  const queryParams = {
    month,
    employeeId: employeeId !== "all" ? Number(employeeId) : undefined,
    status: status !== "all" ? status : undefined,
  };

  const pendingParams = { status: "Pending" };

  const { data: leaves, isLoading: isLeavesLoading } = useListLeaves(queryParams, {
    query: { queryKey: getListLeavesQueryKey(queryParams) },
  });

  const { data: pendingLeaves } = useListLeaves(pendingParams, {
    query: { queryKey: getListLeavesQueryKey(pendingParams) },
  });

  const { data: holidays, isLoading: isHolidaysLoading } = useListHolidays(
    { year },
    { query: { queryKey: getListHolidaysQueryKey({ year }) } }
  );

  const { data: allEmployeesRaw } = useListEmployees();
  const allEmployees = (allEmployeesRaw || []) as any[];

  // Managers see only their team in the employee dropdown
  const employees = isEmployee
    ? [] // employees don't need the dropdown
    : isManager && user?.employeeId
    ? allEmployees.filter((e: any) => e.managerId === user.employeeId)
    : allEmployees;

  // Managers see only their team's leaves
  const visibleLeaves = (() => {
    if (!leaves) return [];
    if (isEmployee) return (leaves as any[]).filter((l: any) => l.employeeId === user?.employeeId);
    if (isManager && user?.employeeId) {
      const teamIds = new Set(
        allEmployees.filter((e: any) => e.managerId === user.employeeId).map((e: any) => e.id)
      );
      return (leaves as any[]).filter((l: any) => teamIds.has(l.employeeId));
    }
    return leaves as any[];
  })();

  const visiblePending = (() => {
    if (!pendingLeaves) return [];
    if (isEmployee) return (pendingLeaves as any[]).filter((l: any) => l.employeeId === user?.employeeId);
    if (isManager && user?.employeeId) {
      const teamIds = new Set(
        allEmployees.filter((e: any) => e.managerId === user.employeeId).map((e: any) => e.id)
      );
      return (pendingLeaves as any[]).filter((l: any) => teamIds.has(l.employeeId));
    }
    return pendingLeaves as any[];
  })();

  const approveLeave = useApproveLeave({
    mutation: {
      onSuccess: () => {
        toast({ title: "Leave status updated" });
        queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to update", description: String(err), variant: "destructive" }),
    },
  });

  const createLeave = useCreateLeave({
    mutation: {
      onSuccess: () => {
        toast({ title: "Leave applied successfully" });
        setIsApplyDialog(false);
        queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
      },
      onError: (err) =>
        toast({ title: "Failed to apply leave", description: String(err), variant: "destructive" }),
    },
  });

  const handleApplyLeave = () => {
    if (!applyData.employeeId || !applyData.fromDate || !applyData.toDate) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    createLeave.mutate({
      data: {
        employeeId: Number(applyData.employeeId),
        leaveType: applyData.type as any,
        fromDate: applyData.fromDate,
        toDate: applyData.toDate,
        reason: applyData.reason,
      },
    });
  };

  const handleAction = (id: number, action: "approve" | "reject") => {
    approveLeave.mutate({ id, data: { action, remarks: `${role} ${action}d` } });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved": return "bg-green-100 text-green-800";
      case "rejected": return "bg-red-100 text-red-800";
      case "pending": return "bg-amber-100 text-amber-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const renderLeavesTable = (data: any[], loading: boolean) => {
    const start = (page - 1) * pageSize;
    const paged = data.slice(start, start + pageSize);
    return (
      <Card>
        <Table data-testid="table-leaves">
          <TableHeader>
            <TableRow>
              {!isEmployee && <TableHead>Employee</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              {canApprove && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={canApprove ? 8 : 7} className="text-center py-6">Loading…</TableCell></TableRow>
            ) : !data || data.length === 0 ? (
              <TableRow><TableCell colSpan={canApprove ? 8 : 7} className="text-center py-6 text-muted-foreground">No leaves found</TableCell></TableRow>
            ) : (
              paged.map((record: any) => (
                <TableRow key={record.id} data-testid={`row-leave-${record.id}`}>
                  {!isEmployee && (
                    <TableCell className="font-medium">{record.employeeName || `EMP #${record.employeeId}`}</TableCell>
                  )}
                  <TableCell>{record.leaveType || record.type}</TableCell>
                  <TableCell>{format(new Date(record.fromDate), "dd MMM yyyy")}</TableCell>
                  <TableCell>{format(new Date(record.toDate), "dd MMM yyyy")}</TableCell>
                  <TableCell>{record.days}</TableCell>
                  <TableCell className="max-w-[180px] truncate" title={record.reason}>{record.reason || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(record.status)}>{record.status}</Badge>
                  </TableCell>
                  {canApprove && (
                    <TableCell>
                      {record.status === "Pending" && (
                        <div className="flex gap-2">
                          <Button size="icon" variant="outline" className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => handleAction(record.id, "approve")} disabled={approveLeave.isPending}
                            data-testid={`btn-approve-${record.id}`}><Check className="h-4 w-4" /></Button>
                          <Button size="icon" variant="outline" className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleAction(record.id, "reject")} disabled={approveLeave.isPending}
                            data-testid={`btn-reject-${record.id}`}><X className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {data.length > pageSize && (
          <PaginationBar
            page={page} pageSize={pageSize} total={data.length}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </Card>
    );
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">
          {isEmployee ? "My Time Off" : "Leaves & Holidays"}
        </h2>

        {/* Apply Leave dialog */}
        <Dialog open={isApplyDialog} onOpenChange={setIsApplyDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-apply-leave">Apply Leave</Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Employee selector — hidden for regular employees */}
              {!isEmployee && (
                <div className="grid gap-2">
                  <Label>Employee *</Label>
                  <Select value={applyData.employeeId} onValueChange={(v) => setApplyData({ ...applyData, employeeId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {(isManager
                        ? allEmployees.filter((e: any) => e.managerId === user?.employeeId)
                        : allEmployees
                      ).map((emp: any) => (
                        <SelectItem key={emp.id} value={emp.id.toString()}>
                          {emp.firstName} {emp.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-2">
                <Label>Leave Type *</Label>
                <Select value={applyData.type} onValueChange={(v) => setApplyData({ ...applyData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Casual">Casual</SelectItem>
                    <SelectItem value="Sick">Sick</SelectItem>
                    <SelectItem value="Earned">Earned</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>From Date *</Label>
                  <Input type="date" value={applyData.fromDate} onChange={(e) => setApplyData({ ...applyData, fromDate: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>To Date *</Label>
                  <Input type="date" value={applyData.toDate} onChange={(e) => setApplyData({ ...applyData, toDate: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Reason</Label>
                <Input value={applyData.reason} onChange={(e) => setApplyData({ ...applyData, reason: e.target.value })} placeholder="Optional reason" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleApplyLeave} disabled={createLeave.isPending} data-testid="submit-leave">
                {createLeave.isPending ? "Submitting…" : "Submit Application"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            {isEmployee ? "My Leaves" : "All Requests"}
          </TabsTrigger>
          {/* Pending tab — hidden for employees (they can't approve anyway) */}
          {!isEmployee && (
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending
              {visiblePending.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-primary/20">{visiblePending.length}</Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="holidays" data-testid="tab-holidays">Holidays</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {/* Filters — employees only see month picker */}
          <div className="flex flex-wrap items-center gap-4 py-2">
            <Input
              type="month" value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-[200px]"
            />
            {!isEmployee && (
              <>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Employees" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>{emp.firstName} {emp.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          {renderLeavesTable(visibleLeaves, isLeavesLoading)}
        </TabsContent>

        {!isEmployee && (
          <TabsContent value="pending" className="space-y-4">
            {renderLeavesTable(visiblePending, isLeavesLoading)}
          </TabsContent>
        )}

        <TabsContent value="holidays" className="space-y-4">
          <div className="flex items-center gap-4 py-2">
            <Select value={year.toString()} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <Table data-testid="table-holidays">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Optional</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isHolidaysLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6">Loading…</TableCell></TableRow>
                ) : !holidays || holidays.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No holidays</TableCell></TableRow>
                ) : (
                  (holidays as any[]).map((h: any) => (
                    <TableRow key={h.id} data-testid={`row-holiday-${h.id}`}>
                      <TableCell className="font-medium">{format(new Date(h.date), "dd MMM yyyy")}</TableCell>
                      <TableCell>{h.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={h.type === "National" ? "bg-indigo-100 text-indigo-800" : "bg-blue-100 text-blue-800"}>
                          {h.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{h.isOptional ? "Yes" : "No"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
