import React, { useState } from "react";
import { Link } from "wouter";
import { useListEmployees, useListDepartments, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, UserPlus, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";

export default function Employees() {
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const params = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(departmentId !== "all" ? { departmentId: Number(departmentId) } : {}),
    ...(status !== "all" ? { status } : {})
  };

  const { data: employees, isLoading } = useListEmployees(params, {
    query: { queryKey: getListEmployeesQueryKey(params) }
  });
  const { data: departments } = useListDepartments();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Employee Directory</h2>
          <p className="text-muted-foreground">Manage your workforce and view employee details.</p>
        </div>
        <Button data-testid="button-add-employee" className="shrink-0 gap-2">
          <UserPlus className="h-4 w-4" />
          Add Employee
        </Button>
      </div>

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
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Role</TableHead>
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
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md inline-block" /></TableCell>
                  </TableRow>
                ))
              ) : employees?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Filter className="h-8 w-8 mb-2 text-muted-foreground/50" />
                      <p>No employees found matching the filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                employees?.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-border">
                          <AvatarImage src={emp.avatarUrl} alt={emp.firstName} />
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {emp.firstName?.[0]}{emp.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{emp.firstName} {emp.lastName}</span>
                          <span className="text-xs text-muted-foreground">{emp.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-xs">{emp.employeeId}</TableCell>
                    <TableCell className="text-sm">{(emp as any).departmentName || emp.department?.name || 'N/A'}</TableCell>
                    <TableCell className="text-sm">{(emp as any).designationName || emp.designation?.name || 'N/A'}</TableCell>
                    <TableCell className="text-sm">{emp.role}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={emp.status?.toUpperCase() === 'ACTIVE' ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'}>
                        {emp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{emp.joiningDate ? format(new Date(emp.joiningDate), "MMM d, yyyy") : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/employees/${emp.id}`}>
                        <Button variant="ghost" size="icon" data-testid={`button-view-${emp.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
