// Administrative APIs in the friend's UI are proposals, not Part B endpoints.
// Keep their honest unavailable states until an agreed account/privacy service exists.
export const backendConnected = false;
export class NotConnectedError extends Error {
  constructor() { super('Not sent. Account, privacy and safety request services are not connected. Live speech translation is configured separately.'); this.name = 'NotConnectedError'; }
}
export async function api() { throw new NotConnectedError(); }
