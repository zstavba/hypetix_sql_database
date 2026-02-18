import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, OneToMany, CreateDateColumn, DeleteDateColumn, UpdateDateColumn, JoinTable, ManyToMany } from "typeorm"
import { UserImages } from "./UserImages";
import { User } from "./User";
import { NewsCategory } from "./NewsCategory";
@Entity()
export class News {

    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(() => User, {nullable: true, onDelete: "CASCADE"})
    @JoinColumn({ name: "fk_user_id" })
    fk_user_id: User;

    @ManyToOne(() => UserImages, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "fk_album_id" })
    fk_album_id: UserImages;

    @ManyToOne(() => NewsCategory,  { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "fk_category_id" })
    fk_category_id: NewsCategory;

    @ManyToMany(() => NewsCategory, (c) => c.news , { nullable: true })
    @JoinTable({
      name: "news_category_join",            // make sure this matches your SQL
      joinColumn: { name: "news", referencedColumnName: "id" },
      inverseJoinColumn: { name: "cetegory", referencedColumnName: "id" },
    })
    categories: NewsCategory[];
    
    @Column({
        type: "text",
        nullable: true
    })
    title: string; 

    @Column({
        type: "text",
        nullable: true
    })
    description: string; 

    @Column({
        type: "text",
        nullable: true
    })
    country: string; 

    @Column({
        type: "text",
        nullable: true
    })
    region: string; 

    @Column({
        type: "text",
        nullable: true
    })
    zip_code: string; 

    @Column({
        type: "boolean",
        nullable: true,
        default: 0
    })
    blocked: boolean;
    

   @CreateDateColumn() createdAt: Date;
   @UpdateDateColumn() updatedAt: Date;
   @DeleteDateColumn() deletedAt?: Date | null;
    

}