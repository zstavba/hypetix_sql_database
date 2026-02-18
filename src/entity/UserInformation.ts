import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, DeleteDateColumn, UpdateDateColumn } from "typeorm"
import { User } from "./User"

export enum UserSexType {
    TOP = "top",
    BOTTOM = "bottom",
    VERSATILE = "versatile",
    NONE = "none"
}

export enum UserGayType {
    TWINK = "twink",
    BEAR = "bear",
    JOCKS = "jocks",
    OTTER = "otter",
    CHUB = "chub",
    DADDIES = "daddies",
    GEEK = "geek",
    WOLF = "wolf",
    CUBS = "cubs",
    GYMBUDDY = "gym_buddy",
    TWUNKS = "twunks",
    NONE = "none"
}

export enum RelationshipStatus {
    SINGLE = "single",
    DATING = "dating",
    EXCLUSIVE = "exclusive",
    COMMITED = "commited",
    PARTNERED = "partnered",
    ENGAGED = "engaged",
    MARRIED = "married",
    OPEN_RELATIONSHIP = "open_relationship",
    NONE = "none"
}

export enum BodyType {
    ENDOMORPH = "endomorph",
    HOURGLASS = "hourglass",
    MESSOMORPH = "messomorph",
    ECTOMORPH = "ectomorph",
    RECTANGLE = "rectangle",
    APPLE = "apple",
    OVAL = "oval",
    PEAR = "pear",
    NONE = "none",
}

export enum GenderIdentity {
  CISGENDER = "Cisgender",
  AGENDER = "Agender",
  INTERSEX = "Intersex",
  NONBINARY = "Nonbinary",
  GENDERFLUID = "Genderfluid",
  GENDERQUEER = "Genderqueer",
  TRANSGENDER = "Transgender",
  BIGENDER = "Bigender",
  GENDER_EXPRESSION = "Gender expression",
  ASEXUAL = "Asexual",
  GENDER_BINARY = "Gender binary",
  GENDER_DYSPHORIA = "Gender dysphoria",
  BISEXUAL = "Bisexual",
  DEMIGENDER = "Demigender",
  GAY = "Gay",
  GENDER_NONCONFORMING = "Gender nonconforming",
  OMNIGENDER = "Omnigender",
  PANSEXUAL = "Pansexual",
  QUESTIONING = "Questioning",
  SEXUALITY = "Sexuality",
  ANDROGYNE = "Androgyne",
  CIS_FEMALE = "Cis female",
  FEMALE = "Female",
  MALE = "Male",
  NONE = "none"
}


@Entity()
export class UserInformation {

    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(() => User, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "fk_user_id" })
    fk_user_id: User; 

    
    @Column({ type: "enum", enum: UserSexType, default: UserSexType.NONE  })
    user_type!: UserSexType;

    @Column({ type: 'varchar', nullable: true })
    height: string;

    @Column({ type: 'varchar', nullable: true })
    weight: string;

    @Column({ type: "enum", enum: UserGayType, default: UserGayType.NONE  })
    user_gay_type!: UserGayType;

    @Column({ type: "enum", enum: RelationshipStatus, default: RelationshipStatus.NONE  })
    relationship_status!: RelationshipStatus;

    @Column({ type: 'varchar', nullable: true })
    relationship_partner: string;

    @Column({ type: "enum", enum: BodyType, default: BodyType.NONE  })
    body_type!: BodyType;

    @Column({ type: "enum", enum: GenderIdentity, default: GenderIdentity.NONE  })
    sex_type!: GenderIdentity;
    
    @Column("json", { nullable: true })
    looking_for: Array<string>;

    @Column("json", { nullable: true })
    meet_at: Array<string>;

    @Column("text", { nullable: true })
    description: string; 


}