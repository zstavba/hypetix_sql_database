"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const data_source_1 = require("./src/data-source");
const Conversation_1 = require("./src/entity/Conversation");
const ConversationParticipant_1 = require("./src/entity/ConversationParticipant ");
async function fixConversationParticipants() {
    await data_source_1.AppDataSource.initialize();
    const conversationRepo = data_source_1.AppDataSource.getRepository(Conversation_1.Conversation);
    const participantRepo = data_source_1.AppDataSource.getRepository(ConversationParticipant_1.ConversationParticipant);
    const conversations = await conversationRepo.find({ relations: ['fk_user_id', 'participants', 'participants.user'] });
    let fixedCount = 0;
    for (const conv of conversations) {
        const creator = conv.fk_user_id;
        if (!creator)
            continue;
        const alreadyParticipant = conv.participants.some(p => p.user && p.user.id === creator.id);
        if (!alreadyParticipant) {
            const cp = new ConversationParticipant_1.ConversationParticipant();
            cp.user = creator;
            cp.conversation = conv;
            cp.invitedBy = creator;
            cp.accepted = true;
            await participantRepo.save(cp);
            fixedCount++;
            console.log(`Added creator (user ${creator.id}) as participant to conversation ${conv.id}`);
        }
    }
    console.log(`Done. Fixed ${fixedCount} conversations.`);
    await data_source_1.AppDataSource.destroy();
}
fixConversationParticipants().catch(console.error);
//# sourceMappingURL=fix_conversation_participants.js.map