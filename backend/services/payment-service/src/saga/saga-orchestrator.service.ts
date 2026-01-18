import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SagaExecution, SagaStatus } from "./entities/saga-execution.entity";
import { SagaStep, StepStatus } from "./entities/saga-step.entity";
import { ISagaStep } from "./interfaces/saga-step.interface";
import { ICompensatableStep } from "./interfaces/compensatable-step.interface";

@Injectable()
export class SagaOrchestrator {
  private readonly logger = new Logger(SagaOrchestrator.name);
  private readonly stepHandlers: Map<string, ISagaStep> = new Map();

  constructor(
    @InjectRepository(SagaExecution)
    private readonly sagaExecutionRepository: Repository<SagaExecution>,
    @InjectRepository(SagaStep)
    private readonly sagaStepRepository: Repository<SagaStep>
  ) {}

  /**
   * Register a step handler for a saga
   */
  registerStep(sagaType: string, step: ISagaStep): void {
    const key = `${sagaType}:${step.stepName}:${step.stepOrder}`;
    this.stepHandlers.set(key, step);
    this.logger.log(`Registered step handler: ${key}`);
  }

  /**
   * Execute a saga
   */
  async executeSaga(
    sagaType: string,
    payload: any,
    steps: ISagaStep[]
  ): Promise<SagaExecution> {
    const execution = this.sagaExecutionRepository.create({
      sagaType,
      status: SagaStatus.PENDING,
      payload,
      startedAt: new Date(),
    });

    const savedExecution = await this.sagaExecutionRepository.save(execution);

    // Create step records
    const stepEntities = steps.map((step, index) =>
      this.sagaStepRepository.create({
        sagaExecutionId: savedExecution.id,
        stepName: step.stepName,
        stepOrder: step.stepOrder,
        status: StepStatus.PENDING,
        maxRetries: step.getMaxRetries(),
      })
    );

    await this.sagaStepRepository.save(stepEntities);

    // Update execution status
    savedExecution.status = SagaStatus.IN_PROGRESS;
    await this.sagaExecutionRepository.save(savedExecution);

    this.logger.log(
      `Starting saga execution ${savedExecution.id} of type ${sagaType}`
    );

    try {
      // Execute steps in order
      for (const step of steps) {
        await this.executeStep(savedExecution, step);
      }

      // All steps completed successfully
      savedExecution.status = SagaStatus.COMPLETED;
      savedExecution.completedAt = new Date();
      await this.sagaExecutionRepository.save(savedExecution);

      this.logger.log(
        `Saga execution ${savedExecution.id} completed successfully`
      );

      return savedExecution;
    } catch (error) {
      this.logger.error(
        `Saga execution ${savedExecution.id} failed: ${error.message}`,
        error.stack
      );

      // Start compensation
      savedExecution.status = SagaStatus.COMPENSATING;
      await this.sagaExecutionRepository.save(savedExecution);

      try {
        await this.compensate(savedExecution, steps);
        savedExecution.status = SagaStatus.COMPENSATED;
        savedExecution.compensatedAt = new Date();
      } catch (compensationError) {
        this.logger.error(
          `Compensation failed for saga ${savedExecution.id}: ${compensationError.message}`,
          compensationError.stack
        );
        savedExecution.status = SagaStatus.FAILED;
        savedExecution.errorMessage = `Compensation failed: ${compensationError.message}`;
      }

      await this.sagaExecutionRepository.save(savedExecution);
      throw error;
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    execution: SagaExecution,
    step: ISagaStep
  ): Promise<void> {
    const stepEntity = await this.sagaStepRepository.findOne({
      where: {
        sagaExecutionId: execution.id,
        stepOrder: step.stepOrder,
      },
    });

    if (!stepEntity) {
      throw new Error(
        `Step entity not found for step ${step.stepName} (order: ${step.stepOrder})`
      );
    }

    // Check if already completed (idempotency)
    if (stepEntity.status === StepStatus.COMPLETED) {
      this.logger.log(
        `Step ${step.stepName} already completed, skipping execution`
      );
      return;
    }

    // Retry logic
    let lastError: any;
    for (let attempt = 0; attempt <= step.getMaxRetries(); attempt++) {
      try {
        stepEntity.status = StepStatus.EXECUTING;
        stepEntity.startedAt = new Date();
        stepEntity.requestPayload = execution.payload;
        await this.sagaStepRepository.save(stepEntity);

        this.logger.log(
          `Executing step ${step.stepName} (attempt ${attempt + 1}/${step.getMaxRetries() + 1})`
        );

        const result = await step.execute(execution.payload);

        stepEntity.status = StepStatus.COMPLETED;
        stepEntity.completedAt = new Date();
        stepEntity.responsePayload = result;
        await this.sagaStepRepository.save(stepEntity);

        this.logger.log(`Step ${step.stepName} completed successfully`);
        return;
      } catch (error) {
        lastError = error;
        stepEntity.retryCount = attempt + 1;
        stepEntity.errorMessage = error.message;

        if (attempt < step.getMaxRetries() && step.canRetry(error)) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          this.logger.warn(
            `Step ${step.stepName} failed (attempt ${attempt + 1}), retrying in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          stepEntity.status = StepStatus.FAILED;
          await this.sagaStepRepository.save(stepEntity);
          throw error;
        }
      }
    }

    throw lastError;
  }

  /**
   * Compensate (rollback) a saga
   */
  private async compensate(
    execution: SagaExecution,
    steps: ISagaStep[]
  ): Promise<void> {
    this.logger.log(`Starting compensation for saga execution ${execution.id}`);

    // Get executed steps in reverse order
    const executedSteps = await this.sagaStepRepository.find({
      where: {
        sagaExecutionId: execution.id,
        status: StepStatus.COMPLETED,
      },
      order: {
        stepOrder: "DESC",
      },
    });

    // Compensate in reverse order
    for (const stepEntity of executedSteps) {
      const step = steps.find((s) => s.stepOrder === stepEntity.stepOrder);

      if (!step) {
        this.logger.warn(
          `Step handler not found for step ${stepEntity.stepName}, skipping compensation`
        );
        continue;
      }

      if (!this.isCompensatable(step)) {
        this.logger.warn(
          `Step ${step.stepName} is not compensatable, skipping`
        );
        continue;
      }

      const compensatableStep = step as ICompensatableStep;

      try {
        stepEntity.status = StepStatus.COMPENSATING;
        await this.sagaStepRepository.save(stepEntity);

        this.logger.log(`Compensating step ${step.stepName}`);

        const compensationResult = await compensatableStep.compensate(
          stepEntity.requestPayload || execution.payload,
          stepEntity.responsePayload
        );

        stepEntity.status = StepStatus.COMPENSATED;
        stepEntity.compensatedAt = new Date();
        stepEntity.compensationPayload = compensationResult;
        await this.sagaStepRepository.save(stepEntity);

        this.logger.log(`Step ${step.stepName} compensated successfully`);
      } catch (error) {
        this.logger.error(
          `Compensation failed for step ${step.stepName}: ${error.message}`,
          error.stack
        );
        stepEntity.errorMessage = `Compensation failed: ${error.message}`;
        await this.sagaStepRepository.save(stepEntity);
        // Continue with other compensations even if one fails
      }
    }

    this.logger.log(
      `Compensation completed for saga execution ${execution.id}`
    );
  }

  /**
   * Check if a step is compensatable
   */
  private isCompensatable(step: ISagaStep): step is ICompensatableStep {
    return (
      "compensate" in step &&
      typeof (step as ICompensatableStep).compensate === "function"
    );
  }

  /**
   * Get saga execution by ID
   */
  async getExecution(id: string): Promise<SagaExecution | null> {
    return this.sagaExecutionRepository.findOne({
      where: { id },
      relations: ["steps"],
    });
  }

  /**
   * Find stuck sagas (IN_PROGRESS for too long)
   */
  async findStuckSagas(timeoutMinutes: number = 30): Promise<SagaExecution[]> {
    const timeoutDate = new Date();
    timeoutDate.setMinutes(timeoutDate.getMinutes() - timeoutMinutes);

    return this.sagaExecutionRepository.find({
      where: {
        status: SagaStatus.IN_PROGRESS,
      },
      relations: ["steps"],
    });
  }
}

