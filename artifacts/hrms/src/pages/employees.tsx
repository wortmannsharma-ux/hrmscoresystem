import React, { useState } from "react";
import { Link } from "wouter";
import {
  useListEmployees,
  useListDepartments,
  useListDesignations,
  useCreateEmployee,
  useUpdateEmployee,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PaginationBar, usePagination } from "@/components/ui/pagination-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, UserPlus, Filter, Users, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ───────────────────────────────────────────────────────────────────

type EmployeeRow = {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  joiningDate: string;
  departmentId?: number | null;
  departmentName?: string | null;
  designationId?: number | null;
  designationName?: string | null;
  managerId?: number | null;
  managerName?: string | null;
  profilePhoto?: string | null;
  address?: string | null;
  bankAccount?: string | null;
  ifscCode?: string | null;
  bankName?: string | null;
  panNumber?: string | null;
  aadharNumber?: string | null;
  emergencyContact?: string | null;
};

const EMPLOYEE_ROLES = [
  "Desk Employee",
  "Field Executive",
  "Manager",
  "Team Leader",
  "HR Admin",
  "Intern",
];

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "Desk Employee",
  joiningDate: new Date().toISOString().split("T")[0] ?? "",
  departmentId: "",
  designationId: "",
  managerId: "",
  address: "",
  bankAccount: "",
  ifscCode: "",
  bankName: "",
  panNumber: "",
  aadharNumber: "",
  emergencyContact: "",
  profilePhoto: "",
  status: "active",
};

type FormState = typeof EMPTY_FORM;

// ─── EmployeeFormDialog ────────────────────────────────────────────────────────

