import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinTable, ManyToMany, JoinColumn } from 'typeorm';
import { BillingPlan } from './BillingPlan';
import { User } from './User';

@Entity()
export class BillingPlanIcons {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  key: string;

  @Column()
  label: string;

  @Column({ nullable: true })
  iconUrl?: string;

  @Column({ nullable: false })
  billingPlanId: number;

  @ManyToOne(() => BillingPlan, plan => plan.icons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'billingPlanId' })
  billingPlan: BillingPlan;

    @ManyToMany(() => User, user => user.iconAssignments)
    @JoinTable()
    users: User[];
}
