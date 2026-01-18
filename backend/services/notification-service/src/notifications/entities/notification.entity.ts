import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type NotificationType = "EMAIL" | "SMS";
export type NotificationStatus = "PENDING" | "SENT" | "FAILED" | "DELIVERED";
export type NotificationEvent =
  | "BOOKING_CONFIRMED"
  | "PAYMENT_RECEIPT"
  | "TICKET_READY"
  | "BOOKING_REMINDER"
  | "CANCELLATION";

@Entity({ name: "notifications" })
@Index(["userId", "status"])
@Index(["type", "status"])
@Index(["event", "status"])
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  @Index()
  userId: string;

  @Column({ type: "varchar", length: 20 })
  type: NotificationType;

  @Column({ type: "varchar", length: 50 })
  event: NotificationEvent;

  @Column({ type: "varchar", length: 20, default: "PENDING" })
  status: NotificationStatus;

  @Column({ type: "text" })
  recipient: string;

  @Column({ type: "text" })
  subject: string;

  @Column({ type: "text", nullable: true })
  body?: string;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: "text", nullable: true })
  externalId?: string;

  @Column({ type: "timestamptz", nullable: true })
  sentAt?: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  deliveredAt?: Date | null;

  @Column({ type: "text", nullable: true })
  failureReason?: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}

