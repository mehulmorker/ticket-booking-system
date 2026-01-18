import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type TicketStatus = "PENDING" | "GENERATED" | "VERIFIED" | "CANCELLED";

@Entity({ name: "tickets" })
@Index(["reservationId"])
@Index(["userId", "status"])
@Index(["qrCode"], { unique: true })
export class Ticket {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  @Index()
  reservationId: string;

  @Column("uuid")
  @Index()
  paymentId: string;

  @Column("uuid")
  @Index()
  userId: string;

  @Column("uuid")
  eventId: string;

  @Column("simple-array")
  seatIds: string[];

  @Column({ type: "varchar", length: 20, default: "PENDING" })
  status: TicketStatus;

  @Column({ type: "text" })
  qrCode: string;

  @Column({ type: "text", nullable: true })
  pdfUrl?: string;

  @Column({ type: "text", nullable: true })
  s3Key?: string;

  @Column({ type: "timestamptz", nullable: true })
  verifiedAt?: Date | null;

  @Column({ type: "text", nullable: true })
  verifiedBy?: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}

