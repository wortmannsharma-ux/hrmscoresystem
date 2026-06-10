import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListExpenses,
  useCreateExpense,
  useApproveExpense,
  useListEmployees,
  getListExpensesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Check, X, IndianRupee, FileText, CheckCircle } from "lucide-react";

export default function ExpensesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [employeeId, setEmployeeId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const [isSubmitDialog, setIsSubmitDialog] = useState(false);
  const [submitData, setSubmitData] = useState({ 
    employeeId: "", category: "Food", amount: "", date: format(new Date(), "yyyy-MM-dd"), 
    description: "", isAutoTravel: false, km: "", rate: "5" 
  });

  const queryParams = { 
    month: month, 
    employeeId: employeeId !== "all" ? Number(employeeId) : undefined,
    status: status !== "all" ? status : undefined
  };

  const { data: expenses, isLoading } = useListExpenses(queryParams, {
    query: { queryKey: getListExpensesQueryKey(queryParams) }
  });

  const { data: employees } = useListEmployees();

  const createExpense = useCreateExpense({
    mutation: {
      onSuccess: () => {
        toast({ title: "Expense submitted successfully" });
        setIsSubmitDialog(false);
        queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to submit", description: String(err), variant: "destructive" })
    }
  });

  const approveExpense = useApproveExpense({
    mutation: {
      onSuccess: () => {
        toast({ title: "Expense approved" });
        queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to approve", description: String(err), variant: "destructive" })
    }
  });

  const handleSubmit = () => {
    let finalAmount = Number(submitData.amount);
    if (submitData.isAutoTravel) {
      finalAmount = Number(submitData.km) * Number(submitData.rate);
    }
    
    createExpense.mutate({
      data: {
        employeeId: Number(submitData.employeeId),
        category: submitData.category as any,
        amount: finalAmount,
        date: submitData.date,
        description: submitData.description,
        isAutoTravel: submitData.isAutoTravel,
        travelKm: submitData.isAutoTravel ? Number(submitData.km) : undefined,
        travelRate: submitData.isAutoTravel ? Number(submitData.rate) : undefined
      }
    });
  };

  const handleApprove = (id: number) => {
    approveExpense.mutate({ id, data: { action: 'approve' } });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "manager approved": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "accounts approved": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "rejected": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "pending": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const stats = useMemo(() => {
    if (!expenses) return { pendingAmount: 0, claims: 0, approved: 0 };
    return expenses.reduce((acc: any, exp: any) => {
      acc.claims += 1;
      if (exp.status === "Pending") acc.pendingAmount += Number(exp.amount) || 0;
      if (exp.status === "Manager Approved" || exp.status === "Accounts Approved") acc.approved += 1;
      return acc;
    }, { pendingAmount: 0, claims: 0, approved: 0 });
  }, [expenses]);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Expenses</h2>
        <Dialog open={isSubmitDialog} onOpenChange={setIsSubmitDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-submit-expense">Submit Expense</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit New Expense</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="emp">Employee</Label>
                <Select value={submitData.employeeId} onValueChange={v => setSubmitData({...submitData, employeeId: v})}>
                  <SelectTrigger id="emp"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees?.map(emp => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>{emp.firstName} {emp.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" value={submitData.date} onChange={e => setSubmitData({...submitData, date: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={submitData.category} onValueChange={v => setSubmitData({...submitData, category: v})}>
                    <SelectTrigger id="category"><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fuel">Fuel</SelectItem>
                      <SelectItem value="Food">Food</SelectItem>
                      <SelectItem value="Hotel">Hotel</SelectItem>
                      <SelectItem value="Toll">Toll</SelectItem>
                      <SelectItem value="Parking">Parking</SelectItem>
                      <SelectItem value="Miscellaneous">Miscellaneous</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 py-2">
                <Switch id="auto-travel" checked={submitData.isAutoTravel} onCheckedChange={c => setSubmitData({...submitData, isAutoTravel: c})} />
                <Label htmlFor="auto-travel">Auto-calculate Travel (KM × Rate)</Label>
              </div>

              {submitData.isAutoTravel ? (
                <div className="grid grid-cols-2 gap-4 bg-muted/50 p-3 rounded-md">
                  <div className="grid gap-2">
                    <Label htmlFor="km">KM Travelled</Label>
                    <Input id="km" type="number" value={submitData.km} onChange={e => setSubmitData({...submitData, km: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rate">Per KM Rate (₹)</Label>
                    <Input id="rate" type="number" value={submitData.rate} onChange={e => setSubmitData({...submitData, rate: e.target.value})} />
                  </div>
                  <div className="col-span-2 text-sm text-right font-medium">
                    Calculated: ₹{(Number(submitData.km) || 0) * (Number(submitData.rate) || 0)}
                  </div>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount (₹)</Label>
                  <Input id="amount" type="number" value={submitData.amount} onChange={e => setSubmitData({...submitData, amount: e.target.value})} />
                </div>
              )}
              
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={submitData.description} onChange={e => setSubmitData({...submitData, description: e.target.value})} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={createExpense.isPending} data-testid="submit-expense-btn">Submit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.pendingAmount.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.claims}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved This Month</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4 py-4">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[200px]" />
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees?.map(emp => (
              <SelectItem key={emp.id} value={emp.id.toString()}>{emp.firstName} {emp.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Manager Approved">Manager Approved</SelectItem>
            <SelectItem value="Accounts Approved">Accounts Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table data-testid="table-expenses">
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center">Loading...</TableCell></TableRow>
            ) : !expenses || expenses.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center">No expenses found</TableCell></TableRow>
            ) : (
              expenses.map((expense: any) => (
                <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                  <TableCell className="font-medium">{(expense as any).employeeName || `EMP #${expense.employeeId}`}</TableCell>
                  <TableCell>{format(new Date(expense.date), "dd MMM yyyy")}</TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={expense.description}>{expense.description}</TableCell>
                  <TableCell className="font-medium">₹{Number(expense.amount).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(expense.status)}>{expense.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {expense.status === "Pending" && (
                      <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => handleApprove(expense.id)} disabled={approveExpense.isPending} data-testid={`btn-approve-${expense.id}`}>
                        Approve
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
