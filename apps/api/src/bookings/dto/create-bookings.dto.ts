import { IsNotEmpty, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  userId!: string; // тимчасово, без Auth

  @IsString()
  @IsNotEmpty()
  eventId!: string;
}