import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(2, 80)
  name: string;

  @IsEmail()
  @MaxLength(120)
  email: string;

  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid 10 digit Indian mobile number' })
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'password must contain letters and numbers' })
  password: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(72)
  password: string;
}

export class AdminLoginDto extends LoginDto {
  @IsOptional()
  @Matches(/^\d{6}$/)
  otp?: string;
}

export class RefreshDto {
  @IsString()
  @Length(20, 200)
  refreshToken: string;
}

export class OtpDto {
  @Matches(/^\d{6}$/)
  otp: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @Length(20, 200)
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'password must contain letters and numbers' })
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'password must contain letters and numbers' })
  newPassword: string;
}
