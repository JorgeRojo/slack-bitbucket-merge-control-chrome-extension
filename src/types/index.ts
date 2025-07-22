// Common types used across the application

import { MERGE_STATUS, APP_STATUS } from '../constants';

// App Configuration
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

// Message types
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
  timestamp: string;
  user: string;
  matchType: MERGE_STATUS | null;
  ts?: string; // Add ts property for compatibility
}

// Status types
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

// Chrome message types
export interface ChromeMessage {
  action: string;
  payload?: any;
}

export interface ChromeMessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Feature toggle
export interface FeatureToggleState {
  isEnabled: boolean;
  disabledUntil: number | null;
}
