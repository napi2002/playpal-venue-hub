import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Filter,
  Download,
  Plus,
  MoreVertical,
  Check,
  X,
  RefreshCw,
  Eye,
  Trash2,
  Repeat,
} from "lucide-react";
import { AddBookingDialog } from "@/components/AddBookingDialog";
import { AddRecurringBookingDialog } from "@/components/AddRecurringBookingDialog";
import { useBookings } from "@/hooks/useBookings";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

const Bookings = () => {
  const [statusFilter, setStatusFilter] = useState<"all" | BookingStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const { bookings, isLoading, updateBooking, deleteBooking } = useBookings();

  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case "paid":
      case "confirmed":
        return "bg-green-500/10 text-green-700 border-green-200";
      case "pending":
      case "held":
        return "bg-amber-500/10 text-amber-700 border-amber-200";
      case "cancelled":
        return "bg-red-500/10 text-red-700 border-red-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case "PlayPal App":
        return "bg-primary/10 text-primary border-primary/20";
      case "API":
        return "bg-purple-500/10 text-purple-700 border-purple-200";
      case "Manual":
        return "bg-blue-500/10 text-blue-700 border-blue-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
    const matchesSearch =
      searchQuery === "" ||
      booking.player_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.booking_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (booking.courts?.name && booking.courts.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const formatDateTime = (date: string, time: string) => {
    try {
      const dateTime = new Date(`${date}T${time}`);
      return format(dateTime, "MMM dd, yyyy HH:mm");
    } catch {
      return `${date} ${time}`;
    }
  };

  const handleStatusChange = (bookingId: string, status: BookingStatus) => {
    updateBooking({ 
      id: bookingId, 
      updates: { status }
    });
  };

  const handleDelete = (bookingId: string) => {
    if (confirm("Are you sure you want to delete this booking?")) {
      deleteBooking(bookingId);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Bookings</h1>
            <p className="text-muted-foreground mt-1">
              {filteredBookings.length} bookings found
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={() => setRecurringDialogOpen(true)}>
              <Repeat className="mr-2 h-4 w-4" />
              Recurring
            </Button>
            <Button variant="cta" onClick={() => setBookingDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Manual booking
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by booking ID, player name, or court..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="held">Held</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bookings Table */}
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Court</TableHead>
                    <TableHead>Sport</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        Loading bookings...
                      </TableCell>
                    </TableRow>
                  ) : filteredBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No bookings found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBookings.map((booking) => (
                      <TableRow key={booking.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{booking.booking_number}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(booking.date, booking.time)}
                        </TableCell>
                        <TableCell>{booking.courts?.name || booking.court_id}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {booking.sport}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{booking.player_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {booking.player_email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getStatusColor(booking.status)}
                          >
                            {booking.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{booking.payment_status}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getSourceColor(booking.source)}
                          >
                            {booking.source}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${booking.amount}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View details
                              </DropdownMenuItem>
                              {booking.status === "pending" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "confirmed")}>
                                    <Check className="mr-2 h-4 w-4" />
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => handleStatusChange(booking.id, "cancelled")}
                                  >
                                    <X className="mr-2 h-4 w-4" />
                                    Decline
                                  </DropdownMenuItem>
                                </>
                              )}
                              {(booking.status === "paid" || booking.status === "confirmed") && (
                                <DropdownMenuItem onClick={() => handleStatusChange(booking.id, "cancelled")}>
                                  <X className="mr-2 h-4 w-4" />
                                  Cancel
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => handleDelete(booking.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <AddBookingDialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen} />
      <AddRecurringBookingDialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen} />
    </DashboardLayout>
  );
};

export default Bookings;
