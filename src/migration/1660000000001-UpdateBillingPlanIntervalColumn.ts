import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateBillingPlanIntervalColumn1660000000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE billing_plan MODIFY COLUMN interval VARCHAR(16) NOT NULL DEFAULT 'month'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE billing_plan MODIFY COLUMN interval ENUM('day','week','month','year') NOT NULL DEFAULT 'month'`);
    }
}
