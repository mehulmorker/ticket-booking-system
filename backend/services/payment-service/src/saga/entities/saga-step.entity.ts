import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from "typeorm";
import { SagaExecution } from "./saga-execution.entity";

export enum StepStatus {
  PENDING = "PENDING",
  EXECUTING = "EXECUTING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  COMPENSATING = "COMPENSATING",
  COMPENSATED = "COMPENSATED",
}

@Entity({ name: "saga_steps" })
@Index(["sagaExecutionId", "stepOrder"], { unique: true })
@Index(["status"])
@Index(["createdAt"])
export class SagaStep {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  sagaExecutionId: string;

  @ManyToOne(() => SagaExecution, (execution) => execution.steps, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "sagaExecutionId" })
  sagaExecution: SagaExecution;

  @Column({ type: "varchar", length: 100 })
  stepName: string;

  @Column({ type: "integer" })
  stepOrder: number;

  @Column({
    type: "varchar",
    length: 20,
    default: StepStatus.PENDING,
  })
  status: StepStatus;

  @Column({ type: "jsonb", nullable: true })
  requestPayload?: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  responsePayload?: Record<string, any>;

  @Column({ type: "text", nullable: true })
  errorMessage?: string;

  @Column({ type: "jsonb", nullable: true })
  compensationPayload?: Record<string, any>;

  @Column({ type: "timestamptz", nullable: true })
  startedAt?: Date;

  @Column({ type: "timestamptz", nullable: true })
  completedAt?: Date;

  @Column({ type: "timestamptz", nullable: true })
  compensatedAt?: Date;

  @Column({ type: "integer", default: 0 })
  retryCount: number;

  @Column({ type: "integer", default: 3 })
  maxRetries: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}

