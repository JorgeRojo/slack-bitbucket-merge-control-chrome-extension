import { MERGE_STATUS, APP_STATUS } from '../constants.js';

export interface AppConfig {
  slackToken: string;
  slackAppToken: string;
  channelId: string;
  channelName: string;
  bitbucketUrl: string;
  mergeButtonSelector: string;
  allowedPhrases: string[];
  disallowedPhrases: string[];
  exceptionPhrases: string[];
  isEnabled: boolean;
}

export interface SlackMessage {
  type: string;
  user: string;
  text: string;
  ts: string;
  team?: string;
  channel?: string;
  event_ts?: string;
  thread_ts?: string;
}

export interface ProcessedMessage {
  text: string;
  timestamp?: string;
  user: string;
  matchType: MERGE_STATUS | null;
  ts: string;
}

export interface AppStatusInfo {
  status: APP_STATUS;
  message: string;
  timestamp: string;
}

export interface MergeStatusInfo {
  status: MERGE_STATUS;
  message: string | null;
  timestamp: string | null;
}

export interface ChromeMessage {
  action: string;
  payload?: any;
}

export interface ChromeMessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface FeatureToggleState {
  isEnabled: boolean;
  disabledUntil: number | null;
}
