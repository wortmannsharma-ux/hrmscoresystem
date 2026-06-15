import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  employeeId?: string;
  [key: string]: any;
}

interface SearchableEmployeeSelectProps {
  employees: Employee[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  allowAll?: boolean;
}

export function SearchableEmployeeSelect({
  employees = [],
  value,
  onValueChange,
  placeholder = "Search employee...",
  className,
  allowAll = false,
}: SearchableEmployeeSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Sync search input text with the selected employee
  useEffect(() => {
    if (value === "all" || value === "") {
      setSearch("");
    } else {
      const selected = employees.find((emp) => emp.id.toString() === value);
      if (selected) {
        setSearch(`${selected.firstName} ${selected.lastName}`);
      }
    }
  }, [value, employees]);

  const filtered = employees.filter((emp) => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
    const empIdStr = emp.employeeId ? emp.employeeId.toLowerCase() : "";
    const query = search.toLowerCase();
    return fullName.includes(query) || empIdStr.includes(query);
  });

  return (
    <div className={cn("relative w-full", className)}>
      <Input
        placeholder={placeholder}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // small timeout to allow click to trigger on button click
          setTimeout(() => {
            setIsOpen(false);
            // reset search text to selected employee name if focus is lost and search query was edited but not selected
            if (value === "all" || value === "") {
              setSearch("");
            } else {
              const selected = employees.find((emp) => emp.id.toString() === value);
              if (selected) {
                setSearch(`${selected.firstName} ${selected.lastName}`);
              }
            }
          }, 200);
        }}
      />
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {allowAll && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors font-medium"
              onClick={() => {
                onValueChange("all");
                setSearch("");
                setIsOpen(false);
              }}
            >
              All Employees
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="py-2 px-3 text-sm text-muted-foreground">No employee found</div>
          ) : (
            filtered.map((emp) => (
              <button
                key={emp.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between"
                onClick={() => {
                  onValueChange(emp.id.toString());
                  setSearch(`${emp.firstName} ${emp.lastName}`);
                  setIsOpen(false);
                }}
              >
                <span>{emp.firstName} {emp.lastName}</span>
                {emp.employeeId && (
                  <span className="text-xs text-muted-foreground font-mono">{emp.employeeId}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
