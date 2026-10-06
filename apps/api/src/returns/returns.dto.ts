import { ReturnReason, ReturnStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class ReturnItemDto {
  @IsString()
  orderItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateReturnDto {
  @IsString()
  orderNumber: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];

  @IsEnum(ReturnReason)
  reason: ReturnReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class UpdateReturnStatusDto {
  @IsEnum(ReturnStatus)
  status: ReturnStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** For COD orders: how the refund was paid out */
  @IsOptional()
  @IsIn(['BANK', 'STORE_CREDIT', 'UPI'])
  refundMode?: string;
}
