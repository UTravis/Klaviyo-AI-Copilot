// promptBuilder.js
// This is the "secret sauce" of the tool — it encodes actual CRM/lifecycle
// best practices into the prompt so the output reads like a strategist wrote
// it, not like generic ChatGPT copy. Edit FLOW_GUIDANCE to bake in more of
// your own playbook over time.

const FLOW_GUIDANCE = {
  welcome: {
    emailCount: 3,
    structure: [
      "Email 1 (send immediately): Warm welcome, deliver any signup incentive (discount code), set expectations for what subscriber will get from the brand.",
      "Email 2 (send +2 days): Brand story / why we exist / founder or mission angle. Build trust and differentiation, soft product tease.",
      "Email 3 (send +5 days): Social proof (reviews/UGC) + clear product recommendation or bestseller push. First real sales ask."
    ],
    goal: "Build trust fast, convert on the incentive before it feels stale, and establish brand voice."
  },
  abandoned_cart: {
    emailCount: 3,
    structure: [
      "Email 1 (send +1 hour): Simple reminder, show the exact product(s) left in cart, no discount yet — assume they just got distracted.",
      "Email 2 (send +24 hours): Address likely objection (shipping cost, sizing, reviews, urgency/stock level). Add light social proof.",
      "Email 3 (send +48-72 hours): Final nudge with incentive (discount or free shipping) and urgency framing (cart expiring, low stock)."
    ],
    goal: "Recover revenue without training customers to always expect a discount — save the incentive for the last touch."
  },
  win_back: {
    emailCount: 3,
    structure: [
      "Email 1: 'We miss you' — acknowledge the gap, remind them what they loved, no hard sell yet.",
      "Email 2: Show what's new since they've been away (new products, improvements) + meaningful incentive.",
      "Email 3: Last chance / breakup email — direct ask: reply or opt down to reduce frequency, or unsubscribe. This protects deliverability by pruning disengaged addresses."
    ],
    goal: "Re-engage profitably, and use the final email to clean the list of truly dead subscribers to protect sender reputation."
  },
  post_purchase: {
    emailCount: 3,
    structure: [
      "Email 1 (send at delivery): Order/usage tips, how to get the most from the product, set up for a good experience (reduces returns).",
      "Email 2 (send +7-10 days): Request a review or UGC, reinforce the purchase decision.",
      "Email 3 (send +21-30 days): Cross-sell or replenishment reminder based on product type, tied to actual usage timing not arbitrary days."
    ],
    goal: "Reduce returns/refunds, generate reviews, and drive a second purchase at the right lifecycle moment."
  },
  campaign: {
    emailCount: 1,
    structure: [
      "Single one-off send, built entirely around the stated campaign objective and target audience — no lifecycle sequencing, this is a standalone blast."
    ],
    goal: "Drive a specific, immediate action from a specific audience segment (as opposed to a lifecycle flow, which nurtures over multiple touches)."
  }
};

function buildPrompt({ brandName, productDescription, toneNotes, flowType, campaignObjective, targetAudience }) {
  const guidance = FLOW_GUIDANCE[flowType] || FLOW_GUIDANCE.welcome;
  const isCampaign = flowType === "campaign";

  const campaignContext = isCampaign
    ? `\nCAMPAIGN OBJECTIVE: ${campaignObjective || "Not specified — infer a sensible objective from the product context."}\nTARGET AUDIENCE: ${targetAudience || "Not specified — assume the brand's general engaged subscriber base."}\n`
    : "";

  return `You are a senior CRM/lifecycle email strategist writing ${isCampaign ? "a one-off email campaign" : "a Klaviyo flow"} for a DTC brand. Write copy that a real agency would send to a client — specific, on-brand, and structured around proven ${isCampaign ? "campaign" : "flow"} mechanics, not generic AI filler.

          BRAND: ${brandName}
          PRODUCT/OFFER CONTEXT: ${productDescription}
          TONE/VOICE NOTES: ${toneNotes || "Friendly, direct, no corporate jargon."}
          ${isCampaign ? "TYPE: One-off Campaign" : `FLOW TYPE: ${flowType.replace("_", " ")}`}${campaignContext}
          ${isCampaign ? "STRATEGY" : "FLOW STRATEGY"} TO FOLLOW:
          Goal: ${guidance.goal}
          ${isCampaign ? "Approach" : `Structure (${guidance.emailCount} emails)`}:
          ${guidance.structure.map((s, i) => `${i + 1}. ${s}`).join("\n")}
          ${isCampaign ? "\nMake sure the copy speaks directly to the stated target audience and drives toward the stated campaign objective — this is not generic brand messaging." : ""}

          For EACH email${isCampaign ? " (there is only one)" : " in the flow"}, output:
          - Send timing (from the structure above)
          - Subject line (2 variants, for A/B testing — make them meaningfully different angles, e.g. curiosity vs. benefit-led, not just reworded)
          - Preview text
          - Full email body copy (concise, scannable, with a clear single CTA)

          WRITING STYLE RULES (apply to all copy, no exceptions):
          - Do NOT use em dashes (—) anywhere in the copy. Use a period, comma, or restructure the sentence instead.
          - Avoid AI-sounding jargon and clichés: "unlock", "elevate", "seamless", "revolutionize", "game-changer", "dive into", "in today's fast-paced world", "look no further", "unleash", "empower", "journey", "elevate your", "in a world where". Write like a real person who knows the brand, not like generic marketing filler.
          - Write in plain, direct language a real customer would actually respond to.

          Respond ONLY in valid JSON, no markdown fences, no preamble, in this exact shape:
          {
            "flowType": "${flowType}",
            "emails": [
              {
                "sendTiming": "...",
                "subjectLines": ["...", "..."],
                "previewText": "...",
                "body": "...",
                "cta": "..."
              }
            ]
          }`;
}

module.exports = { buildPrompt, FLOW_GUIDANCE };