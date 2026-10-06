import { ProductStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1' ? true : value === false || value === 'false' ? false : value;

export class CategoryDto {
  @IsString()
  @Length(1, 80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isReturnable?: boolean | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  returnWindowDays?: number | null;
}

export const SORT_OPTIONS = ['newest', 'price_asc', 'price_desc', 'popular', 'rating', 'discount'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export class ProductQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  /** Comma separated */
  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  color?: string;

  /** Paise */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  discount?: number;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsIn(SORT_OPTIONS)
  sort?: SortOption;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  limit?: number;
}

export class AdminProductQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}

export class ProductImageDto {
  @IsString()
  @MaxLength(500)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;
}

export class ProductVariantDto {
  /** Existing variant id when updating */
  @IsOptional()
  @IsString()
  id?: string;

  @Matches(/^[A-Za-z0-9._-]{2,64}$/, { message: 'sku may contain letters, numbers, dot, dash, underscore' })
  sku: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  colorHex?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  size?: string;

  /** Selling price in paise */
  @IsInt()
  @Min(100)
  price: number;

  /** MRP in paise */
  @IsInt()
  @Min(100)
  mrp: number;

  /** Initial stock (only used when the variant is created; use inventory endpoints afterwards) */
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ProductDto {
  @IsString()
  @Length(2, 160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  slug?: string;

  @IsString()
  @MaxLength(5000)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  material?: string;

  @IsOptional()
  @IsObject()
  specifications?: Record<string, string>;

  @IsOptional()
  @IsArray()
  sizeChart?: Record<string, string>[];

  @IsOptional()
  @IsUrl({ require_tld: false })
  videoUrl?: string;

  @IsOptional()
  @Matches(/^\d{4,8}$/, { message: 'HSN code must be 4–8 digits' })
  hsnCode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  tags?: string[];

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categoryIds: string[];

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images: ProductImageDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants: ProductVariantDto[];
}

export class PincodeQueryDto {
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode: string;
}
