import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class RegisterDto {
  /** @example elisa@fluxo.dev */
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  /** @example Elisa Ruiz */
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  /** Mínimo 8 caracteres */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(128)
  password: string;
}
