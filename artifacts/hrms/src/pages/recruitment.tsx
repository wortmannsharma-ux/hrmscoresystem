import { useState } from "react";
import { Plus, ShieldOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListJobs, useListApplicants, useCreateJob, useCreateApplicant } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";

export default function RecruitmentPage() {
  const { user } = useAuth();
  const [jobStatus, setJobStatus] = useState<string>("OPEN");

  // Hard guard — only SUPER_ADMIN, ADMIN, HR can access recruitment
  if (!["SUPER_ADMIN", "ADMIN", "HR"].includes(user?.role ?? "")) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-muted-foreground">
        <ShieldOff className="h-10 w-10 opacity-40" />
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm">You don't have permission to view recruitment.</p>
      </div>
    );
  }

  const { data: jobs } = useListJobs({ status: jobStatus as any });
  const { data: applicants } = useListApplicants();

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Recruitment</h2>
      </div>

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs">Job Postings</TabsTrigger>
          <TabsTrigger value="applicants">Applicants</TabsTrigger>
        </TabsList>
        
        <TabsContent value="jobs" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Current Openings</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Post Job</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Post New Job</DialogTitle></DialogHeader>
                <div className="py-4 text-sm text-muted-foreground">Form stub</div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs?.length ? jobs.map((job: any) => (
              <Card key={job.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{job.title}</CardTitle>
                      <CardDescription>{job.location} • {job.departmentId}</CardDescription>
                    </div>
                    <Badge>{job.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    <p><strong>Experience:</strong> {job.minExperience} - {job.maxExperience} yrs</p>
                    <p><strong>Salary:</strong> ₹{job.minSalary} - ₹{job.maxSalary}</p>
                    <p><strong>Openings:</strong> {job.openings}</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full">View Applicants</Button>
                </CardFooter>
              </Card>
            )) : (
              <p className="text-muted-foreground col-span-full">No job postings found.</p>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="applicants" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Applicant Tracking</CardTitle>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Applicant</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Expected CTC</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applicants?.length ? applicants.map((app: any) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.firstName} {app.lastName}</TableCell>
                      <TableCell>{app.jobId}</TableCell>
                      <TableCell>{app.experienceYears} yrs</TableCell>
                      <TableCell>₹{app.expectedCtc}</TableCell>
                      <TableCell><Badge variant="secondary">{app.status}</Badge></TableCell>
                      <TableCell><Button variant="ghost" size="sm">Manage</Button></TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6} className="text-center py-4">No applicants found</TableCell></TableRow>
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
