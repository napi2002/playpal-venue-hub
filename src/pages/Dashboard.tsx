import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Users,
  DollarSign,
  AlertCircle,
  Calendar,
  Plus,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AddBookingDialog } from "@/components/AddBookingDialog";

const Dashboard = () => {
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const kpis = [
    {
      title: "Bookings Today",
      value: "24",
      change: "+12%",
      trend: "up",
      icon: Calendar,
      period: "vs yesterday",
    },
    {
      title: "Utilization Rate",
      value: "78%",
      change: "+5%",
      trend: "up",
      icon: TrendingUp,
      period: "last 7 days",
    },
    {
      title: "Revenue (Gross)",
      value: "฿12,450",
      change: "+18%",
      trend: "up",
      icon: DollarSign,
      period: "this week",
    },
    {
      title: "No-shows",
      value: "3",
      change: "-2",
      trend: "down",
      icon: Users,
      period: "this week",
    },
  ];

  const alerts = [
    { id: 1, type: "pending", message: "2 bookings awaiting approval", priority: "high" },
    { id: 2, type: "refund", message: "1 refund request pending", priority: "medium" },
    { id: 3, type: "integration", message: "Calendar sync successful", priority: "low" },
  ];

  const todaySchedule = [
    { time: "09:00 - 10:00", court: "Court 1", sport: "Tennis", status: "confirmed", player: "John D." },
    { time: "10:00 - 11:00", court: "Court 2", sport: "Badminton", status: "paid", player: "Sarah M." },
    { time: "11:00 - 12:00", court: "Court 1", sport: "Tennis", status: "pending", player: "Mike R." },
    { time: "14:00 - 15:00", court: "Court 3", sport: "Squash", status: "confirmed", player: "Emma L." },
    { time: "15:00 - 16:00", court: "Court 2", sport: "Badminton", status: "paid", player: "Tom W." },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
      case "paid":
        return "bg-green-500/10 text-green-700 border-green-200";
      case "pending":
        return "bg-amber-500/10 text-amber-700 border-amber-200";
      case "cancelled":
        return "bg-red-500/10 text-red-700 border-red-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

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
        {kpis.map((kpi) => (
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
        ))}
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
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <span className="text-sm">{alert.message}</span>
              <Badge variant={alert.priority === "high" ? "default" : "outline"}>
                {alert.priority}
              </Badge>
            </div>
          ))}
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
          <div className="space-y-2">
            {todaySchedule.map((booking, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-sm font-medium w-32">{booking.time}</div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{booking.court}</span>
                    <span className="text-xs text-muted-foreground">{booking.sport}</span>
                  </div>
                  <span className="text-sm">{booking.player}</span>
                </div>
                <Badge className={getStatusColor(booking.status)} variant="outline">
                  {booking.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
      
      <AddBookingDialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen} />
    </DashboardLayout>
  );
};

export default Dashboard;
