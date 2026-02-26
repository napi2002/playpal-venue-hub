export type BookingStatus = "PENDING" | "PAID" | "CANCELLED";

export type BookingEvent = {
  id: string;
  courtId: string;
  courtName: string;
  start: string;
  end: string;
  eventName?: string | null;
  status: BookingStatus;
  recurringId?: string;
  occurrenceDate?: string;
};
