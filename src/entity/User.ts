import { AppDataSource } from '../data-source';

import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, OneToMany, ManyToMany } from "typeorm"
import { UserImages } from "./UserImages";
import { BillingPlan } from "./BillingPlan";
import { ConversationParticipant } from "./ConversationParticipant ";
import { Message } from "./Message";
import { EventParticipant } from "./EventParticipant";

export enum Usertype {
    ADMIN = 'admin',
    GUEST = 'guest'
}

@Entity()
export class User {
    @Column({ type: 'boolean', default: false })
    isOnline: boolean;

    @PrimaryGeneratedColumn()
    id: number

    // User.ts
    @ManyToOne(() => UserImages, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "profile_image_id" })     // DB column name
    profileImage?: UserImages | null;

    @Column({ name: "profile_image_id", nullable: true }) // <-- scalar FK property
    profileImageId?: string | null; // or number | null if UserImages.id is INT

    // User.ts
    @ManyToOne(() => UserImages, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "cover_photo_id" })     // DB column name
    cover_photo?: UserImages | null;

    @Column({ name: "cover_photo_id", nullable: true }) // <-- scalar FK property
    cover_photo_id?: string | null; // or number | null if UserImages.id is INT

    @Column()
    first_name: string

    @Column()
    last_name: string

        @ManyToMany(() => require('./BillingPlanIcons').BillingPlanIcons, icon => icon.users)
        iconAssignments: any[];

    @Column()
    username: string; 

    @Column()
    password: string;

    @Column()
    email: string; 

    @Column()
    birth_date: string; 

    @OneToMany(() => UserImages, img => img.fk_user_id, { cascade: ['insert', 'update'] })
    images: UserImages[];

    @Column({ type: "enum", enum: Usertype, default: Usertype.GUEST  })
    user_type!: Usertype;

    @Column()
    sex: string;

    @ManyToOne(() => BillingPlan, { nullable: true })
    @JoinColumn({ name: "fk_billing_plan_id" })
    fk_billing_plan_id: BillingPlan
    
    @OneToMany(() => ConversationParticipant, p => p.user)
    participants!: ConversationParticipant[];

    @OneToMany(() => Message, m => m.sender)
    messages!: Message[];

    @OneToMany(() => EventParticipant, p => p.user)
    event_participations!: EventParticipant[];

    @Column({ name: 'stripe_customer_id', nullable: true })
    stripe_customer_id?: string | null;

    /**
     * Safely assign a billing plan to a user, checking that the plan exists.
     * Throws an error if the plan does not exist.
     */
    static async assignBillingPlan(userId: number, planId: number | null): Promise<User> {
        const userRepo = AppDataSource.getRepository(User);
        const planRepo = AppDataSource.getRepository(BillingPlan);
        const user = await userRepo.findOne({ where: { id: userId } });
        if (!user) throw new Error('User not found');
        let plan: BillingPlan | null = null;
        if (planId !== null) {
            plan = await planRepo.findOne({ where: { id: planId } });
            if (!plan) throw new Error('Billing plan not found');
        }
        user.fk_billing_plan_id = plan || null;
        return userRepo.save(user);
    }

}
