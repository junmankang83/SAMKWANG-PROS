import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ErpUserListQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(100)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  organization!: string;
}
