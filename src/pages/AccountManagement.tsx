import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/apiClient";
import { toast } from "sonner";

type PlanType = "starter" | "growth" | "pro" | "custom";

type UserRow = {
  id: number;
  portal_account_id: number | null;
  account_source: "portal" | "owner";
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

type Venue = {
  id: number;
  name: string;
};

const defaultForm = {
  venueId: "",
  fullName: "",
  username: "",
  email: "",
  temporaryPassword: "",
  plan: "starter" as PlanType,
  commissionPercent: "10",
  monthlyFeeThb: "0",
  monthsPaid: "0",
};

const planDefaults: Record<PlanType, { commissionPercent: string; monthlyFeeThb: string }> = {
  starter: { commissionPercent: "10", monthlyFeeThb: "0" },
  growth: { commissionPercent: "8", monthlyFeeThb: "600" },
  pro: { commissionPercent: "5", monthlyFeeThb: "1200" },
  custom: { commissionPercent: "0", monthlyFeeThb: "0" },
};

const AccountManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const presetVenueId = searchParams.get("venueId") ?? "";
  const [filters, setFilters] = useState({
    plan: "all",
    status: "all",
    q: "",
  });
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ ...defaultForm, venueId: presetVenueId });

  const { data: venues = [] } = useQuery({
    queryKey: ["internal-venues"],
    queryFn: async () => (await apiFetch("/api/internal/venues")) as Venue[],
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["internal-users", filters, presetVenueId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("includeExisting", "true");
      if (filters.plan !== "all") params.set("plan", filters.plan);
      if (filters.status !== "all") params.set("status", filters.status.toLowerCase());
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (presetVenueId) params.set("venueId", presetVenueId);
      return (await apiFetch(`/api/internal/users?${params.toString()}`)) as UserRow[];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const refetchKeys = () => {
    queryClient.invalidateQueries({ queryKey: ["internal-users"] });
    queryClient.invalidateQueries({ queryKey: ["internal-venues"] });
    queryClient.invalidateQueries({ queryKey: ["internal-overview"] });
    queryClient.invalidateQueries({ queryKey: ["internal-revenue"] });
    queryClient.invalidateQueries({ queryKey: ["internal-venue-detail"] });
  };

  const createAdmin = useMutation({
    mutationFn: async () => {
      await apiFetch(`/api/venues/${form.venueId}/court-accounts`, {
        method: "POST",
        body: JSON.stringify({
          fullName: form.fullName,
          username: form.username,
          email: form.email,
          temporaryPassword: form.temporaryPassword,
          plan: form.plan,
          commissionPercent: Number(form.commissionPercent),
          monthlyFeeThb: Number(form.monthlyFeeThb),
          monthsPaid: Number(form.monthsPaid),
        }),
      });
    },
    onSuccess: () => {
      refetchKeys();
      setOpenCreate(false);
      setForm({ ...defaultForm, venueId: presetVenueId });
      toast.success("Venue admin created");
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Failed to create venue admin"),
  });

  const updateAdmin = useMutation({
    mutationFn: async (payload: {
      id: number;
      plan: PlanType;
      commissionPercent: number;
      monthlyFeeThb: number;
      monthsPaid: number;
      isActive?: boolean;
    }) => {
      await apiFetch(`/api/court-accounts/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      refetchKeys();
      setEditing(null);
      toast.success("Account updated");
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Failed to update account"),
  });

  const venueLabel = useMemo(
    () => venues.find((venue) => String(venue.id) === presetVenueId)?.name ?? null,
    [presetVenueId, venues],
  );

  const handlePlanChange = (plan: PlanType) => {
    const defaults = planDefaults[plan];
    setForm((current) => ({
      ...current,
      plan,
      commissionPercent: plan === "custom" ? current.commissionPercent : defaults.commissionPercent,
      monthlyFeeThb: plan === "custom" ? current.monthlyFeeThb : defaults.monthlyFeeThb,
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 text-[#1B1F23]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Users</h1>
            <p className="mt-1 text-sm text-slate-500">
              Venue admin accounts, plans, commission settings, and subscription expiry.
            </p>
            {venueLabel ? <p className="mt-1 text-sm text-slate-500">Filtered to {venueLabel}</p> : null}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/plans")}>Add Plan</Button>
            <Dialog
              open={openCreate}
              onOpenChange={(next) => {
                setOpenCreate(next);
                if (!next) setForm({ ...defaultForm, venueId: presetVenueId });
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-[#FF7A33] text-white hover:bg-[#e56f2f]">Create Venue Admin</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Venue Admin</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Venue</Label>
                    <Select value={form.venueId} onValueChange={(value) => setForm((current) => ({ ...current, venueId: value }))}>
                      <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                      <SelectContent>
                        {venues.map((venue) => <SelectItem key={venue.id} value={String(venue.id)}>{venue.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input placeholder="Admin name" value={form.fullName} onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))} />
                  <Input placeholder="Admin email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} />
                  <Input placeholder="Username" value={form.username} onChange={(e) => setForm((current) => ({ ...current, username: e.target.value }))} />
                  <Input type="password" placeholder="Temporary password" value={form.temporaryPassword} onChange={(e) => setForm((current) => ({ ...current, temporaryPassword: e.target.value }))} />
                  <div className="grid gap-2">
                    <Label>Plan</Label>
                    <Select value={form.plan} onValueChange={handlePlanChange}>
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
                    Monthly fee is the subscription charge. Commission is the percentage PlayPal keeps from bookings.
                  </p>
                  <Button className="bg-[#FF7A33] text-white hover:bg-[#e56f2f]" onClick={() => createAdmin.mutate()} disabled={createAdmin.isPending}>
                    {createAdmin.isPending ? "Creating..." : "Create Venue Admin"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Input placeholder="Search venue or email" value={filters.q} onChange={(e) => setFilters((current) => ({ ...current, q: e.target.value }))} />
              <Select value={filters.plan} onValueChange={(value) => setFilters((current) => ({ ...current, plan: value }))}>
                <SelectTrigger><SelectValue placeholder="Plan filter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}>
                <SelectTrigger><SelectValue placeholder="Status filter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Venue Admin Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venue Name</TableHead>
                  <TableHead>Admin Account Name</TableHead>
                  <TableHead>Admin Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Monthly Fee</TableHead>
                  <TableHead>Commission %</TableHead>
                  <TableHead>Months Paid</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={11}>Loading users...</TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={11}>No venue admins found.</TableCell></TableRow>
                ) : users.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.venue_name}</TableCell>
                    <TableCell>{row.admin_account_name || "—"}</TableCell>
                    <TableCell>{row.admin_email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="capitalize">{row.plan}</Badge>
                        {row.account_source === "owner" ? <span className="text-xs text-slate-500">Existing admin</span> : null}
                      </div>
                    </TableCell>
                    <TableCell>THB {Number(row.monthly_fee_thb).toLocaleString()}</TableCell>
                    <TableCell>{row.commission_percent}%</TableCell>
                    <TableCell>{row.months_paid}</TableCell>
                    <TableCell>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {row.expires_at ? (
                        <div className="text-sm">
                          <div>{new Date(row.expires_at).toLocaleDateString()}</div>
                          <div className="text-xs text-slate-500">{row.expiry_status}</div>
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell><Badge variant={row.status === "Active" ? "secondary" : "outline"}>{row.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/users/${row.venue_id}`)}>View Venue</Button>
                        {row.portal_account_id ? (
                          <>
                            <Button variant="outline" size="sm" onClick={() => setEditing(row)}>Edit Plan</Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateAdmin.mutate({
                                id: row.portal_account_id,
                                plan: row.plan,
                                commissionPercent: row.commission_percent,
                                monthlyFeeThb: row.monthly_fee_thb,
                                monthsPaid: row.months_paid,
                                isActive: row.status !== "Active",
                              })}
                            >
                              {row.status === "Active" ? "Suspend Account" : "Activate Account"}
                            </Button>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => navigate(`/users/${row.venue_id}`)}>Existing Admin</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!editing} onOpenChange={(next) => !next && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Plan</DialogTitle>
            </DialogHeader>
            {editing ? (
              <div className="grid gap-4">
                <div className="text-sm text-slate-500">{editing.venue_name} · {editing.admin_email}</div>
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
                <p className="text-xs text-slate-500">
                  Monthly fee is the venue subscription. Commission is PlayPal&apos;s booking share.
                </p>
                <Button className="bg-[#FF7A33] text-white hover:bg-[#e56f2f]" onClick={() => updateAdmin.mutate({
                  id: editing.portal_account_id ?? editing.id,
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

export default AccountManagement;
