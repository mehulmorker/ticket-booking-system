import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class InitialSeatTables1733500700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if seats table already exists
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'seats'
      );
    `);

    if (tableExists[0].exists) {
      // Table already exists, skip creation
      return;
    }

    // Create seats table
    await queryRunner.createTable(
      new Table({
        name: "seats",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            default: "uuid_generate_v4()",
          },
          {
            name: "eventId",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "rowLabel",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "seatNumber",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "section",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "seatType",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "price",
            type: "decimal",
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: "status",
            type: "varchar",
            length: "16",
            default: "'AVAILABLE'",
            isNullable: false,
          },
          {
            name: "lockedBy",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "reservationId",
            type: "uuid",
            isNullable: true,
          },
          {
            name: "lockedAt",
            type: "timestamptz",
            isNullable: true,
          },
          {
            name: "lockExpiresAt",
            type: "timestamptz",
            isNullable: true,
          },
          {
            name: "createdAt",
            type: "timestamptz",
            default: "now()",
            isNullable: false,
          },
          {
            name: "updatedAt",
            type: "timestamptz",
            default: "now()",
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Create indexes
    await queryRunner.createIndex(
      "seats",
      new TableIndex({
        name: "IDX_seats_eventId",
        columnNames: ["eventId"],
      })
    );

    await queryRunner.createIndex(
      "seats",
      new TableIndex({
        name: "IDX_seats_reservationId",
        columnNames: ["reservationId"],
        where: '"reservationId" IS NOT NULL',
      })
    );

    await queryRunner.createIndex(
      "seats",
      new TableIndex({
        name: "IDX_seats_status_lockExpiresAt",
        columnNames: ["status", "lockExpiresAt"],
        where: "status = 'LOCKED'",
      })
    );

    await queryRunner.createIndex(
      "seats",
      new TableIndex({
        name: "IDX_seats_eventId_rowLabel_seatNumber",
        columnNames: ["eventId", "rowLabel", "seatNumber"],
        isUnique: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("seats", true);
  }
}

