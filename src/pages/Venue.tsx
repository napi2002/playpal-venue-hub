import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useVenue } from "@/hooks/useVenue";
import { useCourts } from "@/hooks/useCourts";
import { usePhotos } from "@/hooks/usePhotos";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import { useQueryClient } from "@tanstack/react-query";

const Venue = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { venue, isLoading, updateVenue, createVenue, isSaving } = useVenue();
  const { courts, isLoading: isCourtsLoading } = useCourts();
  const { photos, isLoading: isPhotosLoading } = usePhotos();
  const [isEditing, setIsEditing] = useState(false);
  const [editingCourt, setEditingCourt] = useState<null | {
    id: string | null;
    name: string;
    sport: string | null;
    sport_type: string | null;
    status: string | null;
    environment: string | null;
    weekday_price_per_hour_thb: number | null;
    weekend_price_per_hour_thb: number | null;
    off_peak_price: number | null;
    peak_price: number | null;
  }>(null);
  const [courtForm, setCourtForm] = useState({
    name: "",
    sport: "",
    status: "active",
    environment: "",
    weekdayPrice: "",
    weekendPrice: "",
  });
  const [isSavingCourt, setIsSavingCourt] = useState(false);
  const [coordsStatus, setCoordsStatus] = useState<"idle" | "resolving" | "done" | "failed">("idle");
  const [formData, setFormData] = useState({
    name_en: "",
    name_th: "",
    timezone: "",
    address_line1: "",
    subdistrict: "",
    district: "",
    province: "",
    postcode: "",
    google_maps_url: "",
    phone: "",
    email: "",
    tax_information: "",
    default_slot_duration_mins: "",
  });
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [sportsMenuOpen, setSportsMenuOpen] = useState(false);

  const sportOptions = [
    "TENNIS",
    "BADMINTON",
    "PADEL",
    "PICKLEBALL",
    "BASKETBALL",
    "FOOTBALL",
    "FUTSAL",
    "GYM",
    "BOULDERING",
    "VOLLEYBALL",
    "BOWLING",
    "SQUASH",
  ];
  const venueTypeOptions = new Set([
    "TENNIS",
    "PADEL",
    "BADMINTON",
    "PICKLEBALL",
    "BASKETBALL",
    "FOOTBALL",
    "FUTSAL",
    "GYM",
    "BOULDERING",
    "VOLLEYBALL",
    "BOWLING",
    "SQUASH",
    "MULTI_SPORT",
  ]);

  const sportsSupported = useMemo(() => {
    if (selectedSports.length > 0) return selectedSports;
    const unique = new Set<string>();
    courts.forEach((court) => {
      const sport = court.sport_type || court.sport;
      if (sport) unique.add(String(sport).toUpperCase());
    });
    return Array.from(unique);
  }, [courts, selectedSports]);

  const resetCourtForm = () => {
    setCourtForm({
      name: "",
      sport: "",
      status: "active",
      environment: "",
      weekdayPrice: "",
      weekendPrice: "",
    });
  };

  const coverPhoto = useMemo(
    () => photos.find((photo) => photo.type === "COVER"),
    [photos],
  );
  const entrancePhoto = useMemo(
    () => photos.find((photo) => photo.type === "ENTRANCE"),
    [photos],
  );
  const facilityPhotos = useMemo(
    () => photos.filter((photo) => photo.type === "FACILITY"),
    [photos],
  );
  const courtPhotosById = useMemo(() => {
    const map = new Map<string, string[]>();
    photos
      .filter((photo) => photo.type === "COURT" && photo.court_id)
      .forEach((photo) => {
        const key = photo.court_id as string;
        const list = map.get(key) ?? [];
        list.push(photo.url);
        map.set(key, list);
      });
    return map;
  }, [photos]);

  const openingHoursSummary = useMemo(() => {
    const hours = venue?.opening_hours as
      | Record<string, { isOpen: boolean; openTime: string; closeTime: string }>
      | null
      | undefined;
    if (!hours) return [];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((day) => {
      const entry = hours[day];
      if (!entry) return `${day}: —`;
      if (!entry.isOpen) return `${day}: Closed`;
      return `${day}: ${entry.openTime} - ${entry.closeTime}`;
    });
  }, [venue]);

  useEffect(() => {
    if (venue) {
      const sportsFromVenue = (venue as typeof venue & { sports_supported?: string[] | null })
        ?.sports_supported;
      const normalizedSports = Array.isArray(sportsFromVenue)
        ? sportsFromVenue.map((sport) => String(sport).toUpperCase())
        : venue.venue_type
          ? [String(venue.venue_type)]
          : [];
      setFormData({
        name_en: venue.name_en ?? venue.name ?? "",
        name_th: venue.name_th ?? "",
        timezone: venue.timezone ?? "",
        address_line1: venue.address_line1 ?? venue.address ?? "",
        subdistrict: venue.subdistrict ?? "",
        district: venue.district ?? "",
        province: venue.province ?? "",
        postcode: venue.postcode ?? "",
        google_maps_url: venue.google_maps_url ?? "",
        phone: venue.phone ?? "",
        email: venue.email ?? "",
        tax_information: venue.tax_information ?? "",
        default_slot_duration_mins:
          venue.default_slot_duration_mins != null ? String(venue.default_slot_duration_mins) : "",
      });
      setSelectedSports(normalizedSports);
    }
  }, [venue]);

  const toNullableValue = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const handleEditCourt = (court: typeof courts[number]) => {
    const sportValue = court.sport_type ?? court.sport ?? "";
    const normalizedSport =
      typeof sportValue === "string" ? sportValue.toUpperCase() : sportValue;
    const environmentValue = court.environment ?? "";
    setEditingCourt({
      id: court.id,
      name: court.name ?? "",
      sport: court.sport ?? null,
      sport_type: court.sport_type ?? null,
      status: court.status ?? "active",
      environment: court.environment ?? null,
      weekday_price_per_hour_thb: court.weekday_price_per_hour_thb ?? null,
      weekend_price_per_hour_thb: court.weekend_price_per_hour_thb ?? null,
      off_peak_price: court.off_peak_price ?? null,
      peak_price: court.peak_price ?? null,
    });
    setCourtForm({
      name: court.name ?? "",
      sport: normalizedSport || "",
      status: court.status ?? "active",
      environment: typeof environmentValue === "string" ? environmentValue.toUpperCase() : "",
      weekdayPrice: String(
        court.weekday_price_per_hour_thb ?? court.off_peak_price ?? "",
      ),
      weekendPrice: String(
        court.weekend_price_per_hour_thb ?? court.peak_price ?? "",
      ),
    });
  };

  const handleAddCourt = () => {
    setEditingCourt({
      id: null,
      name: "",
      sport: null,
      sport_type: null,
      status: "active",
      environment: null,
      weekday_price_per_hour_thb: null,
      weekend_price_per_hour_thb: null,
      off_peak_price: null,
      peak_price: null,
    });
    resetCourtForm();
  };

  const handleSaveCourt = async () => {
    if (!editingCourt) return;
    if (!courtForm.name.trim()) {
      toast({ title: "Court name is required", variant: "destructive" });
      return;
    }

    setIsSavingCourt(true);
    try {
      const sportType =
        courtForm.sport === "TENNIS" ||
        courtForm.sport === "PADEL" ||
        courtForm.sport === "BADMINTON"
          ? courtForm.sport
          : null;
      const environmentType =
        courtForm.environment === "INDOOR" ||
        courtForm.environment === "OUTDOOR" ||
        courtForm.environment === "COVERED"
          ? courtForm.environment
          : null;
      const payload = {
        name: courtForm.name.trim(),
        sport: sportType ?? (courtForm.sport.trim() || null),
        sport_type: sportType,
        status: courtForm.status || "active",
        environment: environmentType,
        weekday_price_per_hour_thb: courtForm.weekdayPrice
          ? Number(courtForm.weekdayPrice)
          : null,
        weekend_price_per_hour_thb: courtForm.weekendPrice
          ? Number(courtForm.weekendPrice)
          : null,
      };

      if (editingCourt.id) {
        await apiFetch(`/api/courts/${editingCourt.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast({ title: "Court updated" });
      } else {
        if (!venue?.id) {
          throw new Error("Venue not found. Save your venue profile first.");
        }
        await apiFetch(`/api/venues/${venue.id}/courts/create`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast({ title: "Court added" });
      }

      setEditingCourt(null);
      resetCourtForm();
      queryClient.invalidateQueries({ queryKey: ["courts"] });
    } catch (error) {
      toast({
        title: "Failed to save court",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSavingCourt(false);
    }
  };

  const selectableSports = selectedSports.length > 0 ? selectedSports : sportOptions;

  const isGoogleMapsUrl = (url: string) => {
    return (
      url.includes("maps.app.goo.gl") ||
      url.includes("maps.google.com") ||
      url.includes("google.com/maps") ||
      url.includes("goo.gl/maps")
    );
  };

  const resolveCoords = async (
    mapsUrl: string | null | undefined,
  ): Promise<{ latitude: number; longitude: number } | null> => {
    if (!mapsUrl?.trim()) return null;
    try {
      setCoordsStatus("resolving");
      const encoded = encodeURIComponent(mapsUrl.trim());
      const result = await apiFetch(`/api/resolve-url?url=${encoded}`);
      if (result?.extracted && result.latitude != null && result.longitude != null) {
        setCoordsStatus("done");
        return { latitude: result.latitude, longitude: result.longitude };
      }
      setCoordsStatus("failed");
      return null;
    } catch {
      setCoordsStatus("failed");
      return null;
    }
  };

  const handleSave = async () => {
    const nameValue = formData.name_en.trim() || venue?.name || "New Venue";
    const normalizedSelected = selectedSports.map((sport) => String(sport).toUpperCase());
    const firstSport = normalizedSelected[0] ?? null;
    const venueType =
      normalizedSelected.length === 1 && firstSport && venueTypeOptions.has(firstSport)
        ? firstSport
        : normalizedSelected.length > 1
          ? "MULTI_SPORT"
          : venue?.venue_type ?? null;
    const mapsUrl = toNullableValue(formData.google_maps_url);

    if (mapsUrl && !isGoogleMapsUrl(mapsUrl)) {
      toast({
        title: "Invalid Google Maps URL",
        description: "Please use a Google Maps link. Open Google Maps, find your venue, and tap Share → Copy link.",
        variant: "destructive",
      });
      return;
    }

    const urlChanged = mapsUrl !== (venue?.google_maps_url ?? null);
    const coordsMissing = !venue?.latitude || !venue?.longitude;
    const coords = (urlChanged || coordsMissing)
      ? await resolveCoords(mapsUrl)
      : null;

    const updates = {
      name: nameValue,
      name_en: nameValue,
      name_th: toNullableValue(formData.name_th),
      venue_type: venueType,
      sports_supported: normalizedSelected,
      timezone: toNullableValue(formData.timezone),
      address_line1: toNullableValue(formData.address_line1),
      subdistrict: toNullableValue(formData.subdistrict),
      district: toNullableValue(formData.district),
      province: toNullableValue(formData.province),
      postcode: toNullableValue(formData.postcode),
      google_maps_url: toNullableValue(formData.google_maps_url),
      phone: toNullableValue(formData.phone),
      email: toNullableValue(formData.email),
      tax_information: toNullableValue(formData.tax_information),
      default_slot_duration_mins: formData.default_slot_duration_mins
        ? Number(formData.default_slot_duration_mins)
        : null,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    };

    if (venue) {
      await updateVenue({ id: venue.id, updates });
    } else {
      await createVenue({
        name: updates.name,
        timezone: updates.timezone,
        address: updates.address_line1,
        phone: updates.phone,
        email: updates.email,
        tax_information: updates.tax_information,
      });
    }

    setIsEditing(false);
  };

  const handleCancel = () => {
    if (venue) {
      const sportsFromVenue = (venue as typeof venue & { sports_supported?: string[] | null })
        ?.sports_supported;
      const normalizedSports = Array.isArray(sportsFromVenue)
        ? sportsFromVenue.map((sport) => String(sport).toUpperCase())
        : venue.venue_type
          ? [String(venue.venue_type)]
          : [];
      setFormData({
        name_en: venue.name_en ?? venue.name ?? "",
        name_th: venue.name_th ?? "",
        timezone: venue.timezone ?? "",
        address_line1: venue.address_line1 ?? venue.address ?? "",
        subdistrict: venue.subdistrict ?? "",
        district: venue.district ?? "",
        province: venue.province ?? "",
        postcode: venue.postcode ?? "",
        google_maps_url: venue.google_maps_url ?? "",
        phone: venue.phone ?? "",
        email: venue.email ?? "",
        tax_information: venue.tax_information ?? "",
        default_slot_duration_mins:
          venue.default_slot_duration_mins != null ? String(venue.default_slot_duration_mins) : "",
      });
      setSelectedSports(normalizedSports);
    }
    setIsEditing(false);
  };

  const isReadOnly = !isEditing || isLoading;
  const isCreatingCourt = Boolean(editingCourt && editingCourt.id === null);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Venue & Courts</h1>
            <p className="text-muted-foreground mt-1">Manage your venue profile and courts</p>
          </div>
          <Button variant="cta" onClick={handleAddCourt}>
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
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancel}
                          disabled={isSaving}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={isSaving}>
                          {isSaving ? "Saving..." : "Save"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        disabled={isLoading}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        {venue ? "Edit" : "Create venue"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Venue name (EN)</Label>
                    <Input
                      value={formData.name_en}
                      placeholder={isLoading ? "Loading..." : "Not set"}
                      onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                      readOnly={isReadOnly}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Venue name (TH)</Label>
                    <Input
                      value={formData.name_th}
                      placeholder={isLoading ? "Loading..." : "Not set"}
                      onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
                      readOnly={isReadOnly}
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Sports offered</Label>
                    <DropdownMenu open={sportsMenuOpen} onOpenChange={setSportsMenuOpen}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={isReadOnly}
                          className="w-full justify-between"
                        >
                          {selectedSports.length
                            ? `${selectedSports.length} selected`
                            : "Select sports"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56">
                        {sportOptions.map((sport) => (
                          <DropdownMenuCheckboxItem
                            key={sport}
                            checked={selectedSports.includes(sport)}
                            onSelect={(event) => event.preventDefault()}
                            onCheckedChange={(value) => {
                              setSelectedSports((prev) =>
                                value
                                  ? [...prev, sport]
                                  : prev.filter((item) => item !== sport),
                              );
                            }}
                          >
                            {sport}
                          </DropdownMenuCheckboxItem>
                        ))}
                        <div className="px-2 py-2">
                          <Button
                            variant="cta"
                            size="sm"
                            className="w-full"
                            onClick={() => setSportsMenuOpen(false)}
                          >
                            Done
                          </Button>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {selectedSports.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {selectedSports.join(", ")}
                      </p>
                    )}
                    {selectedSports.length === 0 && (
                      <p className="text-xs text-muted-foreground">Select at least one sport.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Default slot duration (mins)</Label>
                    <Input
                      value={formData.default_slot_duration_mins}
                      placeholder={isLoading ? "Loading..." : "Not set"}
                      onChange={(e) =>
                        setFormData({ ...formData, default_slot_duration_mins: e.target.value })
                      }
                      readOnly={isReadOnly}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Time zone</Label>
                  <Input
                    value={formData.timezone}
                    placeholder={isLoading ? "Loading..." : "Not set"}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    readOnly={isReadOnly}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Address line 1
                  </Label>
                  <Input
                    value={formData.address_line1}
                    placeholder={isLoading ? "Loading..." : "Not set"}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    readOnly={isReadOnly}
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Subdistrict</Label>
                    <Input
                      value={formData.subdistrict}
                      placeholder={isLoading ? "Loading..." : "Not set"}
                      onChange={(e) => setFormData({ ...formData, subdistrict: e.target.value })}
                      readOnly={isReadOnly}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>District</Label>
                    <Input
                      value={formData.district}
                      placeholder={isLoading ? "Loading..." : "Not set"}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      readOnly={isReadOnly}
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Province</Label>
                    <Input
                      value={formData.province}
                      placeholder={isLoading ? "Loading..." : "Not set"}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                      readOnly={isReadOnly}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Postcode</Label>
                    <Input
                      value={formData.postcode}
                      placeholder={isLoading ? "Loading..." : "Not set"}
                      onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                      readOnly={isReadOnly}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Google Maps URL</span>
                    {coordsStatus === "resolving" && (
                      <span className="text-xs text-muted-foreground animate-pulse"> Extracting coordinates...</span>
                    )}
                    {coordsStatus === "done" && (
                      <span className="text-xs text-green-600 font-medium"> Coordinates saved</span>
                    )}
                    {coordsStatus === "failed" && (
                      <span className="text-xs text-amber-600"> Could not extract coordinates</span>
                    )}
                  </Label>
                  <Input
                    value={formData.google_maps_url}
                    placeholder="https://maps.app.goo.gl/..."
                    onChange={(e) => {
                      setFormData({ ...formData, google_maps_url: e.target.value });
                      setCoordsStatus("idle");
                    }}
                    readOnly={isReadOnly}
                  />
                  {!isReadOnly && (
                    <p className="text-xs text-muted-foreground">
                      Use a link from <strong>Google Maps</strong> — not Google Search. 
                      On mobile: open Google Maps app → find your venue → Share → Copy link. 
                      On desktop: copy the URL directly from your browser address bar.
                    </p>
                  )}
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Contact phone
                    </Label>
                    <Input
                      value={formData.phone}
                      placeholder={isLoading ? "Loading..." : "Not set"}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      readOnly={isReadOnly}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Contact email
                    </Label>
                    <Input
                      value={formData.email}
                      placeholder={isLoading ? "Loading..." : "Not set"}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      readOnly={isReadOnly}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Sports supported</Label>
                  {sportsSupported.length ? (
                    <p className="text-sm text-muted-foreground">{sportsSupported.join(", ")}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {isCourtsLoading ? "Loading..." : "No sports added yet"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Tax information</Label>
                  <Input
                    value={formData.tax_information}
                    placeholder={isLoading ? "Loading..." : "Not set"}
                    onChange={(e) => setFormData({ ...formData, tax_information: e.target.value })}
                    readOnly={isReadOnly}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Courts */}
          <TabsContent value="courts" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {courts.length} courts total • {courts.filter((c) => c.status === "active").length} active
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
              {courts.length === 0 ? (
                <Card className="shadow-sm md:col-span-2 lg:col-span-3">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    {isCourtsLoading ? "Loading courts..." : "No courts added yet"}
                  </CardContent>
                </Card>
              ) : (
                courts.map((court) => (
                  <Card key={court.id} className="shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{court.name}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {court.sport_type || court.sport}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Weekday price:</span>
                          <span className="font-medium">
                            ฿{court.weekday_price_per_hour_thb ?? court.off_peak_price}/hr
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Weekend price:</span>
                          <span className="font-medium">
                            ฿{court.weekend_price_per_hour_thb ?? court.peak_price}/hr
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Environment:</span>
                          <span className="font-medium">{court.environment ?? "—"}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEditCourt(court)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
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
                {isPhotosLoading ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-10 text-sm text-muted-foreground">
                    Loading photos...
                  </div>
                ) : photos.length === 0 ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-10 text-sm text-muted-foreground">
                    No photos uploaded yet
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label>Cover photo</Label>
                      {coverPhoto ? (
                        <img
                          src={coverPhoto.url}
                          alt="Venue cover"
                          className="h-48 w-full rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">No cover photo uploaded.</p>
                      )}
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Entrance photo</Label>
                        {entrancePhoto ? (
                          <img
                            src={entrancePhoto.url}
                            alt="Venue entrance"
                            className="h-40 w-full rounded-lg object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">No entrance photo uploaded.</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Facilities photos</Label>
                        {facilityPhotos.length ? (
                          <div className="grid grid-cols-2 gap-2">
                            {facilityPhotos.map((photo) => (
                              <img
                                key={photo.id}
                                src={photo.url}
                                alt="Facility"
                                className="h-24 w-full rounded-md object-cover"
                                loading="lazy"
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No facilities photos uploaded.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Court photos</Label>
                      {courts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {isCourtsLoading ? "Loading courts..." : "No courts added yet"}
                        </p>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {courts.map((court) => {
                            const courtPhotos = courtPhotosById.get(court.id) ?? [];
                            return (
                              <div key={court.id} className="space-y-2">
                                <p className="text-sm font-medium">{court.name}</p>
                                {courtPhotos.length ? (
                                  <div className="grid grid-cols-2 gap-2">
                                    {courtPhotos.map((url, index) => (
                                      <img
                                        key={`${court.id}-${index}`}
                                        src={url}
                                        alt={`${court.name} photo`}
                                        className="h-24 w-full rounded-md object-cover"
                                        loading="lazy"
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    No photos uploaded for this court.
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={Boolean(editingCourt)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCourt(null);
            resetCourtForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isCreatingCourt ? "Add court" : "Edit court"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Court name</Label>
              <Input
                value={courtForm.name}
                onChange={(e) => setCourtForm({ ...courtForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Sport</Label>
              <Select
                value={courtForm.sport}
                onValueChange={(value) => setCourtForm({ ...courtForm, sport: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sport" />
                </SelectTrigger>
                <SelectContent>
                  {selectableSports.map((sport) => (
                    <SelectItem key={sport} value={sport}>
                      {sport}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSports.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Select venue sports first to filter this list.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Weekday price (THB)</Label>
                <Input
                  value={courtForm.weekdayPrice}
                  onChange={(e) => setCourtForm({ ...courtForm, weekdayPrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Weekend price (THB)</Label>
                <Input
                  value={courtForm.weekendPrice}
                  onChange={(e) => setCourtForm({ ...courtForm, weekendPrice: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select
                  value={courtForm.environment}
                  onValueChange={(value) => setCourtForm({ ...courtForm, environment: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDOOR">Indoor</SelectItem>
                    <SelectItem value="OUTDOOR">Outdoor</SelectItem>
                    <SelectItem value="COVERED">Covered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={courtForm.status}
                  onValueChange={(value) => setCourtForm({ ...courtForm, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingCourt(null);
                resetCourtForm();
              }}
            >
              Cancel
            </Button>
            <Button variant="cta" onClick={handleSaveCourt} disabled={isSavingCourt}>
              {isSavingCourt ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Venue;
