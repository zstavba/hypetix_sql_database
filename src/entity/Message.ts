import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index
} from "typeorm";
import { Conversation } from "./Conversation";
import { User } from "./User";

@Entity()
export class Message {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Index()
    @ManyToOne(() => Conversation, c => c.messages, { onDelete: "CASCADE" })
    conversation!: Conversation;

    @Index()
    @ManyToOne(() => User, u => u.messages, { onDelete: "SET NULL", eager: true, nullable: true })
    sender!: User | null;

    @Column({ type: "text", nullable: true })
    body!: string | null;

    // Store lightweight metadata (files, images, etc.)
    // Message.ts
    @Column({ type: "json", nullable: true })
    attachments!: Array<{ type: string; url: string; name?: string; size?: number }> | null;

    // Optional reply threading
    @Column({ type: "uuid", nullable: true })
    replyToMessageId!: string | null;

    // Soft delete & edit support
    @Column({ type: "date", nullable: true })
    deletedAt!: Date | null;

    @UpdateDateColumn()
    editedAt!: Date;

    @CreateDateColumn()
    createdAt!: Date;
}