import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, DeleteDateColumn, UpdateDateColumn, Check, Unique } from "typeorm"
import { User } from "./User"

export enum FavoriteStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  CANCELED = "canceled",
}

@Entity()
export class UserFavorites {

    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(() => User, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "fk_user_one_id" })
    fk_user_one_id: User; 

    @ManyToOne(() => User, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "fk_user_two_id" })
    fk_user_two_id: User; 

    @Column({ type: "enum", enum: FavoriteStatus, default: FavoriteStatus.PENDING })
    status!: FavoriteStatus;

    @CreateDateColumn() createdAt: Date;
    @UpdateDateColumn() updatedAt: Date;
    @DeleteDateColumn() deletedAt?: Date | null;

}