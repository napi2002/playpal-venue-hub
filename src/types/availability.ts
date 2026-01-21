export type BookingStatus = "PENDING" | "PAID";

export type BookingEvent = {
  id: string;
  courtId: string;
  courtName: string;
  start: string;
  end: string;
  status: BookingStatus;
};
