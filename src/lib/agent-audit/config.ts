// ==============================================================================
// AGENT AUDIT CONFIGURATION
// Centralized configuration for models, thresholds, deep links, and exclusions
// ==============================================================================

/**
 * Default Claude model used for all Agent Audit Batch evaluations.
 * Configurable in this single location.
 */
export const DEFAULT_AUDIT_MODEL =
  process.env.AUDIT_CLAUDE_MODEL || "claude-sonnet-5";

/**
 * Anthropic API Version header
 */
export const ANTHROPIC_API_VERSION = "2023-06-01";

/**
 * Follow Up Boss Deep Link helper
 * Links directly to the contact view in the FUB web application.
 */
export function getFubLeadUrl(personFubId: number | string): string {
  return `https://app.followupboss.com/2/people/view/${personFubId}`;
}

/**
 * Excluded reporting roster.
 * Matt Smith is the team owner and default assigned user for shared pond leads.
 * Owner-assigned pond leads do not represent individual agent follow-up activity.
 */
export const EXCLUDED_AGENT_NAMES = new Set(["matt smith"]);

export function isExcludedAgent(name?: string | null): boolean {
  if (!name) return false;
  return EXCLUDED_AGENT_NAMES.has(name.trim().toLowerCase());
}

/**
 * Default sample size per agent per monthly audit run
 */
export const DEFAULT_MONTHLY_SAMPLE_SIZE = 20;

/**
 * Anonymized label for the agent in LLM prompts
 */
export const ANONYMIZED_AGENT_LABEL = "Agent A";
