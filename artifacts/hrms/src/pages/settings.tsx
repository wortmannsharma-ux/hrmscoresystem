import { useState } from "react";
import {
  useListOfficeLocations, useCreateOfficeLocation, useUpdateOfficeLocation, useDeleteOfficeLocation,
  useListHolidays, useCreateHoliday, useDeleteHoliday,
  getListOfficeLocationsQueryKey, getListHolidaysQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MapPin, Plus, Trash2, Building2, CalendarDays, Edit2, ShieldOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

function HolidaysBadge({ type, isOptional }: { type: string; isOptional?: boolean | null }) {
  if (isOptional) return <Badge variant="outline">Optional</Badge>;
  const colors: Record<string, string> = {
    National: "bg-primary/10 text-primary",
    Regional: "bg-warning/10 text-warning",
    Optional: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[type] ?? colors.National}`}>
      {type}
    </span>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // Hard guard — only SUPER_ADMIN, ADMIN, HR can access settings
  if (!["SUPER_ADMIN", "ADMIN", "HR"].includes(user?.role ?? "")) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-muted-foreground">
        <ShieldOff className="h-10 w-10 opacity-40" />
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm">You don't have permission to view system settings.</p>
      </div>
    );
  }
  const currentYear = new Date().getFullYear();
  const [holidayYear, setHolidayYear] = useState(currentYear);
  const [addLocOpen, setAddLocOpen] = useState(false);
  const [addHolidayOpen, setAddHolidayOpen] = useState(false);
  const [deleteLocId, setDeleteLocId] = useState<number | null>(null);
  const [deleteHolId, setDeleteHolId] = useState<number | null>(null);

  const { data: officeLocations = [], isLoading: loadingLocs } = useListOfficeLocations();
  const { data: holidays = [], isLoading: loadingHols } = useListHolidays(
    { year: holidayYear },
    { query: { queryKey: getListHolidaysQueryKey({ year: holidayYear }) } }
  );

  const createLoc = useCreateOfficeLocation();
  const deleteLoc = useDeleteOfficeLocation();
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();

  const locForm = useForm({
    defaultValues: { name: "", lat: "", lng: "", radius: "100", requireApproval: "false", isActive: "true" },
  });

  const holidayForm = useForm({
    defaultValues: { name: "", date: "", type: "National", isOptional: "false" },
  });

  function handleAddLocation(values: { name: string; lat: string; lng: string; radius: string; requireApproval: string; isActive: string }) {
    createLoc.mutate({
      data: {
        name: values.name,
        lat: parseFloat(values.lat),
        lng: parseFloat(values.lng),
        radius: parseInt(values.radius, 10),
        requireApproval: values.requireApproval === "true",
        isActive: values.isActive === "true",
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOfficeLocationsQueryKey() });
        setAddLocOpen(false);
        locForm.reset();
        toast({ title: "Office location added" });
      },
    });
  }

  function handleAddHoliday(values: { name: string; date: string; type: string; isOptional: string }) {
    createHoliday.mutate({
      data: { name: values.name, date: values.date, type: values.type, isOptional: values.isOptional === "true" },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHolidaysQueryKey({ year: holidayYear }) });
        setAddHolidayOpen(false);
        holidayForm.reset();
        toast({ title: "Holiday added" });
      },
    });
  }

  function handleDeleteLoc() {
    if (!deleteLocId) return;
    deleteLoc.mutate({ id: deleteLocId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOfficeLocationsQueryKey() });
        setDeleteLocId(null);
        toast({ title: "Location removed" });
      },
    });
  }

  function handleDeleteHol() {
    if (!deleteHolId) return;
    deleteHoliday.mutate({ id: deleteHolId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListHolidaysQueryKey({ year: holidayYear }) });
        setDeleteHolId(null);
        toast({ title: "Holiday removed" });
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Configure office locations, holidays, and system preferences</p>
      </div>

      <Tabs defaultValue="locations">
        <TabsList data-testid="tabs-settings">
          <TabsTrigger value="locations">Office Locations</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>

        {/* ── Office Locations ── */}
        <TabsContent value="locations" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Define office geo-fence locations. Field executives must be within the radius to mark valid attendance.
            </p>
            <Dialog open={addLocOpen} onOpenChange={setAddLocOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-location">
                  <Plus className="h-4 w-4 mr-1" /> Add Location
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Office Location</DialogTitle>
                </DialogHeader>
                <Form {...locForm}>
                  <form onSubmit={locForm.handleSubmit(handleAddLocation)} className="space-y-4">
                    <FormField control={locForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location Name</FormLabel>
                        <FormControl><Input {...field} placeholder="e.g. HQ - Bengaluru" data-testid="input-location-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={locForm.control} name="lat" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Latitude</FormLabel>
                          <FormControl><Input {...field} placeholder="12.9716" data-testid="input-lat" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={locForm.control} name="lng" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Longitude</FormLabel>
                          <FormControl><Input {...field} placeholder="77.5946" data-testid="input-lng" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={locForm.control} name="radius" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Allowed Radius (meters)</FormLabel>
                        <FormControl><Input {...field} type="number" placeholder="100" data-testid="input-radius" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={createLoc.isPending} data-testid="button-submit-location">
                      {createLoc.isPending ? "Adding..." : "Add Location"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {loadingLocs ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(2)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : officeLocations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-xl">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No office locations configured</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {officeLocations.map((loc) => (
                <Card key={loc.id} data-testid={`card-location-${loc.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{loc.name}</p>
                          <Badge variant={loc.isActive ? "default" : "secondary"} className="text-xs mt-0.5">
                            {loc.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteLocId(loc.id)}
                        data-testid={`button-delete-location-${loc.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>Lat: {loc.lat.toFixed(4)}, Lng: {loc.lng.toFixed(4)}</p>
                      <p>Radius: <span className="font-medium text-foreground">{loc.radius}m</span></p>
                      {loc.requireApproval && (
                        <Badge variant="outline" className="text-xs">Requires Approval</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Holidays ── */}
        <TabsContent value="holidays" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">Official holidays for</p>
              <Select value={String(holidayYear)} onValueChange={(v) => setHolidayYear(parseInt(v, 10))} data-testid="select-year">
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Dialog open={addHolidayOpen} onOpenChange={setAddHolidayOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-holiday">
                  <Plus className="h-4 w-4 mr-1" /> Add Holiday
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Holiday</DialogTitle>
                </DialogHeader>
                <Form {...holidayForm}>
                  <form onSubmit={holidayForm.handleSubmit(handleAddHoliday)} className="space-y-4">
                    <FormField control={holidayForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Holiday Name</FormLabel>
                        <FormControl><Input {...field} placeholder="e.g. Diwali" data-testid="input-holiday-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={holidayForm.control} name="date" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl><Input {...field} type="date" data-testid="input-holiday-date" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={holidayForm.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-holiday-type"><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="National">National</SelectItem>
                            <SelectItem value="Regional">Regional</SelectItem>
                            <SelectItem value="Optional">Optional</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={createHoliday.isPending} data-testid="button-submit-holiday">
                      {createHoliday.isPending ? "Adding..." : "Add Holiday"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {loadingHols ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />)}
            </div>
          ) : holidays.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-xl">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No holidays for {holidayYear}</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Holiday</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Day</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {holidays.map((h) => {
                    const d = new Date(h.date);
                    const dayName = d.toLocaleDateString("en-IN", { weekday: "long" });
                    const dateStr = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                    return (
                      <tr key={h.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-holiday-${h.id}`}>
                        <td className="px-4 py-3 font-medium">{h.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{dateStr}</td>
                        <td className="px-4 py-3 text-muted-foreground">{dayName}</td>
                        <td className="px-4 py-3">
                          <HolidaysBadge type={h.type} isOptional={h.isOptional} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteHolId(h.id)}
                            data-testid={`button-delete-holiday-${h.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialogs */}
      <AlertDialog open={deleteLocId !== null} onOpenChange={(o) => !o && setDeleteLocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove office location?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this geo-fence location.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLoc} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteHolId !== null} onOpenChange={(o) => !o && setDeleteHolId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove holiday?</AlertDialogTitle>
            <AlertDialogDescription>This holiday will be removed from the calendar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteHol} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
