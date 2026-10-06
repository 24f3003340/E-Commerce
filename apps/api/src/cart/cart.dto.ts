import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export const MAX_QTY_PER_ITEM = 10;

export class AddCartItemDto {
  @IsString()
  variantId: string;

  @IsInt()
  @Min(1)
  @Max(MAX_QTY_PER_ITEM)
  quantity: number;
}

export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  @Max(MAX_QTY_PER_ITEM)
  quantity: number;
}

export class MergeCartDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AddCartItemDto)
  items: AddCartItemDto[];
}

export class QuoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  couponCode?: string;

  @IsOptional()
  @IsIn(['COD', 'ONLINE'])
  paymentMethod?: 'COD' | 'ONLINE';

  @IsOptional()
  @IsIn(['STANDARD', 'EXPRESS'])
  deliveryMethod?: 'STANDARD' | 'EXPRESS';
}
