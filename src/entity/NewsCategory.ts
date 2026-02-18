import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, OneToMany, ManyToMany } from "typeorm"
import { UserImages } from "./UserImages";
import { User } from "./User";
import { News } from "./News";
@Entity()
export class NewsCategory {

    @PrimaryGeneratedColumn()
    id: number

    @ManyToOne(() => User, {nullable: true, onDelete: "CASCADE"})
    @JoinColumn({ name: "fk_user_id" })
    fk_user_id: User;

    @Column({
        type: "text",
        nullable: true
    })
    name: string; 

    @ManyToMany(() => News, (news) => news.categories)
    @JoinColumn({ name: "fk_category_ids" })
    news: News[];

}