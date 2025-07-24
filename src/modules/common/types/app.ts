import { APP_STATUS, MERGE_STATUS } from '@src/modules/common/constants';

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
