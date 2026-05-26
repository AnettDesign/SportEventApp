import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
}

export enum EventFormat {
  TRAINING = 'TRAINING',
  TOURNAMENT = 'TOURNAMENT',
  SECTION = 'SECTION',
  MATCH = 'MATCH',
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  sportType!: string;

  @IsString()
  description?: string;

  @IsEnum(SkillLevel)
  level!: SkillLevel;

  @IsEnum(EventFormat)
  format!: EventFormat;

  @IsDateString()
  startAt!: string;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsInt()
  @Min(1)
  capacity!: number;
}