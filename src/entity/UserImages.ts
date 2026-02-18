import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, DeleteDateColumn, UpdateDateColumn } from "typeorm"
import { User } from "./User"

@Entity()
export class UserImages {

    @PrimaryGeneratedColumn()
    id: number
    @ManyToOne(() => User, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "fk_user_id" })
    fk_user_id: User; 
    // where you store files: relative path, public URL, or cloud key
    @Column({ length: 500 })
    path: string;
    // optional metadata
    @Column({ nullable: true }) mimeType?: string;
    @Column({ type: 'int', nullable: true }) sizeBytes?: number;
    @Column({ type: "boolean"}) album_private: boolean;
    @Column({ type: 'text', nullable: true }) album_name: string;
    @CreateDateColumn() createdAt: Date;
    @UpdateDateColumn() updatedAt: Date;
    @DeleteDateColumn() deletedAt?: Date | null;




}