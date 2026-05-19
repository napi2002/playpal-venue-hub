import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecurringBookings } from "@/hooks/useRecurringBookings";
import { useCourts } from "@/hooks/useCourts";
import { useToast } from "@/hooks/use-toast";
import { TablesInsert } from "@/integrations/supabase/types";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AddRecurringBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const daysOfWeek = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const timeToMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function AddRecurringBookingDialog({ open, onOpenChange }: AddRecurringBookingDialogProps) {
  const { courts } = useCourts();
  const { addRecurringBooking, recurringBookings } = useRecurringBookings();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    court_id: "",
    day_of_week: "",
    time: "",
    duration: "60",
    player_name: "",
    player_email: "",
    start_date: new Date(),
    end_date: undefined as Date | undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const venue_id = courts[0]?.venue_id;
    if (!venue_id) {
      console.error("No venue found");
      return;
    }

    if (!formData.court_id || !formData.day_of_week) {
      return;
    }

    const courtId = Number(formData.court_id);
    const dayOfWeek = parseInt(formData.day_of_week, 10);
    const duration = parseInt(formData.duration, 10);

    if (isNaN(dayOfWeek) || isNaN(duration) || duration <= 0) {
      return;
    }

    const newStart = timeToMinutes(formData.time);
    const newEnd = newStart + duration;
    const hasConflict = recurringBookings.some((existing) => {
      if (existing.status === "cancelled") return false;
      if (String(existing.court_id) !== formData.court_id) return false;
      if (existing.day_of_week !== dayOfWeek) return false;
      const existingStart = timeToMinutes(existing.time);
      const existingEnd = existingStart + Number(existing.duration);
      return newStart < existingEnd && newEnd > existingStart;
    });

    if (hasConflict) {
      toast({
        title: "Time conflict",
        description: "A recurring booking already exists at this time for this court.",
        variant: "destructive",
      });
      return;
    }

    const recurringBooking: TablesInsert<"recurring_bookings"> = {
      venue_id,
      court_id: courtId,
      day_of_week: dayOfWeek,
      time: formData.time,
      duration,
      player_name: formData.player_name,
      player_email: formData.player_email,
      start_date: format(formData.start_date, "yyyy-MM-dd"),
      end_date: formData.end_date ? format(formData.end_date, "yyyy-MM-dd") : null,
      status: "active",
    };

    try {
      await addRecurringBooking(recurringBooking);
      onOpenChange(false);
      setFormData({
        court_id: "",
        day_of_week: "",
        time: "",
        duration: "60",
        player_name: "",
        player_email: "",
        start_date: new Date(),
        end_date: undefined,
      });
    } catch {
      // error toast is handled by the mutation's onError
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Recurring Booking</DialogTitle>
          <DialogDescription>
            Create a booking that repeats weekly on a specific day and time
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="court">Court</Label>
              <Select value={formData.court_id} onValueChange={(value) => setFormData({ ...formData, court_id: value })}>
                <SelectTrigger id="court">
                  <SelectValue placeholder="Choose option" />
                </SelectTrigger>
                <SelectContent>
                  {courts.map((court) => (
                    <SelectItem key={court.id} value={String(court.id)}>
                      {court.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="day">Day of Week</Label>
              <Select value={formData.day_of_week} onValueChange={(value) => setFormData({ ...formData, day_of_week: value })}>
                <SelectTrigger id="day">
                  <SelectValue placeholder="Choose option" />
                </SelectTrigger>
                <SelectContent>
                  {daysOfWeek.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="player_name">Player Name</Label>
              <Input
                id="player_name"
                value={formData.player_name}
                onChange={(e) => setFormData({ ...formData, player_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="player_email">Player Email</Label>
              <Input
                id="player_email"
                type="email"
                value={formData.player_email}
                onChange={(e) => setFormData({ ...formData, player_email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.start_date ? format(formData.start_date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.start_date}
                    onSelect={(date) => date && setFormData({ ...formData, start_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.end_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.end_date ? format(formData.end_date, "PPP") : <span>No end date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.end_date}
                    onSelect={(date) => setFormData({ ...formData, end_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="cta">
              Create Recurring Booking
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
