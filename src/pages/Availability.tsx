import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useVenue } from "@/hooks/useVenue";
import { apiFetch } from "@/lib/apiClient";
import { addDays, addMinutes, addWeeks, format, startOfDay, startOfWeek } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { BookingEvent, BookingStatus } from "@/types/availability";

const Availability = () => {
  const [selectedCourt, setSelectedCourt] = useState("all");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingEvents, setBookingEvents] = useState<BookingEvent[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const { courts } = useCourts();
  const { venue } = useVenue();
  const { toast } = useToast();

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
  const dayStartHour = 6;
  const dayEndHour = 22;
  const slotHeight = 24;
  const pxPerMinute = slotHeight / slotMinutes;

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

  const timeSlots = useMemo(() => {
    const slots: number[] = [];
    for (let hour = dayStartHour; hour < dayEndHour; hour += 1) {
      for (let minutes = 0; minutes < 60; minutes += slotMinutes) {
        slots.push(hour * 60 + minutes);
      }
    }
    return slots;
  }, []);

  const eventsWithDates = useMemo(
    () =>
      bookingEvents.map((event) => ({
        ...event,
        startDate: new Date(event.start),
        endDate: new Date(event.end),
      })),
    [bookingEvents],
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
    base.setHours(dayStartHour, 0, 0, 0);
    return addMinutes(base, minutesFromStart);
  };

  const getEventSlices = (day: Date, event: { startDate: Date; endDate: Date }) => {
    const dayStart = new Date(day);
    dayStart.setHours(dayStartHour, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(dayEndHour, 0, 0, 0);

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

  const handleSlotSelect = (day: Date, minutesFromStart: number) => {
    const start = buildSlotDate(day, minutesFromStart);
    const end = addMinutes(start, 60);
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
    if (selectedCourt === "all" && mode === "week") {
      return `${event.courtName} • ${statusLabel}`;
    }
    if (selectedCourt === "all") {
      return `${event.courtName} • ${statusLabel}`;
    }
    return statusLabel;
  };

  const formatWeekTitle = () => {
    const end = addDays(weekStart, 6);
    return `${format(weekStart, "MMM dd")} - ${format(end, "MMM dd")}`;
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
                      const minutesFromStart = minutes - dayStartHour * 60;
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
                    {visibleDays.map((day) => (
                      <div key={day.toISOString()} className="border-r border-border last:border-r-0">
                        <div className="h-12 border-b border-border px-3 flex items-center justify-between">
                          <div className="text-sm font-medium">{formatDayLabel(day)}</div>
                          {loadingBookings && (
                            <span className="text-xs text-muted-foreground">Loading...</span>
                          )}
                        </div>
                        <div
                          className="relative"
                          style={{ height: timeSlots.length * slotHeight }}
                        >
                          {timeSlots.map((minutes) => (
                            <div
                              key={minutes}
                              className="availability-slot"
                              style={{ height: slotHeight }}
                              onClick={() => handleSlotSelect(day, minutes - dayStartHour * 60)}
                            />
                          ))}
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
                    ))}
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
                  <Button variant="cta" className="mt-4">
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
    </DashboardLayout>
  );
};

export default Availability;
