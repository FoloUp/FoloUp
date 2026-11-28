import type { FeedbackData } from "@/types/response";

// Feedback is saved through a server route (service role), because the
// feedback table is protected by row-level security.
const submitFeedback = async (feedbackData: FeedbackData) => {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(feedbackData),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Error submitting feedback:", result?.error ?? response.statusText);
    throw new Error(result?.error ?? "Failed to submit feedback");
  }

  return result?.feedback ?? null;
};

export const FeedbackService = {
  submitFeedback,
};
