import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableEmployeeSelect } from "./ui/searchable-employee-select";
import { Camera, MapPin, CheckCircle, AlertTriangle, XCircle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface OfficeLocation {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  requireApproval: boolean;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

interface AttendanceSettings {
  presentBeforeMins: number;
  lateBeforeMins: number;
  halfDayBeforeMins: number;
  geoFencingEnabled: boolean;
  outsideRadiusAction: string;
}

interface SmartAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { employeeId: number; selfieUrl: string; lat?: number; lng?: number }) => void;
  isSubmitting?: boolean;
  employees: Employee[];
  officeLocations: OfficeLocation[];
  settings: AttendanceSettings;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getStatusFromTime(
  totalMins: number,
  s: AttendanceSettings
): { status: string; color: string } {
  if (totalMins >= s.halfDayBeforeMins)
    return { status: "Half Day (Approval)", color: "bg-orange-100 text-orange-800 border-orange-200" };
  if (totalMins >= s.lateBeforeMins)
    return { status: "Half Day", color: "bg-yellow-100 text-yellow-800 border-yellow-200" };
  if (totalMins >= s.presentBeforeMins)
    return { status: "Late", color: "bg-amber-100 text-amber-800 border-amber-200" };
  return { status: "Present", color: "bg-green-100 text-green-800 border-green-200" };
}

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function SmartAttendanceModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  employees,
  officeLocations,
  settings,
}: SmartAttendanceModalProps) {
  const [step, setStep] = useState(1);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selfieCapture, setSelfieCapture] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearestOffice, setNearestOffice] = useState<{
    name: string;
    distance: number;
    withinRadius: boolean;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (open) {
      setStep(1);
      setSelfieCapture(null);
      setCameraActive(false);
      setCameraError(false);
      setGpsStatus("idle");
      setGpsCoords(null);
      setNearestOffice(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [open]);

  const selectedEmp = employees.find((e) => e.id.toString() === selectedEmployee);
  const isFieldExecutive = selectedEmp?.role === "Field Executive";

  const totalMins = currentTime.getHours() * 60 + currentTime.getMinutes();
  const { status: predictedStatus, color: statusColor } = getStatusFromTime(totalMins, settings);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError(true);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.8);
      setSelfieCapture(dataUrl);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraActive(false);
    }
  }, []);

  const captureGPS = useCallback(() => {
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsCoords(coords);
        setGpsStatus("success");
        if (officeLocations.length > 0) {
          const withDist = officeLocations
            .map((loc) => ({
              ...loc,
              distance: haversineDistance(coords.lat, coords.lng, loc.lat, loc.lng),
            }))
            .sort((a, b) => a.distance - b.distance);
          setNearestOffice({
            name: withDist[0].name,
            distance: withDist[0].distance,
            withinRadius: withDist[0].distance <= withDist[0].radius,
          });
        }
      },
      () => setGpsStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [officeLocations]);

  const handleSubmit = () => {
    if (!selectedEmployee) return;
    onSubmit({
      employeeId: Number(selectedEmployee),
      selfieUrl: selfieCapture || "demo_selfie",
      lat: gpsCoords?.lat,
      lng: gpsCoords?.lng,
    });
  };

  const geoFenceBlocked =
    settings.geoFencingEnabled &&
    nearestOffice &&
    !nearestOffice.withinRadius &&
    settings.outsideRadiusAction === "block";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Smart Day Start
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1 mb-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${step >= s ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Step {step} of 4 —{" "}
          {step === 1 ? "Employee" : step === 2 ? "Selfie" : step === 3 ? "Location" : "Confirm"}
        </p>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Employee</Label>
              <SearchableEmployeeSelect
                employees={employees}
                value={selectedEmployee}
                onValueChange={setSelectedEmployee}
                placeholder="Choose employee..."
              />
            </div>

            {selectedEmp && (
              <Card className="bg-muted/40">
                <CardContent className="py-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Role</span>
                    <Badge variant="outline">{selectedEmp.role}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Login Time</span>
                    <span className="font-mono font-medium">{format(currentTime, "hh:mm:ss a")}</span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground">Expected Status</span>
                    <Badge className={statusColor}>{predictedStatus}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Requirements</span>
                    <span className="text-xs text-right">
                      {isFieldExecutive ? "Selfie + GPS (mandatory)" : "Selfie (GPS optional)"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded-lg border">
              <div className="font-semibold text-foreground mb-1.5">⏰ Login Time Rules</div>
              <div className="flex justify-between">
                <span>Before {minsToTime(settings.presentBeforeMins)}</span>
                <span className="text-green-600 font-medium">Present ✓</span>
              </div>
              <div className="flex justify-between">
                <span>
                  {minsToTime(settings.presentBeforeMins)} – {minsToTime(settings.lateBeforeMins)}
                </span>
                <span className="text-amber-600 font-medium">Late Mark</span>
              </div>
              <div className="flex justify-between">
                <span>
                  {minsToTime(settings.lateBeforeMins)} – {minsToTime(settings.halfDayBeforeMins)}
                </span>
                <span className="text-yellow-600 font-medium">Half Day</span>
              </div>
              <div className="flex justify-between">
                <span>After {minsToTime(settings.halfDayBeforeMins)}</span>
                <span className="text-orange-600 font-medium">Approval Required</span>
              </div>
            </div>

            <Button className="w-full" onClick={() => setStep(2)} disabled={!selectedEmployee}>
              Continue to Selfie →
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-medium">Capture Selfie</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isFieldExecutive
                  ? "Required — Live selfie for Field Executive verification"
                  : "Required — Desk employee attendance verification"}
              </p>
            </div>

            {!selfieCapture && !cameraActive && (
              <div className="space-y-2">
                {cameraError ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 text-center">
                    Camera not available in this browser
                  </div>
                ) : null}
                <Button onClick={startCamera} className="w-full" variant="outline">
                  <Camera className="h-4 w-4 mr-2" /> Open Camera
                </Button>
                <Button
                  onClick={() => setSelfieCapture("demo_selfie_" + Date.now())}
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                >
                  Use demo / mock selfie
                </Button>
              </div>
            )}

            {cameraActive && (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border-2 border-white/50 rounded-full w-32 h-32 opacity-50" />
                  </div>
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <Button onClick={capturePhoto} className="w-full">
                  <Camera className="h-4 w-4 mr-2" /> Capture
                </Button>
              </div>
            )}

            {selfieCapture && (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden bg-muted aspect-video flex items-center justify-center">
                  {selfieCapture.startsWith("data:") ? (
                    <img src={selfieCapture} alt="Selfie" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                      <p className="text-sm text-muted-foreground">Selfie captured</p>
                      <p className="text-xs text-muted-foreground">{format(currentTime, "hh:mm a")}</p>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setSelfieCapture(null);
                    startCamera();
                  }}
                >
                  Retake
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                ← Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!selfieCapture} className="flex-1">
                Continue →
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-medium">Location Verification</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isFieldExecutive
                  ? "Live GPS is mandatory for Field Executives"
                  : "Optional for Desk Employees"}
              </p>
            </div>

            {gpsStatus === "idle" && (
              <div className="space-y-2">
                <Button onClick={captureGPS} className="w-full" variant="outline">
                  <MapPin className="h-4 w-4 mr-2" /> Capture GPS Location
                </Button>
                {!isFieldExecutive && (
                  <Button
                    onClick={() => setStep(4)}
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground"
                  >
                    Skip (GPS optional for Desk employees)
                  </Button>
                )}
              </div>
            )}

            {gpsStatus === "loading" && (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm">Getting location...</span>
              </div>
            )}

            {gpsStatus === "success" && gpsCoords && (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium text-sm mb-1">
                    <CheckCircle className="h-4 w-4" />
                    Location captured
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-500 font-mono">
                    {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}
                  </div>
                </div>

                {nearestOffice && (
                  <div
                    className={`p-3 rounded-lg border text-sm space-y-1.5 ${
                      nearestOffice.withinRadius
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200"
                        : "bg-amber-50 dark:bg-amber-900/20 border-amber-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      {nearestOffice.withinRadius ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                      <span>{nearestOffice.name}</span>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Distance:{" "}
                      {nearestOffice.distance < 1000
                        ? `${Math.round(nearestOffice.distance)} m`
                        : `${(nearestOffice.distance / 1000).toFixed(1)} km`}
                      {nearestOffice.withinRadius ? " — ✓ Within radius" : " — ⚠ Outside radius"}
                    </div>
                    {!nearestOffice.withinRadius && settings.geoFencingEnabled && (
                      <div
                        className={`text-xs font-medium ${
                          settings.outsideRadiusAction === "block"
                            ? "text-red-600"
                            : settings.outsideRadiusAction === "approve"
                            ? "text-amber-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {settings.outsideRadiusAction === "block" &&
                          "⛔ Attendance will be blocked"}
                        {settings.outsideRadiusAction === "approve" &&
                          "⏳ Will require manager approval"}
                        {settings.outsideRadiusAction === "warn" &&
                          "⚠ Outside office radius (noted)"}
                      </div>
                    )}
                  </div>
                )}

                {!settings.geoFencingEnabled && (
                  <div className="text-xs text-muted-foreground text-center">
                    Geo-fencing is disabled. Location is recorded for reference only.
                  </div>
                )}
              </div>
            )}

            {gpsStatus === "error" && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
                  <XCircle className="h-4 w-4" />
                  {isFieldExecutive
                    ? "GPS access denied — required for Field Executives"
                    : "GPS unavailable"}
                </div>
                <Button size="sm" variant="outline" onClick={captureGPS} className="mt-2 w-full">
                  Retry
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                ← Back
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={isFieldExecutive && gpsStatus !== "success"}
                className="flex-1"
              >
                Continue →
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-medium">Confirm Attendance</h3>
              <p className="text-xs text-muted-foreground">Review and submit</p>
            </div>

            <Card>
              <CardContent className="py-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Employee</span>
                  <span className="font-medium">
                    {selectedEmp?.firstName} {selectedEmp?.lastName}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Role</span>
                  <Badge variant="outline" className="text-xs">{selectedEmp?.role}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{format(currentTime, "dd MMM yyyy")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Login Time</span>
                  <span className="font-mono font-medium">{format(currentTime, "hh:mm a")}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={statusColor}>{predictedStatus}</Badge>
                </div>
                <div className="border-t pt-2.5 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Selfie</span>
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-3 w-3" /> Captured
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">GPS</span>
                    {gpsStatus === "success" ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-3 w-3" /> Captured
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {isFieldExecutive ? "Not captured" : "Skipped"}
                      </span>
                    )}
                  </div>
                </div>

                {geoFenceBlocked && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    Attendance blocked — outside office geo-fence radius
                  </div>
                )}

                {settings.geoFencingEnabled && nearestOffice && !nearestOffice.withinRadius && !geoFenceBlocked && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    Outside office radius —{" "}
                    {settings.outsideRadiusAction === "approve"
                      ? "pending manager approval"
                      : "recorded"}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                ← Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!!isSubmitting || !!geoFenceBlocked}
                className="flex-1"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Mark Attendance ✓
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
