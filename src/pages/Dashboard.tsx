import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, Plus, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AddBookingDialog } from "@/components/AddBookingDialog";

const Dashboard = () => {
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const kpis: {
    title: string;
    value: string;
    change: string;
    trend: "up" | "down";
    icon: typeof Calendar;
    period: string;
  }[] = [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your venue overview.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="cta" size="sm" onClick={() => setBookingDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add booking
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.length === 0 ? (
          <Card className="shadow-sm md:col-span-2 lg:col-span-4">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No metrics available yet
            </CardContent>
          </Card>
        ) : (
          kpis.map((kpi) => (
            <Card key={kpi.title} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`text-xs font-medium ${
                      kpi.trend === "up" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {kpi.change}
                  </span>
                  <span className="text-xs text-muted-foreground">{kpi.period}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Alerts */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-cta" />
            Alerts & Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">No alerts yet</span>
            <Badge variant="outline">none</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Today's Schedule */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Today's Schedule</CardTitle>
            <Button variant="ghost" size="sm">
              View full calendar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <span className="text-sm text-muted-foreground">No bookings scheduled for today</span>
            <Badge variant="outline">empty</Badge>
          </div>
        </CardContent>
      </Card>
      </div>
      
      <AddBookingDialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen} />
    </DashboardLayout>
  );
};

export default Dashboard;
