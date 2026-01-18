import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialTicketTables1765115671174 implements MigrationInterface {
    name = 'InitialTicketTables1765115671174'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'tickets'
            );
        `);

        if (tableExists[0].exists) {
            return;
        }

        await queryRunner.query(`CREATE TABLE "tickets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reservationId" uuid NOT NULL, "paymentId" uuid NOT NULL, "userId" uuid NOT NULL, "eventId" uuid NOT NULL, "seatIds" text NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'PENDING', "qrCode" text NOT NULL, "pdfUrl" text, "s3Key" text, "verifiedAt" TIMESTAMP WITH TIME ZONE, "verifiedBy" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_343bc942ae261cf7a1377f48fd0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_f5f6f2e8bfda46f03c7aca6fbb" ON "tickets" ("reservationId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_44e6dc9fc3e544ca388753b520" ON "tickets" ("paymentId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_4bb45e096f521845765f657f5c" ON "tickets" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fededfa934cf8d7214adfa6c82" ON "tickets" ("qrCode") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b92781135fbe94b5033c15b018" ON "tickets" ("userId", "status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_b92781135fbe94b5033c15b018"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_fededfa934cf8d7214adfa6c82"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_4bb45e096f521845765f657f5c"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_44e6dc9fc3e544ca388753b520"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_f5f6f2e8bfda46f03c7aca6fbb"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "tickets"`);
    }

}
