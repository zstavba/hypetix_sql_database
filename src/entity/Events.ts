import { Entity, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, Column, Unique, Index, JoinColumn, OneToMany } from "typeorm";
import { Conversation } from "./Conversation";
import { User } from "./User";
import { UserImages } from "./UserImages";
import { EventParticipant } from "./EventParticipant";

enum EventType {
  private = 'privat',
  public = 'javno',
  none = 'ni določeno'
}

@Entity()
export class Events {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: "CASCADE"})
  @JoinColumn({ name: "fk_user_id" })
  fk_user_id: User;

  @ManyToOne(() => UserImages, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "fk_album_id" })
  fk_album_id: UserImages;

  @Column({ type: "varchar", length: 255 })
  title: string;

  @Column({ type: "text" })
  description: string;    
  
  @CreateDateColumn()
  start_date: Date;
  
  @CreateDateColumn()
  end_date: Date; 
  
  @Column({ type: "enum", enum: EventType, default: EventType.private })
  event_type: EventType;

  @Column({ type: "boolean", default: false })
  isBlocked: boolean;

  @OneToMany(() => EventParticipant, p => p.event)
  participants!: EventParticipant[];
    

}