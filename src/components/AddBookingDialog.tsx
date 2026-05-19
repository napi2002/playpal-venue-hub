import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBookings } from "@/hooks/useBookings";
import { useCourts } from "@/hooks/useCourts";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import { useRecurringBookings } from "@/hooks/useRecurringBookings";
import { toBangkokUtcIso } from "@/lib/datetime";

interface AddBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string;
  initialTime?: string;
}

const buildDefaultFormData = (date?: string, time?: string) => ({
  date: date ?? new Date().toISOString().split("T")[0],
  time: time ?? "09:00",
  courtId: "",
  player: "",
  email: "",
  duration: 60,
  paymentStatus: "Pending",
  notes: "",
});

export const AddBookingDialog = ({
  open,
  onOpenChange,
  initialDate,
  initialTime,
}: AddBookingDialogProps) => {
  const { addBooking } = useBookings();
  const { courts } = useCourts();
  const { recurringBookings } = useRecurringBookings();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState(buildDefaultFormData(initialDate, initialTime));

  useEffect(() => {
    if (!open) return;
    if (!initialDate && !initialTime) return;
    setFormData(buildDefaultFormData(initialDate, initialTime));
  }, [open, initialDate, initialTime]);

  const generateBookingNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 90) + 10;
    return `BK${timestamp}${random}`;
  };

  const overlapsRecurring = (courtId: string, startAt: string, endAt: string) => {
    const bookingDateKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(startAt));
    const weekdayLabel = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      weekday: "short",
    }).format(new Date(startAt));
    const weekdayIndex = new Map([
      ["Sun", 0],
      ["Mon", 1],
      ["Tue", 2],
      ["Wed", 3],
      ["Thu", 4],
      ["Fri", 5],
      ["Sat", 6],
    ]);
    const bookingWeekday = weekdayIndex.get(weekdayLabel);
    if (bookingWeekday === undefined) return false;

    return recurringBookings.some((recurring) => {
      if (recurring.status === "cancelled") return false;
      if (String(recurring.court_id) !== courtId) return false;
      if (recurring.day_of_week !== bookingWeekday) return false;
      if (bookingDateKey < recurring.start_date) return false;
      if (recurring.end_date && bookingDateKey > recurring.end_date) return false;

      const recurringStart = toBangkokUtcIso(bookingDateKey, recurring.time);
      const recurringEnd = new Date(
        new Date(recurringStart).getTime() + Number(recurring.duration) * 60000,
      ).toISOString();

      return new Date(startAt) < new Date(recurringEnd) && new Date(endAt) > new Date(recurringStart);
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!formData.courtId || !formData.player || !formData.email) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Get venue_id from the selected court
      const selectedCourt = courts.find((court) => String(court.id) === formData.courtId);
      if (!selectedCourt) {
        throw new Error("Selected court not found");
      }
      if (!selectedCourt.venue_id) {
        throw new Error("Selected court is missing venue access");
      }

      const bookingDate = new Date(`${formData.date}T00:00:00+07:00`);
      const isWeekend = bookingDate.getDay() === 0 || bookingDate.getDay() === 6;
      const hourlyRate = Number(
        isWeekend
          ? selectedCourt.weekend_price_per_hour_thb ?? selectedCourt.peak_price
          : selectedCourt.weekday_price_per_hour_thb ?? selectedCourt.off_peak_price,
      );

      if (!hourlyRate || Number.isNaN(hourlyRate)) {
        throw new Error("Court pricing is not configured");
      }

      const amount = Number(((hourlyRate * formData.duration) / 60).toFixed(2));

      const bookingNumber = generateBookingNumber();
      const startAt = toBangkokUtcIso(formData.date, formData.time);
      const endAt = new Date(new Date(startAt).getTime() + formData.duration * 60000).toISOString();

      if (overlapsRecurring(formData.courtId, startAt, endAt)) {
        toast({
          title: "Time unavailable",
          description: "This court has a recurring booking during that time.",
          variant: "destructive",
        });
        return;
      }

      const conflicts = (await apiFetch(
        `/api/venues/${selectedCourt.venue_id}/bookings?start=${encodeURIComponent(
          startAt,
        )}&end=${encodeURIComponent(endAt)}&courtId=${formData.courtId}`,
      )) as Array<{ id: string }>;

      if (Array.isArray(conflicts) && conflicts.length > 0) {
        toast({
          title: "Time unavailable",
          description: "This court already has a booking during that time.",
          variant: "destructive",
        });
        return;
      }

      await addBooking({
        venue_id: selectedCourt.venue_id,
        booking_number: bookingNumber,
        slot_start: startAt,
        slot_end: endAt,
        court_id: Number(formData.courtId),
        player_name: formData.player,
        player_email: formData.email,
        status: formData.paymentStatus === "Paid" ? "paid" : "pending",
        payment_status: formData.paymentStatus,
        source: "Manual",
        total_price: amount,
        currency: "THB",
        duration_minutes: formData.duration,
        notes: formData.notes || null,
      });

      onOpenChange(false);
      setFormData(buildDefaultFormData());
    } catch (error) {
      toast({
        title: "Failed to create booking",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" aria-describedby="add-booking-description">
        <DialogHeader>
          <DialogTitle>Add Manual Booking</DialogTitle>
        </DialogHeader>
        <p id="add-booking-description" className="sr-only">Fill out the form to create a new booking manually</p>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time *</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="court">Court *</Label>
                <Select value={formData.courtId} onValueChange={(value) => setFormData({ ...formData, courtId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose option" />
                  </SelectTrigger>
                  <SelectContent>
                    {courts.map((court) => {
                      const inactive =
                        court.is_active === false ||
                        String(court.status ?? "active").toLowerCase() === "inactive";
                      return (
                        <SelectItem
                          key={court.id}
                          value={String(court.id)}
                          disabled={inactive}
                          className={inactive ? "opacity-40 line-through" : ""}
                        >
                          {court.name} - {court.sport ?? court.sport_type ?? "Sport"}
                          {inactive ? " (inactive)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="player">Player Name *</Label>
              <Input
                id="player"
                value={formData.player}
                onChange={(e) => setFormData({ ...formData, player: e.target.value })}
                placeholder="Enter name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes) *</Label>
                <Select value={String(formData.duration)} onValueChange={(value) => setFormData({ ...formData, duration: Number(value) })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                    <SelectItem value="120">120 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment">Payment Status *</Label>
                <Select value={formData.paymentStatus} onValueChange={(value) => setFormData({ ...formData, paymentStatus: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Enter notes"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="cta" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
