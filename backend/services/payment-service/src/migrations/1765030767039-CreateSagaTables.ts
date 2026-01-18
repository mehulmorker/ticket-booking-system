import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSagaTables1765030767039 implements MigrationInterface {
  name = "CreateSagaTables1765030767039";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create saga_executions table
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "saga_executions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sagaType" character varying(50) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'PENDING', "payload" jsonb NOT NULL, "result" jsonb, "errorMessage" text, "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "completedAt" TIMESTAMP WITH TIME ZONE, "compensatedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5f432af0d72fc1c014ab9adae34" PRIMARY KEY ("id"))`
    );

    // Create indexes for saga_executions (with IF NOT EXISTS check)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_681c9fd72c78f8951f818fceba" ON "saga_executions" ("startedAt")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_b0e6a121f40a0b1ca87c0fcfce" ON "saga_executions" ("status", "createdAt")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_1c9a2f09bf2c859d969ce54f8a" ON "saga_executions" ("sagaType", "status")`
    );

    // Create saga_steps table
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "saga_steps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sagaExecutionId" uuid NOT NULL, "stepName" character varying(100) NOT NULL, "stepOrder" integer NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'PENDING', "requestPayload" jsonb, "responsePayload" jsonb, "errorMessage" text, "compensationPayload" jsonb, "startedAt" TIMESTAMP WITH TIME ZONE, "completedAt" TIMESTAMP WITH TIME ZONE, "compensatedAt" TIMESTAMP WITH TIME ZONE, "retryCount" integer NOT NULL DEFAULT '0', "maxRetries" integer NOT NULL DEFAULT '3', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_18232eb771bd51ccd4d3c92b280" PRIMARY KEY ("id"))`
    );

    // Create indexes for saga_steps (with IF NOT EXISTS check)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_c2af654e122b13f43643de8200" ON "saga_steps" ("createdAt")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_31238905ce51d5d0fce1a35df9" ON "saga_steps" ("status")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_97d172a44dc8df9b452b955f5a" ON "saga_steps" ("sagaExecutionId", "stepOrder")`
    );

    // Add foreign key constraint (with IF NOT EXISTS check)
    const foreignKeyExists = await queryRunner.query(`
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'FK_6e4e62f421743d22c76a2e87d39' 
            AND table_name = 'saga_steps'
        `);
    if (foreignKeyExists.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "saga_steps" ADD CONSTRAINT "FK_6e4e62f421743d22c76a2e87d39" FOREIGN KEY ("sagaExecutionId") REFERENCES "saga_executions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "saga_steps" DROP CONSTRAINT IF EXISTS "FK_6e4e62f421743d22c76a2e87d39"`
    );

    // Drop saga_steps indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_97d172a44dc8df9b452b955f5a"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_31238905ce51d5d0fce1a35df9"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_c2af654e122b13f43643de8200"`
    );

    // Drop saga_steps table
    await queryRunner.query(`DROP TABLE IF EXISTS "saga_steps"`);

    // Drop saga_executions indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_1c9a2f09bf2c859d969ce54f8a"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_b0e6a121f40a0b1ca87c0fcfce"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_681c9fd72c78f8951f818fceba"`
    );

    // Drop saga_executions table
    await queryRunner.query(`DROP TABLE IF EXISTS "saga_executions"`);
  }
}
