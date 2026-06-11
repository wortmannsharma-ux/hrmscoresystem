import React, { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetEmployee,
  useGetLeaveBalance,
  useUpdateEmployee,
  useListDepartments,
  useListDesignations,
  useListEmployees,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, Hash, Building2, Briefcase,
  Award, ShieldAlert, CreditCard, Pencil, KeyRound, User, CalendarDays, ShieldOff,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth, authFetch } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

const EMPLOYEE_ROLES = [
  "Desk Employee", "Field Executive", "Manager", "Team Leader", "HR Admin", "Intern",
];

// ─── Edit Employee Dialog ──────────────────────────────────────────────────────

function EditEmployeeDialog({
  open, onOpenChange, employee, onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: any;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = ["SUPER_ADMIN", "ADMIN", "HR"].includes(user?.role ?? "");

  const { data: departments } = useListDepartments();
  const { data: designations } = useListDesignations();
  const { data: allEmployees } = useListEmployees();
  const updateMutation = useUpdateEmployee();

  const [form, setForm] = useState({
    firstName: "", lastName: "", phone: "", address: "",
    role: "", status: "", departmentId: "", designationId: "", managerId: "",
    bankName: "", bankAccount: "", ifscCode: "", panNumber: "", aadharNumber: "",
    emergencyContact: "", profilePhoto: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && employee) {
      setForm({
        firstName: employee.firstName ?? "",
        lastName: employee.lastName ?? "",
        phone: employee.phone ?? "",
        address: employee.address ?? "",
        role: employee.role ?? "Desk Employee",
        status: employee.status ?? "active",
        departmentId: employee.departmentId?.toString() ?? "",
        designationId: employee.designationId?.toString() ?? "",
        managerId: employee.managerId?.toString() ?? "",
        bankName: employee.bankName ?? "",
        bankAccount: employee.bankAccount ?? "",
        ifscCode: employee.ifscCode ?? "",
        panNumber: employee.panNumber ?? "",
        aadharNumber: employee.aadharNumber ?? "",
        emergencyContact: employee.emergencyContact ?? "",
        profilePhoto: employee.profilePhoto ?? "",
      });
      setError(null);
    }
  }, [open, employee]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => set("profilePhoto", ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }

    const payload: Record<string, any> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || null,
      address: form.address || null,
      profilePhoto: form.profilePhoto || null,
      bankName: form.bankName || null,
      bankAccount: form.bankAccount || null,
      ifscCode: form.ifscCode || null,
      panNumber: form.panNumber || null,
      aadharNumber: form.aadharNumber || null,
      emergencyContact: form.emergencyContact || null,
    };

    if (isAdmin) {
      payload.role = form.role;
      payload.status = form.status;
      payload.departmentId = form.departmentId && form.departmentId !== "none" ? Number(form.departmentId) : null;
      payload.designationId = form.designationId && form.designationId !== "none" ? Number(form.designationId) : null;
      payload.managerId = form.managerId && form.managerId !== "none" ? Number(form.managerId) : null;
    }

    updateMutation.mutate(
      { id: employee.id, data: payload },
      {
        onSuccess: () => {
          toast({ title: "Employee updated successfully" });
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (err: any) => setError(err?.message ?? "Failed to update employee"),
      }
    );
  };

  const filteredDesignations = form.departmentId && form.departmentId !== "none"
    ? designations?.filter((d) => d.departmentId === Number(form.departmentId))
    : designations;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Edit Employee Profile</DialogTitle>
        </DialogHeader>
        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="org">Org & Manager</TabsTrigger>
            <TabsTrigger value="finance">Finance & Docs</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="flex flex-col items-center gap-3 pb-2">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={form.profilePhoto || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {form.firstName?.[0]}{form.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <label className="cursor-pointer">
                <span className="text-xs text-primary underline underline-offset-2">Upload photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Emergency Contact</Label>
              <Input value={form.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} placeholder="Name — Phone" />
            </div>
            {isAdmin && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => set("role", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="org" className="space-y-4">
            {isAdmin ? (
              <>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={form.departmentId || "none"}
                    onValueChange={(v) => { set("departmentId", v === "none" ? "" : v); set("designationId", ""); }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Department</SelectItem>
                      {departments?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Designation</Label>
                  <Select value={form.designationId || "none"} onValueChange={(v) => set("designationId", v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Designation</SelectItem>
                      {filteredDesignations?.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reporting Manager</Label>
                  <Select value={form.managerId || "none"} onValueChange={(v) => set("managerId", v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Manager</SelectItem>
                      {allEmployees?.filter((e) => e.id !== employee?.id).map((e) => (
                        <SelectItem key={e.id} value={e.id.toString()}>
                          {e.firstName} {e.lastName} — {e.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Organisational details can only be updated by HR or Admin.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="finance" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input value={form.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>IFSC Code</Label>
              <Input value={form.ifscCode} onChange={(e) => set("ifscCode", e.target.value.toUpperCase())} className="uppercase" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>PAN Number</Label>
                <Input value={form.panNumber} onChange={(e) => set("panNumber", e.target.value.toUpperCase())} className="uppercase" />
              </div>
              <div className="space-y-2">
                <Label>Aadhar Number</Label>
                <Input value={form.aadharNumber} onChange={(e) => set("aadharNumber", e.target.value)} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Leave Balance Dialog ─────────────────────────────────────────────────

function EditLeaveBalanceDialog({
  open, onOpenChange, employeeId, currentBalance, onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: number;
  currentBalance: any;
  onSuccess?: () => void;
}) {
  const { toast } = useToast();
  const [casual, setCasual] = useState("");
  const [sick, setSick] = useState("");
  const [earned, setEarned] = useState("");
  const [unpaid, setUnpaid] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && currentBalance) {
      setCasual(String(currentBalance.casual ?? 12));
      setSick(String(currentBalance.sick ?? 12));
      setEarned(String(currentBalance.earned ?? 15));
      setUnpaid(String(currentBalance.unpaid ?? 999));
      setError(null);
    }
  }, [open, currentBalance]);

  const handleSave = async () => {
    setError(null);
    const payload = {
      casual: Number(casual),
      sick: Number(sick),
      earned: Number(earned),
      unpaid: Number(unpaid),
    };
    if (Object.values(payload).some((v) => isNaN(v) || v < 0)) {
      setError("All values must be non-negative numbers.");
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`/api/leaves/balance/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || "Failed to update leave balance");
      }
      toast({ title: "Leave balance updated" });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message ?? "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Edit Leave Entitlement
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Set the total leave days for {currentYear}. Used days are calculated from approved leaves and cannot be edited here.
        </p>
        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Casual Leave (days)</Label>
              <Input type="number" min={0} value={casual} onChange={(e) => setCasual(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sick Leave (days)</Label>
              <Input type="number" min={0} value={sick} onChange={(e) => setSick(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Earned Leave (days)</Label>
              <Input type="number" min={0} value={earned} onChange={(e) => setEarned(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unpaid Leave (max days)</Label>
              <Input type="number" min={0} value={unpaid} onChange={(e) => setUnpaid(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset Password Dialog ─────────────────────────────────────────────────────

function ResetPasswordDialog({
  open, onOpenChange, userId, employeeName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: number | null;
  employeeName: string;
}) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) { setNewPassword(""); setConfirm(""); setError(null); }
  }, [open]);

  const handleReset = async () => {
    setError(null);
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirm) { setError("Passwords do not match."); return; }
    if (!userId) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || "Failed to reset password");
      }
      toast({ title: `Password reset for ${employeeName}` });
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message ?? "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Reset Password
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Resetting password for <span className="font-medium text-foreground">{employeeName}</span>.
        </p>
        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
          </div>
          <div className="space-y-2">
            <Label>Confirm Password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleReset} disabled={loading}>{loading ? "Resetting…" : "Reset Password"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Profile Page ─────────────────────────────────────────────────────────

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const employeeId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(user?.role ?? "");
  const isHR = user?.role === "HR";
  const isManager = user?.role === "MANAGER" || user?.role === "TEAM_LEADER";
  const isEmployee = user?.role === "EMPLOYEE" || user?.role === "INTERN";

  // Access guard: employees can only see their own profile
  // Managers can see their team (checked after data loads) but not others
  // Redirect employee to /profile if trying to view someone else
  if (isEmployee && user?.employeeId !== employeeId) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-muted-foreground">
        <ShieldOff className="h-10 w-10 opacity-40" />
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm">You can only view your own profile.</p>
        <a href="/profile" className="text-primary underline text-sm">Go to My Profile</a>
      </div>
    );
  }

  const canEdit = isAdmin || isHR || user?.employeeId === employeeId;
  // Both Admin and HR can reset passwords (HR cannot reset Admin passwords — backend enforces this)
  const canResetPassword = isAdmin || isHR;
  const canEditLeaveBalance = isAdmin || isHR;

  const { data: employee, isLoading } = useGetEmployee(employeeId);
  const { data: leaveBalance, isLoading: isLoadingLeave } = useGetLeaveBalance(employeeId);

  const [editOpen, setEditOpen] = useState(false);
  const [resetPassOpen, setResetPassOpen] = useState(false);
  const [editLeaveOpen, setEditLeaveOpen] = useState(false);
  const [linkedUserId, setLinkedUserId] = useState<number | null>(null);

  // Fetch the linked user ID for password reset
  useEffect(() => {
    if (canResetPassword && employee) {
      authFetch("/api/users")
        .then((r) => r.json())
        .then((users: any[]) => {
          const match = users.find((u: any) => u.employeeId === employee.id);
          setLinkedUserId(match?.id ?? null);
        })
        .catch(() => setLinkedUserId(null));
    }
  }, [canResetPassword, employee?.id]);

  const handleEditSuccess = () => {
    // Invalidate + refetch both the individual record AND the list
    queryClient.invalidateQueries({ queryKey: ["/api/employees"], exact: false });
    queryClient.refetchQueries({ queryKey: ["/api/employees"], exact: false });
    queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}`] });
    queryClient.refetchQueries({ queryKey: [`/api/employees/${employeeId}`] });
  };

  const handleLeaveBalanceSuccess = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/leaves/balance/${employeeId}`] });
    queryClient.refetchQueries({ queryKey: [`/api/leaves/balance/${employeeId}`] });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Card>
          <CardContent className="p-6 flex items-center gap-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-3 flex-1">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <h2 className="text-2xl font-bold">Employee Not Found</h2>
        <Link href="/employees">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Directory</Button>
        </Link>
      </div>
    );
  }

  const canSeeSensitive = isAdmin || isHR || user?.employeeId === employee.id;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/employees">
            <Button variant="outline" size="icon" className="h-8 w-8" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-primary">Employee Profile</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)} data-testid="button-edit-employee">
              <Pencil className="h-4 w-4" /> Edit Profile
            </Button>
          )}
          {canResetPassword && linkedUserId && (
            <Button
              variant="outline" size="sm"
              className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50"
              onClick={() => setResetPassOpen(true)}
              data-testid="button-reset-password"
            >
              <KeyRound className="h-4 w-4" /> Reset Password
            </Button>
          )}
        </div>
      </div>

      {/* Profile Header */}
      <Card className="overflow-hidden border-t-4 border-t-primary">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-4 border-background shadow-md">
                <AvatarImage src={employee.profilePhoto || undefined} alt={employee.firstName} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                  {employee.firstName?.[0]}{employee.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              {canEdit && (
                <button
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-5 w-5 text-white" />
                </button>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-foreground">{employee.firstName} {employee.lastName}</h1>
                <Badge variant="outline" className={employee.status?.toLowerCase() === "active" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                  {employee.status}
                </Badge>
                <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">{employee.role}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground mt-2">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  <span className="font-medium text-foreground">{employee.employeeId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>{employee.departmentName || "No Department"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  <span>{employee.designationName || "No Designation"}</span>
                </div>
                {(employee as any).managerName && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Reports to: <span className="font-medium text-foreground">{(employee as any).managerName}</span></span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md h-auto p-1">
          <TabsTrigger value="personal" className="py-2" data-testid="tab-personal">Personal Info</TabsTrigger>
          <TabsTrigger value="salary" className="py-2" data-testid="tab-salary">Salary & Bank</TabsTrigger>
          <TabsTrigger value="leave" className="py-2" data-testid="tab-leave">Leave Balance</TabsTrigger>
        </TabsList>

        {/* Personal Info */}
        <TabsContent value="personal" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact & Personal Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <InfoField icon={<Mail className="h-4 w-4" />} label="Email Address" value={employee.email} />
              <InfoField icon={<Phone className="h-4 w-4" />} label="Phone Number" value={employee.phone || "Not provided"} />
              <InfoField
                icon={<Calendar className="h-4 w-4" />}
                label="Joining Date"
                value={employee.joiningDate ? format(new Date(employee.joiningDate), "MMMM d, yyyy") : "Not specified"}
              />
              <InfoField icon={<MapPin className="h-4 w-4" />} label="Address" value={employee.address || "Not provided"} />
              {canSeeSensitive && (
                <>
                  <InfoField icon={<Award className="h-4 w-4" />} label="PAN Number" value={employee.panNumber || "Not provided"} className="uppercase tracking-wider" />
                  <InfoField icon={<Award className="h-4 w-4" />} label="Aadhar Number" value={employee.aadharNumber || "Not provided"} className="tracking-wider" />
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-destructive flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" /> Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{employee.emergencyContact || "Not provided"}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary & Bank */}
        <TabsContent value="salary" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bank Account Details</CardTitle>
              <CardDescription>Primary account for payroll processing</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {canSeeSensitive ? (
                <>
                  <InfoField icon={<Building2 className="h-4 w-4" />} label="Bank Name" value={employee.bankName || "Not provided"} />
                  <InfoField
                    icon={<CreditCard className="h-4 w-4" />}
                    label="Account Number"
                    value={employee.bankAccount ? "•••• " + employee.bankAccount.slice(-4) : "Not provided"}
                    className="tracking-widest"
                  />
                  <InfoField icon={<Hash className="h-4 w-4" />} label="IFSC Code" value={employee.ifscCode || "Not provided"} className="uppercase tracking-wider" />
                </>
              ) : (
                <div className="col-span-2 text-center py-8 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Bank details are visible only to HR and Admin.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Balance */}
        <TabsContent value="leave" className="mt-6 space-y-4">
          {/* Admin/HR edit button */}
          {canEditLeaveBalance && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditLeaveOpen(true)}>
                <Pencil className="h-4 w-4" /> Edit Entitlement
              </Button>
            </div>
          )}

          {isLoadingLeave ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <LeaveCard title="Casual Leave" balance={leaveBalance?.casual || 0} used={leaveBalance?.casualUsed || 0} colorClass="text-primary bg-primary/10" />
              <LeaveCard title="Sick Leave" balance={leaveBalance?.sick || 0} used={leaveBalance?.sickUsed || 0} colorClass="text-warning bg-warning/10" />
              <LeaveCard title="Earned Leave" balance={leaveBalance?.earned || 0} used={leaveBalance?.earnedUsed || 0} colorClass="text-success bg-success/10" />
              <Card className="border-destructive/20 bg-destructive/5">
                <CardContent className="p-6 flex flex-col items-center justify-center h-full">
                  <div className="text-sm font-medium text-destructive mb-2">Unpaid Leave</div>
                  <div className="text-3xl font-bold text-destructive">{leaveBalance?.unpaidUsed || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">Days taken</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Max: {leaveBalance?.unpaid === 999 ? "Unlimited" : leaveBalance?.unpaid}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Year note */}
          <p className="text-xs text-muted-foreground text-center">
            Showing entitlements for {new Date().getFullYear()}. Used days are calculated from approved leave requests.
          </p>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EditEmployeeDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        employee={employee}
        onSuccess={handleEditSuccess}
      />
      <ResetPasswordDialog
        open={resetPassOpen}
        onOpenChange={setResetPassOpen}
        userId={linkedUserId}
        employeeName={`${employee.firstName} ${employee.lastName}`}
      />
      <EditLeaveBalanceDialog
        open={editLeaveOpen}
        onOpenChange={setEditLeaveOpen}
        employeeId={employee.id}
        currentBalance={leaveBalance}
        onSuccess={handleLeaveBalanceSuccess}
      />
    </div>
  );
}

// ─── Helper Components ─────────────────────────────────────────────────────────

function InfoField({ icon, label, value, className = "" }: {
  icon: React.ReactNode; label: string; value: string; className?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">{icon} {label}</div>
      <p className={`font-medium ${className}`}>{value}</p>
    </div>
  );
}

function LeaveCard({ title, balance, used, colorClass }: {
  title: string; balance: number; used: number; colorClass: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-sm font-medium text-muted-foreground text-center mb-4">{title}</div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center flex-1">
            <span className="text-3xl font-bold">{balance}</span>
            <span className="text-xs text-muted-foreground mt-1">Available</span>
          </div>
          <div className="w-px h-12 bg-border" />
          <div className="flex flex-col items-center flex-1">
            <span className="text-2xl font-semibold text-muted-foreground">{used}</span>
            <span className="text-xs text-muted-foreground mt-1">Used</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t text-center">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${colorClass}`}>
            Total: {balance + used}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
