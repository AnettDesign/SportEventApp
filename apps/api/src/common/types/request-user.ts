export type RequestUser = {
  sub: string;
  role: 'USER' | 'ORGANIZER' | 'ADMIN';
};