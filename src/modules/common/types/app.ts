import { MERGE_STATUS, APP_STATUS } from '../constants';

export interface ProcessedMessage {
  text: string;
  ts: string;
  user: string;
  matchType: string | null;
}

export interface MergeStatusInfo {
  mergeStatus: MERGE_STATUS;
  lastSlackMessage?: ProcessedMessage;
  appStatus?: APP_STATUS;
}

export interface AppStatusInfo {
  status: APP_STATUS;
  message?: string;
}
