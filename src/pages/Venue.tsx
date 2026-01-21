import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useVenue } from "@/hooks/useVenue";
import { useCourts } from "@/hooks/useCourts";
import { usePhotos } from "@/hooks/usePhotos";

const Venue = () => {
  const { venue, isLoading, updateVenue, createVenue, isSaving } = useVenue();
  const { courts, isLoading: isCourtsLoading } = useCourts();
  const { photos, isLoading: isPhotosLoading } = usePhotos();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name_en: "",
    name_th: "",
    venue_type: "",
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

  const sportsSupported = useMemo(() => {
    const unique = new Set<string>();
    courts.forEach((court) => {
      const sport = court.sport_type || court.sport;
      if (sport) unique.add(sport);
    });
    return Array.from(unique);
  }, [courts]);

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
      setFormData({
        name_en: venue.name_en ?? venue.name ?? "",
        name_th: venue.name_th ?? "",
        venue_type: venue.venue_type ?? "",
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
    }
  }, [venue]);

  const toNullableValue = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const handleSave = async () => {
    const nameValue = formData.name_en.trim() || venue?.name || "New Venue";
    const updates = {
      name: nameValue,
      name_en: nameValue,
      name_th: toNullableValue(formData.name_th),
      venue_type: toNullableValue(formData.venue_type),
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
      setFormData({
        name_en: venue.name_en ?? venue.name ?? "",
        name_th: venue.name_th ?? "",
        venue_type: venue.venue_type ?? "",
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
    }
    setIsEditing(false);
  };

  const isReadOnly = !isEditing || isLoading;

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
                    <Label>Venue type</Label>
                    <Input
                      value={formData.venue_type}
                      placeholder={isLoading ? "Loading..." : "Not set"}
                      onChange={(e) => setFormData({ ...formData, venue_type: e.target.value })}
                      readOnly={isReadOnly}
                    />
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
                  <Label>Google Maps URL</Label>
                  <Input
                    value={formData.google_maps_url}
                    placeholder={isLoading ? "Loading..." : "Not set"}
                    onChange={(e) => setFormData({ ...formData, google_maps_url: e.target.value })}
                    readOnly={isReadOnly}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Opening hours
                  </Label>
                  {openingHoursSummary.length ? (
                    <div className="grid gap-1 text-sm text-muted-foreground">
                      {openingHoursSummary.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not set</p>
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
    </DashboardLayout>
  );
};

export default Venue;
