import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, OneToMany, CreateDateColumn, DeleteDateColumn, UpdateDateColumn, JoinTable, ManyToMany } from "typeorm"
import { UserImages } from "./UserImages";
import { User } from "./User";
import { NewsCategory } from "./NewsCategory";
@Entity()
export class Likes {

    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(() => User, {nullable: true, onDelete: "CASCADE"})
    @JoinColumn({ name: "fk_user_id" })
    fk_user_id: User;

    @Column({ type: "varchar", length: 100 })
    target_type: string;

    @Column({ type: "varchar", length: 255 })
    target_id: string;
    
    @Column({ type: "json", nullable: true })
    metadata: any;  

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    created_at: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
    updated_at: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
    deleted_at: Date | null;

}