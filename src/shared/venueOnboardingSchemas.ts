import { z } from "zod";

export const venueTypeEnum = z.enum(["TENNIS", "PADEL", "BADMINTON", "MULTI_SPORT"]);
export const sportTypeEnum = z.enum(["TENNIS", "PADEL", "BADMINTON"]);
export const environmentEnum = z.enum(["INDOOR", "OUTDOOR", "COVERED"]);
export const venueStatusEnum = z.enum(["DRAFT", "SUBMITTED"]);
export const photoTypeEnum = z.enum(["COVER", "ENTRANCE", "FACILITY", "COURT"]);
export const slotDurationEnum = z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(120)]);

const parseTime = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const dayHoursSchema = z
  .object({
    isOpen: z.boolean(),
    openTime: z.string().optional(),
    closeTime: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.isOpen) {
      return;
    }

    const openTime = value.openTime ?? "";
    const closeTime = value.closeTime ?? "";

    const openMinutes = parseTime(openTime);
    const closeMinutes = parseTime(closeTime);
    const openValid = openMinutes !== null;
    const closeValid = closeMinutes !== null;

    if (!openValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use HH:MM format",
        path: ["openTime"],
      });
      return;
    }

    if (!closeValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use HH:MM format",
        path: ["closeTime"],
      });
      return;
    }

    if (openMinutes !== null && closeMinutes !== null && openMinutes >= closeMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Open time must be earlier than close time",
        path: ["openTime"],
      });
    }
  });

export const openingHoursSchema = z.object({
  Mon: dayHoursSchema,
  Tue: dayHoursSchema,
  Wed: dayHoursSchema,
  Thu: dayHoursSchema,
  Fri: dayHoursSchema,
  Sat: dayHoursSchema,
  Sun: dayHoursSchema,
});

export const venueProfileSchema = z.object({
  venueNameEn: z.string().min(1, "Venue name (EN) is required"),
  venueNameTh: z.string().optional(),
  venueType: venueTypeEnum,
  addressLine1: z.string().min(1, "Address line 1 is required"),
  subdistrict: z.string().min(1, "Subdistrict is required"),
  district: z.string().min(1, "District is required"),
  province: z.string().min(1, "Province is required"),
  postcode: z.string().min(1, "Postcode is required"),
  googleMapsUrl: z.string().url("Enter a valid URL"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Enter a valid email"),
  openingHours: openingHoursSchema,
  defaultSlotDurationMins: slotDurationEnum,
});

export const courtSchema = z.object({
  courtName: z.string().min(1, "Court name is required"),
  sportType: sportTypeEnum,
  environment: environmentEnum,
  surfaceType: z.string().min(1, "Surface type is required"),
  hasLighting: z.boolean(),
  weekdayPricePerHourThb: z.number().min(0, "Weekday price must be 0 or more"),
  weekendPricePerHourThb: z.number().min(0, "Weekend price must be 0 or more"),
});

export const courtsSchema = z.array(courtSchema).min(1, "Add at least 1 court");

export const photoSchema = z
  .object({
    type: photoTypeEnum,
    url: z.string().url(),
    courtId: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "COURT" && !value.courtId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Court photo must include courtId",
        path: ["courtId"],
      });
    }
  });

export const photosPayloadSchema = z.object({
  photos: z.array(photoSchema),
});

export type VenueProfileInput = z.infer<typeof venueProfileSchema>;
export type CourtInput = z.infer<typeof courtSchema>;
export type PhotoInput = z.infer<typeof photoSchema>;
