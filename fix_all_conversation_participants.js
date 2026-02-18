"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const data_source_1 = require("./src/data-source");
const Conversation_1 = require("./src/entity/Conversation");
const ConversationParticipant_1 = require("./src/entity/ConversationParticipant ");
const User_1 = require("./src/entity/User");
async function fixAllConversationParticipants() {
    await data_source_1.AppDataSource.initialize();
    const conversationRepo = data_source_1.AppDataSource.getRepository(Conversation_1.Conversation);
    const participantRepo = data_source_1.AppDataSource.getRepository(ConversationParticipant_1.ConversationParticipant);
    const userRepo = data_source_1.AppDataSource.getRepository(User_1.User);
    const conversations = await conversationRepo.find({ relations: ['fk_user_id', 'participants', 'participants.user'] });
    let fixedCount = 0;
    for (const conv of conversations) {
        // Collect all user IDs that should be participants: creator + all current participants
        const participantUserIds = new Set();
        if (conv.fk_user_id && conv.fk_user_id.id)
            participantUserIds.add(conv.fk_user_id.id);
        for (const p of conv.participants) {
            if (p.user && p.user.id)
                participantUserIds.add(p.user.id);
        }
        // Find all users who have sent or received messages in this conversation
        // (optional: can be extended if you want to include all message senders)
        // Ensure all users in participantUserIds are present as ConversationParticipant
        for (const userId of participantUserIds) {
            const already = conv.participants.some(p => p.user && p.user.id === userId);
            if (!already) {
                const user = await userRepo.findOneBy({ id: userId });
                if (user) {
                    const cp = new ConversationParticipant_1.ConversationParticipant();
                    cp.user = user;
                    cp.conversation = conv;
                    cp.invitedBy = conv.fk_user_id;
                    cp.accepted = true;
                    await participantRepo.save(cp);
                    fixedCount++;
                    console.log(`Added user ${user.username} (ID ${user.id}) as participant to conversation ${conv.id}`);
                }
            }
        }
    }
    console.log(`Done. Fixed ${fixedCount} participant records.`);
    await data_source_1.AppDataSource.destroy();
}
fixAllConversationParticipants().catch(console.error);
//# sourceMappingURL=fix_all_conversation_participants.js.map