import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Venue } from '../venues/entities/venue.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    @InjectRepository(Venue)
    private readonly venuesRepository: Repository<Venue>,
  ) {}

  async create(dto: CreateEventDto): Promise<Event> {
    const venue = await this.venuesRepository.findOne({ where: { id: dto.venueId } });
    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    const event = this.eventsRepository.create({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      venue,
      eventDate: new Date(dto.eventDate),
      startTime: dto.startTime,
      endTime: dto.endTime,
      totalSeats: dto.totalSeats,
      availableSeats: dto.totalSeats,
      status: EventStatus.UPCOMING,
    });

    return this.eventsRepository.save(event);
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: EventStatus;
  }): Promise<{ data: Event[]; total: number; page: number; limit: number }> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.category) {
      where.category = params.category;
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.search) {
      where.title = ILike(`%${params.search}%`);
    }

    const [data, total] = await this.eventsRepository.findAndCount({
      where,
      relations: ['venue'],
      skip,
      take: limit,
      order: { eventDate: 'ASC' },
    });

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventsRepository.findOne({
      where: { id },
      relations: ['venue'],
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);

    if (dto.venueId && dto.venueId !== (event.venue && event.venue.id)) {
      const venue = await this.venuesRepository.findOne({ where: { id: dto.venueId } });
      if (!venue) {
        throw new NotFoundException('Venue not found');
      }
      event.venue = venue;
    }

    Object.assign(event, {
      title: dto.title ?? event.title,
      description: dto.description ?? event.description,
      category: dto.category ?? event.category,
      eventDate: dto.eventDate ? new Date(dto.eventDate) : event.eventDate,
      startTime: dto.startTime ?? event.startTime,
      endTime: dto.endTime ?? event.endTime,
    });

    return this.eventsRepository.save(event);
  }

  async remove(id: string): Promise<void> {
    const event = await this.findOne(id);
    await this.eventsRepository.remove(event);
  }
}
