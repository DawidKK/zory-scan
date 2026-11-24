import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PHASES, POINT_STATUSES, type Phase, type PointStatus } from '../db/schema';

export class FixtureInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(5)
  suffix?: string | null;

  @IsOptional()
  @IsIn(PHASES)
  phase?: Phase | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  powerW?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;
}

/**
 * Pola wspólne dla tworzenia i edycji. Dla pól sieci: undefined = bez zmian, null = wyczyść.
 * (@IsOptional przepuszcza zarówno undefined, jak i null.)
 */
class PointFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;

  @IsOptional()
  @IsUUID()
  circuitId?: string | null;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[0-9A-Za-z]+(\/[0-9A-Za-z]+)*$/, { message: 'Numer słupa: liczby rozdzielone ukośnikiem, np. 8/2/1' })
  number?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  inventoryId?: string | null;

  @IsOptional()
  @IsIn(POINT_STATUSES)
  status?: PointStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  cableLength?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cableType?: string | null;

  /** Jeśli podane: zastępuje wszystkie oprawy słupa. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => FixtureInputDto)
  fixtures?: FixtureInputDto[];
}

export class CreatePointDto extends PointFieldsDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;
}

export class UpdatePointDto extends PointFieldsDto {
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;
}
