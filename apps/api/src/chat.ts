// The slice of Nexconn the app logic depends on. Real: the Nexconn class. Tests: a fake.
import type { Nexconn } from './nexconn.js';

export type Chat = Pick<
  Nexconn,
  | 'issueAccessToken'
  | 'createCommunity'
  | 'createSubchannel'
  | 'joinCommunity'
  | 'addPrivateSubchannelMembers'
  | 'sendCommunity'
  | 'sendDirect'
  | 'sendDirectText'
>;

/** Subchannels every campus has, besides one per hostel. */
export const SUB = {
  /** Wardens post, everyone reads. */
  notices: 'notices',
  /** Private: mentors and wardens only. */
  mentors: 'mentors',
} as const;
