import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { DB, Database } from '../db/db.module';
import { cabinets, circuits, points } from '../db/schema';
import { GeocodeService } from '../points/geocode.service';
import { CircuitInputDto, CreateCabinetDto, UpdateCabinetDto } from './cabinets.dto';

@Injectable()
export class CabinetsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly geocode: GeocodeService,
  ) {}

  async list() {
    const [cabs, circs] = await Promise.all([
      this.db.select().from(cabinets).orderBy(asc(cabinets.number)),
      this.db.select().from(circuits).orderBy(asc(circuits.number)),
    ]);
    return cabs.map((c) => ({ ...c, circuits: circs.filter((x) => x.cabinetId === c.id) }));
  }

  async get(id: string) {
    const cabinet = await this.db.query.cabinets.findFirst({ where: eq(cabinets.id, id) });
    if (!cabinet) throw new NotFoundException('Nie znaleziono szafy');
    const circs = await this.db.select().from(circuits).where(eq(circuits.cabinetId, id)).orderBy(asc(circuits.number));
    return { ...cabinet, circuits: circs };
  }

  async create(dto: CreateCabinetDto) {
    const number = dto.number.trim();
    await this.assertNumberFree(number);
    const list = dto.circuits ?? [{ number: 1 }];
    assertCircuitNumbersUnique(list);

    const address = await this.geocode.reverse(dto.lat, dto.lng);
    const [cabinet] = await this.db
      .insert(cabinets)
      .values({ number, name: dto.name?.trim() ?? '', lat: dto.lat, lng: dto.lng, notes: dto.notes ?? '', address })
      .returning();
    if (list.length) {
      await this.db
        .insert(circuits)
        .values(list.map((c) => ({ cabinetId: cabinet.id, number: c.number, description: c.description?.trim() ?? '' })));
    }
    return this.get(cabinet.id);
  }

  async update(id: string, dto: UpdateCabinetDto) {
    const current = await this.get(id);
    const number = dto.number?.trim();
    if (number && number !== current.number) await this.assertNumberFree(number, id);

    const moved =
      (dto.lat !== undefined && dto.lat !== current.lat) || (dto.lng !== undefined && dto.lng !== current.lng);
    const address =
      moved || current.address == null
        ? await this.geocode.reverse(dto.lat ?? current.lat, dto.lng ?? current.lng)
        : current.address;

    const { circuits: circuitList, ...fields } = dto;
    await this.db
      .update(cabinets)
      .set({
        ...fields,
        ...(number ? { number } : {}),
        ...(fields.name !== undefined ? { name: fields.name.trim() } : {}),
        address,
        updatedAt: new Date(),
      })
      .where(eq(cabinets.id, id));

    if (circuitList) await this.syncCircuits(id, current.circuits.map((c) => c.id), circuitList);
    return this.get(id);
  }

  async remove(id: string) {
    const cabinet = await this.get(id);
    const circuitIds = cabinet.circuits.map((c) => c.id);
    // FK nie muszą być egzekwowane na każdym połączeniu, więc odpinamy słupy jawnie.
    await this.db.batch([
      this.db.update(points).set({ circuitId: null, parentId: null }).where(inArray(points.circuitId, circuitIds.length ? circuitIds : [''])),
      this.db.delete(circuits).where(eq(circuits.cabinetId, id)),
      this.db.delete(cabinets).where(eq(cabinets.id, id)),
    ]);
  }

  private async syncCircuits(cabinetId: string, existingIds: string[], list: CircuitInputDto[]) {
    assertCircuitNumbersUnique(list);
    for (const c of list) {
      if (c.id && !existingIds.includes(c.id)) throw new BadRequestException('Obwód nie należy do tej szafy');
    }
    const keep = new Set(list.map((c) => c.id).filter(Boolean));
    const removed = existingIds.filter((x) => !keep.has(x));

    if (removed.length) {
      await this.db.batch([
        this.db.update(points).set({ circuitId: null, parentId: null }).where(inArray(points.circuitId, removed)),
        this.db.delete(circuits).where(inArray(circuits.id, removed)),
      ]);
    }
    // Zmiana numerów (np. zamiana 1↔2) koliduje z unikalnym indeksem — najpierw numery tymczasowe.
    const updates = list.filter((c) => c.id);
    for (const c of updates) {
      await this.db.update(circuits).set({ number: -1000 - c.number }).where(eq(circuits.id, c.id!));
    }
    for (const c of updates) {
      await this.db
        .update(circuits)
        .set({ number: c.number, description: c.description?.trim() ?? '' })
        .where(eq(circuits.id, c.id!));
    }
    const created = list.filter((c) => !c.id);
    if (created.length) {
      await this.db
        .insert(circuits)
        .values(created.map((c) => ({ cabinetId, number: c.number, description: c.description?.trim() ?? '' })));
    }
  }

  private async assertNumberFree(number: string, exceptId?: string) {
    const clash = await this.db.query.cabinets.findFirst({
      where: exceptId ? and(eq(cabinets.number, number), ne(cabinets.id, exceptId)) : eq(cabinets.number, number),
    });
    if (clash) throw new ConflictException(`Szafa SOU-${number} już istnieje`);
  }
}

function assertCircuitNumbersUnique(list: { number: number }[]) {
  const nums = list.map((c) => c.number);
  if (new Set(nums).size !== nums.length) throw new BadRequestException('Numery obwodów w szafie muszą być unikalne');
}
