import { Entity, PrimaryGeneratedColumn, ManyToOne, ManyToMany, JoinTable } from 'typeorm';
import { User } from './User';
import { BillingPlan } from './BillingPlan';
import { BillingPlanIcons } from './BillingPlanIcons';

@Entity()
export class UserPackageSelection {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  fk_user_id: User;

  @ManyToOne(() => BillingPlan, { onDelete: 'CASCADE' })
  fk_billing_id: BillingPlan;

  @ManyToMany(() => BillingPlanIcons)
  @JoinTable()
  fk_icons_id: BillingPlanIcons[];
}
