import { Entity, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, Column, Unique, Index } from "typeorm";
import { Conversation } from "./Conversation";
import { User } from "./User";

@Entity()
export class ConversationParticipant {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Conversation, c => c.participants, { onDelete: "CASCADE" })
  conversation!: Conversation;

  @Index()
  @ManyToOne(() => User, u => u.participants, { onDelete: "CASCADE", eager: true })
  user!: User;

  // who invited this user (optional)
  @ManyToOne(() => User, { nullable: true, eager: true, onDelete: "CASCADE" })
  invitedBy?: User | null;

  @Column({
    type: "boolean",
    default: false
  })
  accepted: boolean;

}