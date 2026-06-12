import { useState, useEffect, useRef } from "react";
import { useGetLiveLocations, useGetTravelSummary, useGetVisitSummary, useListEmployees } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Navigation, Users, TrendingUp, Package, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

// ── Google Maps API key ───────────────────────────────────────────────────────
const MAPS_API_KEY = "AIzaSyBn64FSrMCbamU0B-3hhORsqQhq5NPk5ZA";

// ── Load the Maps JS API once ─────────────────────────────────────────────────
let mapsLoaded = false;
let mapsLoading = false;
const mapsCallbacks: Array<() => void> = [];

function loadGoogleMaps(onLoad: () => void) {
  if (mapsLoaded) { onLoad(); return; }
  mapsCallbacks.push(onLoad);
  if (mapsLoading) return;
  mapsLoading = true;

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=marker`;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    mapsLoaded = true;
    mapsLoading = false;
    mapsCallbacks.forEach((cb) => cb());
    mapsCallbacks.length = 0;
  };
  script.onerror = () => {
    mapsLoading = false;
    console.error("Failed to load Google Maps API");
  };
  document.head.appendChild(script);
}

// ── LiveMap component ─────────────────────────────────────────────────────────
interface LiveLocation {
  employeeId: number;
  employeeName: string;
  lat: number;
  lng: number;
  isActive: boolean;
  speed?: number | null;
  lastUpdated: string;
  designation?: string;
}

function LiveMap({ locations }: { locations: LiveLocation[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<number, google.maps.Marker>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Initialise the map once
  useEffect(() => {
    loadGoogleMaps(() => {
      if (!mapRef.current || mapInstanceRef.current) return;
      try {
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: { lat: 20.5937, lng: 78.9629 }, // India centre
          zoom: 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });
        setMapReady(true);
      } catch (e) {
        console.error("Map init error", e);
        setLoadError(true);
      }
    });
  }, []);

  // Update markers when locations change
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const currentIds = new Set(locations.map((l) => l.employeeId));

    // Remove stale markers
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    // Add or update markers
    locations.forEach((loc) => {
      const pos = { lat: loc.lat, lng: loc.lng };
      const label = loc.employeeName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
      const title = `${loc.employeeName}\n${loc.designation ?? ""}\nLast: ${new Date(loc.lastUpdated).toLocaleTimeString("en-IN")}`;

      if (markersRef.current.has(loc.employeeId)) {
        const marker = markersRef.current.get(loc.employeeId)!;
        marker.setPosition(pos);
        marker.setTitle(title);
      } else {
        const marker = new google.maps.Marker({
          position: pos,
          map,
          title,
          label: {
            text: label,
            color: "#ffffff",
            fontWeight: "bold",
            fontSize: "12px",
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 18,
            fillColor: loc.isActive ? "#22c55e" : "#94a3b8",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });

        // Info window on click
        const info = new google.maps.InfoWindow({
          content: `<div style="font-family:sans-serif;padding:4px 2px;min-width:140px">
            <strong>${loc.employeeName}</strong><br/>
            <span style="color:#64748b;font-size:12px">${loc.designation ?? ""}</span><br/>
            <span style="font-size:12px">Lat: ${loc.lat.toFixed(4)}, Lng: ${loc.lng.toFixed(4)}</span><br/>
            ${loc.speed != null ? `<span style="font-size:12px">Speed: ${loc.speed.toFixed(1)} km/h</span><br/>` : ""}
            <span style="font-size:11px;color:#94a3b8">Updated: ${new Date(loc.lastUpdated).toLocaleTimeString("en-IN")}</span>
          </div>`,
        });
        marker.addListener("click", () => info.open(map, marker));

        markersRef.current.set(loc.employeeId, marker);
      }
    });

    // Fit bounds if we have locations
    if (locations.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      locations.forEach((l) => bounds.extend({ lat: l.lat, lng: l.lng }));
      map.fitBounds(bounds, 80);
      // Don't zoom in too close for a single marker
      if (locations.length === 1) map.setZoom(13);
    }
  }, [locations, mapReady]);

  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted/30 rounded-lg">
        <MapPin className="h-8 w-8 opacity-40" />
        <p className="text-sm">Failed to load Google Maps</p>
        <p className="text-xs">Check the API key or network connection</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────
function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Tracking() {
  const today = new Date().toISOString().split("T")[0]!;
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [date, setDate] = useState(today);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: liveLocations = [], isLoading: loadingLive } = useGetLiveLocations();
  const { data: employees = [] } = useListEmployees();

  const isManager = user?.role === "MANAGER" || user?.role === "TEAM_LEADER";

  // Managers only see their direct reports in the dropdown
  const selectableEmployees = isManager && user?.employeeId
    ? employees.filter((e) => (e as any).managerId === user.employeeId)
    : employees;

  // Managers only see their team's live locations on the map
  const teamIds = isManager && user?.employeeId
    ? new Set(selectableEmployees.map((e) => e.id))
    : null;

  const empId = selectedEmployee !== "all" ? parseInt(selectedEmployee, 10) : undefined;

  const { data: travelSummary } = useGetTravelSummary(
    empId ? { employeeId: empId, date } : { date },
    { query: { queryKey: empId ? ["travel-summary", empId, date] : ["travel-summary", date] } }
  );
  const { data: visitSummary } = useGetVisitSummary(
    empId ? { employeeId: empId, date } : { date },
    { query: { queryKey: empId ? ["visit-summary", empId, date] : ["visit-summary", date] } }
  );

  // Filter locations: by selected employee, then by team if manager
  const visibleLocations = (() => {
    let locs = liveLocations as LiveLocation[];
    // Managers only see their team
    if (teamIds) locs = locs.filter((l) => teamIds.has(l.employeeId));
    // Further filter by selected employee
    if (selectedEmployee !== "all") locs = locs.filter((l) => l.employeeId === empId);
    return locs;
  })();

  const activeCount = liveLocations.filter((l) => l.isActive).length;

  // Auto-refresh live locations every 2 minutes
  useEffect(() => {
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/tracking/live"] });
    }, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [queryClient]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Field Tracking</h2>
          <p className="text-muted-foreground">Live map and daily travel summaries</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee} data-testid="select-employee">
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Field Execs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {selectableEmployees.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.firstName} {e.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="date" value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            data-testid="input-date"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Active on Field", value: activeCount, icon: Users, color: "text-success", bg: "bg-success/10" },
          { label: "Total KM Today", value: travelSummary?.totalKm != null ? `${travelSummary.totalKm.toFixed(1)} km` : "—", icon: Navigation, color: "text-primary", bg: "bg-primary/10" },
          { label: "Visits Today", value: visitSummary?.totalVisits ?? "—", icon: MapPin, color: "text-warning", bg: "bg-warning/10" },
          { label: "Collection", value: visitSummary?.collectionAmount != null ? `₹${visitSummary.collectionAmount.toLocaleString("en-IN")}` : "—", icon: Package, color: "text-chart-3", bg: "bg-chart-3/10" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full ${s.bg} flex items-center justify-center`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Map + Live list side by side */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Google Map — takes 2/3 width */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              Live Map
              <span className="text-xs text-muted-foreground font-normal ml-1">
                ({visibleLocations.length} employee{visibleLocations.length !== 1 ? "s" : ""} shown)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-4 px-4">
            <div className="h-[420px] w-full">
              <LiveMap locations={visibleLocations} />
            </div>
          </CardContent>
        </Card>

        {/* Live location list — 1/3 width */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Employees</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 overflow-y-auto max-h-[420px] pr-1">
            {loadingLive ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />)
            ) : visibleLocations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No active employees</p>
              </div>
            ) : (
              visibleLocations.map((loc) => (
                <div key={loc.employeeId}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                  data-testid={`card-location-${loc.employeeId}`}
                >
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0 ${loc.isActive ? "bg-success" : "bg-muted-foreground"}`}>
                    {getInitials(loc.employeeName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{loc.employeeName}</p>
                    {loc.designation && <p className="text-xs text-muted-foreground truncate">{loc.designation}</p>}
                    <p className="text-xs text-muted-foreground">
                      {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                      {loc.speed != null ? ` · ${loc.speed.toFixed(1)} km/h` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
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
      </div>

      {/* Travel + Visit summary */}
      {(travelSummary || visitSummary) && (
        <div className="grid gap-6 md:grid-cols-2">
          {travelSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Travel Summary
                  {selectedEmployee !== "all" && <Badge variant="outline" className="ml-auto text-xs">Filtered</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Distance", value: `${travelSummary.totalKm.toFixed(1)} km` },
                    { label: "Hours", value: `${travelSummary.workingHours.toFixed(1)} hrs` },
                    { label: "Visits", value: String(travelSummary.visitCount) },
                    ...(travelSummary.idleTime != null ? [{ label: "Idle", value: `${travelSummary.idleTime.toFixed(0)} min` }] : []),
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-muted p-3">
                      <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                      <p className="text-lg font-bold">{item.value}</p>
                    </div>
                  ))}
                </div>
                {travelSummary.routeSummary && (
                  <div className="rounded-lg border p-3 text-sm">{travelSummary.routeSummary}</div>
                )}
              </CardContent>
            </Card>
          )}

          {visitSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Visit Summary — {date}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total", value: visitSummary.totalVisits, color: "" },
                    { label: "Valid", value: visitSummary.validVisits, color: "text-success" },
                    { label: "Invalid", value: visitSummary.invalidVisits, color: "text-destructive" },
                    { label: "KM", value: `${(visitSummary.totalKm ?? 0).toFixed(1)}`, color: "" },
                    { label: "Orders", value: visitSummary.ordersCollected ?? 0, color: "" },
                    { label: "₹ Collected", value: (visitSummary.collectionAmount ?? 0).toLocaleString("en-IN"), color: "text-success" },
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
      )}
    </div>
  );
}
