import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiFetch } from "@/lib/apiClient";
import {
  courtsSchema,
  venueProfileSchema,
  type CourtInput,
  type PhotoInput,
  type VenueProfileInput,
} from "@/shared/venueOnboardingSchemas";
import { toast } from "@/hooks/use-toast";

type Step = 0 | 1 | 2;

const STEP_LABELS = ["Venue Profile", "Courts", "Photos"];
const DRAFT_STORAGE_KEY = "playpal-venue-onboarding-draft";

const defaultOpeningHours: VenueProfileInput["openingHours"] = {
  Mon: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  Tue: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  Wed: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  Thu: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  Fri: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  Sat: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
  Sun: { isOpen: true, openTime: "09:00", closeTime: "18:00" },
};

const emptyProfile: VenueProfileInput = {
  venueNameEn: "",
  venueNameTh: "",
  venueType: "MULTI_SPORT",
  addressLine1: "",
  subdistrict: "",
  district: "",
  province: "",
  postcode: "",
  googleMapsUrl: "",
  phone: "",
  email: "",
  openingHours: defaultOpeningHours,
  defaultSlotDurationMins: 60,
};

type PhotoRecord = PhotoInput & { courtIndex?: number };

const createEmptyCourt = (): CourtInput => ({
  courtName: "",
  sportType: "TENNIS",
  environment: "INDOOR",
  surfaceType: "",
  hasLighting: false,
  weekdayPricePerHourThb: 0,
  weekendPricePerHourThb: 0,
});

const VenueOnboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [profile, setProfile] = useState<VenueProfileInput>(emptyProfile);
  const [courts, setCourts] = useState<CourtInput[]>([createEmptyCourt()]);
  const [courtIds, setCourtIds] = useState<string[]>([]);
  // Canonical photo records store URLs (not File objects) to keep validation stable across steps.
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Block navigation while uploads are in-flight to avoid race conditions.
  const [uploadingCount, setUploadingCount] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed.profile) setProfile(parsed.profile);
      if (parsed.courts) setCourts(parsed.courts);
      if (parsed.photos) {
        if (Array.isArray(parsed.photos)) {
          setPhotos(parsed.photos);
        } else {
          const legacy = parsed.photos as {
            coverPhoto?: string | null;
            entrancePhoto?: string | null;
            facilitiesPhotos?: string[];
            courtPhotos?: string[][];
          };
          const records: PhotoRecord[] = [];
          if (legacy.coverPhoto) records.push({ type: "COVER", url: legacy.coverPhoto });
          if (legacy.entrancePhoto) records.push({ type: "ENTRANCE", url: legacy.entrancePhoto });
          (legacy.facilitiesPhotos || []).forEach((url) => records.push({ type: "FACILITY", url }));
          (legacy.courtPhotos || []).forEach((urls, index) => {
            urls.forEach((url) => records.push({ type: "COURT", url, courtIndex: index }));
          });
          setPhotos(records);
        }
      }
      if (parsed.venueId) setVenueId(parsed.venueId);
      if (parsed.courtIds) setCourtIds(parsed.courtIds);
      if (typeof parsed.step === "number") setStep(parsed.step);
    } catch {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ step, venueId, profile, courts, photos, courtIds }),
      );
    }, 250);
    return () => clearTimeout(timeout);
  }, [step, venueId, profile, courts, photos, courtIds]);

  useEffect(() => {
    if (!saving) return;
    const timeout = setTimeout(() => {
      setSaving(false);
    }, 20000);
    return () => clearTimeout(timeout);
  }, [saving]);

  useEffect(() => {
    setPhotos((prev) =>
      prev.filter((record) => record.type !== "COURT" || (record.courtIndex ?? 0) < courts.length),
    );
  }, [courts.length]);

  useEffect(() => {
    if (!courtIds.length) return;
    setPhotos((prev) =>
      prev.map((record) => {
        if (record.type !== "COURT" || record.courtId) return record;
        const index = record.courtIndex ?? -1;
        const courtId = courtIds[index];
        if (!courtId) return record;
        return { ...record, courtId };
      }),
    );
  }, [courtIds]);

  const stepCompletion = useMemo(() => {
    return [
      venueProfileSchema.safeParse(profile).success,
      courtsSchema.safeParse(courts).success,
      photos.some((record) => record.type === "COVER") &&
        courts.every((_, index) =>
          photos.some(
            (record) =>
              record.type === "COURT" &&
              (record.courtId === courtIds[index] || record.courtIndex === index),
          ),
        ),
    ];
  }, [profile, courts, photos, courtIds]);

  const setFieldErrorMap = (
    zodError: { issues: Array<{ path: (string | number)[]; message: string }> },
    prefix?: string,
  ) => {
    const map: Record<string, string> = {};
    zodError.issues.forEach((issue) => {
      const pathKey = issue.path.length ? issue.path.join(".") : "";
      const key = prefix ? (pathKey ? `${prefix}.${pathKey}` : prefix) : pathKey;
      if (!map[key]) map[key] = issue.message;
    });
    setErrors(map);
  };

  const clearErrors = () => setErrors({});
  const clearErrorKeys = (keys: string[]) => {
    setErrors((prev) => {
      const next = { ...prev };
      keys.forEach((key) => {
        delete next[key];
      });
      return next;
    });
  };

  const handleNext = () => {
    clearErrors();
    if (uploadingCount > 0) {
      setErrors({ photos: "Please wait for uploads to finish." });
      return;
    }
    if (step === 0) {
      const result = venueProfileSchema.safeParse(profile);
      if (!result.success) {
        setFieldErrorMap(result.error);
        return;
      }
    }
    if (step === 1) {
      const result = courtsSchema.safeParse(courts);
      if (!result.success) {
        setFieldErrorMap(result.error, "courts");
        return;
      }
    }
    if (step < 2) setStep((prev) => (prev + 1) as Step);
  };

  const handleBack = () => {
    clearErrors();
    if (step > 0) setStep((prev) => (prev - 1) as Step);
  };

  const ensureDraftVenue = async () => {
    if (venueId) return venueId;
    const draftProfile = {
      ...profile,
      venueNameEn: profile.venueNameEn || undefined,
      venueNameTh: profile.venueNameTh || undefined,
      addressLine1: profile.addressLine1 || undefined,
      subdistrict: profile.subdistrict || undefined,
      district: profile.district || undefined,
      province: profile.province || undefined,
      postcode: profile.postcode || undefined,
      googleMapsUrl: profile.googleMapsUrl || undefined,
      phone: profile.phone || undefined,
      email: profile.email || undefined,
    };
    const response = await apiFetch("/api/venues/draft", {
      method: "POST",
      body: JSON.stringify({ profile: draftProfile }),
    });
    setVenueId(response.venueId);
    return response.venueId as string;
  };

  const saveDraft = async () => {
    try {
      toast({ title: "Saving draft...", description: "Please wait." });
      setSaving(true);
      const id = await ensureDraftVenue();
      const profileCheck = venueProfileSchema.safeParse(profile);
      if (profileCheck.success) {
        await apiFetch(`/api/venues/${id}`, {
          method: "PUT",
          body: JSON.stringify({ profile, status: "DRAFT" }),
        });
      }
      const courtsCheck = courtsSchema.safeParse(courts);
      if (courtsCheck.success) {
        const courtsResponse = await apiFetch(`/api/venues/${id}/courts`, {
          method: "POST",
          body: JSON.stringify({ courts }),
        });
        const ids = (courtsResponse.courts || []).map((court: { id: string }) => court.id);
        if (ids.length) {
          setCourtIds(ids);
        }
        const resolvedCourtIds = ids.length === courts.length ? ids : [];
        const hasAnyPhotos = photos.length > 0;

        if (hasAnyPhotos && resolvedCourtIds.length === courts.length) {
          const photosPayload = photos.map((record) => {
            if (record.type !== "COURT") return { type: record.type, url: record.url };
            const courtId =
              record.courtId ?? resolvedCourtIds[record.courtIndex ?? -1] ?? null;
            return { type: record.type, url: record.url, courtId };
          });
          await apiFetch(`/api/venues/${id}/photos`, {
            method: "POST",
            body: JSON.stringify({ photos: photosPayload }),
          });
        }
      }
      toast({ title: "Draft saved", description: "Your changes have been saved." });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save draft",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const submitAll = async () => {
    clearErrors();
    if (uploadingCount > 0) {
      setErrors({ photos: "Please wait for uploads to finish." });
      setStep(2);
      return;
    }
    const profileResult = venueProfileSchema.safeParse(profile);
    const courtsResult = courtsSchema.safeParse(courts);
    if (!profileResult.success) {
      setFieldErrorMap(profileResult.error);
      setStep(0);
      return;
    }
    if (!courtsResult.success) {
      setFieldErrorMap(courtsResult.error, "courts");
      setStep(1);
      return;
    }
    const photoErrors: Record<string, string> = {};
    if (!photos.some((record) => record.type === "COVER")) {
      photoErrors["photos.coverPhoto"] = "Cover photo is required.";
    }
    courts.forEach((_, index) => {
      const hasCourtPhoto = photos.some(
        (record) =>
          record.type === "COURT" &&
          (record.courtId === courtIds[index] || record.courtIndex === index),
      );
      if (!hasCourtPhoto) {
        photoErrors[`photos.court.${index}`] = "Add at least 1 photo for this court.";
      }
    });
    if (Object.keys(photoErrors).length > 0) {
      setErrors(photoErrors);
      setStep(2);
      return;
    }

    try {
      setSaving(true);
      const id = await ensureDraftVenue();

      await apiFetch(`/api/venues/${id}`, {
        method: "PUT",
        body: JSON.stringify({ profile, status: "DRAFT" }),
      });

      const courtsResponse = await apiFetch(`/api/venues/${id}/courts`, {
        method: "POST",
        body: JSON.stringify({ courts }),
      });

      const courtIdsFromApi: string[] = courtsResponse.courts.map((court: { id: string }) => court.id);
      setCourtIds(courtIdsFromApi);

      const photosPayload = photos.map((record) => {
        if (record.type !== "COURT") return { type: record.type, url: record.url };
        const courtId =
          record.courtId ?? courtIdsFromApi[record.courtIndex ?? -1] ?? null;
        return { type: record.type, url: record.url, courtId };
      });

      await apiFetch(`/api/venues/${id}/photos`, {
        method: "POST",
        body: JSON.stringify({ photos: photosPayload }),
      });

      await apiFetch(`/api/venues/${id}/submit`, {
        method: "POST",
      });

      localStorage.removeItem(DRAFT_STORAGE_KEY);
      localStorage.setItem("playpal-onboarding-submitted", "true");
      navigate("/dashboard");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit onboarding",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    const isValidType = ["image/jpeg", "image/png"].includes(file.type);
    if (!isValidType) {
      throw new Error("Only JPG and PNG files are allowed.");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Max file size is 10MB.");
    }
    const formData = new FormData();
    formData.append("file", file);
    setUploadingCount((count) => count + 1);
    try {
      const response = await apiFetch("/api/upload", { method: "POST", body: formData });
      return response.url as string;
    } finally {
      setUploadingCount((count) => Math.max(0, count - 1));
    }
  };

  const renderStepper = () => (
    <div className="flex flex-wrap items-center gap-4">
      {STEP_LABELS.map((label, index) => (
        <div key={label} className="flex items-center gap-3">
          <div
            className={`h-8 w-8 rounded-full border flex items-center justify-center text-sm font-medium ${
              step === index ? "border-primary text-primary" : "border-border text-muted-foreground"
            }`}
          >
            {stepCompletion[index] ? "✓" : index + 1}
          </div>
          <span className={step === index ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        </div>
      ))}
    </div>
  );

  const renderProfileStep = () => (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Venue Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Venue name (EN)</Label>
            <Input
              value={profile.venueNameEn}
              onChange={(e) => setProfile({ ...profile, venueNameEn: e.target.value })}
            />
            {errors.venueNameEn && <p className="text-xs text-destructive">{errors.venueNameEn}</p>}
          </div>
          <div className="space-y-2">
            <Label>Venue name (TH)</Label>
            <Input
              value={profile.venueNameTh || ""}
              onChange={(e) => setProfile({ ...profile, venueNameTh: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Venue type</Label>
            <Select
              value={profile.venueType}
              onValueChange={(value) =>
                setProfile({ ...profile, venueType: value as VenueProfileInput["venueType"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TENNIS">Tennis</SelectItem>
                <SelectItem value="PADEL">Padel</SelectItem>
                <SelectItem value="BADMINTON">Badminton</SelectItem>
                <SelectItem value="MULTI_SPORT">Multi-sport</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default slot duration</Label>
            <Select
              value={String(profile.defaultSlotDurationMins)}
              onValueChange={(value) =>
                setProfile({ ...profile, defaultSlotDurationMins: Number(value) as VenueProfileInput["defaultSlotDurationMins"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
                <SelectItem value="90">90 minutes</SelectItem>
                <SelectItem value="120">120 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Address line 1</Label>
          <Input
            value={profile.addressLine1}
            onChange={(e) => setProfile({ ...profile, addressLine1: e.target.value })}
          />
          {errors.addressLine1 && <p className="text-xs text-destructive">{errors.addressLine1}</p>}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Subdistrict</Label>
            <Input
              value={profile.subdistrict}
              onChange={(e) => setProfile({ ...profile, subdistrict: e.target.value })}
            />
            {errors.subdistrict && <p className="text-xs text-destructive">{errors.subdistrict}</p>}
          </div>
          <div className="space-y-2">
            <Label>District</Label>
            <Input
              value={profile.district}
              onChange={(e) => setProfile({ ...profile, district: e.target.value })}
            />
            {errors.district && <p className="text-xs text-destructive">{errors.district}</p>}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Province</Label>
            <Input
              value={profile.province}
              onChange={(e) => setProfile({ ...profile, province: e.target.value })}
            />
            {errors.province && <p className="text-xs text-destructive">{errors.province}</p>}
          </div>
          <div className="space-y-2">
            <Label>Postcode</Label>
            <Input
              value={profile.postcode}
              onChange={(e) => setProfile({ ...profile, postcode: e.target.value })}
            />
            {errors.postcode && <p className="text-xs text-destructive">{errors.postcode}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Google Maps URL</Label>
          <Input
            value={profile.googleMapsUrl}
            onChange={(e) => setProfile({ ...profile, googleMapsUrl: e.target.value })}
          />
          {errors.googleMapsUrl && <p className="text-xs text-destructive">{errors.googleMapsUrl}</p>}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
        </div>

        <div className="space-y-4">
          <Label>Opening hours</Label>
          {Object.entries(profile.openingHours).map(([day, hours]) => (
            <div key={day} className="flex flex-wrap items-center gap-4">
              <div className="w-16 text-sm font-medium">{day}</div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={hours.isOpen}
                  onCheckedChange={(checked) =>
                    setProfile({
                      ...profile,
                      openingHours: {
                        ...profile.openingHours,
                        [day]: { ...hours, isOpen: Boolean(checked) },
                      },
                    })
                  }
                />
                <span className="text-sm text-muted-foreground">Open</span>
              </div>
              <Input
                type="time"
                value={hours.openTime}
                disabled={!hours.isOpen}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    openingHours: {
                      ...profile.openingHours,
                      [day]: { ...hours, openTime: e.target.value },
                    },
                  })
                }
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="time"
                value={hours.closeTime}
                disabled={!hours.isOpen}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    openingHours: {
                      ...profile.openingHours,
                      [day]: { ...hours, closeTime: e.target.value },
                    },
                  })
                }
                className="w-32"
              />
              {errors[`openingHours.${day}.openTime`] && (
                <p className="text-xs text-destructive">{errors[`openingHours.${day}.openTime`]}</p>
              )}
              {errors[`openingHours.${day}.closeTime`] && (
                <p className="text-xs text-destructive">{errors[`openingHours.${day}.closeTime`]}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const renderCourtsStep = () => (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Courts</CardTitle>
        <Button
          variant="outline"
          onClick={() => {
            setCourts([...courts, createEmptyCourt()]);
          }}
        >
          Add court
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {errors.courts && <p className="text-sm text-destructive">{errors.courts}</p>}
        {courts.map((court, index) => (
          <Card key={index} className="border border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Court {index + 1}</CardTitle>
              {courts.length > 1 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    const nextCourts = courts.filter((_, i) => i !== index);
                    setCourts(nextCourts);
                    setCourtIds((prev) => prev.filter((_, i) => i !== index));
                    setPhotos((prev) =>
                      prev.filter(
                        (record) => record.type !== "COURT" || record.courtIndex !== index,
                      ),
                    );
                  }}
                >
                  Remove
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Court name</Label>
                <Input
                  value={court.courtName}
                  onChange={(e) => {
                    const next = [...courts];
                    next[index] = { ...court, courtName: e.target.value };
                    setCourts(next);
                  }}
                />
                {errors[`courts.${index}.courtName`] && (
                  <p className="text-xs text-destructive">{errors[`courts.${index}.courtName`]}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Sport type</Label>
                  <Select
                    value={court.sportType}
                    onValueChange={(value) => {
                      const next = [...courts];
                      next[index] = { ...court, sportType: value as CourtInput["sportType"] };
                      setCourts(next);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TENNIS">Tennis</SelectItem>
                      <SelectItem value="PADEL">Padel</SelectItem>
                      <SelectItem value="BADMINTON">Badminton</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <Select
                    value={court.environment}
                    onValueChange={(value) => {
                      const next = [...courts];
                      next[index] = { ...court, environment: value as CourtInput["environment"] };
                      setCourts(next);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDOOR">Indoor</SelectItem>
                      <SelectItem value="OUTDOOR">Outdoor</SelectItem>
                      <SelectItem value="COVERED">Covered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Surface type</Label>
                  <Input
                    value={court.surfaceType}
                    onChange={(e) => {
                      const next = [...courts];
                      next[index] = { ...court, surfaceType: e.target.value };
                      setCourts(next);
                    }}
                  />
                  {errors[`courts.${index}.surfaceType`] && (
                    <p className="text-xs text-destructive">{errors[`courts.${index}.surfaceType`]}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={court.hasLighting}
                  onCheckedChange={(checked) => {
                    const next = [...courts];
                    next[index] = { ...court, hasLighting: Boolean(checked) };
                    setCourts(next);
                  }}
                />
                <span className="text-sm">Has lighting</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Weekday price per hour (THB)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={court.weekdayPricePerHourThb}
                    onChange={(e) => {
                      const next = [...courts];
                      next[index] = { ...court, weekdayPricePerHourThb: Number(e.target.value) };
                      setCourts(next);
                    }}
                  />
                  {errors[`courts.${index}.weekdayPricePerHourThb`] && (
                    <p className="text-xs text-destructive">
                      {errors[`courts.${index}.weekdayPricePerHourThb`]}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Weekend price per hour (THB)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={court.weekendPricePerHourThb}
                    onChange={(e) => {
                      const next = [...courts];
                      next[index] = { ...court, weekendPricePerHourThb: Number(e.target.value) };
                      setCourts(next);
                    }}
                  />
                  {errors[`courts.${index}.weekendPricePerHourThb`] && (
                    <p className="text-xs text-destructive">
                      {errors[`courts.${index}.weekendPricePerHourThb`]}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );

  const renderPhotosStep = () => (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Photos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {errors.photos && <p className="text-sm text-destructive">{errors.photos}</p>}
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Cover: {photos.some((record) => record.type === "COVER") ? "uploaded" : "missing"} · Courts:{" "}
          {courts
            .map((_, index) =>
              photos.filter(
                (record) =>
                  record.type === "COURT" &&
                  (record.courtId === courtIds[index] || record.courtIndex === index),
              ).length,
            )
            .join(", ")}
          {uploadingCount > 0 ? " · Uploading..." : ""}
        </div>
        <div className="space-y-2">
          <Label>Venue cover photo (required)</Label>
          {photos.some((record) => record.type === "COVER") ? (
            <div className="flex items-center gap-4">
              <img
                src={photos.find((record) => record.type === "COVER")?.url}
                alt="Cover"
                className="h-24 w-32 rounded-md object-cover"
              />
              <Button
                variant="outline"
                onClick={() =>
                  setPhotos((prev) => prev.filter((record) => record.type !== "COVER"))
                }
              >
                Remove
              </Button>
            </div>
          ) : (
            <Input
              type="file"
              accept="image/png,image/jpeg"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const url = await handleFileUpload(file);
                  setPhotos((prev) => [
                    ...prev.filter((record) => record.type !== "COVER"),
                    { type: "COVER", url },
                  ]);
                  clearErrorKeys(["photos.coverPhoto", "photos"]);
                } catch (error) {
                  toast({
                    title: "Upload failed",
                    description: error instanceof Error ? error.message : "Upload failed",
                    variant: "destructive",
                  });
                }
              }}
            />
          )}
          {errors["photos.coverPhoto"] && (
            <p className="text-xs text-destructive">{errors["photos.coverPhoto"]}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Entrance photo (optional)</Label>
          {photos.some((record) => record.type === "ENTRANCE") ? (
            <div className="flex items-center gap-4">
              <img
                src={photos.find((record) => record.type === "ENTRANCE")?.url}
                alt="Entrance"
                className="h-24 w-32 rounded-md object-cover"
              />
              <Button
                variant="outline"
                onClick={() =>
                  setPhotos((prev) => prev.filter((record) => record.type !== "ENTRANCE"))
                }
              >
                Remove
              </Button>
            </div>
          ) : (
            <Input
              type="file"
              accept="image/png,image/jpeg"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const url = await handleFileUpload(file);
                  setPhotos((prev) => [
                    ...prev.filter((record) => record.type !== "ENTRANCE"),
                    { type: "ENTRANCE", url },
                  ]);
                  clearErrorKeys(["photos"]);
                } catch (error) {
                  toast({
                    title: "Upload failed",
                    description: error instanceof Error ? error.message : "Upload failed",
                    variant: "destructive",
                  });
                }
              }}
            />
          )}
        </div>

        <div className="space-y-2">
          <Label>Facilities photos (optional)</Label>
          <div className="flex flex-wrap gap-3">
            {photos
              .filter((record) => record.type === "FACILITY")
              .map((record) => (
              <div key={record.url} className="relative">
                <img src={record.url} alt="Facility" className="h-20 w-24 rounded-md object-cover" />
                <Button
                  variant="ghost"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background p-0"
                  onClick={() => {
                    setPhotos((prev) => prev.filter((item) => item !== record));
                  }}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
          <Input
            type="file"
            accept="image/png,image/jpeg"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const url = await handleFileUpload(file);
                setPhotos((prev) => [...prev, { type: "FACILITY", url }]);
                clearErrorKeys(["photos"]);
              } catch (error) {
                toast({
                  title: "Upload failed",
                  description: error instanceof Error ? error.message : "Upload failed",
                  variant: "destructive",
                });
              }
            }}
          />
        </div>

        <div className="space-y-4">
          <Label>Court photos (min 1 per court)</Label>
          {courts.map((court, index) => (
            <Card key={index} className="border border-border">
              <CardHeader>
                <CardTitle className="text-base">{court.courtName || `Court ${index + 1}`}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {
                    photos.filter(
                      (record) =>
                        record.type === "COURT" &&
                        (record.courtId === courtIds[index] || record.courtIndex === index),
                    ).length
                  }{" "}
                  photo
                  {photos.filter(
                    (record) =>
                      record.type === "COURT" &&
                      (record.courtId === courtIds[index] || record.courtIndex === index),
                  ).length === 1
                    ? ""
                    : "s"}{" "}
                  uploaded
                </p>
                <div className="flex flex-wrap gap-3">
                  {photos
                    .filter(
                      (record) =>
                        record.type === "COURT" &&
                        (record.courtId === courtIds[index] || record.courtIndex === index),
                    )
                    .map((record) => (
                    <div key={record.url} className="relative">
                      <img src={record.url} alt="Court" className="h-20 w-24 rounded-md object-cover" />
                      <Button
                        variant="ghost"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background p-0"
                        onClick={() => {
                          setPhotos((prev) => {
                            return prev.filter((item) => item !== record);
                          });
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
                <Input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const url = await handleFileUpload(file);
                      setPhotos((prev) => [
                        ...prev,
                        {
                          type: "COURT",
                          url,
                          courtId: courtIds[index],
                          courtIndex: index,
                        },
                      ]);
                      clearErrorKeys([`photos.court.${index}`, "photos"]);
                    } catch (error) {
                      toast({
                        title: "Upload failed",
                        description: error instanceof Error ? error.message : "Upload failed",
                        variant: "destructive",
                      });
                    }
                  }}
                />
                {errors[`photos.court.${index}`] && (
                  <p className="text-xs text-destructive">{errors[`photos.court.${index}`]}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {renderStepper()}
        {step === 0 && renderProfileStep()}
        {step === 1 && renderCourtsStep()}
        {step === 2 && renderPhotosStep()}

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleBack} disabled={step === 0 || saving || uploadingCount > 0}>
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={saveDraft} disabled={saving || uploadingCount > 0}>
              {saving ? "Saving..." : "Save Draft"}
            </Button>
            {step < 2 ? (
              <Button type="button" onClick={handleNext} disabled={saving || uploadingCount > 0}>
                {uploadingCount > 0 ? "Uploading..." : "Next"}
              </Button>
            ) : (
              <Button type="button" onClick={submitAll} disabled={saving || uploadingCount > 0}>
                {uploadingCount > 0 ? "Uploading..." : "Submit"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default VenueOnboarding;
