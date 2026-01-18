import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED";
export type PaymentMethod = "CARD" | "PAYPAL" | "BANK_TRANSFER";

@Entity({ name: "payments" })
@Index(["reservationId"])
@Index(["userId", "status"])
@Index(["idempotencyKey"], {
  unique: true,
  where: '"idempotencyKey" IS NOT NULL',
})
export class Payment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: true })
  idempotencyKey?: string;

  @Column("uuid")
  @Index()
  reservationId: string;

  @Column("uuid")
  @Index()
  userId: string;

  @Column("uuid")
  eventId: string;

  @Column("decimal", { precision: 10, scale: 2 })
  amount: number;

  @Column({ type: "varchar", length: 20, default: "PENDING" })
  status: PaymentStatus;

  @Column({ type: "varchar", length: 20 })
  paymentMethod: PaymentMethod;

  @Column({ nullable: true })
  transactionId?: string;

  @Column({ type: "text", nullable: true })
  paymentDetails?: string;

  @Column({ type: "text", nullable: true })
  failureReason?: string;

  @Column({ type: "timestamptz", nullable: true })
  processedAt?: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  refundedAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
