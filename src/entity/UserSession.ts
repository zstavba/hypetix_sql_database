import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm"
import { User } from "./User"

@Entity()
export class UserSession {

    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(() => User, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "fk_logged_in_user" })
    fk_logged_in_user: User; 

    @Column({ type: "varchar", length: 255, nullable: true })
    session_token: string; 
    
    @Column({ type: "varchar", length: 255, nullable: true })
    ip_adress: string;

    @Column({ type: "varchar", length: 255, nullable: true })
    user_agent: string; 

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
    updated_at: Date;
   
    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    created_at: Date;
        @ManyToOne(() => require('./BillingPlan').BillingPlan, { nullable: true })
        @JoinColumn({ name: "fk_billing_plan_id" })
        fk_billing_plan_id?: any;

}