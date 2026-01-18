import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { SagaStep } from "./saga-step.entity";

export enum SagaStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  COMPENSATING = "COMPENSATING",
  COMPENSATED = "COMPENSATED",
  FAILED = "FAILED",
}

@Entity({ name: "saga_executions" })
@Index(["sagaType", "status"])
@Index(["status", "createdAt"])
@Index(["startedAt"])
export class SagaExecution {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 50 })
  sagaType: string;

  @Column({
    type: "varchar",
    length: 20,
    default: SagaStatus.PENDING,
  })
  status: SagaStatus;

  @Column({ type: "jsonb" })
  payload: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  result?: Record<string, any>;

  @Column({ type: "text", nullable: true })
  errorMessage?: string;

  @Column({ type: "timestamptz" })
  startedAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  completedAt?: Date;

  @Column({ type: "timestamptz", nullable: true })
  compensatedAt?: Date;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;

  @OneToMany(() => SagaStep, (step) => step.sagaExecution, {
    cascade: true,
  })
  steps: SagaStep[];
}

