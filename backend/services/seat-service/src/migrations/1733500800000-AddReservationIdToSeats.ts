import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from "typeorm";

export class AddReservationIdToSeats1733500800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if reservationId column already exists
    const columnExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'seats' 
        AND column_name = 'reservationId'
      );
    `);

    if (!columnExists[0].exists) {
      // Add reservationId column
      await queryRunner.addColumn(
        "seats",
        new TableColumn({
          name: "reservationId",
          type: "uuid",
          isNullable: true,
        })
      );
    }

    // Check if index already exists
    const indexExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'seats' 
        AND indexname = 'idx_seats_reservation_id'
      );
    `);

    if (!indexExists[0].exists) {
      // Add index for performance (partial index for non-null values)
      await queryRunner.query(`
        CREATE INDEX idx_seats_reservation_id ON seats("reservationId") 
        WHERE "reservationId" IS NOT NULL;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS idx_seats_reservation_id;`);

    // Drop column
    await queryRunner.dropColumn("seats", "reservationId");
  }
}
