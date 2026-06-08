import {
  db,
  departmentsTable, designationsTable, employeesTable,
  attendanceTable, leavesTable, expensesTable,
  vendorsTable, visitsTable, salaryStructuresTable,
  payrollTable, jobsTable, applicantsTable, holidaysTable,
  officeLocationsTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("Seeding HRMS database...");

  // Departments
  const [deptHR] = await db.insert(departmentsTable).values({ name: "Human Resources", description: "HR and People Ops" }).returning();
  const [deptSales] = await db.insert(departmentsTable).values({ name: "Sales", description: "Sales and Business Development" }).returning();
  const [deptOps] = await db.insert(departmentsTable).values({ name: "Operations", description: "Operations and Logistics" }).returning();
  const [deptIT] = await db.insert(departmentsTable).values({ name: "Technology", description: "IT and Software" }).returning();
  const [deptAccounts] = await db.insert(departmentsTable).values({ name: "Accounts", description: "Finance and Accounts" }).returning();
  console.log("Departments created");

  // Designations
  const [desigHRM] = await db.insert(designationsTable).values({ name: "HR Manager", departmentId: deptHR.id, level: 3 }).returning();
  const [desigHRE] = await db.insert(designationsTable).values({ name: "HR Executive", departmentId: deptHR.id, level: 2 }).returning();
  const [desigSM] = await db.insert(designationsTable).values({ name: "Sales Manager", departmentId: deptSales.id, level: 3 }).returning();
  const [desigSE] = await db.insert(designationsTable).values({ name: "Sales Executive", departmentId: deptSales.id, level: 2 }).returning();
  const [desigFE] = await db.insert(designationsTable).values({ name: "Field Executive", departmentId: deptSales.id, level: 1 }).returning();
  const [desigOPM] = await db.insert(designationsTable).values({ name: "Operations Manager", departmentId: deptOps.id, level: 3 }).returning();
  const [desigTL] = await db.insert(designationsTable).values({ name: "Team Leader", departmentId: deptSales.id, level: 2 }).returning();
  const [desigDev] = await db.insert(designationsTable).values({ name: "Software Developer", departmentId: deptIT.id, level: 2 }).returning();
  const [desigAcc] = await db.insert(designationsTable).values({ name: "Accountant", departmentId: deptAccounts.id, level: 2 }).returning();
  console.log("Designations created");

  // Employees
  const [emp1] = await db.insert(employeesTable).values({
    employeeId: "EMP001", firstName: "Ravi", lastName: "Kumar", email: "ravi.kumar@company.com",
    phone: "9876543210", role: "HR", status: "active", joiningDate: "2022-01-15",
    departmentId: deptHR.id, designationId: desigHRM.id,
    bankAccount: "1234567890", ifscCode: "HDFC0001234", bankName: "HDFC Bank",
    panNumber: "ABCPK1234D", address: "123, MG Road, Bengaluru",
  }).returning();

  const [emp2] = await db.insert(employeesTable).values({
    employeeId: "EMP002", firstName: "Priya", lastName: "Sharma", email: "priya.sharma@company.com",
    phone: "9876543211", role: "Manager", status: "active", joiningDate: "2021-06-01",
    departmentId: deptSales.id, designationId: desigSM.id,
    bankAccount: "0987654321", ifscCode: "ICIC0001234", bankName: "ICICI Bank",
  }).returning();

  const [emp3] = await db.insert(employeesTable).values({
    employeeId: "EMP003", firstName: "Amit", lastName: "Singh", email: "amit.singh@company.com",
    phone: "9876543212", role: "Field Executive", status: "active", joiningDate: "2023-03-10",
    departmentId: deptSales.id, designationId: desigFE.id, managerId: emp2.id,
  }).returning();

  const [emp4] = await db.insert(employeesTable).values({
    employeeId: "EMP004", firstName: "Sunita", lastName: "Verma", email: "sunita.verma@company.com",
    phone: "9876543213", role: "Field Executive", status: "active", joiningDate: "2023-07-01",
    departmentId: deptSales.id, designationId: desigFE.id, managerId: emp2.id,
  }).returning();

  const [emp5] = await db.insert(employeesTable).values({
    employeeId: "EMP005", firstName: "Rahul", lastName: "Gupta", email: "rahul.gupta@company.com",
    phone: "9876543214", role: "Desk Employee", status: "active", joiningDate: "2022-09-15",
    departmentId: deptIT.id, designationId: desigDev.id,
  }).returning();

  const [emp6] = await db.insert(employeesTable).values({
    employeeId: "EMP006", firstName: "Anjali", lastName: "Patel", email: "anjali.patel@company.com",
    phone: "9876543215", role: "HR", status: "active", joiningDate: "2023-01-20",
    departmentId: deptHR.id, designationId: desigHRE.id, managerId: emp1.id,
  }).returning();

  const [emp7] = await db.insert(employeesTable).values({
    employeeId: "EMP007", firstName: "Vikram", lastName: "Mehta", email: "vikram.mehta@company.com",
    phone: "9876543216", role: "Field Executive", status: "active", joiningDate: "2024-01-10",
    departmentId: deptSales.id, designationId: desigFE.id, managerId: emp2.id,
  }).returning();

  const [emp8] = await db.insert(employeesTable).values({
    employeeId: "EMP008", firstName: "Deepa", lastName: "Nair", email: "deepa.nair@company.com",
    phone: "9876543217", role: "Accounts", status: "active", joiningDate: "2022-04-01",
    departmentId: deptAccounts.id, designationId: desigAcc.id,
  }).returning();
  console.log("Employees created");

  // Salary Structures
  await db.insert(salaryStructuresTable).values([
    { employeeId: emp1.id, effectiveFrom: "2022-01-15", basic: 35000, hra: 14000, specialAllowance: 8000, conveyance: 2000 },
    { employeeId: emp2.id, effectiveFrom: "2021-06-01", basic: 45000, hra: 18000, specialAllowance: 12000, conveyance: 3000 },
    { employeeId: emp3.id, effectiveFrom: "2023-03-10", basic: 20000, hra: 8000, specialAllowance: 5000, conveyance: 1500 },
    { employeeId: emp4.id, effectiveFrom: "2023-07-01", basic: 20000, hra: 8000, specialAllowance: 5000, conveyance: 1500 },
    { employeeId: emp5.id, effectiveFrom: "2022-09-15", basic: 30000, hra: 12000, specialAllowance: 8000, conveyance: 2000 },
    { employeeId: emp6.id, effectiveFrom: "2023-01-20", basic: 22000, hra: 8800, specialAllowance: 5000, conveyance: 1500 },
    { employeeId: emp7.id, effectiveFrom: "2024-01-10", basic: 18000, hra: 7200, specialAllowance: 4000, conveyance: 1200 },
    { employeeId: emp8.id, effectiveFrom: "2022-04-01", basic: 28000, hra: 11200, specialAllowance: 6000, conveyance: 1800 },
  ]);
  console.log("Salary structures created");

  // Attendance — last 30 days
  const today = new Date();
  const employees = [emp1, emp2, emp3, emp4, emp5, emp6, emp7, emp8];
  const statuses = ["Present", "Present", "Present", "Present", "Late", "Half Day", "Absent", "WFH", "Outdoor Duty"];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

    const dateStr = date.toISOString().split("T")[0];

    for (const emp of employees) {
      const isField = [emp3, emp4, emp7].map((e) => e.id).includes(emp.id);
      const status = isField
        ? ["Outdoor Duty", "Outdoor Duty", "Present", "Present", "Late", "Absent"][Math.floor(Math.random() * 6)]
        : statuses[Math.floor(Math.random() * statuses.length)];

      const checkIn = new Date(date);
      checkIn.setHours(9 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));
      const checkOut = new Date(checkIn);
      checkOut.setHours(checkIn.getHours() + 7 + Math.floor(Math.random() * 2));

      await db.insert(attendanceTable).values({
        employeeId: emp.id,
        date: dateStr,
        status,
        checkInTime: status === "Absent" ? undefined : checkIn,
        checkOutTime: status === "Absent" ? undefined : checkOut,
        workingHours: status === "Absent" ? undefined : 7 + Math.random() * 2,
        eodSubmitted: isField && status !== "Absent",
        eodVisits: isField && status !== "Absent" ? Math.floor(Math.random() * 8) + 2 : undefined,
        eodKm: isField && status !== "Absent" ? Math.floor(Math.random() * 50) + 20 : undefined,
        eodLeads: isField && status !== "Absent" ? Math.floor(Math.random() * 5) : undefined,
        eodOrders: isField && status !== "Absent" ? Math.floor(Math.random() * 3) : undefined,
        eodCollection: isField && status !== "Absent" ? Math.floor(Math.random() * 50000) + 5000 : undefined,
        distanceTravelled: isField && status !== "Absent" ? Math.floor(Math.random() * 50) + 20 : undefined,
      }).onConflictDoNothing();
    }
  }
  console.log("Attendance seeded");

  // Leaves
  await db.insert(leavesTable).values([
    { employeeId: emp3.id, leaveType: "Sick", fromDate: "2026-05-20", toDate: "2026-05-21", days: 2, reason: "Fever and cold", status: "Approved", hrApproval: "approve", managerApproval: "approve", approvedBy: emp1.id },
    { employeeId: emp4.id, leaveType: "Casual", fromDate: "2026-06-10", toDate: "2026-06-10", days: 1, reason: "Personal work", status: "Pending" },
    { employeeId: emp5.id, leaveType: "Earned", fromDate: "2026-06-15", toDate: "2026-06-18", days: 4, reason: "Family vacation", status: "Pending" },
    { employeeId: emp6.id, leaveType: "Sick", fromDate: "2026-05-28", toDate: "2026-05-28", days: 1, reason: "Doctor appointment", status: "Approved", hrApproval: "approve", managerApproval: "approve", approvedBy: emp1.id },
    { employeeId: emp7.id, leaveType: "Casual", fromDate: "2026-06-20", toDate: "2026-06-20", days: 1, reason: "Marriage in family", status: "Rejected", rejectionReason: "Team understaffed" },
  ]);
  console.log("Leaves seeded");

  // Expenses
  await db.insert(expensesTable).values([
    { employeeId: emp3.id, category: "Fuel", amount: 850, date: "2026-06-05", description: "Field visit fuel", isAutoTravel: true, travelKm: 85, travelRate: 10, status: "Pending" },
    { employeeId: emp4.id, category: "Food", amount: 320, date: "2026-06-04", description: "Client lunch", status: "Manager Approved", managerApproval: "approve", approvedBy: emp2.id },
    { employeeId: emp7.id, category: "Toll", amount: 180, date: "2026-06-06", description: "Highway toll", isAutoTravel: false, status: "Pending" },
    { employeeId: emp3.id, category: "Hotel", amount: 2500, date: "2026-05-30", description: "Outstation client visit", status: "Pending" },
    { employeeId: emp5.id, category: "Miscellaneous", amount: 450, date: "2026-06-01", description: "Office supplies", status: "Manager Approved", managerApproval: "approve", approvedBy: emp2.id },
  ]);
  console.log("Expenses seeded");

  // Vendors
  const [v1] = await db.insert(vendorsTable).values({ name: "Sharma Distributors", contactPerson: "Rakesh Sharma", mobile: "9988776655", email: "rakesh@sharma.com", address: "45, Industrial Area, Pune", lat: 18.5204, lng: 73.8567, radius: 100 }).returning();
  const [v2] = await db.insert(vendorsTable).values({ name: "Delhi Traders Co", contactPerson: "Mohit Agarwal", mobile: "9988776644", email: "mohit@delhitraders.com", address: "12, Connaught Place, Delhi", lat: 28.6315, lng: 77.2167, radius: 150 }).returning();
  const [v3] = await db.insert(vendorsTable).values({ name: "Mumbai Wholesale Hub", contactPerson: "Suresh Bhai", mobile: "9988776633", email: "suresh@mumbaiwhls.com", address: "78, Crawford Market, Mumbai", lat: 18.9489, lng: 72.8341, radius: 200 }).returning();
  const [v4] = await db.insert(vendorsTable).values({ name: "Bangalore Tech Supplies", contactPerson: "Rajan Nair", mobile: "9988776622", email: "rajan@bangtechsup.com", address: "23, Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770, radius: 100 }).returning();
  const [v5] = await db.insert(vendorsTable).values({ name: "Hyderabad Enterprise", contactPerson: "Kishore Reddy", mobile: "9988776611", email: "kishore@hydent.com", address: "56, HITEC City, Hyderabad", lat: 17.4435, lng: 78.3772, radius: 120 }).returning();
  console.log("Vendors created");

  // Visits
  const recentDates = ["2026-06-05", "2026-06-04", "2026-06-03", "2026-06-02", "2026-06-01"];
  for (const emp of [emp3, emp4, emp7]) {
    for (const vDate of recentDates) {
      const vendors = [v1, v2, v3, v4, v5];
      const vendor = vendors[Math.floor(Math.random() * vendors.length)];
      await db.insert(visitsTable).values({
        employeeId: emp.id,
        vendorId: vendor.id,
        visitDate: vDate,
        checkInTime: new Date(`${vDate}T10:00:00Z`),
        selfieUrl: "https://placehold.co/100x100",
        lat: vendor.lat ? vendor.lat + (Math.random() - 0.5) * 0.01 : undefined,
        lng: vendor.lng ? vendor.lng + (Math.random() - 0.5) * 0.01 : undefined,
        remarks: "Client meeting",
        orderValue: Math.floor(Math.random() * 50000) + 10000,
        status: Math.random() > 0.2 ? "Valid" : "Invalid",
        invalidReason: undefined,
      });
    }
  }
  console.log("Visits seeded");

  // Jobs
  const [job1] = await db.insert(jobsTable).values({ title: "Senior Sales Executive", departmentId: deptSales.id, description: "Looking for experienced sales executive", location: "Mumbai", experienceMin: 2, experienceMax: 5, salaryMin: 25000, salaryMax: 40000, openings: 3, postedDate: "2026-05-15", status: "Open" }).returning();
  const [job2] = await db.insert(jobsTable).values({ title: "HR Executive", departmentId: deptHR.id, description: "HR executive for talent acquisition", location: "Bengaluru", experienceMin: 1, experienceMax: 3, salaryMin: 20000, salaryMax: 30000, openings: 1, postedDate: "2026-06-01", status: "Open" }).returning();
  const [job3] = await db.insert(jobsTable).values({ title: "Field Executive", departmentId: deptSales.id, description: "Field sales executive for Delhi NCR", location: "Delhi", experienceMin: 0, experienceMax: 2, salaryMin: 15000, salaryMax: 22000, openings: 5, postedDate: "2026-05-20", status: "Open" }).returning();
  console.log("Jobs created");

  // Applicants
  await db.insert(applicantsTable).values([
    { jobId: job1.id, name: "Karan Malhotra", email: "karan@gmail.com", phone: "9900112233", experience: 3, currentCtc: 28000, expectedCtc: 38000, noticePeriod: 30, status: "Shortlisted", source: "LinkedIn" },
    { jobId: job1.id, name: "Neha Joshi", email: "neha@gmail.com", phone: "9900112244", experience: 4, currentCtc: 35000, expectedCtc: 42000, noticePeriod: 60, status: "Interview", source: "Naukri", interviewDate: "2026-06-12" },
    { jobId: job1.id, name: "Rohit Bansal", email: "rohit@gmail.com", phone: "9900112255", experience: 2, currentCtc: 22000, expectedCtc: 30000, status: "Applied", source: "Direct" },
    { jobId: job2.id, name: "Shruti Kapoor", email: "shruti@gmail.com", phone: "9900112266", experience: 2, currentCtc: 20000, expectedCtc: 28000, status: "Shortlisted", source: "LinkedIn" },
    { jobId: job3.id, name: "Raj Yadav", email: "raj@gmail.com", phone: "9900112277", experience: 1, currentCtc: 14000, expectedCtc: 18000, status: "Applied", source: "Newspaper" },
    { jobId: job3.id, name: "Pooja Singh", email: "pooja@gmail.com", phone: "9900112288", experience: 0, currentCtc: 0, expectedCtc: 16000, status: "Selected", source: "Campus" },
  ]);
  console.log("Applicants seeded");

  // Holidays
  await db.insert(holidaysTable).values([
    { name: "Republic Day", date: "2026-01-26", type: "National", isOptional: false },
    { name: "Holi", date: "2026-03-20", type: "National", isOptional: false },
    { name: "Good Friday", date: "2026-04-03", type: "Optional", isOptional: true },
    { name: "Dr. Ambedkar Jayanti", date: "2026-04-14", type: "National", isOptional: false },
    { name: "Labour Day", date: "2026-05-01", type: "National", isOptional: false },
    { name: "Eid ul-Fitr", date: "2026-03-30", type: "Optional", isOptional: true },
    { name: "Independence Day", date: "2026-08-15", type: "National", isOptional: false },
    { name: "Ganesh Chaturthi", date: "2026-08-23", type: "Optional", isOptional: true },
    { name: "Gandhi Jayanti", date: "2026-10-02", type: "National", isOptional: false },
    { name: "Dussehra", date: "2026-10-22", type: "Optional", isOptional: true },
    { name: "Diwali", date: "2026-11-11", type: "National", isOptional: false },
    { name: "Christmas", date: "2026-12-25", type: "Optional", isOptional: true },
  ]);
  console.log("Holidays seeded");

  // Office locations
  await db.insert(officeLocationsTable).values([
    { name: "HQ - Bengaluru", lat: 12.9716, lng: 77.5946, radius: 100, requireApproval: false, isActive: true },
    { name: "Branch - Mumbai", lat: 19.0760, lng: 72.8777, radius: 150, requireApproval: false, isActive: true },
    { name: "Branch - Delhi", lat: 28.6139, lng: 77.2090, radius: 120, requireApproval: true, isActive: true },
  ]);
  console.log("Office locations seeded");

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
