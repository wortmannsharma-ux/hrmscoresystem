import { useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Clock, CheckCircle, Map, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useListVisits, useCreateVisit, useGetVisitSummary,
  useListVendors, useCreateVendor,
  useListEmployees,
  getListVisitsQueryKey, getListVendorsQueryKey, getGetVisitSummaryQueryKey
} from "@workspace/api-client-react";

export default function VisitsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const [isVisitDialog, setIsVisitDialog] = useState(false);
  const [isVendorDialog, setIsVendorDialog] = useState(false);

  const [visitData, setVisitData] = useState({
    employeeId: "", vendorId: "", checkInTime: "", latitude: "", longitude: "",
    orderValue: "", remarks: ""
  });

  const [vendorData, setVendorData] = useState({
    name: "", contactPerson: "", mobile: "", email: "", address: "", city: ""
  });

  const { data: visits } = useListVisits({ date });
  const { data: summary } = useGetVisitSummary({ date });
  const { data: vendors } = useListVendors();
  const { data: employees } = useListEmployees();

  const createVisit = useCreateVisit({
    mutation: {
      onSuccess: () => {
        toast({ title: "Visit logged successfully" });
        setIsVisitDialog(false);
        setVisitData({ employeeId: "", vendorId: "", checkInTime: "", latitude: "", longitude: "", orderValue: "", remarks: "" });
        queryClient.invalidateQueries({ queryKey: getListVisitsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetVisitSummaryQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to log visit", description: String(err), variant: "destructive" })
    }
  });

  const createVendor = useCreateVendor({
    mutation: {
      onSuccess: () => {
        toast({ title: "Vendor added successfully" });
        setIsVendorDialog(false);
        setVendorData({ name: "", contactPerson: "", mobile: "", email: "", address: "", city: "" });
        queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to add vendor", description: String(err), variant: "destructive" })
    }
  });

  const handleLogVisit = () => {
    createVisit.mutate({
      data: {
        employeeId: Number(visitData.employeeId),
        vendorId: Number(visitData.vendorId),
        selfieUrl: visitData.checkInTime || new Date().toISOString(),
        lat: visitData.latitude ? Number(visitData.latitude) : undefined,
        lng: visitData.longitude ? Number(visitData.longitude) : undefined,
        orderValue: visitData.orderValue ? Number(visitData.orderValue) : undefined,
        remarks: visitData.remarks || undefined,
      }
    });
  };

  const handleAddVendor = () => {
    createVendor.mutate({
      data: {
        name: vendorData.name,
        contactPerson: vendorData.contactPerson || undefined,
        mobile: vendorData.mobile || undefined,
        email: vendorData.email || undefined,
        address: vendorData.address || undefined,
      }
    });
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Field Visits & Vendors</h2>
      </div>

      <Tabs defaultValue="visits" className="space-y-4">
        <TabsList>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
        </TabsList>

        <TabsContent value="visits" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.totalVisits || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valid / Invalid</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {summary?.validVisits || 0}{" "}
                  <span className="text-muted-foreground text-sm font-normal">/ {summary?.invalidVisits || 0}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total KM</CardTitle>
                <Map className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.totalKm || 0} km</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Collection</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{(summary as any)?.collectionAmount ?? summary?.ordersCollected ?? 0}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Visit Logs</CardTitle>
                <CardDescription>Daily field visit records.</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-[160px]"
                />
                <Dialog open={isVisitDialog} onOpenChange={setIsVisitDialog}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> Log Visit</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Log New Visit</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Employee</Label>
                        <Select value={visitData.employeeId} onValueChange={v => setVisitData({ ...visitData, employeeId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                          <SelectContent>
                            {employees?.map(emp => (
                              <SelectItem key={emp.id} value={emp.id.toString()}>{emp.firstName} {emp.lastName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Vendor</Label>
                        <Select value={visitData.vendorId} onValueChange={v => setVisitData({ ...visitData, vendorId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                          <SelectContent>
                            {vendors?.map((v: any) => (
                              <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Latitude</Label>
                          <Input type="number" step="any" value={visitData.latitude} onChange={e => setVisitData({ ...visitData, latitude: e.target.value })} placeholder="e.g. 28.6139" />
                        </div>
                        <div className="grid gap-2">
                          <Label>Longitude</Label>
                          <Input type="number" step="any" value={visitData.longitude} onChange={e => setVisitData({ ...visitData, longitude: e.target.value })} placeholder="e.g. 77.2090" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Order Value (₹)</Label>
                        <Input type="number" value={visitData.orderValue} onChange={e => setVisitData({ ...visitData, orderValue: e.target.value })} placeholder="0" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Remarks</Label>
                        <Input value={visitData.remarks} onChange={e => setVisitData({ ...visitData, remarks: e.target.value })} placeholder="Optional notes" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleLogVisit} disabled={createVisit.isPending || !visitData.employeeId || !visitData.vendorId}>
                        Log Visit
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Order Value</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visits?.length ? visits.map((visit: any) => (
                    <TableRow key={visit.id}>
                      <TableCell className="font-medium">{visit.employee?.firstName || visit.employeeId}</TableCell>
                      <TableCell>{visit.vendor?.name || visit.vendorId}</TableCell>
                      <TableCell>{visit.visitDate ? format(new Date(visit.visitDate), "dd MMM yyyy") : ""}</TableCell>
                      <TableCell>{visit.checkInTime ? format(new Date(visit.checkInTime), "h:mm a") : "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={visit.isValid ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                          {visit.isValid ? "Valid" : "Invalid"}
                        </Badge>
                      </TableCell>
                      <TableCell>₹{visit.orderValue || 0}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground">{visit.remarks || "-"}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No visits found for this date</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendors" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Vendors Directory</CardTitle>
                <CardDescription>Manage vendor contacts and details.</CardDescription>
              </div>
              <Dialog open={isVendorDialog} onOpenChange={setIsVendorDialog}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Add Vendor</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Vendor</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Company Name *</Label>
                      <Input value={vendorData.name} onChange={e => setVendorData({ ...vendorData, name: e.target.value })} placeholder="ABC Enterprises" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Contact Person</Label>
                        <Input value={vendorData.contactPerson} onChange={e => setVendorData({ ...vendorData, contactPerson: e.target.value })} placeholder="John Doe" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Mobile</Label>
                        <Input value={vendorData.mobile} onChange={e => setVendorData({ ...vendorData, mobile: e.target.value })} placeholder="9876543210" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Email</Label>
                      <Input type="email" value={vendorData.email} onChange={e => setVendorData({ ...vendorData, email: e.target.value })} placeholder="contact@vendor.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>City</Label>
                        <Input value={vendorData.city} onChange={e => setVendorData({ ...vendorData, city: e.target.value })} placeholder="Mumbai" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Address</Label>
                        <Input value={vendorData.address} onChange={e => setVendorData({ ...vendorData, address: e.target.value })} placeholder="Street address" />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddVendor} disabled={createVendor.isPending || !vendorData.name}>
                      Add Vendor
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors?.length ? vendors.map((vendor: any) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">{vendor.name}</TableCell>
                      <TableCell>{vendor.contactPerson || "-"}</TableCell>
                      <TableCell>{vendor.mobile || "-"}</TableCell>
                      <TableCell>{vendor.email || "-"}</TableCell>
                      <TableCell>{vendor.city || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{vendor.address || "-"}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No vendors found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
