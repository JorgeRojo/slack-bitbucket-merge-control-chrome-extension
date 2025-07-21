// Types for Slack API integration

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_private: boolean;
  is_mpim: boolean;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  profile: {
    display_name: string;
    real_name: string;
    image_24?: string;
    image_32?: string;
    image_48?: string;
    image_72?: string;
    image_192?: string;
    image_512?: string;
  };
}

export interface SlackConversationsListResponse {
  ok: boolean;
  channels?: SlackChannel[];
  error?: string;
}

export interface SlackConversationsHistoryResponse {
  ok: boolean;
  messages?: Array<{
    type: string;
    user: string;
    text: string;
    ts: string;
  }>;
  has_more?: boolean;
  error?: string;
}

export interface SlackUsersListResponse {
  ok: boolean;
  members?: SlackUser[];
  error?: string;
}

export interface SlackAuthTestResponse {
  ok: boolean;
  url?: string;
  team?: string;
  user?: string;
  team_id?: string;
  user_id?: string;
  error?: string;
}

export interface SlackConnectionsOpenResponse {
  ok: boolean;
  url?: string;
  error?: string;
}

export interface SlackWebSocketMessage {
  type: string;
  payload?: any;
  envelope_id?: string;
  accepts_response_payload?: boolean;
}

export interface SlackEventMessage {
  type: string;
  event: {
    type: string;
    channel: string;
    user: string;
    text: string;
    ts: string;
    event_ts: string;
    channel_type: string;
  };
}
