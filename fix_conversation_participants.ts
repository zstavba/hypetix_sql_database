import { AppDataSource } from './src/data-source';
import { Conversation } from './src/entity/Conversation';
import { ConversationParticipant } from './src/entity/ConversationParticipant ';
import { User } from './src/entity/User';

async function fixConversationParticipants() {
  await AppDataSource.initialize();
  const conversationRepo = AppDataSource.getRepository(Conversation);
  const participantRepo = AppDataSource.getRepository(ConversationParticipant);

  const conversations = await conversationRepo.find({ relations: ['fk_user_id', 'participants', 'participants.user'] });

  let fixedCount = 0;
  for (const conv of conversations) {
    const creator = conv.fk_user_id;
    if (!creator) continue;
    const alreadyParticipant = conv.participants.some(p => p.user && p.user.id === creator.id);
    if (!alreadyParticipant) {
      const cp = new ConversationParticipant();
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
  await AppDataSource.destroy();
}

fixConversationParticipants().catch(console.error);
