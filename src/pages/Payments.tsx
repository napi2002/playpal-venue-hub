import { useEffect, useMemo, useState } from "react";
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
import { Download, Filter, Search } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 10;

type PaymentStatus = "PENDING" | "COMPLETED" | "REFUNDED" | "FAILED";

type PaymentRecord = {
  id: string;
  booking_id: string;
  player_name: string;
  amount: number | string;
  currency?: string | null;
  status: PaymentStatus;
  method?: string | null;
  transaction_id?: string | null;
  created_at: string;
};

type PaymentsResponse = {
  data: PaymentRecord[];
  total: number;
};

type SummaryResponse = {
  completedAmount: number;
  completedCount: number;
  pendingAmount: number;
  pendingCount: number;
  refundedAmount: number;
  refundedCount: number;
  totalCount: number;
};

type PendingBooking = {
  id: string;
  booking_number: string | null;
  player_name: string | null;
  court_name: string | null;
  date: string | null;
  time: string | null;
  amount: number | string;
  status: string | null;
  created_at: string;
};

type PendingBookingsResponse = {
  data: PendingBooking[];
  total: number;
};

const Payments = () => {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [totalPayments, setTotalPayments] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
      setPendingPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (searchQuery) params.set("q", searchQuery);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    return params;
  }, [page, searchQuery, statusFilter]);

  const pendingQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    params.set("page", String(pendingPage));
    params.set("pageSize", String(PAGE_SIZE));
    return params;
  }, [pendingPage, searchQuery]);

  const fetchSummary = async () => {
    try {
      const data = await apiFetch(`/payments/summary?${queryParams.toString()}`);
      setSummary(data as SummaryResponse);
    } catch (error) {
      toast({
        title: "Failed to load summary",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const response = (await apiFetch(`/payments?${queryParams.toString()}`)) as
        | PaymentsResponse
        | { data: PaymentRecord[]; total: number }
        | { items: PaymentRecord[]; total: number };

      const data = "items" in response ? response.items : response.data;
      setPayments(data || []);
      setTotalPayments(response.total ?? data.length);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load payments");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingBookings = async () => {
    try {
      setPendingLoading(true);
      setPendingError(null);
      const response = (await apiFetch(
        `/payments/pending?${pendingQueryParams.toString()}`,
      )) as PendingBookingsResponse;
      setPendingBookings(response.data ?? []);
      setPendingTotal(response.total ?? 0);
    } catch (error) {
      setPendingError(
        error instanceof Error ? error.message : "Failed to load pending bookings",
      );
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchPayments();
  }, [queryParams.toString()]);

  useEffect(() => {
    fetchPendingBookings();
  }, [pendingQueryParams.toString()]);

  const totalPages = Math.max(1, Math.ceil(totalPayments / PAGE_SIZE));
  const pendingTotalPages = Math.max(1, Math.ceil(pendingTotal / PAGE_SIZE));

  const statusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-500/10 text-green-700 border-green-200";
      case "PENDING":
        return "bg-amber-500/10 text-amber-700 border-amber-200";
      case "REFUNDED":
        return "bg-purple-500/10 text-purple-700 border-purple-200";
      case "FAILED":
        return "bg-red-500/10 text-red-700 border-red-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleExport = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/payments/export?${queryParams.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `payments_${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  const renderSummaryValue = (value?: number) => (value ?? 0).toFixed(2);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Payments & Payouts</h1>
            <p className="text-muted-foreground mt-1">
              Track transactions and manage payouts
            </p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ฿{renderSummaryValue(summary?.completedAmount)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary?.completedCount ?? 0} payments completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                ฿{renderSummaryValue(summary?.pendingAmount)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary?.pendingCount ?? 0} awaiting
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Refunded</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                ฿{renderSummaryValue(summary?.refundedAmount)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary?.refundedCount ?? 0} refunds
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.totalCount ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total transactions
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by booking ID, player name, or transaction ID..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | PaymentStatus)}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="REFUNDED">Refunded</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Player Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: PAGE_SIZE }).map((_, index) => (
                      <TableRow key={`skeleton-${index}`} className="animate-pulse">
                        <TableCell colSpan={7}>
                          <div className="h-4 w-full rounded bg-muted" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : errorMessage ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-destructive">
                        {errorMessage}
                      </TableCell>
                    </TableRow>
                  ) : payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No payments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment) => (
                      <TableRow key={payment.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-sm">
                          {payment.transaction_id || payment.id}
                        </TableCell>
                        <TableCell>{payment.booking_id}</TableCell>
                        <TableCell>{payment.player_name}</TableCell>
                        <TableCell>
                          {new Date(payment.created_at).toLocaleString("en-GB", {
                            hour12: false,
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {payment.method || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge(payment.status)}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ฿{Number(payment.amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1 || isLoading}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages || isLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6 pb-4">
            <div>
              <h2 className="text-lg font-semibold">Pending bookings</h2>
              <p className="text-sm text-muted-foreground">
                Bookings awaiting payment confirmation
              </p>
            </div>
          </CardContent>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Event Name</TableHead>
                    <TableHead>Court</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingLoading ? (
                    Array.from({ length: PAGE_SIZE }).map((_, index) => (
                      <TableRow key={`pending-skeleton-${index}`} className="animate-pulse">
                        <TableCell colSpan={6}>
                          <div className="h-4 w-full rounded bg-muted" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : pendingError ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-destructive">
                        {pendingError}
                      </TableCell>
                    </TableRow>
                  ) : pendingBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No pending bookings
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingBookings.map((booking) => (
                      <TableRow key={booking.id} className="hover:bg-muted/30">
                        <TableCell>{booking.booking_number ?? booking.id}</TableCell>
                        <TableCell>{booking.player_name ?? "-"}</TableCell>
                        <TableCell>{booking.court_name ?? "-"}</TableCell>
                        <TableCell>
                          {booking.date && booking.time
                            ? `${booking.date} ${booking.time}`
                            : booking.created_at
                              ? new Date(booking.created_at).toLocaleString("en-GB", {
                                  hour12: false,
                                })
                              : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge("PENDING")}>
                            PENDING
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ฿{Number(booking.amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-sm text-muted-foreground">
                Page {pendingPage} of {pendingTotalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPendingPage((prev) => Math.max(1, prev - 1))}
                  disabled={pendingPage === 1 || pendingLoading}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPendingPage((prev) => Math.min(pendingTotalPages, prev + 1))}
                  disabled={pendingPage >= pendingTotalPages || pendingLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Payments;
