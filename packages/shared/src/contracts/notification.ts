export type NotificationDTO = {
  id: string;
  createdAt: string;
  readAt?: string | null;
  type: string;
  title: string;
  message: string;
  eventId?: string | null;
  bookingId?: string | null;
};
