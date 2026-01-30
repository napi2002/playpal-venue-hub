import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, Plus, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useBookings } from "@/hooks/useBookings";
import { usePayments } from "@/hooks/usePayments";
import { useCourts } from "@/hooks/useCourts";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { bookings, isLoading: isBookingsLoading } = useBookings();
  const { payments, isLoading: isPaymentsLoading } = usePayments();
  const { courts, isLoading: isCourtsLoading } = useCourts();

  const bangkokDateKey = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    [],
  );

  const bangkokTime = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [],
  );

  const todayKey = useMemo(
    () => bangkokDateKey.format(new Date()),
    [bangkokDateKey],
  );

  const getBookingStart = (booking: typeof bookings[number]) => {
    if (booking.slot_start) return new Date(booking.slot_start);
    if (booking.start_at) return new Date(booking.start_at);
    if (booking.date && booking.time) {
      return new Date(`${booking.date}T${booking.time}+07:00`);
    }
    return new Date(booking.created_at);
  };

  const getBookingEnd = (booking: typeof bookings[number]) => {
    if (booking.slot_end) return new Date(booking.slot_end);
    if (booking.end_at) return new Date(booking.end_at);
    const start = getBookingStart(booking);
    const duration = Number(booking.duration_minutes ?? booking.duration ?? 60);
    return new Date(start.getTime() + duration * 60 * 1000);
  };

  const paidBookingIds = useMemo(() => {
    return new Set(
      payments
        .filter((payment) => String(payment.status).toLowerCase() === "completed")
        .map((payment) => payment.booking_id),
    );
  }, [payments]);

  const getPaymentStatus = (booking: typeof bookings[number]) => {
    const paymentStatus = String(booking.payment_status ?? "").toLowerCase();
    if (paymentStatus === "paid" || booking.status === "paid" || paidBookingIds.has(booking.id)) {
      return "paid";
    }
    if (booking.status === "confirmed") {
      return "confirmed";
    }
    return "pending";
  };

  const todayStart = useMemo(() => new Date(`${todayKey}T00:00:00+07:00`), [todayKey]);
  const todayEnd = useMemo(() => new Date(`${todayKey}T23:59:59+07:00`), [todayKey]);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  const nextWeekEnd = useMemo(
    () => new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    [now],
  );

  const todaysBookings = useMemo(() => {
    return bookings
      .filter((booking) => booking.status !== "cancelled")
      .filter((booking) => {
        const start = getBookingStart(booking);
        return start >= todayStart && start <= todayEnd;
      })
      .sort((a, b) => getBookingStart(a).getTime() - getBookingStart(b).getTime());
  }, [bookings, todayStart, todayEnd]);

  const upcomingBookings = useMemo(() => {
    return bookings.filter((booking) => {
      if (booking.status === "cancelled") return false;
      const start = getBookingStart(booking);
      const end = getBookingEnd(booking);
      return start <= nextWeekEnd && end > now;
    });
  }, [bookings, nextWeekEnd, now]);

  const todaysRevenue = useMemo(() => {
    return todaysBookings.reduce((total, booking) => {
      const status = getPaymentStatus(booking);
      if (status === "paid" || status === "confirmed") {
        return total + Number(booking.final_price ?? booking.total_price ?? booking.amount ?? 0);
      }
      return total;
    }, 0);
  }, [todaysBookings, paidBookingIds]);

  const metricsAvailable =
    bookings.length > 0 || payments.length > 0 || upcomingBookings.length > 0;

  const alerts = useMemo(() => {
    const items: { id: string; title: string; detail: string }[] = [];
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const unpaidSoon = bookings.filter((booking) => {
      if (booking.status === "cancelled") return false;
      const status = getPaymentStatus(booking);
      if (status === "paid") return false;
      const start = getBookingStart(booking);
      return start >= now && start <= windowEnd;
    });

    if (unpaidSoon.length > 0) {
      items.push({
        id: "unpaid-soon",
        title: "Unpaid bookings starting soon",
        detail: `${unpaidSoon.length} booking(s) start within 2 hours`,
      });
    }

    const conflicts: Array<{ courtId: string; count: number }> = [];
    const bookingsByCourt = bookings
      .filter((booking) => booking.status !== "cancelled")
      .reduce<Record<string, typeof bookings>>((acc, booking) => {
        const courtId = booking.court_id ?? "unknown";
        if (!acc[courtId]) acc[courtId] = [];
        acc[courtId].push(booking);
        return acc;
      }, {});

    Object.entries(bookingsByCourt).forEach(([courtId, courtBookings]) => {
      const sorted = [...courtBookings].sort(
        (a, b) => getBookingStart(a).getTime() - getBookingStart(b).getTime(),
      );
      let overlapCount = 0;
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1];
        const current = sorted[i];
        if (getBookingStart(current) < getBookingEnd(prev)) {
          overlapCount += 1;
        }
      }
      if (overlapCount > 0) {
        conflicts.push({ courtId, count: overlapCount });
      }
    });

    if (conflicts.length > 0) {
      items.push({
        id: "conflicts",
        title: "Booking conflicts detected",
        detail: `${conflicts.length} court(s) have overlapping bookings`,
      });
    }

    const unavailableCourts = courts.filter((court) => court.status !== "active");
    const unavailableWithBookings = unavailableCourts.filter((court) =>
      bookings.some((booking) => booking.court_id === court.id && booking.status !== "cancelled"),
    );

    if (unavailableWithBookings.length > 0) {
      items.push({
        id: "unavailable",
        title: "Unavailable courts with bookings",
        detail: `${unavailableWithBookings.length} court(s) are unavailable but still booked`,
      });
    }

    return items;
  }, [bookings, courts, paidBookingIds]);

  const formatTimeRange = (booking: typeof bookings[number]) => {
    const start = getBookingStart(booking);
    const end = getBookingEnd(booking);
    return `${bangkokTime.format(start)}–${bangkokTime.format(end)}`;
  };

  const statusBadgeClass = (status: "paid" | "confirmed" | "pending") => {
    switch (status) {
      case "paid":
        return "bg-green-500/10 text-green-700 border-green-200";
      case "confirmed":
        return "bg-blue-500/10 text-blue-700 border-blue-200";
      case "pending":
        return "bg-amber-500/10 text-amber-700 border-amber-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleExport = () => {
    const rows = [...todaysBookings, ...upcomingBookings];
    if (rows.length === 0) {
      toast({
        title: "No bookings to export",
        description: "There are no bookings for today or the next 7 days.",
      });
      return;
    }

    const headers = [
      "booking_id",
      "booking_number",
      "date",
      "start_time",
      "end_time",
      "court",
      "sport",
      "event_name",
      "status",
      "amount_thb",
    ];
    const csvRows = [headers.join(",")];

    rows.forEach((booking) => {
      const start = getBookingStart(booking);
      const end = getBookingEnd(booking);
      const values = [
        booking.id,
        booking.booking_number ?? "",
        bangkokDateKey.format(start),
        bangkokTime.format(start),
        bangkokTime.format(end),
        booking.court_name ?? "",
        booking.sport ?? "",
        booking.player_name ?? "",
        getPaymentStatus(booking),
        Number(booking.final_price ?? booking.total_price ?? booking.amount ?? 0).toFixed(2),
      ].map((value) => `"${String(value).replace(/\"/g, '\"\"')}"`);
      csvRows.push(values.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings_${todayKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your venue overview.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="cta" size="sm" onClick={() => navigate("/bookings?create=1")}>
            <Plus className="mr-2 h-4 w-4" />
            Add booking
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isBookingsLoading || isPaymentsLoading ? (
          <Card className="shadow-sm md:col-span-2 lg:col-span-4">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Loading metrics...
            </CardContent>
          </Card>
        ) : !metricsAvailable ? (
          <Card className="shadow-sm md:col-span-2 lg:col-span-4">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No metrics available yet
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Today's total bookings
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todaysBookings.length}</div>
                <div className="text-xs text-muted-foreground mt-2">Bookings today</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Today's revenue
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">฿{todaysRevenue.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-2">Paid + confirmed</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Upcoming bookings
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{upcomingBookings.length}</div>
                <div className="text-xs text-muted-foreground mt-2">Next 7 days</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Alerts */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-cta" />
            Alerts & Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isBookingsLoading || isPaymentsLoading || isCourtsLoading ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Loading alerts...</span>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">No alerts yet</span>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border"
              >
                <div>
                  <div className="text-sm font-medium">{alert.title}</div>
                  <div className="text-xs text-muted-foreground">{alert.detail}</div>
                </div>
                <Badge variant="outline">alert</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Today's Schedule */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Today's Schedule</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <a href="/availability">View full calendar</a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isBookingsLoading ? (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <span className="text-sm text-muted-foreground">Loading bookings...</span>
            </div>
          ) : todaysBookings.length === 0 ? (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <span className="text-sm text-muted-foreground">No bookings scheduled for today</span>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysBookings.map((booking) => (
                <button
                  key={booking.id}
                  className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-left transition hover:bg-muted/30"
                  type="button"
                  onClick={() => navigate(`/bookings?bookingId=${booking.id}`)}
                >
                  <div>
                    <div className="text-sm font-medium">
                      {formatTimeRange(booking)} • {booking.court_name || "Court"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {booking.player_name ?? "Guest"} · {booking.sport ?? booking.sport_type ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className={statusBadgeClass(getPaymentStatus(booking))}>
                      {getPaymentStatus(booking)}
                    </Badge>
                    <span className="font-medium">
                      ฿{Number(booking.final_price ?? booking.total_price ?? booking.amount ?? 0).toFixed(2)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
