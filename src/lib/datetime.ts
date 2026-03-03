const bangkokDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const formatBangkokDateKey = (value: Date) => bangkokDateFormatter.format(value);

export const toBangkokUtcIso = (date: string, time: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0));
  return utcDate.toISOString();
};
