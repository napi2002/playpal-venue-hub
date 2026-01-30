import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Clock,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddBookingDialog } from "@/components/AddBookingDialog";
import { useCourts } from "@/hooks/useCourts";
import { useRecurringBookings } from "@/hooks/useRecurringBookings";
import { useVenue } from "@/hooks/useVenue";
import { apiFetch } from "@/lib/apiClient";
import { addDays, addMinutes, addWeeks, format, startOfDay, startOfWeek } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { BookingEvent, BookingStatus } from "@/types/availability";
import { apiFetch } from "@/lib/apiClient";

const Availability = () => {
  const [selectedCourt, setSelectedCourt] = useState("all");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [bookingEvents, setBookingEvents] = useState<BookingEvent[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const { courts } = useCourts();
  const { recurringBookings, isLoading: isRecurringLoading } = useRecurringBookings();
  const { venue } = useVenue();
  const { toast } = useToast();
  const [overrideForm, setOverrideForm] = useState({
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "10:00",
    courtId: "",
    sport: "",
    eventName: "",
  });

  const availabilityRules: {
    id: number;
    name: string;
    courts: string[];
    days: string;
    time: string;
    minDuration: string;
    buffer: string;
    leadTime: string;
  }[] = [];

  const slotMinutes = 30;
  const defaultStartMinutes = 6 * 60;
  const defaultEndMinutes = 22 * 60;
  const slotHeight = 24;
  const pxPerMinute = slotHeight / slotMinutes;

  const openingHours = useMemo(() => {
    return venue?.opening_hours as
      | Record<string, { isOpen: boolean; openTime: string; closeTime: string }>
      | null
      | undefined;
  }, [venue]);

  const weekdayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Bangkok",
        weekday: "short",
      }),
    [],
  );

  const parseTimeToMinutes = (value?: string | null) => {
    if (!value) return null;
    const [hours, minutes] = value.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

  const getDayHours = useCallback(
    (day: Date) => {
      const weekdayKey = weekdayFormatter.format(day);
      const entry = openingHours?.[weekdayKey];
      if (!entry?.isOpen) {
        return null;
      }
      const openMinutes = parseTimeToMinutes(entry.openTime);
      const closeMinutes = parseTimeToMinutes(entry.closeTime);
      if (openMinutes === null || closeMinutes === null || openMinutes >= closeMinutes) {
        return null;
      }
      return { openMinutes, closeMinutes, weekdayKey };
    },
    [openingHours, weekdayFormatter],
  );

  const weekStart = useMemo(
    () => startOfWeek(currentDate, { weekStartsOn: 1 }),
    [currentDate],
  );

  const visibleDays = useMemo(() => {
    if (viewMode === "day") {
      return [startOfDay(currentDate)];
    }
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [currentDate, viewMode, weekStart]);

  const rangeStart = useMemo(() => startOfDay(visibleDays[0]), [visibleDays]);
  const rangeEnd = useMemo(
    () => addDays(startOfDay(visibleDays[visibleDays.length - 1]), 1),
    [visibleDays],
  );

  const dayBounds = useMemo(() => {
    const openTimes = visibleDays
      .map((day) => getDayHours(day))
      .filter((entry): entry is { openMinutes: number; closeMinutes: number } => Boolean(entry));

    if (!openTimes.length) {
      return { startMinutes: defaultStartMinutes, endMinutes: defaultEndMinutes };
    }

    const rawStart = Math.min(...openTimes.map((entry) => entry.openMinutes));
    const rawEnd = Math.max(...openTimes.map((entry) => entry.closeMinutes));
    const roundedStart = Math.floor(rawStart / slotMinutes) * slotMinutes;
    const roundedEnd = Math.ceil(rawEnd / slotMinutes) * slotMinutes;
    return {
      startMinutes: roundedStart,
      endMinutes: Math.max(roundedEnd, roundedStart + slotMinutes),
    };
  }, [defaultEndMinutes, defaultStartMinutes, getDayHours, slotMinutes, visibleDays]);

  const timeSlots = useMemo(() => {
    const slots: number[] = [];
    for (let minutes = dayBounds.startMinutes; minutes < dayBounds.endMinutes; minutes += slotMinutes) {
      slots.push(minutes);
    }
    return slots;
  }, [dayBounds.endMinutes, dayBounds.startMinutes, slotMinutes]);

  const generateBookingNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 90) + 10;
    return `BK${timestamp}${random}`;
  };

  const toBangkokUtcIso = (date: string, time: string) => {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0));
    return utcDate.toISOString();
  };

  const recurringEvents = useMemo(() => {
    if (!recurringBookings.length) return [];

    const dayLabels = Array.from({ length: 7 }, (_, index) => index);
    const days: string[] = [];
    const weekdayByDate = new Map<string, number>();
    const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      weekday: "short",
    });
    const weekdayIndex = new Map([
      ["Sun", 0],
      ["Mon", 1],
      ["Tue", 2],
      ["Wed", 3],
      ["Thu", 4],
      ["Fri", 5],
      ["Sat", 6],
    ]);
    for (let idx = 0; idx < visibleDays.length; idx += 1) {
      const dateKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(visibleDays[idx]);
      days.push(dateKey);
      const weekdayLabel = weekdayFormatter.format(visibleDays[idx]);
      const weekdayValue = weekdayIndex.get(weekdayLabel);
      if (weekdayValue !== undefined) {
        weekdayByDate.set(dateKey, weekdayValue);
      }
    }

    const byCourt = new Map(courts.map((court) => [court.id, court.name]));

    return recurringBookings.flatMap((recurring) => {
      if (recurring.status === "cancelled") return [];
      if (selectedCourt !== "all" && recurring.court_id !== selectedCourt) return [];

      const recurrenceStart = recurring.start_date;
      const recurrenceEnd = recurring.end_date ?? null;
      const bookingDay = Number(recurring.day_of_week);
      if (!dayLabels.includes(bookingDay)) return [];

      return days.flatMap((dateKey) => {
        if (dateKey < recurrenceStart) return [];
        if (recurrenceEnd && dateKey > recurrenceEnd) return [];

        const dayCheck = weekdayByDate.get(dateKey);
        if (dayCheck === undefined || dayCheck !== bookingDay) return [];

        const startAt = toBangkokUtcIso(dateKey, recurring.time);
        const endAt = new Date(
          new Date(startAt).getTime() + Number(recurring.duration) * 60000,
        ).toISOString();

        return [
          {
            id: `${recurring.id}-${dateKey}`,
            courtId: recurring.court_id,
            courtName: byCourt.get(recurring.court_id) || "Court",
            start: startAt,
            end: endAt,
            eventName: recurring.player_name,
            status:
              recurring.status === "paid" || recurring.status === "confirmed"
                ? "PAID"
                : "PENDING",
          },
        ];
      });
    });
  }, [courts, recurringBookings, selectedCourt, visibleDays]);

  const mergedEvents = useMemo(
    () => [...bookingEvents, ...recurringEvents],
    [bookingEvents, recurringEvents],
  );

  const eventsWithDates = useMemo(
    () =>
      mergedEvents.map((event) => ({
        ...event,
        startDate: new Date(event.start),
        endDate: new Date(event.end),
      })),
    [mergedEvents],
  );

  const fetchBookings = useCallback(async () => {
    if (!venue?.id) return;
    setLoadingBookings(true);
    try {
      const params = new URLSearchParams({
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
      });
      if (selectedCourt !== "all") {
        params.set("courtId", selectedCourt);
      }
      const data = await apiFetch(`/api/venues/${venue.id}/bookings?${params.toString()}`);
      setBookingEvents(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({
        title: "Failed to load bookings",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoadingBookings(false);
    }
  }, [rangeEnd, rangeStart, selectedCourt, toast, venue?.id]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (!bookingDialogOpen) {
      fetchBookings();
    }
  }, [bookingDialogOpen, fetchBookings]);

  const formatDayLabel = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Bangkok",
    }).format(date);

  const formatTimeLabel = (date: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Bangkok",
    }).format(date);

  const buildSlotDate = (day: Date, minutesFromStart: number) => {
    const base = new Date(day);
    base.setHours(0, 0, 0, 0);
    base.setMinutes(dayBounds.startMinutes);
    return addMinutes(base, minutesFromStart);
  };

  const getEventSlices = (day: Date, event: { startDate: Date; endDate: Date }) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setMinutes(dayBounds.startMinutes);
    const dayEnd = new Date(day);
    dayEnd.setHours(0, 0, 0, 0);
    dayEnd.setMinutes(dayBounds.endMinutes);

    if (event.endDate <= dayStart || event.startDate >= dayEnd) {
      return null;
    }

    const sliceStart = event.startDate > dayStart ? event.startDate : dayStart;
    const sliceEnd = event.endDate < dayEnd ? event.endDate : dayEnd;
    return { sliceStart, sliceEnd, dayStart };
  };

  const hasOverlap = (start: Date, end: Date) =>
    eventsWithDates.find(
      (event) => start < event.endDate && end > event.startDate,
    );

  const isSlotWithinOpenHours = (day: Date, slotStartMinutes: number, slotEndMinutes: number) => {
    const hours = getDayHours(day);
    if (!hours) return false;
    return slotStartMinutes >= hours.openMinutes && slotEndMinutes <= hours.closeMinutes;
  };

  const handleSlotSelect = (day: Date, minutesFromStart: number) => {
    const start = buildSlotDate(day, minutesFromStart);
    const end = addMinutes(start, 60);
    const slotStartMinutes = dayBounds.startMinutes + minutesFromStart;
    const slotEndMinutes = slotStartMinutes + 60;

    if (!isSlotWithinOpenHours(day, slotStartMinutes, slotEndMinutes)) {
      toast({
        title: "Venue closed",
        description: "This time is outside the venue's opening hours.",
        variant: "destructive",
      });
      return;
    }

    const conflict = hasOverlap(start, end);
    if (conflict) {
      const statusLabel = conflict.status === "PAID" ? "Paid booking" : "Pending booking";
      toast({
        title: "This time is not available",
        description: `This time is not available (${statusLabel})`,
        variant: "destructive",
      });
      return;
    }
    setBookingDialogOpen(true);
  };

  const bookingLabel = (event: BookingEvent, mode: "week" | "day") => {
    const statusLabel = event.status === "PAID" ? "Paid" : "Pending";
    const nameLabel = event.eventName ? ` • ${event.eventName}` : "";
    if (selectedCourt === "all") {
      return `${event.courtName}${nameLabel} • ${statusLabel}`;
    }
    return `${statusLabel}${nameLabel}`;
  };

  const formatWeekTitle = () => {
    const end = addDays(weekStart, 6);
    return `${format(weekStart, "MMM dd")} - ${format(end, "MMM dd")}`;
  };

  const handleCreateOverride = async () => {
    if (!overrideForm.courtId || !overrideForm.sport || !overrideForm.eventName) {
      toast({
        title: "Missing fields",
        description: "Please fill all required fields.",
        variant: "destructive",
      });
      return;
    }

    const startAt = toBangkokUtcIso(overrideForm.date, overrideForm.startTime);
    const endAt = toBangkokUtcIso(overrideForm.date, overrideForm.endTime);

    if (new Date(endAt) <= new Date(startAt)) {
      toast({
        title: "Invalid time range",
        description: "End time must be after start time.",
        variant: "destructive",
      });
      return;
    }

    const selected = courts.find((court) => court.id === overrideForm.courtId);
    if (!selected?.venue_id) {
      toast({
        title: "Missing court",
        description: "Please select a valid court.",
        variant: "destructive",
      });
      return;
    }

    const durationMinutes = Math.round(
      (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000,
    );
    const bookingDate = new Date(`${overrideForm.date}T00:00:00`);
    const isWeekend = bookingDate.getDay() === 0 || bookingDate.getDay() === 6;
    const hourlyRate = Number(
      isWeekend
        ? selected.weekend_price_per_hour_thb ?? selected.peak_price
        : selected.weekday_price_per_hour_thb ?? selected.off_peak_price,
    );

    if (!hourlyRate || Number.isNaN(hourlyRate)) {
      toast({
        title: "Court pricing missing",
        description: "Please set court pricing before creating bookings.",
        variant: "destructive",
      });
      return;
    }

    const amount = ((hourlyRate * durationMinutes) / 60).toFixed(2);

    const conflicts = (await apiFetch(
      `/api/venues/${selected.venue_id}/bookings?start=${encodeURIComponent(
        startAt,
      )}&end=${encodeURIComponent(endAt)}&courtId=${overrideForm.courtId}`,
    )) as Array<{ id: string }>;

    if (Array.isArray(conflicts) && conflicts.length > 0) {
      toast({
        title: "Time unavailable",
        description: "This court already has a booking during that time.",
        variant: "destructive",
      });
      return;
    }

    await apiFetch(`/api/venues/${selected.venue_id}/bookings`, {
      method: "POST",
      body: JSON.stringify({
        venueId: selected.venue_id,
        courtId: overrideForm.courtId,
        slotStart: startAt,
        slotEnd: endAt,
        durationMinutes,
        status: "paid",
        totalPrice: amount,
        currency: "THB",
        notes: null,
        bookingNumber: generateBookingNumber(),
        playerName: overrideForm.eventName,
        playerEmail: "no-email@playpal.local",
        source: "Manual",
        paymentStatus: "Paid",
      }),
    });

    toast({ title: "Booking created" });
    setOverrideDialogOpen(false);
    setOverrideForm({
      date: overrideForm.date,
      startTime: overrideForm.startTime,
      endTime: overrideForm.endTime,
      courtId: overrideForm.courtId,
      sport: "",
      eventName: "",
    });
    fetchBookings();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Availability Management</h1>
            <p className="text-muted-foreground mt-1">Set and manage court availability schedules</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Copy className="mr-2 h-4 w-4" />
              Bulk edit
            </Button>
            <Button variant="cta">
              <Plus className="mr-2 h-4 w-4" />
              Add availability
            </Button>
            <Button variant="outline" onClick={() => setBookingDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add booking
            </Button>
          </div>
        </div>

        <Tabs defaultValue="calendar" className="space-y-6">
          <TabsList>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            <TabsTrigger value="rules">Rules & Overrides</TabsTrigger>
          </TabsList>

          {/* Calendar View */}
          <TabsContent value="calendar" className="space-y-4">
            {/* Filters */}
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Select value={selectedCourt} onValueChange={setSelectedCourt}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select court" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All courts</SelectItem>
                        {courts.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No courts available
                          </SelectItem>
                        ) : (
                          courts.map((court) => (
                            <SelectItem key={court.id} value={court.id}>
                              {court.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCurrentDate(
                          viewMode === "week"
                            ? addWeeks(currentDate, -1)
                            : addDays(currentDate, -1),
                        )
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2 px-4">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {viewMode === "week" ? formatWeekTitle() : format(currentDate, "MMM dd, yyyy")}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCurrentDate(
                          viewMode === "week"
                            ? addWeeks(currentDate, 1)
                            : addDays(currentDate, 1),
                        )
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={viewMode === "day" ? "cta" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("day")}
                    >
                      Day
                    </Button>
                    <Button
                      variant={viewMode === "week" ? "cta" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("week")}
                    >
                      Week
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Calendar Grid */}
            <Card className="shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-[80px_1fr]">
                  <div className="border-r border-border bg-muted/30">
                    <div className="h-12 border-b border-border" />
                    {timeSlots.map((minutes) => {
                      const minutesFromStart = minutes - dayBounds.startMinutes;
                      const label = minutes % 60 === 0
                        ? formatTimeLabel(buildSlotDate(new Date(), minutesFromStart))
                        : "";
                      return (
                        <div
                          key={minutes}
                          className="flex items-start justify-end pr-3 text-xs text-muted-foreground"
                          style={{ height: slotHeight }}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                  <div className={`grid ${visibleDays.length === 7 ? "grid-cols-7" : "grid-cols-1"}`}>
                    {visibleDays.map((day) => {
                      const dayHours = getDayHours(day);
                      const isClosedDay = !dayHours;
                      return (
                      <div key={day.toISOString()} className="border-r border-border last:border-r-0">
                      <div className="h-12 border-b border-border px-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{formatDayLabel(day)}</div>
                          {isClosedDay && (
                            <div className="text-xs text-muted-foreground">Closed</div>
                          )}
                        </div>
                        {(loadingBookings || isRecurringLoading) && (
                          <span className="text-xs text-muted-foreground">Loading...</span>
                        )}
                      </div>
                        <div
                          className="relative"
                          style={{ height: timeSlots.length * slotHeight }}
                        >
                          {timeSlots.map((minutes) => {
                            const minutesFromStart = minutes - dayBounds.startMinutes;
                            const slotStart = minutes;
                            const slotEnd = minutes + slotMinutes;
                            const isOpenSlot = isSlotWithinOpenHours(day, slotStart, slotEnd);
                            return (
                              <div
                                key={minutes}
                                className={`availability-slot${isOpenSlot ? "" : " availability-slot--closed"}`}
                                style={{ height: slotHeight }}
                                onClick={
                                  isOpenSlot
                                    ? () => handleSlotSelect(day, minutesFromStart)
                                    : undefined
                                }
                              />
                            );
                          })}
                          {eventsWithDates.map((event) => {
                            const slice = getEventSlices(day, event);
                            if (!slice) return null;
                            const minutesFromStart =
                              (slice.sliceStart.getTime() - slice.dayStart.getTime()) / 60000;
                            const durationMinutes =
                              (slice.sliceEnd.getTime() - slice.sliceStart.getTime()) / 60000;
                            const top = minutesFromStart * pxPerMinute;
                            const height = Math.max(durationMinutes * pxPerMinute, 18);
                            const className =
                              event.status === "PAID" ? "booking-paid" : "booking-pending";

                            return (
                              <div
                                key={`${event.id}-${day.toISOString()}`}
                                className={`booking-event ${className}`}
                                style={{ top, height }}
                              >
                                <div className="text-xs font-medium">
                                  {bookingLabel(event, viewMode)}
                                </div>
                                <div className="text-[11px] opacity-80">
                                  {formatTimeLabel(slice.sliceStart)} - {formatTimeLabel(slice.sliceEnd)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rules */}
          <TabsContent value="rules" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Availability Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {availabilityRules.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                    No rules or overrides yet
                  </div>
                ) : (
                  availabilityRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{rule.name}</h4>
                          <div className="flex gap-2 mt-2">
                            {rule.courts.map((court) => (
                              <Badge key={court} variant="secondary" className="text-xs">
                                {court}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm">
                            Delete
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Days:</span>
                          <p className="font-medium">{rule.days}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Time:</span>
                          <p className="font-medium">{rule.time}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Min duration:</span>
                          <p className="font-medium">{rule.minDuration}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Lead time:</span>
                          <p className="font-medium">{rule.leadTime}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Special Events & Closures
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No special events or closures scheduled</p>
                  <Button variant="cta" className="mt-4" onClick={() => setOverrideDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add override
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      <AddBookingDialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen} />
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add override booking</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={overrideForm.date}
                  onChange={(e) => setOverrideForm({ ...overrideForm, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Court</Label>
                <Select
                  value={overrideForm.courtId}
                  onValueChange={(value) => setOverrideForm({ ...overrideForm, courtId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select court" />
                  </SelectTrigger>
                  <SelectContent>
                    {courts.map((court) => (
                      <SelectItem key={court.id} value={court.id}>
                        {court.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start time</Label>
                <Input
                  type="time"
                  value={overrideForm.startTime}
                  onChange={(e) => setOverrideForm({ ...overrideForm, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End time</Label>
                <Input
                  type="time"
                  value={overrideForm.endTime}
                  onChange={(e) => setOverrideForm({ ...overrideForm, endTime: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sport</Label>
                <Select
                  value={overrideForm.sport}
                  onValueChange={(value) => setOverrideForm({ ...overrideForm, sport: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tennis">Tennis</SelectItem>
                    <SelectItem value="Padel">Padel</SelectItem>
                    <SelectItem value="Badminton">Badminton</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Event name</Label>
              <Input
                value={overrideForm.eventName}
                onChange={(e) => setOverrideForm({ ...overrideForm, eventName: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="cta" onClick={handleCreateOverride}>
              Create booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Availability;
