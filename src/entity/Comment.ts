import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, OneToMany, CreateDateColumn, DeleteDateColumn, UpdateDateColumn, JoinTable, ManyToMany, Index } from "typeorm"
import { UserImages } from "./UserImages";
import { User } from "./User";
import { NewsCategory } from "./NewsCategory";
import { News } from "./News";

export type BillingInterval = 'day'|'week'|'month'|'year';
export type PricingModel = 'free' |'pro' | 'pro_plus';

@Entity()
export class Comment {

    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(() => User, {nullable: true, onDelete: "CASCADE"})
    @JoinColumn({ name: "fk_user_id" })
    fk_user_id: User;

    @ManyToOne(() => News, {nullable: true, onDelete: "CASCADE"})
    @JoinColumn({ name: "fk_news_id" })
    fk_news_id: News;

    @ManyToOne(() => UserImages, {nullable: true, onDelete: "CASCADE"})
    @JoinColumn({ name: "fk_video_id" })
    fk_video_id: UserImages;

    @Column({ type: 'text', nullable: true })
    body?: string | null;

    @Column({
        type: "boolean",
        nullable: true,
        default: 0
    })
    blocked: boolean;

    // Timestamps
    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    created_at: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
    updated_at: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deleted_at?: Date | null;

}