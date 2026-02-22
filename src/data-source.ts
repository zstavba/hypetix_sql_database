import "reflect-metadata"
import { DataSource } from "typeorm"
import { User } from "./entity/User";
import { UserSession } from "./entity/UserSession";
import { UserImages } from "./entity/UserImages";
import { UserFavorites } from "./entity/UserFavorites";
import { UserInformation } from "./entity/UserInformation";
import { News } from "./entity/News";
import { NewsCategory } from "./entity/NewsCategory";
import { NewsBlocked } from "./entity/NewsBlocked";
import { Likes } from "./entity/Likes";
import { BillingPlan } from "./entity/BillingPlan";
import { BillingPlanIcons } from "./entity/BillingPlanIcons";
import { UserPackageSelection } from "./entity/UserPackageSelection";
import { Notification } from "./entity/Notification";
import { Conversation } from "./entity/Conversation";
import { ConversationParticipant } from "./entity/ConversationParticipant ";
import { Message } from "./entity/Message";
import { Comment } from "./entity/Comment";
import { Events } from "./entity/Events";
import { EventParticipant } from "./entity/EventParticipant";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false,
    logging: false,
    entities: [
        User,
        UserSession,
        UserImages,
        UserFavorites,
        UserInformation,
        News,
        NewsCategory,
        NewsBlocked,
        Likes,
        BillingPlan,
        BillingPlanIcons,
        UserPackageSelection,
        Notification,
        Conversation,
        ConversationParticipant,
        Message,
        Comment,
        Events,
        EventParticipant,
        Notification
    ],
    migrations: [],
    subscribers: [],
    relationLoadStrategy: "query",
})
