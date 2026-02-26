import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  Calendar,
  CheckCircle2,
  CreditCard,
  Plus,
  RefreshCcw,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import { useBookings } from "@/hooks/useBookings";
import { usePayments } from "@/hooks/usePayments";
import { useCourts } from "@/hooks/useCourts";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const Dashboard = () => {
  const navigate = useNavigate();
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

  const getPaymentStatus = useCallback((booking: typeof bookings[number]) => {
    const paymentStatus = String(booking.payment_status ?? "").toLowerCase();
    if (paymentStatus === "paid" || booking.status === "paid" || paidBookingIds.has(booking.id)) {
      return "paid";
    }
    if (booking.status === "confirmed") {
      return "confirmed";
    }
    return "pending";
  }, [paidBookingIds]);

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
  }, [todaysBookings, getPaymentStatus]);

  const activeCourts = useMemo(
    () => courts.filter((court) => court.status === "active").length,
    [courts],
  );

  const upcomingBookingsSorted = useMemo(() => {
    return [...upcomingBookings].sort(
      (a, b) => getBookingStart(a).getTime() - getBookingStart(b).getTime(),
    );
  }, [upcomingBookings]);

  const unpaidSoon = useMemo(() => {
    const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    return bookings.filter((booking) => {
      if (booking.status === "cancelled") return false;
      const status = getPaymentStatus(booking);
      if (status === "paid") return false;
      const start = getBookingStart(booking);
      return start >= now && start <= windowEnd;
    });
  }, [bookings, getPaymentStatus, now]);

  const weeklyRevenue = useMemo(() => {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return payments
      .filter((payment) => {
        if (String(payment.status).toLowerCase() !== "completed") return false;
        return new Date(payment.created_at) >= weekAgo;
      })
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  }, [now, payments]);

  const newMemberCount = useMemo(() => {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const earliestByEmail = new Map<string, Date>();
    bookings.forEach((booking) => {
      if (!booking.player_email) return;
      const email = booking.player_email.toLowerCase();
      const createdAt = new Date(booking.created_at);
      const existing = earliestByEmail.get(email);
      if (!existing || createdAt < existing) {
        earliestByEmail.set(email, createdAt);
      }
    });
    return Array.from(earliestByEmail.values()).filter((date) => date >= weekAgo).length;
  }, [bookings, now]);

  const paymentSummary = useMemo(() => {
    return payments.reduce(
      (acc, payment) => {
        const status = String(payment.status).toLowerCase();
        if (status === "completed") acc.completed += 1;
        if (status === "pending") acc.pending += 1;
        if (status === "refunded") acc.refunded += 1;
        return acc;
      },
      { completed: 0, pending: 0, refunded: 0 },
    );
  }, [payments]);

  const activityItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: "booking_created" | "booking_status" | "payment_completed" | "new_member";
      title: string;
      detail: string;
      time: Date;
    }> = [];

    const earliestByEmail = new Map<string, Date>();
    bookings.forEach((booking) => {
      if (!booking.player_email) return;
      const email = booking.player_email.toLowerCase();
      const createdAt = new Date(booking.created_at);
      const existing = earliestByEmail.get(email);
      if (!existing || createdAt < existing) {
        earliestByEmail.set(email, createdAt);
      }
    });

    bookings.forEach((booking) => {
      const createdAt = new Date(booking.created_at);
      items.push({
        id: `created-${booking.id}`,
        type: "booking_created",
        title: "Booking created",
        detail: `${booking.player_name ?? "Guest"} • ${booking.court_name ?? "Court"}`,
        time: createdAt,
      });

      if (booking.updated_at && booking.updated_at !== booking.created_at) {
        const updatedAt = new Date(booking.updated_at);
        items.push({
          id: `status-${booking.id}`,
          type: "booking_status",
          title: "Status updated",
          detail: `${booking.booking_number ?? booking.id} • ${booking.status ?? "pending"}`,
          time: updatedAt,
        });
      }
    });

    earliestByEmail.forEach((date, email) => {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (date < weekAgo) return;
      items.push({
        id: `member-${email}`,
        type: "new_member",
        title: "New member created",
        detail: email,
        time: date,
      });
    });

    payments.forEach((payment) => {
      if (String(payment.status).toLowerCase() !== "completed") return;
      items.push({
        id: `payment-${payment.id}`,
        type: "payment_completed",
        title: "Payment completed",
        detail: `฿${Number(payment.amount ?? 0).toFixed(2)} • ${payment.booking_id}`,
        time: new Date(payment.created_at),
      });
    });

    return items
      .filter((item) => !Number.isNaN(item.time.getTime()))
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 30);
  }, [bookings, now, payments]);

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

  const activityStyles = {
    booking_created: {
      icon: Calendar,
      label: "Booking",
      className: "bg-sky-100 text-sky-700",
    },
    booking_status: {
      icon: RefreshCcw,
      label: "Status",
      className: "bg-amber-100 text-amber-700",
    },
    payment_completed: {
      icon: CreditCard,
      label: "Payment",
      className: "bg-emerald-100 text-emerald-700",
    },
    new_member: {
      icon: UserPlus,
      label: "Member",
      className: "bg-teal-100 text-teal-700",
    },
  } as const;

  const renderActivityList = (
    items: typeof activityItems,
    emptyLabel: string,
  ) => {
    if (isBookingsLoading || isPaymentsLoading) {
      return (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Loading activity...
        </div>
      );
    }
    if (!items.length) {
      return (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {items.map((item) => {
          const config = activityStyles[item.type];
          const Icon = config.icon;
          return (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-background p-3"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${config.className}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(item.time, { addSuffix: true })}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{item.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
              Venue control center
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Snapshot of bookings, revenue, and what needs attention.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-xs text-muted-foreground lg:block">
              Updated {formatDistanceToNow(now, { addSuffix: true })}
            </div>
            <Button variant="cta" size="sm" onClick={() => navigate("/bookings?create=1")}>
              <Plus className="mr-2 h-4 w-4" />
              Add booking
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-amber-900">Bookings today</CardTitle>
              <Calendar className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-amber-950">{todaysBookings.length}</div>
              <div className="text-xs text-amber-700">Next 2 hours: {unpaidSoon.length} unpaid</div>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-emerald-900">Revenue today</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-emerald-950">฿{todaysRevenue.toFixed(2)}</div>
              <div className="text-xs text-emerald-700">Paid + confirmed</div>
            </CardContent>
          </Card>
          <Card className="border-sky-200 bg-sky-50/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-sky-900">Revenue (7d)</CardTitle>
              <CreditCard className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-sky-950">฿{weeklyRevenue.toFixed(2)}</div>
              <div className="text-xs text-sky-700">Completed payments</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-slate-50/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-slate-900">Active courts</CardTitle>
              <Bell className="h-4 w-4 text-slate-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-slate-950">
                {activeCourts}/{courts.length}
              </div>
              <div className="text-xs text-slate-700">Courts ready for bookings</div>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-orange-900">Upcoming (7d)</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-orange-950">{upcomingBookings.length}</div>
              <div className="text-xs text-orange-700">Scheduled sessions</div>
            </CardContent>
          </Card>
          <Card className="border-teal-200 bg-teal-50/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-teal-900">New members</CardTitle>
              <UserPlus className="h-4 w-4 text-teal-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-teal-950">{newMemberCount}</div>
              <div className="text-xs text-teal-700">Last 7 days</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Today & Next Up</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <a href="/availability">Open calendar</a>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isBookingsLoading ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Loading bookings...
                </div>
              ) : upcomingBookingsSorted.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No upcoming bookings.
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingBookingsSorted.slice(0, 5).map((booking) => (
                    <button
                      key={booking.id}
                      className="flex w-full items-start justify-between gap-3 rounded-lg border border-border p-3 text-left transition hover:bg-muted/30"
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
              {unpaidSoon.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                  {unpaidSoon.length} unpaid booking(s) start within the next 2 hours.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-lg">Notifications</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="bookings">Bookings</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                  <TabsTrigger value="members">Members</TabsTrigger>
                </TabsList>
                <TabsContent value="all">
                  {renderActivityList(activityItems, "No activity yet.")}
                </TabsContent>
                <TabsContent value="bookings">
                  {renderActivityList(
                    activityItems.filter(
                      (item) => item.type === "booking_created" || item.type === "booking_status",
                    ),
                    "No booking updates yet.",
                  )}
                </TabsContent>
                <TabsContent value="payments">
                  {renderActivityList(
                    activityItems.filter((item) => item.type === "payment_completed"),
                    "No payment updates yet.",
                  )}
                </TabsContent>
                <TabsContent value="members">
                  {renderActivityList(
                    activityItems.filter((item) => item.type === "new_member"),
                    "No new members yet.",
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Court readiness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isCourtsLoading ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Loading court status...
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <div className="text-sm font-medium">Active courts</div>
                      <div className="text-xs text-muted-foreground">Ready for bookings</div>
                    </div>
                    <div className="text-lg font-semibold">{activeCourts}</div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <div className="text-sm font-medium">Inactive courts</div>
                      <div className="text-xs text-muted-foreground">Needs attention</div>
                    </div>
                    <div className="text-lg font-semibold">{courts.length - activeCourts}</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Payments snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isPaymentsLoading ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Loading payments...
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs text-muted-foreground">Completed</div>
                    <div className="text-lg font-semibold text-emerald-700">{paymentSummary.completed}</div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs text-muted-foreground">Pending</div>
                    <div className="text-lg font-semibold text-amber-700">{paymentSummary.pending}</div>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs text-muted-foreground">Refunded</div>
                    <div className="text-lg font-semibold text-red-600">{paymentSummary.refunded}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
