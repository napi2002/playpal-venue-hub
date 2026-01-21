import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBookings } from "@/hooks/useBookings";
import { useCourts } from "@/hooks/useCourts";

interface AddBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddBookingDialog = ({ open, onOpenChange }: AddBookingDialogProps) => {
  const { addBooking } = useBookings();
  const { courts } = useCourts();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: "09:00",
    courtId: "",
    sport: "",
    player: "",
    email: "",
    duration: 60,
    paymentStatus: "Pending",
    notes: "",
  });

  const generateBookingNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 90) + 10;
    return `BK${timestamp}${random}`;
  };

  const toBangkokUtcIso = (date: string, time: string) => {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    // Bangkok is UTC+7; store UTC in the DB.
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0));
    return utcDate.toISOString();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!formData.courtId || !formData.sport || !formData.player || !formData.email) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Get venue_id from the selected court
      const selectedCourt = courts.find(c => c.id === formData.courtId);
      if (!selectedCourt) {
        throw new Error("Selected court not found");
      }
      if (!selectedCourt.venue_id) {
        throw new Error("Selected court is missing venue access");
      }

      // Calculate amount based on sport and duration
      const pricePerHour = formData.sport === "Tennis" ? 45 : formData.sport === "Padel" ? 40 : 35;
      const amount = ((pricePerHour * formData.duration) / 60).toFixed(2);

      const bookingNumber = generateBookingNumber();
      const startAt = toBangkokUtcIso(formData.date, formData.time);
      const endAt = new Date(new Date(startAt).getTime() + formData.duration * 60000).toISOString();

      await addBooking({
        venue_id: selectedCourt.venue_id,
        booking_number: bookingNumber,
        date: formData.date,
        time: formData.time,
        start_at: startAt,
        end_at: endAt,
        court_id: formData.courtId,
        sport: formData.sport,
        player_name: formData.player,
        player_email: formData.email,
        status: formData.paymentStatus === "Paid" ? "paid" : "pending",
        payment_status: formData.paymentStatus,
        source: "Manual",
        amount: amount,
        duration: formData.duration,
        notes: formData.notes || null,
      });

      onOpenChange(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        time: "09:00",
        courtId: "",
        sport: "",
        player: "",
        email: "",
        duration: 60,
        paymentStatus: "Pending",
        notes: "",
      });
    } catch (error) {
      console.error("Error creating booking:", error);
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
                    <SelectValue placeholder="Select court" />
                  </SelectTrigger>
                  <SelectContent>
                    {courts.map((court) => (
                      <SelectItem key={court.id} value={court.id}>
                        {court.name} - {court.sport}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sport">Sport *</Label>
                <Select value={formData.sport} onValueChange={(value) => setFormData({ ...formData, sport: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tennis">Tennis</SelectItem>
                    <SelectItem value="Padel">Padel</SelectItem>
                    <SelectItem value="Squash">Squash</SelectItem>
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
                placeholder="Enter player name"
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
                placeholder="player@example.com"
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
                placeholder="Add any special notes or requirements"
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
