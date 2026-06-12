import { useState } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  useListPayroll, useGeneratePayroll, useListSalaryStructures, useCreateSalaryStructure,
  useListEmployees,
  getListPayrollQueryKey, getListSalaryStructuresQueryKey
} from "@workspace/api-client-react";

export default function PayrollPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Hard guard — only SUPER_ADMIN, ADMIN, HR can access payroll
  if (!["SUPER_ADMIN", "ADMIN", "HR"].includes(user?.role ?? "")) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-muted-foreground">
        <ShieldOff className="h-10 w-10 opacity-40" />
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm">You don't have permission to view payroll.</p>
      </div>
    );
  }
  const [month, setMonth] = useState<string>(format(new Date(), "yyyy-MM"));

  const [isStructureDialog, setIsStructureDialog] = useState(false);
  const [structureData, setStructureData] = useState({
    employeeId: "", basic: "", hra: "", specialAllowance: "", conveyance: "",
    medicalAllowance: "", effectiveFrom: format(new Date(), "yyyy-MM-dd")
  });

  const { data: payroll } = useListPayroll({ month });
  const { data: structures } = useListSalaryStructures();
  const { data: employees } = useListEmployees();

  const generatePayroll = useGeneratePayroll({
    mutation: {
      onSuccess: () => {
        toast({ title: "Payroll generated successfully" });
        queryClient.invalidateQueries({ queryKey: getListPayrollQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to generate payroll", description: String(err), variant: "destructive" })
    }
  });

  const createStructure = useCreateSalaryStructure({
    mutation: {
      onSuccess: () => {
        toast({ title: "Salary structure saved" });
        setIsStructureDialog(false);
        setStructureData({ employeeId: "", basic: "", hra: "", specialAllowance: "", conveyance: "", medicalAllowance: "", effectiveFrom: format(new Date(), "yyyy-MM-dd") });
        queryClient.invalidateQueries({ queryKey: getListSalaryStructuresQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to save structure", description: String(err), variant: "destructive" })
    }
  });

  const handleCreateStructure = () => {
<<<<<<< HEAD
    const combinedSpecial = (Number(structureData.specialAllowance) || 0) + (Number(structureData.medicalAllowance) || 0);
=======
    const specialAllowanceValue = Number(structureData.specialAllowance) + (Number(structureData.medicalAllowance) || 0);
>>>>>>> aalekh
    createStructure.mutate({
      data: {
        employeeId: Number(structureData.employeeId),
        basic: Number(structureData.basic),
<<<<<<< HEAD
        hra: Number(structureData.hra) || undefined,
        specialAllowance: combinedSpecial || undefined,
        conveyance: Number(structureData.conveyance) || undefined,
=======
        hra: Number(structureData.hra),
        specialAllowance: specialAllowanceValue || undefined,
        conveyance: Number(structureData.conveyance),
>>>>>>> aalekh
        effectiveFrom: structureData.effectiveFrom,
      }
    });
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Payroll & Compensation</h2>
      </div>

      <Tabs defaultValue="payroll" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payroll">Payroll Records</TabsTrigger>
          <TabsTrigger value="structures">Salary Structures</TabsTrigger>
        </TabsList>

        <TabsContent value="payroll" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Payroll for {month}</CardTitle>
                <CardDescription>Monthly payroll processing</CardDescription>
              </div>
              <div className="flex space-x-2">
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[150px]" />
                <Button onClick={() => generatePayroll.mutate({ data: { month } })} disabled={generatePayroll.isPending}>
                  {generatePayroll.isPending ? "Generating…" : "Generate Payroll"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Present Days</TableHead>
                    <TableHead>LOP Days</TableHead>
                    <TableHead>Basic</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payroll?.length ? payroll.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {employees?.find(e => e.id === p.employeeId)
                          ? `${employees.find(e => e.id === p.employeeId)!.firstName} ${employees.find(e => e.id === p.employeeId)!.lastName}`
                          : `EMP #${p.employeeId}`}
                      </TableCell>
                      <TableCell>{p.presentDays}</TableCell>
                      <TableCell>{p.lopDays}</TableCell>
                      <TableCell>₹{Number(p.basic).toLocaleString()}</TableCell>
                      <TableCell>₹{Number(p.grossSalary).toLocaleString()}</TableCell>
                      <TableCell>₹{Number(p.totalDeductions).toLocaleString()}</TableCell>
                      <TableCell className="font-semibold text-success">₹{Number(p.netSalary).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          p.status === "PAID" ? "bg-success/10 text-success border-success/20" :
                          p.status === "PROCESSED" ? "bg-primary/10 text-primary border-primary/20" :
                          "bg-muted text-muted-foreground"
                        }>
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No payroll records for {month}. Click "Generate Payroll" to process.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structures" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Salary Structures</CardTitle>
                <CardDescription>Define CTC breakdown for each employee.</CardDescription>
              </div>
              <Dialog open={isStructureDialog} onOpenChange={setIsStructureDialog}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Add Structure</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Salary Structure</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Employee *</Label>
                      <Select value={structureData.employeeId} onValueChange={v => setStructureData({ ...structureData, employeeId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                        <SelectContent>
                          {employees?.map(emp => (
                            <SelectItem key={emp.id} value={emp.id.toString()}>{emp.firstName} {emp.lastName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Effective From</Label>
                      <Input type="date" value={structureData.effectiveFrom} onChange={e => setStructureData({ ...structureData, effectiveFrom: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Basic (₹) *</Label>
                        <Input type="number" value={structureData.basic} onChange={e => setStructureData({ ...structureData, basic: e.target.value })} placeholder="0" />
                      </div>
                      <div className="grid gap-2">
                        <Label>HRA (₹)</Label>
                        <Input type="number" value={structureData.hra} onChange={e => setStructureData({ ...structureData, hra: e.target.value })} placeholder="0" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Special Allowance (₹)</Label>
                        <Input type="number" value={structureData.specialAllowance} onChange={e => setStructureData({ ...structureData, specialAllowance: e.target.value })} placeholder="0" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Conveyance (₹)</Label>
                        <Input type="number" value={structureData.conveyance} onChange={e => setStructureData({ ...structureData, conveyance: e.target.value })} placeholder="0" />
                      </div>
                      <div className="grid gap-2 col-span-2">
                        <Label>Medical Allowance (₹)</Label>
                        <Input type="number" value={structureData.medicalAllowance} onChange={e => setStructureData({ ...structureData, medicalAllowance: e.target.value })} placeholder="0" />
                      </div>
                    </div>
                    {structureData.basic && (
                      <div className="bg-muted/50 rounded-md p-3 text-sm">
                        <span className="text-muted-foreground">Estimated CTC: </span>
                        <span className="font-semibold">₹{(
                          (Number(structureData.basic) || 0) +
                          (Number(structureData.hra) || 0) +
                          (Number(structureData.specialAllowance) || 0) +
                          (Number(structureData.conveyance) || 0) +
                          (Number(structureData.medicalAllowance) || 0)
                        ).toLocaleString()}</span>
                        <span className="text-muted-foreground"> / month</span>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateStructure} disabled={createStructure.isPending || !structureData.employeeId || !structureData.basic}>
                      Save Structure
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Basic</TableHead>
                    <TableHead>HRA</TableHead>
                    <TableHead>Special</TableHead>
                    <TableHead>Conveyance</TableHead>
                    <TableHead className="text-right">Total CTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structures?.length ? structures.map((s: any) => {
                    const ctc = Number(s.basic) + Number(s.hra) + Number(s.specialAllowance) + Number(s.conveyance) + (Number(s.medicalAllowance) || 0);
                    const emp = employees?.find(e => e.id === s.employeeId);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {emp ? `${emp.firstName} ${emp.lastName}` : `EMP #${s.employeeId}`}
                        </TableCell>
                        <TableCell>{s.effectiveFrom ? format(new Date(s.effectiveFrom), "MMM d, yyyy") : "-"}</TableCell>
                        <TableCell>₹{Number(s.basic).toLocaleString()}</TableCell>
                        <TableCell>₹{Number(s.hra).toLocaleString()}</TableCell>
                        <TableCell>₹{Number(s.specialAllowance).toLocaleString()}</TableCell>
                        <TableCell>₹{Number(s.conveyance).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-primary">₹{ctc.toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No salary structures found</TableCell>
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
