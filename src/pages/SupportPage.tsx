import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/apiClient";

type UserRow = {
  id: number;
  venue_name: string;
  admin_email: string;
  status: "Active" | "Suspended";
};

type BookingRow = {
  id: number;
  booking_id: string;
  venue: string | null;
  player: string | null;
  status: string;
};

const SupportPage = () => {
  const { data: users = [] } = useQuery({
    queryKey: ["support-users"],
    queryFn: async () => (await apiFetch("/api/internal/users?status=suspended")) as UserRow[],
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["support-bookings"],
    queryFn: async () => (await apiFetch("/api/internal/bookings?status=pending")) as BookingRow[],
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 text-[#1B1F23]">
        <div>
          <h1 className="text-3xl font-semibold">Support</h1>
          <p className="mt-1 text-sm text-slate-500">Operational exceptions and accounts needing follow-up.</p>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-xl">Suspended Accounts</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venue</TableHead>
                    <TableHead>Admin Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.venue_name}</TableCell>
                      <TableCell>{user.admin_email}</TableCell>
                      <TableCell>{user.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-xl">Pending Bookings</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.slice(0, 20).map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>{booking.booking_id}</TableCell>
                      <TableCell>{booking.venue}</TableCell>
                      <TableCell>{booking.player}</TableCell>
                      <TableCell className="capitalize">{booking.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SupportPage;
