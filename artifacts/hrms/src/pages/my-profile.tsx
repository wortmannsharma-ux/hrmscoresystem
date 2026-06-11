import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { useGetEmployee, useUpdateEmployee } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, authFetch } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Mail, Phone, MapPin, Calendar, Hash, Building2, Briefcase,
  Pencil, KeyRound, Award, ShieldAlert,
} from "lucide-react";
import { format } from "date-fns";

// ─── Change Password Dialog ─────────────────────────────────────────────────

function ChangePasswordDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) { setOldPassword(""); setNewPassword(""); setConfirm(""); setError(null); }
  }, [open]);

  const handleChange = async () => {
    setError(null);
    if (!oldPassword) { setError("Current password is required."); return; }
    if (newPassword.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (newPassword !== confirm) { setError("Passwords do not match."); return; }
    if (oldPassword === newPassword) { setError("New password must differ from current password."); return; }

    setLoading(true);
    try {
      const res = await authFetch("/api/auth/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.email, oldPassword, newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || "Failed to change password");
      }
      toast({ title: "Password changed successfully" });
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message ?? "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" /> Change Password
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Enter your current password to set a new one.
        </p>
        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Current Password *</Label>
            <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Your current password" />
          </div>
          <div className="space-y-2">
            <Label>New Password *</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password *</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat new password" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleChange} disabled={loading}>
            {loading ? "Changing…" : "Change Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Basic Details Dialog ──────────────────────────────────────────────

function EditBasicDialog({
  open, onOpenChange, employee, onSuccess,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; employee: any; onSuccess?: () => void;
}) {
  const { toast } = useToast();
  const updateMutation = useUpdateEmployee();
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", address: "", emergencyContact: "", profilePhoto: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && employee) {
      setForm({
        firstName: employee.firstName ?? "",
        lastName: employee.lastName ?? "",
        phone: employee.phone ?? "",
        address: employee.address ?? "",
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

  const handleSave = () => {
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    updateMutation.mutate(
      { id: employee.id, data: {
        firstName: form.firstName.trim(), lastName: form.lastName.trim(),
        phone: form.phone || null, address: form.address || null,
        emergencyContact: form.emergencyContact || null,
        profilePhoto: form.profilePhoto || null,
      }},
      {
        onSuccess: () => { toast({ title: "Profile updated" }); onOpenChange(false); onSuccess?.(); },
        onError: (err: any) => setError(err?.message ?? "Failed to update"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Edit Basic Details</DialogTitle></DialogHeader>
        {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-16 w-16 border-2 border-border">
              <AvatarImage src={form.profilePhoto || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {form.firstName?.[0]}{form.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <label className="cursor-pointer">
              <span className="text-xs text-primary underline underline-offset-2">Upload photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>First Name *</Label>
              <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Last Name *</Label>
              <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9876543210" />
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Emergency Contact</Label>
            <Input value={form.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} placeholder="Name — Phone" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── My Profile Page ─────────────────────────────────────────────────────────

export default function MyProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const employeeId = user?.employeeId;

  const { data: employee, isLoading } = useGetEmployee(employeeId ?? 0, {
    query: { enabled: !!employeeId, queryKey: [`/api/employees/${employeeId ?? 0}`] },
  });

  const [editOpen, setEditOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/employees"], exact: false });
  };

  if (!employeeId) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4 text-center px-4">
        <h2 className="text-2xl font-bold">No Employee Record</h2>
        <p className="text-muted-foreground max-w-sm">
          Your account doesn't have a linked employee profile yet. Please contact HR or Admin.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Card><CardContent className="p-6 flex gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="space-y-3 flex-1"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-4 w-1/4" /></div>
        </CardContent></Card>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <h2 className="text-2xl font-bold">Profile not found</h2>
        <p className="text-muted-foreground">Contact HR to set up your employee profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-primary">My Profile</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit Details
          </Button>
          <Button variant="outline" size="sm" className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => setPwdOpen(true)}>
            <KeyRound className="h-4 w-4" /> Change Password
          </Button>
        </div>
      </div>

      {/* Profile Card */}
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
              <button
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-5 w-5 text-white" />
              </button>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold">{employee.firstName} {employee.lastName}</h1>
                <Badge variant="outline" className={employee.status?.toLowerCase() === "active" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                  {employee.status}
                </Badge>
                <Badge className="bg-primary text-primary-foreground">{employee.role}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Hash className="h-4 w-4" /><span className="font-medium text-foreground">{employee.employeeId}</span></span>
                <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" />{employee.departmentName || "No Department"}</span>
                <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" />{employee.designationName || "No Designation"}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Tabs */}
      <Tabs defaultValue="personal">
        <TabsList className="max-w-xs h-auto p-1">
          <TabsTrigger value="personal" className="py-2">Personal Info</TabsTrigger>
          <TabsTrigger value="account" className="py-2">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-6 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Contact Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={employee.email} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={employee.phone || "Not provided"} />
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="Joining Date" value={employee.joiningDate ? format(new Date(employee.joiningDate), "MMMM d, yyyy") : "—"} />
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={employee.address || "Not provided"} />
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

        <TabsContent value="account" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Login Account</CardTitle>
              <CardDescription>Manage your login credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Login Email" value={user?.email ?? "—"} />
              <InfoRow icon={<Award className="h-4 w-4" />} label="Role" value={user?.role ?? "—"} />
              <div className="pt-2">
                <Button variant="outline" className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => setPwdOpen(true)}>
                  <KeyRound className="h-4 w-4" /> Change Password
                </Button>
                <p className="text-xs text-muted-foreground mt-2">You must enter your current password to set a new one.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EditBasicDialog open={editOpen} onOpenChange={setEditOpen} employee={employee} onSuccess={handleEditSuccess} />
      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon} {label}</div>
      <p className="font-medium">{value}</p>
    </div>
  );
}
