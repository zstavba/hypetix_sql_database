import { Entity, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, JoinColumn, Index } from "typeorm";
import { Events } from "./Events";
import { User } from "./User";

@Entity()
@Index(["event", "user"], { unique: true })
export class EventParticipant {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Events, event => event.participants, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id" })
  event: Events;

  @ManyToOne(() => User, user => user.event_participations, { onDelete: "CASCADE", eager: true })
  @JoinColumn({ name: "user_id" })
  user: User;

  @CreateDateColumn()
  joined_at: Date;
}
