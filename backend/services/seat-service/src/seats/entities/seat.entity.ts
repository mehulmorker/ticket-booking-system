import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type SeatStatus = "AVAILABLE" | "LOCKED" | "RESERVED" | "SOLD";

@Entity({ name: "seats" })
@Index(["eventId", "rowLabel", "seatNumber"], { unique: true })
@Index(["status", "lockExpiresAt"], { where: "status = 'LOCKED'" })
export class Seat {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  @Index()
  eventId: string;

  @Column()
  rowLabel: string;

  @Column()
  seatNumber: string;

  @Column({ nullable: true })
  section?: string;

  @Column({ nullable: true })
  seatType?: string; // e.g., REGULAR, VIP, BALCONY

  @Column("decimal", { precision: 10, scale: 2 })
  price: number;

  @Column({ type: "varchar", length: 16, default: "AVAILABLE" })
  status: SeatStatus;

  @Column({ type: "varchar", nullable: true })
  lockedBy?: string | null; // userId (who has the lock)

  @Column({ type: "uuid", nullable: true })
  @Index()
  reservationId?: string | null; // Which reservation owns this seat

  @Column({ type: "timestamptz", nullable: true })
  lockedAt?: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  lockExpiresAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