function EmployeeFormDialog({
  open,
  onOpenChange,
  initialValues,
  editId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialValues?: Partial<FormState>;
  editId?: number;
  onSuccess?: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = ["SUPER_ADMIN", "ADMIN", "HR"].includes(user?.role ?? "");

  const { data: departments } = useListDepartments();
  const { data: designations } = useListDesignations();
  const { data: allEmployees } = useListEmployees();

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, ...initialValues });
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens with new initialValues
  React.useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, ...initialValues });
      setError(null);
    }
  }, [open, JSON.stringify(initialValues)]);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      set("profilePhoto", ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError("First name, last name and email are required.");
      return;
    }
    if (!form.joiningDate) {
      setError("Joining date is required.");
      return;
    }

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role,
      joiningDate: form.joiningDate,
      status: form.status || "active",
      departmentId: form.departmentId && form.departmentId !== "none" ? Number(form.departmentId) : null,
      designationId: form.designationId && form.designationId !== "none" ? Number(form.designationId) : null,
      managerId: form.managerId && form.managerId !== "none" ? Number(form.managerId) : null,
      address: form.address || null,
      bankAccount: form.bankAccount || null,
      ifscCode: form.ifscCode || null,
      bankName: form.bankName || null,
      panNumber: form.panNumber || null,
      aadharNumber: form.aadharNumber || null,
      emergencyContact: form.emergencyContact || null,
      profilePhoto: form.profilePhoto || null,
    };

    if (editId) {
      updateMutation.mutate(
        { id: editId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Employee updated successfully" });
            onOpenChange(false);
            onSuccess?.();
          },
          onError: (err: any) => setError(err?.message ?? "Failed to update employee"),
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Employee added successfully" });
            onOpenChange(false);
            onSuccess?.();
          },
          onError: (err: any) => setError(err?.message ?? "Failed to create employee"),
        }
      );
    }
  };

  const filteredDesignations = form.departmentId
    ? designations?.filter((d) => d.departmentId === Number(form.departmentId))
    : designations;

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editId ? "Edit Employee" : "Add New Employee"}</DialogTitle>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
        )}

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="org">Org & Manager</TabsTrigger>
            <TabsTrigger value="finance">Finance & Docs</TabsTrigger>
          </TabsList>

          {/* ── Basic Info ── */}
          <TabsContent value="basic" className="space-y-4">
            {/* Photo upload */}
            <div className="flex flex-col items-center gap-3 pb-2">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={form.profilePhoto || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {form.firstName?.[0]}{form.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <label className="cursor-pointer">
                <span className="text-xs text-primary underline underline-offset-2">
                  Upload photo
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Rahul" />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Sharma" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="rahul@company.com"
                disabled={!!editId} // email shouldn't change on edit to avoid confusion
              />
              {editId && <p className="text-xs text-muted-foreground">Email cannot be changed after creation.</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9876543210" />
              </div>
              <div className="space-y-2">
                <Label>Joining Date *</Label>
                <Input type="date" value={form.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="123 Main St, City" />
            </div>

            {isAdmin && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee Role</Label>
                  <Select value={form.role} onValueChange={(v) => set("role", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
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

          {/* ── Org & Manager ── */}
          <TabsContent value="org" className="space-y-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={form.departmentId || "none"}
                onValueChange={(v) => {
                  set("departmentId", v === "none" ? "" : v);
                  set("designationId", ""); // reset designation when dept changes
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Designation</Label>
              <Select value={form.designationId || "none"} onValueChange={(v) => set("designationId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Designation</SelectItem>
                  {filteredDesignations?.map((d) => (
                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.departmentId && form.departmentId !== "none" && (
                <p className="text-xs text-muted-foreground">Showing designations for selected department.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Reporting Manager</Label>
              <Select value={form.managerId || "none"} onValueChange={(v) => set("managerId", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Manager</SelectItem>
                  {allEmployees
                    ?.filter((e) => !editId || e.id !== editId) // don't assign self
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id.toString()}>
                        {e.firstName} {e.lastName} — {e.role}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* ── Finance & Docs ── */}
          <TabsContent value="finance" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input value={form.bankName ?? ""} onChange={(e) => set("bankName", e.target.value)} placeholder="HDFC Bank" />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input value={form.bankAccount ?? ""} onChange={(e) => set("bankAccount", e.target.value)} placeholder="XXXXXXXXXXXX" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>IFSC Code</Label>
              <Input value={form.ifscCode ?? ""} onChange={(e) => set("ifscCode", e.target.value)} placeholder="HDFC0001234" className="uppercase" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>PAN Number</Label>
                <Input value={form.panNumber ?? ""} onChange={(e) => set("panNumber", e.target.value.toUpperCase())} placeholder="ABCDE1234F" className="uppercase" />
              </div>
              <div className="space-y-2">
                <Label>Aadhar Number</Label>
                <Input value={form.aadharNumber ?? ""} onChange={(e) => set("aadharNumber", e.target.value)} placeholder="XXXX XXXX XXXX" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Emergency Contact</Label>
              <Input value={form.emergencyContact ?? ""} onChange={(e) => set("emergencyContact", e.target.value)} placeholder="Name — Phone" />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (editId ? "Saving…" : "Adding…") : (editId ? "Save Changes" : "Add Employee")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Employees Page ───────────────────────────────────────────────────────

export default function Employees() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isManager = role === "MANAGER" || role === "TEAM_LEADER";
  const isAdmin = ["SUPER_ADMIN", "ADMIN", "HR"].includes(role);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const [addOpen, setAddOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<EmployeeRow | null>(null);

  const params = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(departmentId !== "all" ? { departmentId: Number(departmentId) } : {}),
    ...(status !== "all" ? { status } : {}),
  };

  const { data: allEmployees, isLoading } = useListEmployees(params, {
    query: {
      // Use a flat key so invalidation by prefix ["/api/employees"] always hits
      queryKey: ["/api/employees", params],
    },
  });
  const { data: departments } = useListDepartments();

  // Managers only see employees whose managerId matches their own employee record
  const employees = isManager && user?.employeeId
    ? allEmployees?.filter((emp) => emp.managerId === user.employeeId)
    : allEmployees;

  const handleRefresh = () => {
    // Invalidate ALL employee queries regardless of params
    queryClient.invalidateQueries({ queryKey: ["/api/employees"], exact: false });
    queryClient.refetchQueries({ queryKey: ["/api/employees"], exact: false });
  };

  // ── Pagination ──────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pagedEmployees = usePagination(employees ?? [], page, pageSize);

  // Build initial values for edit dialog
  const editInitialValues = editEmployee
    ? {
        firstName: editEmployee.firstName,
        lastName: editEmployee.lastName,
        email: editEmployee.email,
        phone: editEmployee.phone ?? "",
        role: editEmployee.role,
        joiningDate: editEmployee.joiningDate,
        departmentId: editEmployee.departmentId?.toString() ?? "",
        designationId: editEmployee.designationId?.toString() ?? "",
        managerId: editEmployee.managerId?.toString() ?? "",
        address: editEmployee.address ?? "",
        bankAccount: editEmployee.bankAccount ?? "",
        ifscCode: editEmployee.ifscCode ?? "",
        bankName: editEmployee.bankName ?? "",
        panNumber: editEmployee.panNumber ?? "",
        aadharNumber: editEmployee.aadharNumber ?? "",
        emergencyContact: editEmployee.emergencyContact ?? "",
        profilePhoto: editEmployee.profilePhoto ?? "",
        status: editEmployee.status,
      }
    : undefined;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">
            {isManager ? "My Team" : "Employee Directory"}
          </h2>
          <p className="text-muted-foreground">
            {isManager
              ? "Employees reporting directly to you."
              : "Manage your workforce and view employee details."}
          </p>
        </div>
        {isAdmin && (
          <Button
            data-testid="button-add-employee"
            className="shrink-0 gap-2"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            Add Employee
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-full md:w-[200px]" data-testid="select-department">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full md:w-[150px]" data-testid="select-status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joining Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-[120px]" /><Skeleton className="h-3 w-[80px]" /></div></div></TableCell>
                    {Array.from({ length: 6 }).map((_, j) => (<TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>))}
                    <TableCell className="text-right"><Skeleton className="h-8 w-16 rounded-md inline-block" /></TableCell>
                  </TableRow>
                ))
              ) : pagedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      {isManager ? (
                        <><Users className="h-8 w-8 mb-2 text-muted-foreground/50" /><p>No team members assigned yet.</p></>
                      ) : (
                        <><Filter className="h-8 w-8 mb-2 text-muted-foreground/50" /><p>No employees found.</p></>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pagedEmployees.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-border">
                          <AvatarImage src={emp.profilePhoto || undefined} alt={emp.firstName} />
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">{emp.firstName?.[0]}{emp.lastName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{emp.firstName} {emp.lastName}</span>
                          <span className="text-xs text-muted-foreground">{emp.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-xs">{emp.employeeId}</TableCell>
                    <TableCell className="text-sm">{emp.departmentName || "—"}</TableCell>
                    <TableCell className="text-sm">{emp.designationName || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{(emp as any).managerName || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={emp.status?.toLowerCase() === "active" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                        {emp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{emp.joiningDate ? format(new Date(emp.joiningDate), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(isAdmin || emp.id === user?.employeeId) && (
                          <Button variant="ghost" size="icon" data-testid={`button-edit-${emp.id}`} onClick={() => setEditEmployee(emp as EmployeeRow)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Link href={`/employees/${emp.id}`}>
                          <Button variant="ghost" size="icon" data-testid={`button-view-${emp.id}`}><Eye className="h-4 w-4" /></Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={employees?.length ?? 0}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </Card>

      {/* Add Employee Dialog */}
      <EmployeeFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={handleRefresh}
      />

      {/* Edit Employee Dialog */}
      <EmployeeFormDialog
        open={!!editEmployee}
        onOpenChange={(v) => { if (!v) setEditEmployee(null); }}
        initialValues={editInitialValues}
        editId={editEmployee?.id}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
