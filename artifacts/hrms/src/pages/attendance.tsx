import { useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTodayAttendance,
  useListAttendance,
  useGetAttendanceSummary,
  useDayStart,
  useDayEnd,
  useListEmployees,
  getListAttendanceQueryKey,
  getGetAttendanceSummaryQueryKey,
  getGetTodayAttendanceQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, UserCheck, UserX, Clock, MapPin, Map } from "lucide-react";

export default function AttendancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [employeeId, setEmployeeId] = useState<string>("all");
  
  const [isStartDialog, setIsStartDialog] = useState(false);
  const [isEndDialog, setIsEndDialog] = useState(false);
  
  const [startData, setStartData] = useState({ selfieUrl: "", latitude: "", longitude: "" });
  const [endData, setEndData] = useState({ visits: "", km: "", leads: "", orders: "", collection: "", remarks: "" });

  const { data: todayStats } = useGetTodayAttendance();
  const { data: summary } = useGetAttendanceSummary({ month, employeeId: employeeId !== "all" ? Number(employeeId) : undefined }, {
    query: { queryKey: getGetAttendanceSummaryQueryKey({ month, employeeId: employeeId !== "all" ? Number(employeeId) : undefined }) }
  });
  const { data: attendanceList, isLoading } = useListAttendance({ month, employeeId: employeeId !== "all" ? Number(employeeId) : undefined }, {
    query: { queryKey: getListAttendanceQueryKey({ month, employeeId: employeeId !== "all" ? Number(employeeId) : undefined }) }
  });
  const { data: employees } = useListEmployees();

  const dayStartMutation = useDayStart({
    mutation: {
      onSuccess: () => {
        toast({ title: "Day started successfully" });
        setIsStartDialog(false);
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to start day", description: String(err), variant: "destructive" })
    }
  });

  const dayEndMutation = useDayEnd({
    mutation: {
      onSuccess: () => {
        toast({ title: "Day ended successfully" });
        setIsEndDialog(false);
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to end day", description: String(err), variant: "destructive" })
    }
  });

  const handleStartDay = () => {
    dayStartMutation.mutate({
      data: {
        selfieUrl: startData.selfieUrl || "https://example.com/selfie.jpg",
        location: {
          latitude: Number(startData.latitude) || 0,
          longitude: Number(startData.longitude) || 0,
          address: "Current Location"
        }
      }
    });
  };

  const handleEndDay = () => {
    dayEndMutation.mutate({
      data: {
        visits: Number(endData.visits) || 0,
        kmTravelled: Number(endData.km) || 0,
        leadsGenerated: Number(endData.leads) || 0,
        ordersCollected: Number(endData.orders) || 0,
        collectionAmount: Number(endData.collection) || 0,
        remarks: endData.remarks
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "present": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "absent": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "late": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "half day": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "wfh": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "outdoor duty": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400";
      case "on leave": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Attendance</h2>
        <div className="flex items-center gap-2">
          <Dialog open={isStartDialog} onOpenChange={setIsStartDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-day-start">Day Start</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start Your Day</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="selfieUrl">Selfie URL</Label>
                  <Input id="selfieUrl" value={startData.selfieUrl} onChange={e => setStartData({...startData, selfieUrl: e.target.value})} data-testid="input-selfie" placeholder="https://..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="lat">Latitude</Label>
                    <Input id="lat" type="number" value={startData.latitude} onChange={e => setStartData({...startData, latitude: e.target.value})} data-testid="input-lat" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lng">Longitude</Label>
                    <Input id="lng" type="number" value={startData.longitude} onChange={e => setStartData({...startData, longitude: e.target.value})} data-testid="input-lng" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleStartDay} disabled={dayStartMutation.isPending} data-testid="submit-day-start">Submit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isEndDialog} onOpenChange={setIsEndDialog}>
            <DialogTrigger asChild>
              <Button variant="secondary" data-testid="button-day-end">Day End</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>End Your Day</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4 grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="visits">Visits</Label>
                  <Input id="visits" type="number" value={endData.visits} onChange={e => setEndData({...endData, visits: e.target.value})} data-testid="input-visits" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="km">KM Travelled</Label>
                  <Input id="km" type="number" value={endData.km} onChange={e => setEndData({...endData, km: e.target.value})} data-testid="input-km" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="leads">Leads Generated</Label>
                  <Input id="leads" type="number" value={endData.leads} onChange={e => setEndData({...endData, leads: e.target.value})} data-testid="input-leads" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="orders">Orders Collected</Label>
                  <Input id="orders" type="number" value={endData.orders} onChange={e => setEndData({...endData, orders: e.target.value})} data-testid="input-orders" />
                </div>
                <div className="grid gap-2 col-span-2">
                  <Label htmlFor="collection">Collection Amount (₹)</Label>
                  <Input id="collection" type="number" value={endData.collection} onChange={e => setEndData({...endData, collection: e.target.value})} data-testid="input-collection" />
                </div>
                <div className="grid gap-2 col-span-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Input id="remarks" value={endData.remarks} onChange={e => setEndData({...endData, remarks: e.target.value})} data-testid="input-remarks" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleEndDay} disabled={dayEndMutation.isPending} data-testid="submit-day-end">Submit EOD</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Today</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayStats?.presentCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
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
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayStats?.lateCount || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 py-4">
        <Input 
          type="month" 
          value={month} 
          onChange={(e) => setMonth(e.target.value)}
          className="w-[200px]"
          data-testid="filter-month"
        />
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger className="w-[200px]" data-testid="filter-employee">
            <SelectValue placeholder="All Employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees?.map(emp => (
              <SelectItem key={emp.id} value={emp.id.toString()}>{emp.firstName} {emp.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {summary && (
        <Card className="mb-4 bg-muted/50">
          <CardContent className="py-4 flex items-center justify-around text-sm">
            <div className="text-center">
              <div className="text-muted-foreground">Attendance Rate</div>
              <div className="font-bold text-lg">{summary.rate}%</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Total Present</div>
              <div className="font-bold text-lg">{summary.present}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Total Absent</div>
              <div className="font-bold text-lg">{summary.absent}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Total Late</div>
              <div className="font-bold text-lg">{summary.late}</div>
            </div>
          </CardContent>
        </Card>
      )}

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
              <TableHead>EOD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center">Loading...</TableCell></TableRow>
            ) : attendanceList?.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center">No records found</TableCell></TableRow>
            ) : (
              attendanceList?.map((record: any) => (
                <TableRow key={record.id} data-testid={`row-attendance-${record.id}`}>
                  <TableCell className="font-medium">{record.employeeName || `EMP #${record.employeeId}`}</TableCell>
                  <TableCell>{format(new Date(record.date), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(record.status)}>{record.status}</Badge>
                  </TableCell>
                  <TableCell>{record.checkIn ? format(new Date(record.checkIn), "HH:mm") : "-"}</TableCell>
                  <TableCell>{record.checkOut ? format(new Date(record.checkOut), "HH:mm") : "-"}</TableCell>
                  <TableCell>{record.workingHours || "-"}</TableCell>
                  <TableCell>{record.kmTravelled || "-"}</TableCell>
                  <TableCell>{record.dayEndSubmitted ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
