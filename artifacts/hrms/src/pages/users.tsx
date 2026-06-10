import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, UserCheck, UserX, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { authFetch } from "@/lib/auth-context";

const USERS_KEY = ["users"];

type AppUser = {
  id: number;
  userId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  employeeId: number | null;
  employeeName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "HR",
  "MANAGER",
  "TEAM_LEADER",
  "EMPLOYEE",
  "INTERN",
] as const;

function roleBadgeClass(role: string) {
  switch (role) {
    case "SUPER_ADMIN": return "bg-red-100 text-red-800 border-red-200";
    case "ADMIN":       return "bg-orange-100 text-orange-800 border-orange-200";
    case "HR":          return "bg-purple-100 text-purple-800 border-purple-200";
    case "MANAGER":     return "bg-blue-100 text-blue-800 border-blue-200";
    case "TEAM_LEADER": return "bg-cyan-100 text-cyan-800 border-cyan-200";
    case "EMPLOYEE":    return "bg-green-100 text-green-800 border-green-200";
    default:            return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  // ── Fetch all users ────────────────────────────────────────────────────────
  const { data: users = [], isLoading } = useQuery<AppUser[]>({
    queryKey: USERS_KEY,
    queryFn: async () => {
      const res = await authFetch("/api/users");
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });

  // ── Create user ────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "EMPLOYEE" });
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await authFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).message || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      setCreateOpen(false);
      setForm({ name: "", email: "", password: "", role: "EMPLOYEE" });
      setFormError(null);
      toast({ title: "User created successfully" });
    },
    onError: (err: any) => setFormError(err.message),
  });

  // ── Toggle active/inactive ─────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await authFetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update user");
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      toast({ title: vars.isActive ? "User activated" : "User deactivated" });
    },
    onError: () => toast({ title: "Failed to update user", variant: "destructive" }),
  });

  // ── Delete user (SUPER_ADMIN only) ─────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete user");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      setDeleteId(null);
      toast({ title: "User deleted" });
    },
    onError: () => toast({ title: "Failed to delete user", variant: "destructive" }),
  });

  const handleCreate = () => {
    setFormError(null);
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError("Name, email and password are required.");
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Users</h2>
          <p className="text-muted-foreground">
            Manage login accounts — create, activate / deactivate, and delete users.
          </p>
        </div>
        <Button onClick={() => { setCreateOpen(true); setFormError(null); }} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total",    value: users.length,                              icon: ShieldCheck, cls: "text-primary" },
          { label: "Active",   value: users.filter((u) => u.isActive).length,    icon: UserCheck,   cls: "text-success" },
          { label: "Inactive", value: users.filter((u) => !u.isActive).length,   icon: UserX,       cls: "text-destructive" },
          { label: "Admins",   value: users.filter((u) => ["SUPER_ADMIN","ADMIN"].includes(u.role)).length, icon: ShieldCheck, cls: "text-orange-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <s.icon className={`h-5 w-5 ${s.cls}`} />
                <div>
                  <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Linked Employee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading users…</TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No users found.</TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <TableRow key={u.id} className={!u.isActive ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{u.name}</span>
                        <span className="text-xs text-muted-foreground">{u.userId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleBadgeClass(u.role)}>
                        {u.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.employeeName ?? "—"}
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.lastLoginAt ? format(new Date(u.lastLoginAt), "dd MMM yyyy, HH:mm") : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {/* Active / Inactive toggle — not for self */}
                        {!isSelf && (
                          <Button
                            size="sm"
                            variant="outline"
                            className={u.isActive
                              ? "text-amber-600 border-amber-200 hover:bg-amber-50"
                              : "text-green-600 border-green-200 hover:bg-green-50"}
                            onClick={() => toggleMutation.mutate({ id: u.id, isActive: !u.isActive })}
                            disabled={toggleMutation.isPending}
                          >
                            {u.isActive ? (
                              <><UserX className="h-3.5 w-3.5 mr-1" /> Deactivate</>
                            ) : (
                              <><UserCheck className="h-3.5 w-3.5 mr-1" /> Activate</>
                            )}
                          </Button>
                        )}
                        {/* Delete — SUPER_ADMIN only, not self */}
                        {isSuperAdmin && !isSelf && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteId(u.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {isSelf && (
                          <span className="text-xs text-muted-foreground px-2">You</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{formError}</p>
            )}
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                placeholder="e.g. Rahul Sharma"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                placeholder="rahul@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                placeholder="Min 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Role controls what this user can see and do in the system.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the login account. Their employee HR record (if any) will not be affected.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
