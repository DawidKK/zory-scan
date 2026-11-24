import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CircuitInputDto {
  /** Brak id = nowy obwód. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsInt()
  @Min(1)
  @Max(99)
  number: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class CreateCabinetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  number: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  /** Pełna lista obwodów szafy (tworzenie / synchronizacja). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CircuitInputDto)
  circuits?: CircuitInputDto[];
}

export class UpdateCabinetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  /** Jeśli podane: obwody spoza listy zostaną usunięte (ich słupy staną się nieprzypisane). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CircuitInputDto)
  circuits?: CircuitInputDto[];
}
