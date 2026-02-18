import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, OneToMany, CreateDateColumn, DeleteDateColumn, UpdateDateColumn, JoinTable, ManyToMany, Index } from "typeorm"
import { UserImages } from "./UserImages";
import { User } from "./User";
import { NewsCategory } from "./NewsCategory";
import { BillingPlanIcons } from "./BillingPlanIcons";

export type BillingInterval = 'day'|'week'|'month'|'year';
export type PricingModel = 'free' |'pro' | 'pro_plus';

@Entity()
export class BillingPlan {

    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(() => User, {nullable: true})
    @JoinColumn({ name: "fk_user_id" })
    fk_user_id: User;
    
    @Index({ unique: true })
    @Column({ length: 64 })
    slug!: string;

    @Column({ length: 100 })
    name!: string;

    @Column({ type: 'text', nullable: true })
    description?: string;    

    @Index()
    @Column({ type: 'tinyint', width: 1, default: 1 })
    active!: boolean;

    @Column({ type: 'enum', enum: ['flat','per_seat'], default: 'flat' })
    pricing_model!: PricingModel;

    // price in minor units (e.g., cents)
    @Column({ type: 'int', unsigned: true })
    amount_minor!: number;

    @Column({ type: 'char', length: 3 })
    currency!: string; // "EUR", "USD", ...

    @Column({ type: 'enum', enum: ['day','week','month','year'], default: 'month' })
    interval!: BillingInterval;

    @Column({ type: 'tinyint', unsigned: true, default: 1 })
    interval_count!: number;

    @Column({ type: 'smallint', unsigned: true, default: 0 })
    trial_days!: number;

    @Column({ type: 'int', unsigned: true, nullable: true })
    max_seats?: number;


    @Column({ type: 'varchar', length: 128, nullable: true })
    stripe_price_id?: string;

    @Column({ type: 'json', nullable: true })
    metadata?: Record<string, any>;

    @CreateDateColumn({ type: 'datetime', precision: 6 })
    created_at!: Date;

    @UpdateDateColumn({ type: 'datetime', precision: 6 })
    updated_at!: Date;

    @OneToMany(() => BillingPlanIcons, icon => icon.billingPlan)
    icons: BillingPlanIcons[];

}