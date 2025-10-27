import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Clock,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Availability = () => {
  const [selectedCourt, setSelectedCourt] = useState("all");
  const [currentWeek, setCurrentWeek] = useState(0);

  const courts = ["All Courts", "Court 1", "Court 2", "Court 3", "Court 4"];
  
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const timeSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", 
    "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"
  ];

  const availabilityRules = [
    {
      id: 1,
      name: "Weekday Morning",
      courts: ["Court 1", "Court 2"],
      days: "Mon-Fri",
      time: "08:00-12:00",
      minDuration: "60 mins",
      buffer: "15 mins",
      leadTime: "2 hours",
    },
    {
      id: 2,
      name: "Weekend Peak",
      courts: ["All Courts"],
      days: "Sat-Sun",
      time: "09:00-18:00",
      minDuration: "90 mins",
      buffer: "15 mins",
      leadTime: "4 hours",
    },
    {
      id: 3,
      name: "Evening Slots",
      courts: ["Court 3", "Court 4"],
      days: "Mon-Sun",
      time: "17:00-21:00",
      minDuration: "60 mins",
      buffer: "10 mins",
      leadTime: "2 hours",
    },
  ];

  const getSlotStatus = (day: number, time: string) => {
    const random = Math.random();
    
    // When viewing all courts, show partly/fully booked states
    if (selectedCourt === "all" || selectedCourt === "all-courts") {
      if (random > 0.7) return "available";
      if (random > 0.5) return "partly-booked";
      if (random > 0.3) return "fully-booked";
      return "blocked";
    }
    
    // For individual courts, show simple available/booked/blocked
    if (random > 0.7) return "available";
    if (random > 0.5) return "booked";
    return "blocked";
  };

  const getSlotColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-100 hover:bg-green-200 border-green-300";
      case "partly-booked":
        return "bg-orange-100 hover:bg-orange-200 border-orange-300";
      case "fully-booked":
        return "bg-red-100 border-red-300";
      case "booked":
        return "bg-blue-100 border-blue-300";
      case "blocked":
        return "bg-gray-100 border-gray-300";
      default:
        return "bg-muted";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Availability Management</h1>
            <p className="text-muted-foreground mt-1">Set and manage court availability schedules</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Copy className="mr-2 h-4 w-4" />
              Bulk edit
            </Button>
            <Button variant="cta">
              <Plus className="mr-2 h-4 w-4" />
              Add availability
            </Button>
          </div>
        </div>

        <Tabs defaultValue="calendar" className="space-y-6">
          <TabsList>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            <TabsTrigger value="rules">Rules & Overrides</TabsTrigger>
          </TabsList>

          {/* Calendar View */}
          <TabsContent value="calendar" className="space-y-4">
            {/* Filters */}
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Select value={selectedCourt} onValueChange={setSelectedCourt}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select court" />
                      </SelectTrigger>
                      <SelectContent>
                        {courts.map((court) => (
                          <SelectItem key={court} value={court.toLowerCase().replace(" ", "-")}>
                            {court}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentWeek(currentWeek - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2 px-4">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Week {currentWeek + 1}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentWeek(currentWeek + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Calendar Grid */}
            <Card className="shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-border">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-20">
                            Time
                          </th>
                          {weekDays.map((day) => (
                            <th
                              key={day}
                              className="px-4 py-3 text-center text-xs font-medium text-muted-foreground"
                            >
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border bg-background">
                        {timeSlots.map((time) => (
                          <tr key={time}>
                            <td className="px-4 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">
                              {time}
                            </td>
                            {weekDays.map((_, dayIndex) => {
                              const status = getSlotStatus(dayIndex, time);
                              return (
                                <td key={dayIndex} className="p-1">
                                  <button
                                    className={`w-full h-12 rounded border-2 transition-colors ${getSlotColor(
                                      status
                                    )}`}
                                    title={`${status} - ${time}`}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-6 px-4 py-3 border-t border-border bg-muted/30">
                  <span className="text-xs font-medium text-muted-foreground">Legend:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-100 border-2 border-green-300" />
                    <span className="text-xs">Available</span>
                  </div>
                  {(selectedCourt === "all" || selectedCourt === "all-courts") ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-orange-100 border-2 border-orange-300" />
                        <span className="text-xs">Partly Booked</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-red-100 border-2 border-red-300" />
                        <span className="text-xs">Fully Booked</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-300" />
                      <span className="text-xs">Booked</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-gray-100 border-2 border-gray-300" />
                    <span className="text-xs">Blocked</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rules */}
          <TabsContent value="rules" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Availability Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {availabilityRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{rule.name}</h4>
                        <div className="flex gap-2 mt-2">
                          {rule.courts.map((court) => (
                            <Badge key={court} variant="secondary" className="text-xs">
                              {court}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm">
                          Delete
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Days:</span>
                        <p className="font-medium">{rule.days}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Time:</span>
                        <p className="font-medium">{rule.time}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Min duration:</span>
                        <p className="font-medium">{rule.minDuration}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Lead time:</span>
                        <p className="font-medium">{rule.leadTime}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Special Events & Closures
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No special events or closures scheduled</p>
                  <Button variant="cta" className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Add override
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Availability;
