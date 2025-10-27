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
} from "lucide-react";

const Bookings = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const bookings = [
    {
      id: "BK-001",
      dateTime: "2025-01-15 09:00",
      court: "Court 1",
      sport: "Tennis",
      player: "John Doe",
      email: "john@example.com",
      status: "paid",
      payment: "PromptPay",
      source: "PlayPal App",
      amount: 300,
    },
    {
      id: "BK-002",
      dateTime: "2025-01-15 10:00",
      court: "Court 2",
      sport: "Badminton",
      player: "Sarah Miller",
      email: "sarah@example.com",
      status: "pending",
      payment: "-",
      source: "Manual",
      amount: 250,
    },
    {
      id: "BK-003",
      dateTime: "2025-01-15 11:00",
      court: "Court 1",
      sport: "Tennis",
      player: "Mike Rodriguez",
      email: "mike@example.com",
      status: "confirmed",
      payment: "Card",
      source: "PlayPal App",
      amount: 300,
    },
    {
      id: "BK-004",
      dateTime: "2025-01-15 14:00",
      court: "Court 3",
      sport: "Squash",
      player: "Emma Lee",
      email: "emma@example.com",
      status: "paid",
      payment: "PromptPay",
      source: "API",
      amount: 280,
    },
    {
      id: "BK-005",
      dateTime: "2025-01-15 15:00",
      court: "Court 2",
      sport: "Badminton",
      player: "Tom Wilson",
      email: "tom@example.com",
      status: "cancelled",
      payment: "Refunded",
      source: "PlayPal App",
      amount: 250,
    },
    {
      id: "BK-006",
      dateTime: "2025-01-16 09:00",
      court: "Court 1",
      sport: "Tennis",
      player: "Lisa Chen",
      email: "lisa@example.com",
      status: "held",
      payment: "-",
      source: "Manual",
      amount: 300,
    },
    {
      id: "BK-007",
      dateTime: "2025-01-16 10:00",
      court: "Court 4",
      sport: "Tennis",
      player: "David Park",
      email: "david@example.com",
      status: "paid",
      payment: "Card",
      source: "PlayPal App",
      amount: 300,
    },
  ];

  const getStatusColor = (status: string) => {
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
      booking.player.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.court.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

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
            <Button variant="cta">
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
                  {filteredBookings.map((booking) => (
                    <TableRow key={booking.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{booking.id}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {booking.dateTime}
                      </TableCell>
                      <TableCell>{booking.court}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {booking.sport}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{booking.player}</div>
                          <div className="text-xs text-muted-foreground">
                            {booking.email}
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
                      <TableCell className="text-sm">{booking.payment}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getSourceColor(booking.source)}
                        >
                          {booking.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ฿{booking.amount}
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
                                <DropdownMenuItem>
                                  <Check className="mr-2 h-4 w-4" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">
                                  <X className="mr-2 h-4 w-4" />
                                  Decline
                                </DropdownMenuItem>
                              </>
                            )}
                            {(booking.status === "paid" || booking.status === "confirmed") && (
                              <>
                                <DropdownMenuItem>
                                  <X className="mr-2 h-4 w-4" />
                                  Cancel
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Refund
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Bookings;
