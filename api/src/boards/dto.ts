import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsOptionalNotNull, trim } from '../common/validation.js';

export class CreateBoardDto {
  /** @example Lanzamiento v1 */
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;
}

export class UpdateBoardDto extends CreateBoardDto {}

export class CreateColumnDto {
  /** @example En revisión */
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title: string;

  /** Si se omite, la lista se añade al final */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  position?: number;
}

export class UpdateColumnDto {
  @IsOptionalNotNull()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title?: string;

  @IsOptionalNotNull()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  position?: number;
}
