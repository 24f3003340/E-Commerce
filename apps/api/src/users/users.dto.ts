import { IsBoolean, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid 10 digit Indian mobile number' })
  phone?: string;
}

export class AddressDto {
  @IsString()
  @Length(2, 80)
  name: string;

  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid 10 digit Indian mobile number' })
  phone: string;

  @IsString()
  @Length(3, 200)
  line1: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  landmark?: string;

  @IsString()
  @Length(2, 80)
  city: string;

  @IsString()
  @Length(2, 80)
  state: string;

  @Matches(/^[1-9]\d{5}$/, { message: 'pincode must be a valid 6 digit pincode' })
  pincode: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
