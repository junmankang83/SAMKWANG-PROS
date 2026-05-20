import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class AuthChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(100)
  newPassword!: string;
}
