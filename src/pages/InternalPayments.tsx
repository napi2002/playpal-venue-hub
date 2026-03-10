import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/apiClient";

type RevenueResponse = {
  summary: {
    commission_month: string;
    commission_all_time: string;
  } | null;
  rows: Array<{
    venue: string;
    period: string;
    total_bookings: number;
    total_gmv: string;
    commission_earned: string;
  }>;
};

const InternalPayments = () => {
  const { data } = useQuery({
    queryKey: ["internal-revenue"],
    queryFn: async () => (await apiFetch("/api/internal/revenue")) as RevenueResponse,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 text-[#1B1F23]">
        <div>
          <h1 className="text-3xl font-semibold">Payments</h1>
          <p className="mt-1 text-sm text-slate-500">Platform commission and revenue operations.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base font-medium text-slate-500">Total Commission This Month</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-semibold">THB {Number(data?.summary?.commission_month ?? 0).toLocaleString()}</div></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base font-medium text-slate-500">Total Commission All Time</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-semibold">THB {Number(data?.summary?.commission_all_time ?? 0).toLocaleString()}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-xl">Revenue by Venue</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venue</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Total Bookings</TableHead>
                  <TableHead>Total GMV</TableHead>
                  <TableHead>Commission Earned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.rows?.map((row) => (
                  <TableRow key={`${row.venue}-${row.period}`}>
                    <TableCell>{row.venue}</TableCell>
                    <TableCell>{row.period}</TableCell>
                    <TableCell>{row.total_bookings}</TableCell>
                    <TableCell>THB {Number(row.total_gmv).toLocaleString()}</TableCell>
                    <TableCell>THB {Number(row.commission_earned).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default InternalPayments;
