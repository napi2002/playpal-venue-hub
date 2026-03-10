import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/apiClient";
import { toast } from "sonner";

type VenueDetail = {
  venue: Record<string, unknown> & {
    id: number;
    name: string;
    province: string | null;
    city: string | null;
    email: string | null;
    phone: string | null;
    venue_type: string | null;
    courts_count: number;
  };
  admins: Array<{
    id: number;
    name: string | null;
    email: string;
    last_login: string | null;
    status: string;
  }>;
  metrics: {
    total_bookings: number;
    total_gmv: string;
    total_commission: string;
    bookings_30d: number;
  } | null;
};

const InternalVenueDetail = () => {
  const { venueId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["internal-venue-detail", venueId],
    enabled: !!venueId,
    queryFn: async () => (await apiFetch(`/api/internal/venues/${venueId}`)) as VenueDetail,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["internal-users-by-venue", venueId],
    enabled: !!venueId,
    queryFn: async () => (await apiFetch(`/api/internal/users?venueId=${venueId}`)) as Array<{
      id: number;
      plan: "starter" | "growth" | "pro" | "custom";
      commission_percent: number;
      monthly_fee_thb: number;
      months_paid: number;
      created_at: string;
      expires_at: string | null;
      status: "Active" | "Suspended";
    }>,
  });

  const primaryPlan = users[0];

  const disableAdmin = useMutation({
    mutationFn: async (id: number) => {
      const target = users.find((user) => user.id === id);
      if (!target) throw new Error("Admin not found");
      await apiFetch(`/api/court-accounts/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          plan: target.plan,
          commissionPercent: target.commission_percent,
          monthlyFeeThb: target.monthly_fee_thb,
          isActive: false,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-venue-detail", venueId] });
      queryClient.invalidateQueries({ queryKey: ["internal-users-by-venue", venueId] });
      toast.success("Admin disabled");
    },
  });

  if (isLoading || !data) {
    return (
      <DashboardLayout>
        <div className="text-sm text-slate-500">Loading venue details...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 text-[#1B1F23]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">{data.venue.name}</h1>
            <p className="mt-1 text-sm text-slate-500">Venue operational detail</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/users")}>Back to Users</Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-xl">Venue Information</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p>Location: <span className="font-medium">{data.venue.city || "—"}, {data.venue.province || "—"}</span></p>
              <p>Sports type: <span className="font-medium">{data.venue.venue_type || "—"}</span></p>
              <p>Number of courts: <span className="font-medium">{data.venue.courts_count}</span></p>
              <p>Contact info: <span className="font-medium">{data.venue.email || "—"} · {data.venue.phone || "—"}</span></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-xl">Venue Activity</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p>Total bookings: <span className="font-medium">{data.metrics?.total_bookings ?? 0}</span></p>
              <p>Total GMV: <span className="font-medium">THB {Number(data.metrics?.total_gmv ?? 0).toLocaleString()}</span></p>
              <p>Total commission generated: <span className="font-medium">THB {Number(data.metrics?.total_commission ?? 0).toLocaleString()}</span></p>
              <p>Bookings last 30 days: <span className="font-medium">{data.metrics?.bookings_30d ?? 0}</span></p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-xl">Admin Accounts</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-2">
              <Button className="bg-[#FF7A33] text-white hover:bg-[#e56f2f]" onClick={() => navigate(`/users?venueId=${venueId}`)}>Create Admin</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell>{admin.name || "—"}</TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>{admin.last_login ? new Date(admin.last_login).toLocaleString() : "—"}</TableCell>
                    <TableCell>{admin.status}</TableCell>
                    <TableCell><Button variant="outline" size="sm" onClick={() => disableAdmin.mutate(admin.id)}>Disable Admin</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-xl">Plan Settings</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>Plan type: <span className="font-medium capitalize">{primaryPlan?.plan || "—"}</span></p>
            <p>Monthly subscription fee: <span className="font-medium">THB {Number(primaryPlan?.monthly_fee_thb ?? 0).toLocaleString()}</span></p>
            <p>Commission percentage: <span className="font-medium">{primaryPlan?.commission_percent ?? 0}%</span></p>
            <p>Months paid: <span className="font-medium">{primaryPlan?.months_paid ?? 0}</span></p>
            <p>Created on: <span className="font-medium">{primaryPlan?.created_at ? new Date(primaryPlan.created_at).toLocaleDateString() : "—"}</span></p>
            <p>Package expiry: <span className="font-medium">{primaryPlan?.expires_at ? new Date(primaryPlan.expires_at).toLocaleDateString() : "—"}</span></p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate("/plans")}>Update Plan</Button>
              <Button variant="outline" onClick={() => navigate("/plans")}>Add Plan</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default InternalVenueDetail;
