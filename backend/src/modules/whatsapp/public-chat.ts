/**
 * Chats carry their linked client. Before a chat leaves the backend (API or socket) the
 * client's secrets are removed and `hasAccount` tells whether they activated SyncroCredit.
 */
export function publicChat<T extends { client?: any } | null | undefined>(chat: T): T {
  if (!chat || !chat.client) return chat;
  const { password, activationCode, activationCodeExpires, securityPin, ...client } = chat.client;
  return { ...chat, client: { ...client, hasAccount: !!password } };
}
