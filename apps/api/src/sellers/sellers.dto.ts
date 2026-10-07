import { OrderStatus, SellerStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Optional business and payout details, shared by sign-up and profile edits. */
class SellerDetailsDto {
  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @IsOptional() @Transform(upper)
  @ValidateIf((_, v) => v !== '')
  @Matches(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, { message: 'GSTIN must be a valid 15 character GST number' })
  gstin?: string;

  @IsOptional() @Transform(upper)
  @ValidateIf((_, v) => v !== '')
  @Matches(/^[A-Z]{5}\d{4}[A-Z]$/, { message: 'PAN must look like ABCDE1234F' })
  pan?: string;

  @IsOptional() @IsString() @MaxLength(200)
  addressLine2?: string;

  @IsOptional() @IsString() @MaxLength(100)
  bankAccountName?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @Matches(/^\d{9,18}$/, { message: 'bank account number must be 9–18 digits' })
  bankAccountNumber?: string;

  @IsOptional() @Transform(upper)
  @ValidateIf((_, v) => v !== '')
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'IFSC must look like HDFC0001234' })
  bankIfsc?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @Matches(/^[\w.-]{2,}@[A-Za-z]{2,}$/, { message: 'UPI ID must look like name@bank' })
  upiId?: string;
}

export class SellerRegisterDto extends SellerDetailsDto {
  @Transform(trim) @IsString() @Length(2, 80)
  name: string;

  @IsEmail() @MaxLength(120)
  email: string;

  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid 10 digit Indian mobile number' })
  phone: string;

  @IsString() @MinLength(8) @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'password must contain letters and numbers' })
  password: string;

  @Transform(trim) @IsString() @Length(2, 60)
  storeName: string;

  @Transform(trim) @IsString() @Length(3, 200)
  addressLine1: string;

  @Transform(trim) @IsString() @Length(2, 60)
  city: string;

  @Transform(trim) @IsString() @Length(2, 60)
  state: string;

  @Matches(/^[1-9]\d{5}$/, { message: 'pincode must be 6 digits' })
  pincode: string;
}

/** What a seller can change later (email and password have their own flows). */
export class SellerProfileDto extends SellerDetailsDto {
  @IsOptional() @Transform(trim) @IsString() @Length(2, 80)
  name?: string;

  @IsOptional() @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid 10 digit Indian mobile number' })
  phone?: string;

  @IsOptional() @Transform(trim) @IsString() @Length(2, 60)
  storeName?: string;

  @IsOptional() @Transform(trim) @IsString() @Length(3, 200)
  addressLine1?: string;

  @IsOptional() @Transform(trim) @IsString() @Length(2, 60)
  city?: string;

  @IsOptional() @Transform(trim) @IsString() @Length(2, 60)
  state?: string;

  @IsOptional() @Matches(/^[1-9]\d{5}$/, { message: 'pincode must be 6 digits' })
  pincode?: string;
}

export class AdminSellerQueryDto {
  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @IsIn(Object.values(SellerStatus))
  status?: SellerStatus;

  @IsOptional() @Type(() => Number) @IsInt()
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  limit?: number;
}

export class UpdateSellerStatusDto {
  @IsIn([SellerStatus.APPROVED, SellerStatus.REJECTED, SellerStatus.SUSPENDED])
  status: SellerStatus;

  /** Shown to the seller (reason for rejection / suspension) */
  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

export class UpdateCommissionDto {
  /** Percent of item value; null = use the store default */
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
  commissionPct: number | null;
}

export class CreatePayoutDto {
  /** Bank UTR / UPI reference of the transfer */
  @Transform(trim) @IsString() @Length(3, 60)
  reference: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

export class ProductReviewDto {
  @IsBoolean()
  approve: boolean;

  /** Reason shown to the seller when rejected */
  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

/** Fulfilment steps a seller may take themselves. Shipping goes through the shipment endpoint. */
export const SELLER_ORDER_STATUSES: OrderStatus[] = [OrderStatus.PROCESSING, OrderStatus.PACKED, OrderStatus.CANCELLED];

export class SellerOrderStatusDto {
  @IsIn(SELLER_ORDER_STATUSES)
  status: OrderStatus;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}
