import { DigestSummary, SlackMessage, SlackBlock } from "./types";
import { config } from "../config";
import { createContextLogger } from "../utils/logger";

const log = createContextLogger("slack-webhook");

/**
 * Format a DigestSummary into a Slack Block Kit message.
 */
export function formatSlackMessage(digest: DigestSummary): SlackMessage {
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: digest.title,
        emoji: true,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `📅 ${digest.timeRange.from.toISOString()} → ${digest.timeRange.to.toISOString()} | ${digest.entryCount} events compressed`,
        },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: digest.bullets.map((b) => `• ${b}`).join("\n"),
      },
    },
  ];

  return {
    channel: config.notifications.slackChannel,
    username: "ADLC Engine",
    icon_emoji: ":robot_face:",
    blocks,
    text: digest.title, // Fallback text
  };
}

/**
 * Send a digest to Slack via webhook.
 */
export async function sendToSlack(digest: DigestSummary): Promise<boolean> {
  const webhookUrl = config.notifications.slackWebhookUrl;

  if (!webhookUrl) {
    log.warn("Slack webhook URL not configured, skipping notification");
    return false;
  }

  const message = formatSlackMessage(digest);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      log.error("Slack webhook failed", {
        status: response.status,
        statusText: response.statusText,
      });
      return false;
    }

    log.info("Slack notification sent", {
      bullets: digest.bullets.length,
      severity: digest.severity,
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Slack webhook error", { error: message });
    return false;
  }
}

/**
 * Format a digest as a plain-text console summary.
 */
export function formatConsoleDigest(digest: DigestSummary): string {
  const lines: string[] = [
    "",
    "─".repeat(50),
    `  ${digest.title}`,
    "─".repeat(50),
    "",
    ...digest.bullets.map((b) => `  ${b}`),
    "",
    `  [${digest.entryCount} events | ${digest.severity}]`,
    "─".repeat(50),
    "",
  ];
  return lines.join("\n");
}

export default { formatSlackMessage, sendToSlack, formatConsoleDigest };
