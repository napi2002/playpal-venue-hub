import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Plus,
  Upload,
  Edit,
  Trash2,
  Copy,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Venue = () => {
  const courts = [
    {
      id: 1,
      name: "Court 1",
      sport: "Tennis",
      status: "active",
      peakPrice: 300,
      offPeakPrice: 200,
      buffer: 15,
    },
    {
      id: 2,
      name: "Court 2",
      sport: "Badminton",
      status: "active",
      peakPrice: 250,
      offPeakPrice: 180,
      buffer: 10,
    },
    {
      id: 3,
      name: "Court 3",
      sport: "Squash",
      status: "active",
      peakPrice: 280,
      offPeakPrice: 200,
      buffer: 15,
    },
    {
      id: 4,
      name: "Court 4",
      sport: "Tennis",
      status: "inactive",
      peakPrice: 300,
      offPeakPrice: 200,
      buffer: 15,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Venue & Courts</h1>
            <p className="text-muted-foreground mt-1">Manage your venue profile and courts</p>
          </div>
          <Button variant="cta">
            <Plus className="mr-2 h-4 w-4" />
            Add court
          </Button>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Venue Profile</TabsTrigger>
            <TabsTrigger value="courts">Courts</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
          </TabsList>

          {/* Venue Profile */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Venue Information</CardTitle>
                  <Button variant="outline" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Venue name</Label>
                    <Input value="Central Sports Complex" readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Time zone</Label>
                    <Input value="Asia/Bangkok (GMT+7)" readOnly />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Address
                  </Label>
                  <Input
                    value="123 Sports Avenue, Bangkok 10110, Thailand"
                    readOnly
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Contact phone
                    </Label>
                    <Input value="+66 2 123 4567" readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Contact email
                    </Label>
                    <Input value="info@centralsports.com" readOnly />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Sports supported</Label>
                  <div className="flex gap-2">
                    <Badge variant="secondary">Tennis</Badge>
                    <Badge variant="secondary">Badminton</Badge>
                    <Badge variant="secondary">Squash</Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tax information</Label>
                  <Input value="7% VAT included in prices" readOnly />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Courts */}
          <TabsContent value="courts" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {courts.length} courts total • {courts.filter(c => c.status === "active").length} active
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate pricing
                </Button>
                <Button variant="outline" size="sm">
                  Import courts
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {courts.map((court) => (
                <Card key={court.id} className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{court.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {court.sport}
                        </p>
                      </div>
                      <Badge
                        variant={court.status === "active" ? "default" : "outline"}
                        className={
                          court.status === "active"
                            ? "bg-green-500/10 text-green-700 border-green-200"
                            : ""
                        }
                      >
                        {court.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Peak price:</span>
                        <span className="font-medium">฿{court.peakPrice}/hr</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Off-peak:</span>
                        <span className="font-medium">฿{court.offPeakPrice}/hr</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Buffer:</span>
                        <span className="font-medium">{court.buffer} mins</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Photos */}
          <TabsContent value="photos">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Venue Photos</CardTitle>
                  <Button variant="cta" size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload photos
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="relative aspect-video rounded-lg bg-muted flex items-center justify-center border border-border"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Venue;
