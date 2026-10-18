import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '../generated/prisma/enums.js';

export class CreateWorkspaceDto {
  /** @example Estudio Fluxo */
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;
}

export class UpdateWorkspaceDto extends CreateWorkspaceDto {}

export class AddMemberDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class UpdateMemberDto {
  @IsEnum(Role)
  role: Role;
}
