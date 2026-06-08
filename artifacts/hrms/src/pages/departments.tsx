import { useState } from "react";
import { Plus, Building2, UserCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDepartments, useListDesignations, useCreateDepartment, useCreateDesignation,
  getListDepartmentsQueryKey, getListDesignationsQueryKey
} from "@workspace/api-client-react";

export default function DepartmentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: departments } = useListDepartments();
  const { data: designations } = useListDesignations();

  const [isDeptDialog, setIsDeptDialog] = useState(false);
  const [isDesigDialog, setIsDesigDialog] = useState(false);

  const [deptData, setDeptData] = useState({ name: "", description: "" });
  const [desigData, setDesigData] = useState({ title: "", departmentId: "", level: "" });

  const createDept = useCreateDepartment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Department created" });
        setIsDeptDialog(false);
        setDeptData({ name: "", description: "" });
        queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to create department", description: String(err), variant: "destructive" })
    }
  });

  const createDesig = useCreateDesignation({
    mutation: {
      onSuccess: () => {
        toast({ title: "Designation created" });
        setIsDesigDialog(false);
        setDesigData({ title: "", departmentId: "", level: "" });
        queryClient.invalidateQueries({ queryKey: getListDesignationsQueryKey() });
      },
      onError: (err) => toast({ title: "Failed to create designation", description: String(err), variant: "destructive" })
    }
  });

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Organization Structure</h2>
      </div>

      <Tabs defaultValue="departments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="departments"><Building2 className="mr-2 h-4 w-4" /> Departments</TabsTrigger>
          <TabsTrigger value="designations"><UserCircle className="mr-2 h-4 w-4" /> Designations</TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Departments</CardTitle>
                <CardDescription>Manage company departments and units.</CardDescription>
              </div>
              <Dialog open={isDeptDialog} onOpenChange={setIsDeptDialog}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Add Department</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Department</DialogTitle></DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Department Name *</Label>
                      <Input
                        value={deptData.name}
                        onChange={e => setDeptData({ ...deptData, name: e.target.value })}
                        placeholder="e.g. Engineering"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Description</Label>
                      <Input
                        value={deptData.description}
                        onChange={e => setDeptData({ ...deptData, description: e.target.value })}
                        placeholder="Brief description of this department"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => createDept.mutate({ data: { name: deptData.name, description: deptData.description || undefined } })} disabled={createDept.isPending || !deptData.name}>
                      Create Department
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments?.length ? departments.map((dept: any) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell className="text-muted-foreground">{dept.description || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">Edit</Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No departments found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="designations" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Designations</CardTitle>
                <CardDescription>Manage job roles and levels.</CardDescription>
              </div>
              <Dialog open={isDesigDialog} onOpenChange={setIsDesigDialog}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Add Designation</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Designation</DialogTitle></DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Job Title *</Label>
                      <Input
                        value={desigData.title}
                        onChange={e => setDesigData({ ...desigData, title: e.target.value })}
                        placeholder="e.g. Senior Developer"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Department</Label>
                      <Select value={desigData.departmentId} onValueChange={v => setDesigData({ ...desigData, departmentId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                        <SelectContent>
                          {departments?.map((d: any) => (
                            <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Level</Label>
                      <Select value={desigData.level} onValueChange={v => setDesigData({ ...desigData, level: v })}>
                        <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Junior">Junior</SelectItem>
                          <SelectItem value="Mid">Mid</SelectItem>
                          <SelectItem value="Senior">Senior</SelectItem>
                          <SelectItem value="Lead">Lead</SelectItem>
                          <SelectItem value="Manager">Manager</SelectItem>
                          <SelectItem value="Director">Director</SelectItem>
                          <SelectItem value="VP">VP</SelectItem>
                          <SelectItem value="C-Level">C-Level</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createDesig.mutate({ data: { title: desigData.title, departmentId: desigData.departmentId ? Number(desigData.departmentId) : undefined, level: desigData.level || undefined } })}
                      disabled={createDesig.isPending || !desigData.title}
                    >
                      Create Designation
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {designations?.length ? designations.map((desig: any) => (
                    <TableRow key={desig.id}>
                      <TableCell className="font-medium">{desig.title}</TableCell>
                      <TableCell>{departments?.find((d: any) => d.id === desig.departmentId)?.name || "-"}</TableCell>
                      <TableCell>{desig.level || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">Edit</Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">No designations found</TableCell></TableRow>
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
