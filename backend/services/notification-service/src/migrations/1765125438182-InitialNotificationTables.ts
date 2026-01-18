import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialNotificationTables1765125438182 implements MigrationInterface {
    name = 'InitialNotificationTables1765125438182'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" character varying(20) NOT NULL, "event" character varying(50) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'PENDING', "recipient" text NOT NULL, "subject" text NOT NULL, "body" text, "metadata" jsonb, "externalId" text, "sentAt" TIMESTAMP WITH TIME ZONE, "deliveredAt" TIMESTAMP WITH TIME ZONE, "failureReason" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_692a909ee0fa9383e7859f9b40" ON "notifications" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7b337f0fe18ed8f2fb6193c26f" ON "notifications" ("event", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_f8aa5a0ec5345433ba253a7eaa" ON "notifications" ("type", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_78207b2dc2b0d717649e89d3fc" ON "notifications" ("userId", "status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_78207b2dc2b0d717649e89d3fc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f8aa5a0ec5345433ba253a7eaa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7b337f0fe18ed8f2fb6193c26f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_692a909ee0fa9383e7859f9b40"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
    }

}
