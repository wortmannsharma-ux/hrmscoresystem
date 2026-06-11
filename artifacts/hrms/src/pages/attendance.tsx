import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTodayAttendance,
  useListAttendance,
  useGetAttendanceSummary,
  useDayStart,
  useDayEnd,
  useListEmployees,
  useListOfficeLocations,
  useCreateOfficeLocation,
  useUpdateOfficeLocation,
  useDeleteOfficeLocation,
  useApproveAttendance,
  getListAttendanceQueryKey,
  getGetAttendanceSummaryQueryKey,
  getGetTodayAttendanceQueryKey,
  getListOfficeLocationsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, UserCheck, UserX, Clock, MapPin, Plus, Pencil, Trash2, Settings, Shield, CheckCircle, XCircle } from "lucide-react";
import { SmartAttendanceModal } from "@/components/smart-attendance-modal";
import { useAuth, authFetch } from "@/lib/auth-context";

const DEFAULT_SETTINGS = {
  presentBeforeMins: 570,
  lateBeforeMins: 660,
  halfDayBeforeMins: 780,
  geoFencingEnabled: false,
  outsideRadiusAction: "warn",
};

function minsToTimeInput(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeInputToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export default function AttendancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isEmployee = role === "EMPLOYEE" || role === "INTERN";
  const isManager = role === "MANAGER" || role === "TEAM_LEADER";
  const canApprove = role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER" || role === "TEAM_LEADER";
  const canSeeSettings = ["SUPER_ADMIN", "ADMIN", "HR"].includes(role);

  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  // Employees always see only their own records — lock the filter to their employee ID
  const [employeeFilter, setEmployeeFilter] = useState<string>(
    isEmployee && user?.employeeId ? user.employeeId.toString() : "all"
  );

  const [isSmartModal, setIsSmartModal] = useState(false);
  const [isEndDialog, setIsEndDialog] = useState(false);
  const [endData, setEndData] = useState({
    employeeId: "",
    visits: "",
    km: "",
    leads: "",
    orders: "",
    collection: "",
    remarks: "",
  });

  // Attendance Settings (not in codegen, fetch directly)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState(DEFAULT_SETTINGS);

  // Office Location dialog state
  const [locationDialog, setLocationDialog] = useState<{ open: boolean; editing: any | null }>({ open: false, editing: null });
  const [locationForm, setLocationForm] = useState({ name: "", lat: "", lng: "", radius: "50", requireApproval: false, isActive: true });

  useEffect(() => {
    authFetch("/api/attendance/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLocalSettings(data);
        setSettingsLoading(false);
      })
      .catch(() => setSettingsLoading(false));
  }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await authFetch("/api/attendance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localSettings),
      });
      const data = await res.json();
      setSettings(data);
      setLocalSettings(data);
      toast({ title: "Attendance settings saved" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const { data: todayStats } = useGetTodayAttendance();
  const { data: summary } = useGetAttendanceSummary(
    { month, employeeId: employeeFilter !== "all" ? Number(employeeFilter) : undefined },
    { query: { queryKey: getGetAttendanceSummaryQueryKey({ month, employeeId: employeeFilter !== "all" ? Number(employeeFilter) : undefined }) } }
  );
  const { data: attendanceList, isLoading } = useListAttendance(
    { month, employeeId: employeeFilter !== "all" ? Number(employeeFilter) : undefined },
    { query: { queryKey: getListAttendanceQueryKey({ month, employeeId: employeeFilter !== "all" ? Number(employeeFilter) : undefined }) } }
  );
  const { data: employees } = useListEmployees();
  const { data: officeLocations } = useListOfficeLocations();

  // Manager sees only their team employees
  const allEmployees = (employees || []) as any[];
  const employeesList = isManager && user?.employeeId
    ? allEmployees.filter((e: any) => e.managerId === user.employeeId)
    : allEmployees;

  // Approve attendance mutation (ADMIN / MANAGER only)
  const approveMutation = useApproveAttendance({
    mutation: {
      onSuccess: () => {
        toast({ title: "Attendance updated" });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      },
      onError: () => toast({ title: "Failed to update attendance", variant: "destructive" }),
    },
  });

  const dayStartMutation = useDayStart({
    mutation: {
      onSuccess: () => {
        toast({ title: "Day started successfully", description: "Attendance marked" });
        setIsSmartModal(false);
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error || String(err);
        toast({ title: "Failed to start day", description: msg, variant: "destructive" });
      },
    },
  });

  const dayEndMutation = useDayEnd({
    mutation: {
      onSuccess: () => {
        toast({ title: "Day ended", description: "EOD report submitted" });
        setIsEndDialog(false);
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      },
      onError: (err: any) => toast({ title: "Failed to end day", description: String(err), variant: "destructive" }),
    },
  });

  const createLocationMutation = useCreateOfficeLocation({
    mutation: {
      onSuccess: () => {
        toast({ title: "Office location added" });
        setLocationDialog({ open: false, editing: null });
        queryClient.invalidateQueries({ queryKey: getListOfficeLocationsQueryKey() });
      },
    },
  });

  const updateLocationMutation = useUpdateOfficeLocation({
    mutation: {
      onSuccess: () => {
        toast({ title: "Office location updated" });
        setLocationDialog({ open: false, editing: null });
        queryClient.invalidateQueries({ queryKey: getListOfficeLocationsQueryKey() });
      },
    },
  });

  const deleteLocationMutation = useDeleteOfficeLocation({
    mutation: {
      onSuccess: () => {
        toast({ title: "Location deleted" });
        queryClient.invalidateQueries({ queryKey: getListOfficeLocationsQueryKey() });
      },
    },
  });

  const handleSmartDayStart = (data: { employeeId: number; selfieUrl: string; lat?: number; lng?: number }) => {
    dayStartMutation.mutate({
      data: {
        employeeId: data.employeeId,
        selfieUrl: data.selfieUrl,
        lat: data.lat,
        lng: data.lng,
      },
    });
  };

  const handleEndDay = () => {
    // For employees, use their own ID directly
    const empId = isEmployee && user?.employeeId ? user.employeeId : Number(endData.employeeId);
    if (!empId) return;
    dayEndMutation.mutate({
      data: {
        employeeId: empId,
        eodVisits: Number(endData.visits) || 0,
        eodKm: Number(endData.km) || 0,
        eodLeads: Number(endData.leads) || 0,
        eodOrders: Number(endData.orders) || 0,
        eodCollection: Number(endData.collection) || 0,
        eodRemarks: endData.remarks || undefined,
      },
    });
  };

  const openAddLocation = () => {
    setLocationForm({ name: "", lat: "", lng: "", radius: "50", requireApproval: false, isActive: true });
    setLocationDialog({ open: true, editing: null });
  };

  const openEditLocation = (loc: any) => {
    setLocationForm({
      name: loc.name,
      lat: loc.lat.toString(),
      lng: loc.lng.toString(),
      radius: loc.radius.toString(),
      requireApproval: loc.requireApproval,
      isActive: loc.isActive,
    });
    setLocationDialog({ open: true, editing: loc });
  };

  const handleSaveLocation = () => {
    const payload = {
      name: locationForm.name,
      lat: Number(locationForm.lat),
      lng: Number(locationForm.lng),
      radius: Number(locationForm.radius),
      requireApproval: locationForm.requireApproval,
      isActive: locationForm.isActive,
    };
    if (locationDialog.editing) {
      updateLocationMutation.mutate({ id: locationDialog.editing.id, data: payload });
    } else {
      createLocationMutation.mutate({ data: payload });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "present": return "bg-green-100 text-green-800 border-green-200";
      case "absent": return "bg-red-100 text-red-800 border-red-200";
      case "late": return "bg-amber-100 text-amber-800 border-amber-200";
      case "half day": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "wfh": return "bg-blue-100 text-blue-800 border-blue-200";
      case "outdoor duty": return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "on leave": return "bg-orange-100 text-orange-800 border-orange-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Attendance</h2>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsSmartModal(true)} data-testid="button-day-start">
            <Clock className="h-4 w-4 mr-2" /> Day Start
          </Button>
          <Button variant="secondary" onClick={() => setIsEndDialog(true)} data-testid="button-day-end">
            Day End
          </Button>
        </div>
      </div>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">Records</TabsTrigger>
          {canSeeSettings && (
            <TabsTrigger value="settings">
              <Settings className="h-3.5 w-3.5 mr-1.5" /> Settings
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="records" className="space-y-4 mt-4">
          {/* Today's stats — only for managers/admins, not for individual employees */}
          {!isEmployee && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Present Today</CardTitle>
                  <UserCheck className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">{todayStats?.presentCount || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
                  <UserX className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{todayStats?.absentCount || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">On Leave</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{todayStats?.onLeaveCount || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Late In</CardTitle>
                  <Clock className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{todayStats?.lateCount || 0}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters — employees see only month picker, no employee selector */}
          <div className="flex items-center gap-4">
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-[200px]"
              data-testid="filter-month"
            />
            {!isEmployee && (
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger className="w-[200px]" data-testid="filter-employee">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employeesList.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {emp.firstName} {emp.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Monthly summary bar */}
          {summary && (
            <Card className="bg-muted/40">
              <CardContent className="py-4 flex items-center justify-around text-sm flex-wrap gap-4">
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">Attendance Rate</div>
                  <div className="font-bold text-xl text-primary">{(summary as any).attendanceRate}%</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">Present</div>
                  <div className="font-bold text-lg text-success">{(summary as any).totalPresent}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">Absent</div>
                  <div className="font-bold text-lg text-destructive">{(summary as any).totalAbsent}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">Late</div>
                  <div className="font-bold text-lg text-warning">{(summary as any).totalLate}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">Half Day</div>
                  <div className="font-bold text-lg">{(summary as any).totalHalfDay}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">WFH</div>
                  <div className="font-bold text-lg">{(summary as any).totalWfh}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">On Leave</div>
                  <div className="font-bold text-lg">{(summary as any).totalLeave}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attendance table */}
          <Card>
            <Table data-testid="table-attendance">
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Selfie</TableHead>
                  <TableHead>EOD</TableHead>
                  <TableHead>Approval</TableHead>
                  {canApprove && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canApprove ? 11 : 10} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : !attendanceList?.length ? (
                  <TableRow>
                    <TableCell colSpan={canApprove ? 11 : 10} className="text-center text-muted-foreground py-8">
                      No records found for {month}
                    </TableCell>
                  </TableRow>
                ) : (
                  (attendanceList as any[])
                    // Managers see only their team's records
                    .filter((record: any) => {
                      if (!isManager || !user?.employeeId) return true;
                      return employeesList.some((e: any) => e.id === record.employeeId);
                    })
                    .map((record: any) => (
                    <TableRow key={record.id} data-testid={`row-attendance-${record.id}`}>
                      <TableCell className="font-medium">
                        {record.employeeName || `EMP #${record.employeeId}`}
                      </TableCell>
                      <TableCell>{format(new Date(record.date), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(record.status)}>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {record.checkInTime ? format(new Date(record.checkInTime), "HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {record.checkOutTime ? format(new Date(record.checkOutTime), "HH:mm") : "—"}
                      </TableCell>
                      <TableCell>
                        {record.workingHours != null ? `${Number(record.workingHours).toFixed(1)}h` : "—"}
                      </TableCell>
                      <TableCell>{record.eodKm != null ? `${record.eodKm} km` : "—"}</TableCell>
                      <TableCell>
                        {record.checkInSelfie ? (
                          <span className="text-xs text-success">✓</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={record.eodSubmitted ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"}>
                          {record.eodSubmitted ? "Done" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.approvalStatus ? (
                          <Badge variant="outline" className={
                            record.approvalStatus === "Approved" ? "bg-green-50 text-green-700" :
                            record.approvalStatus === "Rejected" ? "bg-red-50 text-red-700" :
                            "bg-amber-50 text-amber-700"
                          }>
                            {record.approvalStatus}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      {/* Approve / Reject — only ADMIN and MANAGER see this */}
                      {canApprove && (
                        <TableCell className="text-right">
                          {record.approvalStatus === "Pending" && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 text-green-600 border-green-200 hover:bg-green-50"
                                disabled={approveMutation.isPending}
                                onClick={() => approveMutation.mutate({ id: record.id, data: { action: "Approved", approvedBy: user?.employeeId ?? undefined } })}
                                title="Approve"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 text-red-600 border-red-200 hover:bg-red-50"
                                disabled={approveMutation.isPending}
                                onClick={() => approveMutation.mutate({ id: record.id, data: { action: "Rejected" } })}
                                title="Reject"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6 mt-4">
          {settingsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading settings...</div>
          ) : (
            <>
              {/* Late Login Rules */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Late Login Rules
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Configure time thresholds that determine attendance status on check-in
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-sm">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          Present before
                        </span>
                      </Label>
                      <Input
                        type="time"
                        value={minsToTimeInput(localSettings.presentBeforeMins)}
                        onChange={(e) =>
                          setLocalSettings((s) => ({ ...s, presentBeforeMins: timeInputToMins(e.target.value) }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">Login before this time → Present</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          Half Day after
                        </span>
                      </Label>
                      <Input
                        type="time"
                        value={minsToTimeInput(localSettings.lateBeforeMins)}
                        onChange={(e) =>
                          setLocalSettings((s) => ({ ...s, lateBeforeMins: timeInputToMins(e.target.value) }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">Between Present & Half Day cutoff → Late</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-orange-500" />
                          Approval required after
                        </span>
                      </Label>
                      <Input
                        type="time"
                        value={minsToTimeInput(localSettings.halfDayBeforeMins)}
                        onChange={(e) =>
                          setLocalSettings((s) => ({ ...s, halfDayBeforeMins: timeInputToMins(e.target.value) }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">Login after this → requires approval</p>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1.5">
                    <div className="font-medium mb-1">Preview of rules:</div>
                    <div className="flex gap-8 flex-wrap">
                      <span>Before {minsToTimeInput(localSettings.presentBeforeMins)} → <strong className="text-green-600">Present</strong></span>
                      <span>{minsToTimeInput(localSettings.presentBeforeMins)}–{minsToTimeInput(localSettings.lateBeforeMins)} → <strong className="text-amber-600">Late</strong></span>
                      <span>{minsToTimeInput(localSettings.lateBeforeMins)}–{minsToTimeInput(localSettings.halfDayBeforeMins)} → <strong className="text-yellow-600">Half Day</strong></span>
                      <span>After {minsToTimeInput(localSettings.halfDayBeforeMins)} → <strong className="text-orange-600">Approval Required</strong></span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Geo-Fencing */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Geo-Fencing Policy
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Control attendance based on employee GPS location vs office radius
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Enable Geo-Fencing</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Validate employee location against defined office locations
                      </p>
                    </div>
                    <Switch
                      checked={localSettings.geoFencingEnabled}
                      onCheckedChange={(v) =>
                        setLocalSettings((s) => ({ ...s, geoFencingEnabled: v }))
                      }
                    />
                  </div>

                  {localSettings.geoFencingEnabled && (
                    <div className="space-y-2">
                      <Label className="text-sm">If employee is outside allowed radius:</Label>
                      <Select
                        value={localSettings.outsideRadiusAction}
                        onValueChange={(v) =>
                          setLocalSettings((s) => ({ ...s, outsideRadiusAction: v }))
                        }
                      >
                        <SelectTrigger className="w-[300px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="warn">⚠ Warn only (record but allow)</SelectItem>
                          <SelectItem value="approve">⏳ Require manager approval</SelectItem>
                          <SelectItem value="block">⛔ Block attendance</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {localSettings.outsideRadiusAction === "warn" && "Employee is alerted but attendance is marked normally"}
                        {localSettings.outsideRadiusAction === "approve" && "Attendance will be pending until manager approves"}
                        {localSettings.outsideRadiusAction === "block" && "Employee cannot mark attendance from outside the radius"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? "Saving..." : "Save Settings"}
              </Button>

              {/* Office Locations */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      Office Locations
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Define office geo-fence zones. Radius is used for attendance validation.
                    </p>
                  </div>
                  <Button size="sm" onClick={openAddLocation}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Location
                  </Button>
                </CardHeader>
                <CardContent>
                  {!officeLocations?.length ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No office locations defined yet.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Coordinates</TableHead>
                          <TableHead>Radius</TableHead>
                          <TableHead>Outside Policy</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(officeLocations as any[]).map((loc: any) => (
                          <TableRow key={loc.id}>
                            <TableCell className="font-medium">{loc.name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                            </TableCell>
                            <TableCell>{loc.radius} m</TableCell>
                            <TableCell>
                              {loc.requireApproval ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                  Approval Required
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-muted text-muted-foreground">
                                  Allow
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={loc.isActive ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"}
                              >
                                {loc.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditLocation(loc)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => deleteLocationMutation.mutate({ id: loc.id })}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Smart Day Start Modal */}
      <SmartAttendanceModal
        open={isSmartModal}
        onOpenChange={setIsSmartModal}
        onSubmit={handleSmartDayStart}
        isSubmitting={dayStartMutation.isPending}
        employees={
          isEmployee && user?.employeeId
            // Employee only sees themselves
            ? employeesList.filter((e: any) => e.id === user.employeeId).map((e: any) => ({
                id: e.id, firstName: e.firstName, lastName: e.lastName, role: e.role,
              }))
            : employeesList.map((e: any) => ({
                id: e.id, firstName: e.firstName, lastName: e.lastName, role: e.role,
              }))
        }
        officeLocations={(officeLocations || []) as any[]}
        settings={settings}
      />

      {/* Day End Dialog */}
      <Dialog open={isEndDialog} onOpenChange={setIsEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End of Day Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Employee selector — hidden for regular employees (auto-filled) */}
            {!isEmployee && (
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={endData.employeeId} onValueChange={(v) => setEndData({ ...endData, employeeId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeesList.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Visits</Label>
                <Input type="number" min="0" value={endData.visits} onChange={(e) => setEndData({ ...endData, visits: e.target.value })} data-testid="input-visits" />
              </div>
              <div className="space-y-2">
                <Label>KM Travelled</Label>
                <Input type="number" min="0" step="0.1" value={endData.km} onChange={(e) => setEndData({ ...endData, km: e.target.value })} data-testid="input-km" />
              </div>
              <div className="space-y-2">
                <Label>Leads Generated</Label>
                <Input type="number" min="0" value={endData.leads} onChange={(e) => setEndData({ ...endData, leads: e.target.value })} data-testid="input-leads" />
              </div>
              <div className="space-y-2">
                <Label>Orders Collected</Label>
                <Input type="number" min="0" value={endData.orders} onChange={(e) => setEndData({ ...endData, orders: e.target.value })} data-testid="input-orders" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Collection Amount (₹)</Label>
                <Input type="number" min="0" value={endData.collection} onChange={(e) => setEndData({ ...endData, collection: e.target.value })} data-testid="input-collection" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Remarks</Label>
                <Input value={endData.remarks} onChange={(e) => setEndData({ ...endData, remarks: e.target.value })} data-testid="input-remarks" placeholder="Daily summary..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEndDialog(false)}>Cancel</Button>
            <Button
              onClick={handleEndDay}
              disabled={dayEndMutation.isPending || (!isEmployee && !endData.employeeId)}
              data-testid="submit-day-end"
            >
              {dayEndMutation.isPending ? "Submitting..." : "Submit EOD"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Office Location Dialog */}
      <Dialog open={locationDialog.open} onOpenChange={(v) => setLocationDialog({ open: v, editing: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {locationDialog.editing ? "Edit" : "Add"} Office Location
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Location Name *</Label>
              <Input
                placeholder="e.g. HQ Mumbai"
                value={locationForm.name}
                onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Latitude *</Label>
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="19.0760"
                  value={locationForm.lat}
                  onChange={(e) => setLocationForm({ ...locationForm, lat: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Longitude *</Label>
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="72.8777"
                  value={locationForm.lng}
                  onChange={(e) => setLocationForm({ ...locationForm, lng: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Allowed Radius (meters)</Label>
              <Select
                value={locationForm.radius}
                onValueChange={(v) => setLocationForm({ ...locationForm, radius: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 meters</SelectItem>
                  <SelectItem value="10">10 meters</SelectItem>
                  <SelectItem value="25">25 meters</SelectItem>
                  <SelectItem value="50">50 meters</SelectItem>
                  <SelectItem value="100">100 meters</SelectItem>
                  <SelectItem value="200">200 meters</SelectItem>
                  <SelectItem value="500">500 meters</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Require Approval for Outside</Label>
                <p className="text-xs text-muted-foreground">Override global policy for this location</p>
              </div>
              <Switch
                checked={locationForm.requireApproval}
                onCheckedChange={(v) => setLocationForm({ ...locationForm, requireApproval: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Active</Label>
                <p className="text-xs text-muted-foreground">Include in geo-fence checks</p>
              </div>
              <Switch
                checked={locationForm.isActive}
                onCheckedChange={(v) => setLocationForm({ ...locationForm, isActive: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialog({ open: false, editing: null })}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveLocation}
              disabled={!locationForm.name || !locationForm.lat || !locationForm.lng}
            >
              {locationDialog.editing ? "Update" : "Add"} Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
