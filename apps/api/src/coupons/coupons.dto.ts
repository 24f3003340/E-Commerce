import { CouponType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CouponDto {
  @Matches(/^[A-Za-z0-9_-]{3,30}$/, { message: 'code must be 3-30 letters/numbers' })
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsEnum(CouponType)
  type: CouponType;

  /** PERCENT: whole percent. FLAT: paise. */
  @IsInt()
  @Min(1)
  value: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxDiscount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderValue?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableCategoryIds?: string[];

  @IsOptional()
  @IsBoolean()
  firstOrderOnly?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
