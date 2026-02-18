import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, OneToMany, CreateDateColumn, DeleteDateColumn, UpdateDateColumn, JoinTable, ManyToMany, Index } from "typeorm"
import { UserImages } from "./UserImages";
import { User } from "./User";
import { NewsCategory } from "./NewsCategory";

export type NotificationType = 'event' | 'message' | 'friend' | 'other';

@Entity()
export class Notification {
    @ManyToMany(() => User, { nullable: true, onDelete: "CASCADE" })
    @JoinTable({ name: "notifications_friends" })
    fk_friends_id?: User[];

    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(() => User, {nullable: true, onDelete: "CASCADE"})
    @JoinColumn({ name: "fk_user_id" })
    fk_user_id: User;
    
    @Column({ type: 'enum', enum: ['event', 'message', 'friend', 'other'], default: 'other' })
    type!: NotificationType;

    @Column({ type: 'varchar', length: 255 })
    title: string;


    @Column({ type: 'boolean', default: false })
    read: boolean;

    @CreateDateColumn({ type: 'datetime', precision: 6 })
    created_at!: Date;

    @UpdateDateColumn({ type: 'datetime', precision: 6 })
    updated_at!: Date;


}