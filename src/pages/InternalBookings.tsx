import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/apiClient";

type BookingRow = {
  id: number;
  booking_id: string;
  venue: string | null;
  court: string | null;
  player: string | null;
  booking_time: string;
  price: number;
  commission: number;
  status: string;
};

type Venue = { id: number; name: string };

const InternalBookings = () => {
  const [filters, setFilters] = useState({ start: "", end: "", venueId: "all", status: "all", q: "" });

  const { data: venues = [] } = useQuery({
    queryKey: ["internal-venues"],
    queryFn: async () => (await apiFetch("/api/internal/venues")) as Venue[],
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.start) params.set("start", new Date(filters.start).toISOString());
    if (filters.end) params.set("end", new Date(filters.end).toISOString());
    if (filters.venueId !== "all") params.set("venueId", filters.venueId);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.q.trim()) params.set("q", filters.q.trim());
    return params.toString();
  }, [filters]);

  const { data: bookings = [] } = useQuery({
    queryKey: ["internal-bookings", queryString],
    queryFn: async () => (await apiFetch(`/api/internal/bookings?${queryString}`)) as BookingRow[],
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 text-[#1B1F23]">
        <div>
          <h1 className="text-3xl font-semibold">Bookings</h1>
          <p className="mt-1 text-sm text-slate-500">Operational booking monitor across all venues.</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-5">
              <Input type="date" value={filters.start} onChange={(e) => setFilters((current) => ({ ...current, start: e.target.value }))} />
              <Input type="date" value={filters.end} onChange={(e) => setFilters((current) => ({ ...current, end: e.target.value }))} />
              <Select value={filters.venueId} onValueChange={(value) => setFilters((current) => ({ ...current, venueId: value }))}>
                <SelectTrigger><SelectValue placeholder="Venue" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Venues</SelectItem>
                  {venues.map((venue) => <SelectItem key={venue.id} value={String(venue.id)}>{venue.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="held">Held</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Search venue, player, booking ID" value={filters.q} onChange={(e) => setFilters((current) => ({ ...current, q: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-xl">All Bookings</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Court</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Booking Time</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>{booking.booking_id}</TableCell>
                    <TableCell>{booking.venue}</TableCell>
                    <TableCell>{booking.court}</TableCell>
                    <TableCell>{booking.player}</TableCell>
                    <TableCell>{new Date(booking.booking_time).toLocaleString()}</TableCell>
                    <TableCell>THB {Number(booking.price ?? 0).toLocaleString()}</TableCell>
                    <TableCell>THB {Number(booking.commission ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="capitalize">{booking.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default InternalBookings;
