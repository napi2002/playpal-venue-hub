import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/apiClient";
import { toast } from "sonner";

type PlanType = "starter" | "growth" | "pro" | "custom";

type PlanRow = {
  id: number;
  venue_id: number;
  venue_name: string;
  admin_account_name: string | null;
  admin_email: string;
  plan: PlanType;
  commission_percent: number;
  monthly_fee_thb: number;
  months_paid: number;
  status: "Active" | "Suspended";
  created_at: string;
  expires_at: string | null;
  expiry_status: "Active" | "Expiring Soon" | "Expired";
};

const defaultForm = {
  accountId: "",
  plan: "starter" as PlanType,
  monthlyFeeThb: "0",
  commissionPercent: "10",
  monthsPaid: "0",
};

const PlansPage = () => {
  const queryClient = useQueryClient();
  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [form, setForm] = useState(defaultForm);

  const { data: rows = [] } = useQuery({
    queryKey: ["internal-users", "plans"],
    queryFn: async () => (await apiFetch("/api/internal/users")) as PlanRow[],
  });

  const updatePlan = useMutation({
    mutationFn: async (payload: {
      id: number;
      plan: PlanType;
      commissionPercent: number;
      monthlyFeeThb: number;
      monthsPaid: number;
    }) => {
      await apiFetch(`/api/court-accounts/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-users"] });
      queryClient.invalidateQueries({ queryKey: ["internal-overview"] });
      queryClient.invalidateQueries({ queryKey: ["internal-revenue"] });
      setEditing(null);
      toast.success("Plan updated");
    },
  });

  const addPlan = useMutation({
    mutationFn: async () => {
      const target = rows.find((row) => String(row.id) === form.accountId);
      if (!target) throw new Error("Select a venue admin first");
      await apiFetch(`/api/court-accounts/${target.id}`, {
        method: "PUT",
        body: JSON.stringify({
          plan: form.plan,
          commissionPercent: Number(form.commissionPercent),
          monthlyFeeThb: Number(form.monthlyFeeThb),
          monthsPaid: Number(form.monthsPaid),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-users"] });
      queryClient.invalidateQueries({ queryKey: ["internal-overview"] });
      queryClient.invalidateQueries({ queryKey: ["internal-revenue"] });
      setOpenAdd(false);
      setForm(defaultForm);
      toast.success("Plan assigned");
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Failed to assign plan"),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 text-[#1B1F23]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Plans</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage package type, monthly fee, commission, and paid duration for each venue admin.
            </p>
          </div>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button className="bg-[#FF7A33] text-white hover:bg-[#e56f2f]">Add Plan</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Plan</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Venue Admin</Label>
                  <Select value={form.accountId} onValueChange={(value) => setForm((current) => ({ ...current, accountId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select venue admin" /></SelectTrigger>
                    <SelectContent>
                      {rows.map((row) => (
                        <SelectItem key={row.id} value={String(row.id)}>
                          {row.venue_name} · {row.admin_email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Plan</Label>
                  <Select value={form.plan} onValueChange={(value: PlanType) => setForm((current) => ({ ...current, plan: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="growth">Growth</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label>Monthly Fee (THB)</Label>
                    <Input value={form.monthlyFeeThb} onChange={(e) => setForm((current) => ({ ...current, monthlyFeeThb: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Commission %</Label>
                    <Input value={form.commissionPercent} onChange={(e) => setForm((current) => ({ ...current, commissionPercent: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Months Paid</Label>
                    <Input value={form.monthsPaid} onChange={(e) => setForm((current) => ({ ...current, monthsPaid: e.target.value }))} />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Monthly fee is the venue subscription amount. Commission is the percentage of bookings collected by PlayPal.
                </p>
                <Button className="bg-[#FF7A33] text-white hover:bg-[#e56f2f]" onClick={() => addPlan.mutate()} disabled={addPlan.isPending}>
                  {addPlan.isPending ? "Saving..." : "Save Plan"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-xl">Plan Settings</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venue</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Monthly Fee</TableHead>
                  <TableHead>Commission %</TableHead>
                  <TableHead>Months Paid</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.venue_name}</TableCell>
                    <TableCell>{row.admin_account_name || row.admin_email}</TableCell>
                    <TableCell className="capitalize">{row.plan}</TableCell>
                    <TableCell>THB {Number(row.monthly_fee_thb).toLocaleString()}</TableCell>
                    <TableCell>{row.commission_percent}%</TableCell>
                    <TableCell>{row.months_paid}</TableCell>
                    <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{row.expires_at ? new Date(row.expires_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>{row.expiry_status}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing(row)}>Update Plan</Button>
                        <Button variant="outline" size="sm" onClick={() => setEditing(row)}>Override Commission</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-xl">Plan Notes</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm text-slate-600 md:grid-cols-3">
            <div>
              <p className="font-medium text-[#1B1F23]">Monthly Fee</p>
              <p>Fixed subscription billed to the venue each month.</p>
            </div>
            <div>
              <p className="font-medium text-[#1B1F23]">Commission %</p>
              <p>Platform share deducted from booking GMV.</p>
            </div>
            <div>
              <p className="font-medium text-[#1B1F23]">Months Paid</p>
              <p>Contract duration counted from the account creation date.</p>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!editing} onOpenChange={(next) => !next && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Plan</DialogTitle>
            </DialogHeader>
            {editing ? (
              <div className="grid gap-4">
                <div className="text-sm text-slate-500">
                  {editing.venue_name} · {editing.admin_email}
                </div>
                <div className="grid gap-2">
                  <Label>Plan</Label>
                  <Select value={editing.plan} onValueChange={(value: PlanType) => setEditing({ ...editing, plan: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="growth">Growth</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label>Monthly Fee (THB)</Label>
                    <Input value={String(editing.monthly_fee_thb)} onChange={(e) => setEditing({ ...editing, monthly_fee_thb: Number(e.target.value || 0) })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Commission %</Label>
                    <Input value={String(editing.commission_percent)} onChange={(e) => setEditing({ ...editing, commission_percent: Number(e.target.value || 0) })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Months Paid</Label>
                    <Input value={String(editing.months_paid)} onChange={(e) => setEditing({ ...editing, months_paid: Number(e.target.value || 0) })} />
                  </div>
                </div>
                <Button className="bg-[#FF7A33] text-white hover:bg-[#e56f2f]" onClick={() => updatePlan.mutate({
                  id: editing.id,
                  plan: editing.plan,
                  commissionPercent: editing.commission_percent,
                  monthlyFeeThb: editing.monthly_fee_thb,
                  monthsPaid: editing.months_paid,
                })}>
                  Save Changes
                </Button>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PlansPage;
