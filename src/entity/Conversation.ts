import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, OneToMany, CreateDateColumn, DeleteDateColumn, UpdateDateColumn, JoinTable, ManyToMany, Index } from "typeorm"
import { UserImages } from "./UserImages";
import { User } from "./User";
import { NewsCategory } from "./NewsCategory";
import { ConversationParticipant } from "./ConversationParticipant ";
import { Message } from "./Message";
import { userInfo } from "os";

export type NotificationType = 'message' |'billing_plan' | 'task';

@Entity()
export class Conversation {

    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, { nullable: true, onDelete: "CASCADE"})
    @JoinColumn({ name: "fk_user_id" })
    fk_user_id: User;

    @Column({ default: false })
    isGroup!: boolean;

    // Optional display title for groups; can be null for 1:1
    @Column({ type: "varchar", length: 255, nullable: true })
    title!: string | null;
    
    @Index()
    @UpdateDateColumn()
    updatedAt!: Date;

    @CreateDateColumn()
    createdAt!: Date;

    @DeleteDateColumn()
    deletedAt!: Date | null;

    @Column({ type: "boolean", default: false })
    isDeleted!: boolean;

    @Column({ type: "boolean", default: false })
    isBlocked!: boolean;

    @OneToMany(() => ConversationParticipant, p => p.conversation, { cascade: ["insert"], eager: false })
    participants!: ConversationParticipant[];
    
    @OneToMany(() => Message, m => m.conversation, { cascade: ["remove"] })
    messages!: Message[];
}