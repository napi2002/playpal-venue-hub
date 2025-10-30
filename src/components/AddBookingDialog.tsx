import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBookings } from "@/contexts/BookingsContext";
import { useToast } from "@/hooks/use-toast";

interface AddBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddBookingDialog = ({ open, onOpenChange }: AddBookingDialogProps) => {
  const { addBooking } = useBookings();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: "09:00",
    court: "",
    sport: "",
    player: "",
    email: "",
    duration: 60,
    payment: "pending",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.court || !formData.sport || !formData.player || !formData.email) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const pricePerHour = formData.sport === "Tennis" ? 800 : 600;
    const amount = (pricePerHour * formData.duration) / 60;

    addBooking({
      date: formData.date,
      time: formData.time,
      court: formData.court,
      sport: formData.sport,
      player: formData.player,
      email: formData.email,
      status: "pending",
      payment: formData.payment === "paid" ? "Paid" : "Pending",
      source: "Manual",
      amount: `฿${amount.toLocaleString()}`,
      duration: formData.duration,
      notes: formData.notes,
    });

    toast({
      title: "Booking created",
      description: `Booking for ${formData.player} has been added successfully`,
    });

    onOpenChange(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      time: "09:00",
      court: "",
      sport: "",
      player: "",
      email: "",
      duration: 60,
      payment: "pending",
      notes: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Manual Booking</DialogTitle>
        </DialogHeader>
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
                <Select value={formData.court} onValueChange={(value) => setFormData({ ...formData, court: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select court" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Court 1">Court 1</SelectItem>
                    <SelectItem value="Court 2">Court 2</SelectItem>
                    <SelectItem value="Court 3">Court 3</SelectItem>
                    <SelectItem value="Court 4">Court 4</SelectItem>
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
                    <SelectItem value="Badminton">Badminton</SelectItem>
                    <SelectItem value="Pickleball">Pickleball</SelectItem>
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
                <Select value={formData.payment} onValueChange={(value) => setFormData({ ...formData, payment: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
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
            <Button type="submit" variant="cta">
              Create Booking
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
