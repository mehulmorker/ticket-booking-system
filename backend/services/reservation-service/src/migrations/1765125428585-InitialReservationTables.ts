import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialReservationTables1765125428585 implements MigrationInterface {
    name = 'InitialReservationTables1765125428585'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "reservations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "idempotencyKey" character varying, "userId" uuid NOT NULL, "eventId" uuid NOT NULL, "seatIds" text NOT NULL, "totalAmount" numeric(10,2) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'PENDING', "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "confirmedAt" TIMESTAMP WITH TIME ZONE, "cancelledAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_27e1faef37031629c5a09cbe01b" UNIQUE ("idempotencyKey"), CONSTRAINT "PK_da95cef71b617ac35dc5bcda243" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_aa0e1cc2c4f54da32bf8282154" ON "reservations" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6fda79964e4d3a3e3f9843fbc" ON "reservations" ("eventId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ab5431e531213cadec893a8f77" ON "reservations" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_02546c5154b11745813892b622" ON "reservations" ("eventId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_d903e8a932e1e82ed9131a4b7a" ON "reservations" ("userId", "status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_d903e8a932e1e82ed9131a4b7a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_02546c5154b11745813892b622"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ab5431e531213cadec893a8f77"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c6fda79964e4d3a3e3f9843fbc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa0e1cc2c4f54da32bf8282154"`);
        await queryRunner.query(`DROP TABLE "reservations"`);
    }

}
