import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

// Vercel AI Gateway configuration
const vercelAI = createOpenAICompatible({
  name: "vercel-ai-gateway",
  baseURL: "https://api.vercel.ai/v1",
  headers: {
    Authorization: `Bearer ${process.env.VERCEL_AI_API_KEY}`,
  },
});

// Llama 4 Scout model via Vercel AI Gateway
const moderationModel = vercelAI("meta/llama-4-scout");

export interface ModerationResult {
  approved: boolean;
  reason: string;
  confidence: number;
  inputTokens: number;
  outputTokens: number;
}

const MODERATION_PROMPT = `You are a content moderator for a public community art wall called "Subway Therapy" where people leave anonymous sticky notes with drawings or handwritten messages.

Analyze this sticky note image and determine if it should be APPROVED or REJECTED.

APPROVE content that is:
- Personal expressions, feelings, or thoughts
- Supportive or encouraging messages
- Art, doodles, or creative drawings
- Neutral or positive statements
- Mild language or humor

REJECT content that contains:
- Explicit sexual content or nudity
- Graphic violence or gore
- Hate speech, slurs, or discriminatory content
- Direct threats or calls for violence
- Personal information (phone numbers, addresses, etc.)
- Spam or advertising
- Illegal content

Respond with ONLY a JSON object in this exact format (no markdown, no code blocks):
{"decision": "APPROVED" or "REJECTED", "reason": "brief explanation", "confidence": 0.0-1.0}`;

export async function moderateImage(imageData: string): Promise<ModerationResult> {
  try {
    // Prepare the image - handle both URLs and base64 data
    const imageContent = imageData.startsWith("data:")
      ? { type: "image" as const, image: imageData }
      : { type: "image" as const, image: new URL(imageData) };

    const result = await generateText({
      model: moderationModel,
      messages: [
        {
          role: "user",
          content: [
            imageContent,
            { type: "text", text: MODERATION_PROMPT },
          ],
        },
      ],
    });

    // Parse the response
    const responseText = result.text.trim();

    // Try to extract JSON from the response
    let parsed: { decision: string; reason: string; confidence: number };
    try {
      // Handle potential markdown code blocks
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      // If parsing fails, check for keywords
      const isApproved = responseText.toUpperCase().includes("APPROVED");
      parsed = {
        decision: isApproved ? "APPROVED" : "REJECTED",
        reason: "Could not parse structured response",
        confidence: 0.5,
      };
    }

    return {
      approved: parsed.decision === "APPROVED",
      reason: parsed.reason,
      confidence: parsed.confidence,
      inputTokens: result.usage?.inputTokens || 0,
      outputTokens: result.usage?.outputTokens || 0,
    };
  } catch (error) {
    console.error("AI moderation error:", error);
    // On error, default to pending for manual review
    return {
      approved: false,
      reason: "AI moderation unavailable - requires manual review",
      confidence: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}

// Estimate token counts for cost calculation
// Image tokens are calculated based on Llama 4 Scout's vision encoding
// Typically ~1000 tokens for a small image
export function estimateTokens(): { inputTokens: number; outputTokens: number } {
  // Prompt text: ~200 tokens
  // Image encoding: ~1000 tokens (for 150x150 sticky note images)
  // Total input: ~1200 tokens
  const inputTokens = 1200;

  // Output: JSON response ~50 tokens
  const outputTokens = 50;

  return { inputTokens, outputTokens };
}

// Calculate cost per moderation
export function calculateModerationCost(
  inputTokens: number,
  outputTokens: number,
  inputPricePerMillion: number = 0.08,
  outputPricePerMillion: number = 0.30
): number {
  const inputCost = (inputTokens / 1_000_000) * inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * outputPricePerMillion;
  return inputCost + outputCost;
}
