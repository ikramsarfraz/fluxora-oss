export const SUPPORT_ISSUE_TYPES = [
  { value: "bug", label: "Bug" },
  { value: "question", label: "Question" },
  { value: "feature_request", label: "Feature request" },
  { value: "workflow_issue", label: "Workflow issue" },
] as const;

export const SUPPORT_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export const SUPPORT_TICKET_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
] as const;

export const SUPPORT_TICKET_UPDATE_VISIBILITIES = [
  { value: "internal", label: "Internal note" },
  { value: "tenant_visible", label: "Tenant-visible update" },
] as const;

export type SupportIssueType = (typeof SUPPORT_ISSUE_TYPES)[number]["value"];
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number]["value"];
export type SupportTicketStatus =
  (typeof SUPPORT_TICKET_STATUSES)[number]["value"];
export type SupportTicketUpdateVisibility =
  (typeof SUPPORT_TICKET_UPDATE_VISIBILITIES)[number]["value"];

export function supportIssueTypeLabel(value: SupportIssueType) {
  return SUPPORT_ISSUE_TYPES.find(item => item.value === value)?.label ?? value;
}

export function supportPriorityLabel(value: SupportPriority) {
  return SUPPORT_PRIORITIES.find(item => item.value === value)?.label ?? value;
}

export function supportTicketStatusLabel(value: SupportTicketStatus) {
  return SUPPORT_TICKET_STATUSES.find(item => item.value === value)?.label ?? value;
}

export function supportTicketUpdateVisibilityLabel(
  value: SupportTicketUpdateVisibility,
) {
  return (
    SUPPORT_TICKET_UPDATE_VISIBILITIES.find(item => item.value === value)
      ?.label ?? value
  );
}
