"use client";
import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconMapPin } from "@tabler/icons-react";

export function BranchSwitcher({ disabled }: { disabled?: boolean }) {
  const [mounted, setMounted] = React.useState(false);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = React.useState<string>("");
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";

  React.useEffect(() => {
    setMounted(true);
    const fetchBranches = async () => {
      try {
        const res = await fetch(`${API}/branches`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
          const data = await res.json();
          const userStr = localStorage.getItem("user");
          const user = userStr ? JSON.parse(userStr) : null;
          const isAdmin = user?.role === "ownerpos" || user?.role === "admin";
          
          let filteredBranches = data;
          if (!isAdmin && user?.branchIds && user.branchIds.length > 0) {
            filteredBranches = data.filter((b: any) => user.branchIds.includes(b.id));
          }
          
          setBranches(filteredBranches);
          
          // Load selected branch from local storage or pick main
          const savedBranchId = localStorage.getItem("currentBranchId");
          if (savedBranchId && filteredBranches.some((b: any) => b.id === savedBranchId)) {
            setSelectedBranch(savedBranchId);
          } else if (filteredBranches.length > 0) {
            const main = filteredBranches.find((b: any) => b.isMain) || filteredBranches[0];
            setSelectedBranch(main.id);
            localStorage.setItem("currentBranchId", main.id);
          }
        }
      } catch (error) {
        console.error("Error fetching branches:", error);
      }
    };
    fetchBranches();

    // Listen for branch updates to refresh the list automatically
    window.addEventListener("branchUpdated", fetchBranches);
    return () => window.removeEventListener("branchUpdated", fetchBranches);
  }, [API]);

  const handleBranchChange = (value: string) => {
    setSelectedBranch(value);
    localStorage.setItem("currentBranchId", value);
    // Reload page to refresh all data with branch context
    window.location.reload();
  };

  if (!mounted || branches.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 pr-2 ${disabled ? 'opacity-60 grayscale' : ''}`}>
      <IconMapPin size={16} className="text-muted-foreground" />
      <Select value={selectedBranch} onValueChange={handleBranchChange} disabled={disabled}>
        <SelectTrigger className="w-[180px] h-8 text-xs font-semibold border-none bg-muted/50 hover:bg-muted transition-colors shadow-none">
          <SelectValue placeholder="Seleccionar Sucursal" />
        </SelectTrigger>
        <SelectContent>
          {branches.map((b, index) => (
            <SelectItem key={b.id || `branch-${index}-${b.name}`} value={b.id || `branch-${index}`} className="text-xs">
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
