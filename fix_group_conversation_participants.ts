import { AppDataSource } from './src/data-source';
import { Conversation } from './src/entity/Conversation';
import { ConversationParticipant } from './src/entity/ConversationParticipant ';
import { User } from './src/entity/User';

async function ensureAllParticipants() {
  await AppDataSource.initialize();
  const conversationRepo = AppDataSource.getRepository(Conversation);
  const participantRepo = AppDataSource.getRepository(ConversationParticipant);
  const userRepo = AppDataSource.getRepository(User);

  const conversations = await conversationRepo.find({ relations: ['fk_user_id', 'participants', 'participants.user'] });
  let fixedCount = 0;

  for (const conv of conversations) {
    // Collect all user IDs that should be participants: creator + all current participants
    const participantUserIds = new Set<number>();
    if (conv.fk_user_id && conv.fk_user_id.id) participantUserIds.add(conv.fk_user_id.id);
    for (const p of conv.participants) {
      if (p.user && p.user.id) participantUserIds.add(p.user.id);
    }
    // If this is a group, ensure all users are present
    if (participantUserIds.size > 1) {
      for (const userId of participantUserIds) {
        const already = conv.participants.some(p => p.user && p.user.id === userId);
        if (!already) {
          const user = await userRepo.findOneBy({ id: userId });
          if (user) {
            const cp = new ConversationParticipant();
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
  }
  console.log(`Done. Fixed ${fixedCount} participant records.`);
  await AppDataSource.destroy();
}

ensureAllParticipants().catch(console.error);
