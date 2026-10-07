import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class CheckoutDto {
  @IsString()
  addressId: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsIn(['STANDARD', 'EXPRESS'])
  deliveryMethod?: 'STANDARD' | 'EXPRESS';

  @IsOptional()
  @IsString()
  @MaxLength(30)
  couponCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class TrackOrderDto {
  @IsString()
  @MaxLength(40)
  orderNumber: string;

  /** Email or phone used on the order */
  @IsString()
  @MaxLength(120)
  contact: string;
}

export class AdminOrderQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  /** Marketplace seller id, or "store" for the store's own orders */
  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreateShipmentDto {
  @IsString()
  @MaxLength(60)
  carrier: string;

  @IsString()
  @MaxLength(60)
  awb: string;

  @IsOptional()
  @IsUrl()
  trackingUrl?: string;
}

/** Package details for booking a courier pickup (weight in kg, sizes in cm). */
export class BookCourierDto {
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.05) @Max(50)
  weightKg: number;

  @IsNumber({ maxDecimalPlaces: 1 }) @Min(1) @Max(200)
  lengthCm: number;

  @IsNumber({ maxDecimalPlaces: 1 }) @Min(1) @Max(200)
  breadthCm: number;

  @IsNumber({ maxDecimalPlaces: 1 }) @Min(1) @Max(200)
  heightCm: number;
}
