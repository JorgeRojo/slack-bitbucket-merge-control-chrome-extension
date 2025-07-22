// Types for Chrome extension API integration

export interface ChromeStorageItems {
  slackToken?: string;
  slackAppToken?: string;
  appToken?: string; // Add this for compatibility
  channelId?: string;
  channelName?: string;
  bitbucketUrl?: string;
  mergeButtonSelector?: string;
  allowedPhrases?: string[];
  disallowedPhrases?: string[];
  exceptionPhrases?: string[];
  isEnabled?: boolean;
  disabledUntil?: number | null;
  lastConnectionTime?: number;
}

export interface ChromeContentScriptInjection {
  id: string;
  js?: chrome.scripting.InjectionTarget[];
  css?: chrome.scripting.InjectionTarget[];
  target: chrome.scripting.InjectionTarget;
  world?: chrome.scripting.ExecutionWorld;
  allFrames?: boolean;
}

export interface ChromeMessageSender {
  id?: string;
  url?: string;
  origin?: string;
  tab?: chrome.tabs.Tab;
  frameId?: number;
}

export interface ChromeRuntimeMessage {
  action: string;
  payload?: any;
}

export interface ChromeRuntimeMessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}
