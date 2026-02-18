import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateUserPackageSelectionTable1660000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "user_package_selection",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment"
                    },
                    {
                        name: "fk_user_id",
                        type: "int"
                    },
                    {
                        name: "fk_billing_id",
                        type: "int"
                    }
                ]
            })
        );
        await queryRunner.createForeignKey(
            "user_package_selection",
            new TableForeignKey({
                columnNames: ["fk_user_id"],
                referencedTableName: "user",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE"
            })
        );
        await queryRunner.createForeignKey(
            "user_package_selection",
            new TableForeignKey({
                columnNames: ["fk_billing_id"],
                referencedTableName: "billing_plan",
                referencedColumnNames: ["id"],
                onDelete: "CASCADE"
            })
        );
        // Many-to-many for icons
        await queryRunner.query(`
            CREATE TABLE user_package_selection_fk_icons_id_billing_plan_icons (
                user_package_selection_id int NOT NULL,
                billing_plan_icons_id int NOT NULL,
                PRIMARY KEY (user_package_selection_id, billing_plan_icons_id),
                CONSTRAINT FK_user_package_selection_id FOREIGN KEY (user_package_selection_id) REFERENCES user_package_selection(id) ON DELETE CASCADE,
                CONSTRAINT FK_billing_plan_icons_id FOREIGN KEY (billing_plan_icons_id) REFERENCES billing_plan_icons(id) ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DROP TABLE user_package_selection_fk_icons_id_billing_plan_icons");
        await queryRunner.dropTable("user_package_selection");
    }
}
