import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialPaymentTables1765115668757 implements MigrationInterface {
    name = 'InitialPaymentTables1765115668757'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'payments'
            );
        `);

        if (tableExists[0].exists) {
            return;
        }

        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "idempotencyKey" character varying, "reservationId" uuid NOT NULL, "userId" uuid NOT NULL, "eventId" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'PENDING', "paymentMethod" character varying(20) NOT NULL, "transactionId" character varying, "paymentDetails" text, "failureReason" text, "processedAt" TIMESTAMP WITH TIME ZONE, "refundedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_1221b304716c539fde3fb3cb8d" ON "payments" ("reservationId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_d35cb3c13a18e1ea1705b2817b" ON "payments" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_6dfaaeefd1fb00160610b96108" ON "payments" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_5e9210b4560e083026af787ec3" ON "payments" ("userId", "status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_5e9210b4560e083026af787ec3"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_6dfaaeefd1fb00160610b96108"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_d35cb3c13a18e1ea1705b2817b"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_1221b304716c539fde3fb3cb8d"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    }

}
