import { useState } from "react";
import { useGetLiveLocations, useGetTravelSummary, useGetVisitSummary, useListEmployees } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Clock, Navigation, Users, TrendingUp, Package } from "lucide-react";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function Tracking() {
  const today = new Date().toISOString().split("T")[0];
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [date, setDate] = useState(today);

  const { data: liveLocations = [], isLoading: loadingLive } = useGetLiveLocations();
  const { data: employees = [] } = useListEmployees({ role: "Field Executive" });
  const empId = selectedEmployee !== "all" ? parseInt(selectedEmployee, 10) : undefined;
  const { data: travelSummary } = useGetTravelSummary(
    empId ? { employeeId: empId, date } : { date },
    { query: { enabled: true, queryKey: empId ? ["travel-summary", empId, date] : ["travel-summary", date] } }
  );
  const { data: visitSummary } = useGetVisitSummary(
    empId ? { employeeId: empId, date } : { date },
    { query: { enabled: true, queryKey: empId ? ["visit-summary", empId, date] : ["visit-summary", date] } }
  );

  const activeCount = liveLocations.filter((l) => l.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Field Executive Tracking</h2>
          <p className="text-muted-foreground">Live locations and daily travel summaries</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee} data-testid="select-employee">
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Field Execs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Field Execs</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.firstName} {e.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            data-testid="input-date"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Field Execs</p>
              <p className="text-2xl font-bold text-success">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Navigation className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total KM Today</p>
              <p className="text-2xl font-bold">{travelSummary?.totalKm?.toFixed(1) ?? "—"} km</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Visits Today</p>
              <p className="text-2xl font-bold">{visitSummary?.totalVisits ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-chart-3/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-chart-3" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Collection</p>
              <p className="text-2xl font-bold">
                {visitSummary?.collectionAmount != null
                  ? `₹${visitSummary.collectionAmount.toLocaleString("en-IN")}`
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Live locations list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              Live Locations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingLive ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : liveLocations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No active field executives</p>
              </div>
            ) : (
              liveLocations.map((loc) => (
                <div
                  key={loc.employeeId}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                  data-testid={`card-location-${loc.employeeId}`}
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                    {getInitials(loc.employeeName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{loc.employeeName}</p>
                    {loc.designation && <p className="text-xs text-muted-foreground">{loc.designation}</p>}
                    <p className="text-xs text-muted-foreground">
                      {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                      {loc.speed != null ? ` · ${loc.speed.toFixed(1)} km/h` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={loc.isActive ? "default" : "secondary"} className="text-xs">
                      {loc.isActive ? "Active" : "Idle"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatTime(loc.lastUpdated)}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Travel summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Travel Summary
              {selectedEmployee !== "all" && <Badge variant="outline" className="ml-auto text-xs">Filtered</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {travelSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground mb-1">Total Distance</p>
                    <p className="text-lg font-bold">{travelSummary.totalKm.toFixed(1)} km</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground mb-1">Working Hours</p>
                    <p className="text-lg font-bold">{travelSummary.workingHours.toFixed(1)} hrs</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground mb-1">Total Visits</p>
                    <p className="text-lg font-bold">{travelSummary.visitCount}</p>
                  </div>
                  {travelSummary.idleTime != null && (
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-xs text-muted-foreground mb-1">Idle Time</p>
                      <p className="text-lg font-bold">{travelSummary.idleTime.toFixed(1)} min</p>
                    </div>
                  )}
                </div>
                {travelSummary.routeSummary && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Route Summary</p>
                    <p className="text-sm">{travelSummary.routeSummary}</p>
                  </div>
                )}
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-muted-foreground">Start:</span>
                    <span>{travelSummary.startLocation}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-destructive" />
                    <span className="text-muted-foreground">End:</span>
                    <span>{travelSummary.endLocation}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Navigation className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No travel data for this date</p>
                <p className="text-xs mt-1">Select an employee or check a different date</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Visit summary */}
      {visitSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Visit Summary — {date}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {[
                { label: "Total Visits", value: visitSummary.totalVisits, color: "" },
                { label: "Valid", value: visitSummary.validVisits, color: "text-success" },
                { label: "Invalid", value: visitSummary.invalidVisits, color: "text-destructive" },
                { label: "Total KM", value: `${visitSummary.totalKm.toFixed(1)} km`, color: "" },
                { label: "Orders", value: visitSummary.ordersCollected, color: "" },
                { label: "Collection", value: `₹${visitSummary.collectionAmount.toLocaleString("en-IN")}`, color: "text-success" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
