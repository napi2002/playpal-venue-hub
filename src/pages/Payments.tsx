import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  MoreVertical,
  Eye,
  RotateCcw,
  DollarSign,
  TrendingUp,
  CreditCard,
  Clock,
} from "lucide-react";
import { usePayments } from "@/hooks/usePayments";
import { format } from "date-fns";

const Payments = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { payments, isLoading, refundPayment } = usePayments();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "paid":
        return "bg-green-500/10 text-green-700 border-green-200";
      case "pending":
        return "bg-amber-500/10 text-amber-700 border-amber-200";
      case "refunded":
        return "bg-purple-500/10 text-purple-700 border-purple-200";
      case "failed":
        return "bg-red-500/10 text-red-700 border-red-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    const matchesSearch =
      searchQuery === "" ||
      payment.bookings?.player_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.bookings?.booking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.transaction_id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalRevenue = payments
    .filter((p) => p.status === "completed" || p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const pendingAmount = payments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const refundedAmount = payments
    .filter((p) => p.status === "refunded")
    .reduce((sum, p) => sum + Number(p.refund_amount || 0), 0);

  const handleRefund = (paymentId: string, amount: number) => {
    if (confirm("Are you sure you want to refund this payment?")) {
      refundPayment({ id: paymentId, amount });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Payments & Payouts</h1>
            <p className="text-muted-foreground mt-1">
              Track transactions and manage payouts
            </p>
          </div>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                From {payments.filter((p) => p.status === "completed" || p.status === "paid").length} payments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">${pendingAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {payments.filter((p) => p.status === "pending").length} awaiting
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Refunded
              </CardTitle>
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">${refundedAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {payments.filter((p) => p.status === "refunded").length} refunds
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Transactions
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payments.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total transactions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by booking ID, player name, or transaction ID..."
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
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Transaction</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        Loading payments...
                      </TableCell>
                    </TableRow>
                  ) : filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No payments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => (
                      <TableRow key={payment.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-sm">
                          {payment.transaction_id || "-"}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {payment.bookings?.booking_number || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {payment.bookings?.player_name || "-"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {payment.bookings?.player_email || ""}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {payment.paid_at
                            ? format(new Date(payment.paid_at), "MMM dd, yyyy HH:mm")
                            : format(new Date(payment.created_at), "MMM dd, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {payment.payment_method || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getStatusColor(payment.status || "")}
                          >
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {payment.currency} {Number(payment.amount).toFixed(2)}
                          {payment.refund_amount && (
                            <div className="text-xs text-purple-600">
                              Refund: {payment.currency} {Number(payment.refund_amount).toFixed(2)}
                            </div>
                          )}
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
                              {(payment.status === "completed" || payment.status === "paid") &&
                                !payment.refund_amount && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleRefund(payment.id, Number(payment.amount))
                                    }
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Refund
                                  </DropdownMenuItem>
                                )}
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
    </DashboardLayout>
  );
};

export default Payments;
