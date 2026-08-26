/**
 * Notification types for the ADLC Engine.
 */

export type NotificationSeverity = "info" | "success" | "warning" | "error";

export interface DigestEntry {
  /** Source agent or module */
  source: string;
  /** Raw log message */
  message: string;
  /** Severity level */
  severity: NotificationSeverity;
  /** Timestamp */
  timestamp: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface DigestSummary {
  /** Compressed title */
  title: string;
  /** 2-3 bullet point summary */
  bullets: string[];
  /** Overall severity (highest of entries) */
  severity: NotificationSeverity;
  /** Number of raw entries compressed */
  entryCount: number;
  /** Time range covered */
  timeRange: {
    from: Date;
    to: Date;
  };
}

export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: { type: string; text: string }[];
  fields?: { type: string; text: string }[];
}

export interface SlackMessage {
  channel?: string;
  username?: string;
  icon_emoji?: string;
  blocks?: SlackBlock[];
  text?: string;
}
