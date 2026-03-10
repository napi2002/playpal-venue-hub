import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/apiClient";
import { useVenue } from "@/hooks/useVenue";
import { useCourts } from "@/hooks/useCourts";
import { toast } from "sonner";

type CourtAccount = {
  id: number;
  court_id: number;
  court_name: string;
  username: string;
  login_email: string;
  plan: "free" | "pro" | "custom";
  plan_notes: string | null;
  is_active: boolean;
  invite_sent_at: string | null;
  password_reset_sent_at: string | null;
  full_name: string | null;
};

const emptyForm = {
  courtId: "",
  fullName: "",
  username: "",
  email: "",
  temporaryPassword: "",
  plan: "free" as "free" | "pro" | "custom",
  planNotes: "",
};

const CourtManagement = () => {
  const queryClient = useQueryClient();
  const { venue } = useVenue();
  const { courts } = useCourts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CourtAccount | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["court-accounts", venue?.id],
    enabled: !!venue?.id,
    queryFn: async () => {
      const data = await apiFetch(`/api/venues/${venue?.id}/court-accounts`);
      return Array.isArray(data) ? (data as CourtAccount[]) : [];
    },
  });

  const unassignedCourts = useMemo(() => {
    const assigned = new Set(accounts.map((account) => account.court_id));
    return courts.filter((court) => !assigned.has(Number(court.id)) || Number(court.id) === editing?.court_id);
  }, [accounts, courts, editing?.court_id]);

  const saveAccount = useMutation({
    mutationFn: async () => {
      if (!venue?.id) throw new Error("Venue not found");

      const payload = {
        courtId: Number(form.courtId),
        fullName: form.fullName.trim() || null,
        username: form.username.trim(),
        email: form.email.trim(),
        temporaryPassword: form.temporaryPassword,
        plan: form.plan,
        planNotes: form.planNotes.trim() || null,
      };

      if (editing) {
        return apiFetch(`/api/court-accounts/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({
            username: payload.username,
            email: payload.email,
            temporaryPassword: payload.temporaryPassword || undefined,
            plan: payload.plan,
            planNotes: payload.planNotes,
          }),
        });
      }

      return apiFetch(`/api/venues/${venue.id}/court-accounts`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["court-accounts"] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success("Court portal account saved");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to save court account");
    },
  });

  const resendInvite = useMutation({
    mutationFn: async (account: CourtAccount) => {
      return apiFetch(`/api/court-accounts/${account.id}`, {
        method: "PUT",
        body: JSON.stringify({ resendPasswordEmail: true }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["court-accounts"] });
      toast.success("Password setup email sent");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to send email");
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (account: CourtAccount) => {
    setEditing(account);
    setForm({
      courtId: String(account.court_id),
      fullName: account.full_name ?? "",
      username: account.username,
      email: account.login_email,
      temporaryPassword: "",
      plan: account.plan,
      planNotes: account.plan_notes ?? "",
    });
    setOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Court Management</h1>
            <p className="mt-1 text-muted-foreground">
              Create login accounts for each court and track their plan.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="cta" onClick={openCreate}>Create court account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit court account" : "Create court account"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Court</Label>
                  <Select
                    value={form.courtId}
                    onValueChange={(value) => setForm((current) => ({ ...current, courtId: value }))}
                    disabled={!!editing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a court" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedCourts.map((court) => (
                        <SelectItem key={court.id} value={String(court.id)}>
                          {court.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Contact name</Label>
                  <Input
                    value={form.fullName}
                    onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                    placeholder="Court manager name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Username</Label>
                  <Input
                    value={form.username}
                    onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                    placeholder="court-a1"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="court-a1@example.com"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Temporary password</Label>
                  <Input
                    type="password"
                    value={form.temporaryPassword}
                    onChange={(event) => setForm((current) => ({ ...current, temporaryPassword: event.target.value }))}
                    placeholder={editing ? "Leave blank to keep current password" : "Minimum 8 characters"}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Plan</Label>
                  <Select
                    value={form.plan}
                    onValueChange={(value: "free" | "pro" | "custom") =>
                      setForm((current) => ({ ...current, plan: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Plan notes</Label>
                  <Textarea
                    value={form.planNotes}
                    onChange={(event) => setForm((current) => ({ ...current, planNotes: event.target.value }))}
                    placeholder="Custom plan details, limits, or notes"
                  />
                </div>

                <Button
                  variant="cta"
                  onClick={() => saveAccount.mutate()}
                  disabled={saveAccount.isPending}
                >
                  {saveAccount.isPending ? "Saving..." : editing ? "Save changes" : "Create account and send email"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Court Accounts</CardTitle>
            <CardDescription>
              {accounts.length} configured {accounts.length === 1 ? "account" : "accounts"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading court accounts...</p>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No court portal accounts created yet.</p>
            ) : (
              accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{account.court_name}</p>
                      <Badge variant="secondary" className="capitalize">{account.plan}</Badge>
                      {!account.is_active ? <Badge variant="outline">Inactive</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {account.username} · {account.login_email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {account.plan_notes || "No plan notes"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => resendInvite.mutate(account)} disabled={resendInvite.isPending}>
                      Send password email
                    </Button>
                    <Button variant="outline" onClick={() => openEdit(account)}>
                      Edit
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CourtManagement;
