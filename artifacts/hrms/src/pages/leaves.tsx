import { useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListLeaves,
  useApproveLeave,
  useCreateLeave,
  useListHolidays,
  useListEmployees,
  getListLeavesQueryKey,
  getListHolidaysQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";

export default function LeavesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [employeeId, setEmployeeId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [leaveType, setLeaveType] = useState<string>("all");
  const [year, setYear] = useState(new Date().getFullYear());

  const [isApplyDialog, setIsApplyDialog] = useState(false);
  const [applyData, setApplyData] = useState({ employeeId: "", type: "Casual", fromDate: "", toDate: "", reason: "" });

  const queryParams = { 
    month: month, 
    employeeId: employeeId !== "all" ? Number(employeeId) : undefined,
    status: status !== "all" ? status : undefined,
    type: leaveType !== "all" ? leaveType : undefined
  };

  const pendingParams = { status: "Pending" };

  const { data: leaves, isLoading: isLeavesLoading } = useListLeaves(queryParams, {
    query: { queryKey: getListLeavesQueryKey(queryParams) }
  });

  const { data: pendingLeaves } = useListLeaves(pendingParams, {
    query: { queryKey: getListLeavesQueryKey(pendingParams) }
  });

  const { data: holidays, isLoading: isHolidaysLoading } = useListHolidays({ year }, {
    query: { queryKey: getListHolidaysQueryKey({ year }) }
  });

  const { data: employees } = useListEmployees();

  const approveLeave = useApproveLeave({
    mutation: {
      onSuccess: () => {
        toast({ title: "Leave status updated" });
        queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to update", description: String(err), variant: "destructive" })
    }
  });

  const createLeave = useCreateLeave({
    mutation: {
      onSuccess: () => {
        toast({ title: "Leave applied successfully" });
        setIsApplyDialog(false);
        queryClient.invalidateQueries({ queryKey: getListLeavesQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to apply leave", description: String(err), variant: "destructive" })
    }
  });

  const handleApplyLeave = () => {
    createLeave.mutate({
      data: {
        employeeId: Number(applyData.employeeId),
        leaveType: applyData.type as any,
        fromDate: applyData.fromDate,
        toDate: applyData.toDate,
        reason: applyData.reason
      }
    });
  };

  const handleAction = (id: number, action: 'approve' | 'reject') => {
    approveLeave.mutate({
      id,
      data: { action, remarks: `Manager ${action}d` }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "rejected": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "pending": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const renderLeavesTable = (data: any[], isLoading: boolean) => (
    <Card>
      <Table data-testid="table-leaves">
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Days</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={8} className="text-center">Loading...</TableCell></TableRow>
          ) : !data || data.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-center">No leaves found</TableCell></TableRow>
          ) : (
            data.map((record: any) => (
              <TableRow key={record.id} data-testid={`row-leave-${record.id}`}>
                <TableCell className="font-medium">{record.employeeName || `EMP #${record.employeeId}`}</TableCell>
                <TableCell>{record.leaveType || record.type}</TableCell>
                <TableCell>{format(new Date(record.fromDate), "dd MMM yyyy")}</TableCell>
                <TableCell>{format(new Date(record.toDate), "dd MMM yyyy")}</TableCell>
                <TableCell>{record.days}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={record.reason}>{record.reason}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={getStatusColor(record.status)}>{record.status}</Badge>
                </TableCell>
                <TableCell>
                  {record.status === "Pending" && (
                    <div className="flex gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8 text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleAction(record.id, 'approve')} disabled={approveLeave.isPending} data-testid={`btn-approve-${record.id}`}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleAction(record.id, 'reject')} disabled={approveLeave.isPending} data-testid={`btn-reject-${record.id}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Leaves & Holidays</h2>
        <Dialog open={isApplyDialog} onOpenChange={setIsApplyDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-apply-leave">Apply Leave</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="emp">Employee</Label>
                <Select value={applyData.employeeId} onValueChange={v => setApplyData({...applyData, employeeId: v})}>
                  <SelectTrigger id="emp"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees?.map(emp => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>{emp.firstName} {emp.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Leave Type</Label>
                <Select value={applyData.type} onValueChange={v => setApplyData({...applyData, type: v})}>
                  <SelectTrigger id="type"><SelectValue placeholder="Select type" /></SelectTrigger>
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
                  <Label htmlFor="from">From Date</Label>
                  <Input id="from" type="date" value={applyData.fromDate} onChange={e => setApplyData({...applyData, fromDate: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="to">To Date</Label>
                  <Input id="to" type="date" value={applyData.toDate} onChange={e => setApplyData({...applyData, toDate: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reason">Reason</Label>
                <Input id="reason" value={applyData.reason} onChange={e => setApplyData({...applyData, reason: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleApplyLeave} disabled={createLeave.isPending} data-testid="submit-leave">Submit Application</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All Requests</TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">Pending
            {pendingLeaves?.length ? <Badge variant="secondary" className="ml-2 bg-primary/20">{pendingLeaves.length}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="holidays" data-testid="tab-holidays">Holidays</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 py-2">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[200px]" />
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees?.map(emp => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>{emp.firstName} {emp.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Casual">Casual</SelectItem>
                <SelectItem value="Sick">Sick</SelectItem>
                <SelectItem value="Earned">Earned</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {renderLeavesTable(leaves || [], isLeavesLoading)}
        </TabsContent>
        
        <TabsContent value="pending" className="space-y-4">
          {renderLeavesTable(pendingLeaves || [], isLeavesLoading)}
        </TabsContent>
        
        <TabsContent value="holidays" className="space-y-4">
          <div className="flex items-center gap-4 py-2">
            <Select value={year.toString()} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" data-testid="button-add-holiday">Add Holiday</Button>
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
                  <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>
                ) : !holidays || holidays.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center">No holidays found</TableCell></TableRow>
                ) : (
                  holidays.map((holiday: any) => (
                    <TableRow key={holiday.id} data-testid={`row-holiday-${holiday.id}`}>
                      <TableCell className="font-medium">{format(new Date(holiday.date), "dd MMM yyyy")}</TableCell>
                      <TableCell>{holiday.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={holiday.type === "National" ? "bg-indigo-100 text-indigo-800" : "bg-blue-100 text-blue-800"}>
                          {holiday.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{holiday.isOptional ? "Yes" : "No"}</TableCell>
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
