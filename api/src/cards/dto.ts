import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsOptionalNotNull, trim } from '../common/validation.js';

export class CreateCardDto {
  /** @example Diseñar el modal de tarjeta */
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  /** Si se omite, la tarjeta se añade al final de la lista */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  position?: number;
}

/**
 * Todo es opcional salvo `version`: la que conoce el cliente.
 * Si no coincide con la del servidor → 409 (ADR 0002).
 */
export class UpdateCardDto {
  @IsInt()
  @Min(1)
  version: number;

  @IsOptionalNotNull()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptionalNotNull()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  /** null = sin asignar */
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  /** ISO 8601; null = sin fecha */
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptionalNotNull()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  labelIds?: string[];

  /** Mover a otra lista del mismo tablero */
  @IsOptionalNotNull()
  @IsUUID()
  columnId?: string;

  @IsOptionalNotNull()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  position?: number;
}
