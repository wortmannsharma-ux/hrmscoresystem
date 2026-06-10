import React from "react";
import { useParams, Link } from "wouter";
import { useGetEmployee, useGetLeaveBalance } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Hash, Building2, Briefcase, Award, ShieldAlert, CreditCard } from "lucide-react";
import { format } from "date-fns";

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const employeeId = Number(id);

  const { data: employee, isLoading } = useGetEmployee(employeeId);
  const { data: leaveBalance, isLoading: isLoadingLeave } = useGetLeaveBalance(employeeId);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/employees">
          <Button variant="outline" size="icon" className="h-8 w-8" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-primary">Employee Profile</h2>
      </div>

      {/* Profile Header */}
      <Card className="overflow-hidden border-t-4 border-t-primary">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Avatar className="h-24 w-24 border-4 border-background shadow-md">
              <AvatarImage src={employee.profilePhoto || undefined} alt={employee.firstName} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                {employee.firstName?.[0]}{employee.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-foreground">{employee.firstName} {employee.lastName}</h1>
                <Badge variant="outline" className={employee.status === 'ACTIVE' ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'}>
                  {employee.status}
                </Badge>
                <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {employee.role}
                </Badge>
              </div>
              
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground mt-2">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  <span className="font-medium text-foreground">{employee.employeeId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>{employee.departmentName || 'No Department'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  <span>{employee.designationName || 'No Designation'}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md h-auto p-1">
          <TabsTrigger value="personal" className="py-2" data-testid="tab-personal">Personal Info</TabsTrigger>
          <TabsTrigger value="salary" className="py-2" data-testid="tab-salary">Salary & Bank</TabsTrigger>
          <TabsTrigger value="leave" className="py-2" data-testid="tab-leave">Leave Balance</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact & Personal Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Mail className="h-4 w-4" /> Email Address
                </div>
                <p className="font-medium">{employee.email}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Phone className="h-4 w-4" /> Phone Number
                </div>
                <p className="font-medium">{employee.phone || 'Not provided'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" /> Joining Date
                </div>
                <p className="font-medium">{employee.joiningDate ? format(new Date(employee.joiningDate), "MMMM d, yyyy") : 'Not specified'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <MapPin className="h-4 w-4" /> Address
                </div>
                <p className="font-medium">{employee.address || 'Not provided'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Award className="h-4 w-4" /> PAN Number
                </div>
                <p className="font-medium uppercase tracking-wider">{employee.panNumber || 'Not provided'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Award className="h-4 w-4" /> Aadhar Number
                </div>
                <p className="font-medium tracking-wider">{employee.aadharNumber || 'Not provided'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-destructive flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" /> Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground mb-1">Contact</div>
                <p className="font-medium">{employee.emergencyContact || 'Not provided'}</p>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground mb-1">Contact Phone</div>
                <p className="font-medium">{employee.emergencyContact ? 'See contact details above' : 'Not provided'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bank Account Details</CardTitle>
              <CardDescription>Primary account for payroll processing</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Building2 className="h-4 w-4" /> Bank Name
                </div>
                <p className="font-medium">{employee.bankName || 'Not provided'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <CreditCard className="h-4 w-4" /> Account Number
                </div>
                <p className="font-medium tracking-widest">{employee.bankAccount ? '•••• ' + employee.bankAccount.slice(-4) : 'Not provided'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Hash className="h-4 w-4" /> IFSC Code
                </div>
                <p className="font-medium uppercase tracking-wider">{employee.ifscCode || 'Not provided'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="mt-6">
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
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeaveCard({ title, balance, used, colorClass }: { title: string, balance: number, used: number, colorClass: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-sm font-medium text-muted-foreground text-center mb-4">{title}</div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center flex-1">
            <span className="text-3xl font-bold">{balance}</span>
            <span className="text-xs text-muted-foreground mt-1">Available</span>
          </div>
          <div className="w-px h-12 bg-border"></div>
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
