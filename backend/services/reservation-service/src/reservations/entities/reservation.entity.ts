import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELLED";

@Entity({ name: "reservations" })
@Index(["userId", "status"])
@Index(["eventId", "status"])
@Index(["idempotencyKey"], {
  unique: true,
  where: '"idempotencyKey" IS NOT NULL',
})
export class Reservation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: true, unique: true })
  idempotencyKey?: string;

  @Column("uuid")
  @Index()
  userId: string;

  @Column("uuid")
  @Index()
  eventId: string;

  @Column("simple-array")
  seatIds: string[]; // Array of seat UUIDs

  @Column("decimal", { precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: "varchar", length: 20, default: "PENDING" })
  status: ReservationStatus;

  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  confirmedAt?: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  cancelledAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
