# Klaviyo Copilot

## What's new in v2

- **Real Klaviyo integration, not just generation**: "Push to Klaviyo" now creates an actual draft campaign in your account with full body content attached — not just a subject line shell. Required chaining 3 Klaviyo API calls (create campaign → create template → assign template to message), since Klaviyo's Create Campaign endpoint alone doesn't accept body content.
- **Campaign support alongside flows**: added a Campaign (single send) option with dedicated Campaign Objective and Target Audience inputs, so the AI writes toward a specific goal and audience instead of generic lifecycle copy.
- **Cleaner, more human copy**: updated prompt rules to strip AI-sounding jargon ("unlock", "elevate", "seamless", etc.) and em dashes from generated copy.
- **Modal-based UX**: replaced browser `prompt()`/`alert()` calls with a proper in-app modal for entering Klaviyo details and viewing a success state with a direct link to the created campaign.
- **Clearer roadmap signaling**: flows now show a distinct "Coming Soon" badge for direct Klaviyo Flow integration, since flows require a different (and more complex) API approach than campaigns — see the "v3 idea" note below.
- Rebranded from "Klaviyo AI Flow Copy Generator" to **Klaviyo AI Campaign Studio**, since it now does more than generate copy.

## What's next (v3 idea)

Direct Klaviyo Flow integration is scoped but not yet built: Klaviyo's Flows API doesn't support creating a flow from scratch via API. The planned approach is to pre-build one template flow per flow type manually in the Klaviyo UI, then clone that flow's structure via the API and swap in AI-generated copy for each email step.

Generates on-brand Klaviyo flow copy (welcome, abandoned cart, win-back, post-purchase)
using Gemini 2.0 Flash, with real lifecycle-marketing structure baked into the prompt —
then optionally pushes a draft campaign straight into Klaviyo via their API.

## Why this exists

Built as a portfolio piece to demonstrate CRM/lifecycle expertise + the ability to
ship a working AI tool, not just prompt an AI chatbot. The value isn't "AI writes an
email" — it's "AI writes an email using an actual flow strategist's playbook."

## Project structure

```
klaviyo-ai-tool/
├── backend/
│   ├── server.js          # Express server, API routes
│   ├── promptBuilder.js   # Encodes flow-type strategy into the Claude prompt
│   ├── package.json
│   └── .env.example       # Copy to .env and fill in your keys
└── frontend/
    └── index.html         # Single-page UI, no build step needed
```

## Setup

1. `cd backend && npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `GEMINI_API_KEY` — free at aistudio.google.com/apikey
   - `KLAVIYO_API_KEY` — from your Klaviyo account's private API key (Settings > API Keys).
     Needs `campaigns:write` scope. Skip this if you just want copy generation without
     the Klaviyo push feature.
3. `npm start` (runs on http://localhost:3001)
4. Open `http://localhost:3001` in your browser — the frontend is served by the same server.

## How it works

1. You fill in brand name, product/offer description, tone notes, and pick a flow type.
2. The backend builds a prompt using `promptBuilder.js`, which encodes the actual
   send-timing and strategic structure for that flow type (e.g. abandoned cart:
   no discount on email 1, objection-handling on email 2, incentive + urgency on email 3).
3. Gemini returns structured JSON: each email's send timing, 2 subject line A/B variants,
   preview text, and full body copy.
4. Optional: click "Push to Klaviyo" on any email to create it as a **draft campaign**
   in your Klaviyo account (never sends automatically — you review and send manually).

## Notes on the Klaviyo integration

v1 pushes each email as an individual draft **Campaign** rather than building a full
Klaviyo **Flow** (trigger + multi-step automation), because Flow creation via API
requires defining the full trigger/action graph, which is a bigger lift. Draft campaigns
are enough to prove the integration works end-to-end for a portfolio demo. A natural
"v2" pitch: build out full Flow API support so the whole 3-email sequence gets created
as a real automated flow, not just individual drafts.

## Customizing the strategy

Everything in `FLOW_GUIDANCE` inside `promptBuilder.js` is where your own lifecycle
playbook lives — edit the `structure` and `goal` fields for each flow type to reflect
your own point of view. This is the part worth talking about on LinkedIn: the tool is
only as good as the strategy encoded into it.

## Ideas for extending (good "what's next" talking points)

- Pull a brand's actual Klaviyo flow performance via API and flag underperforming
  flows that need a copy refresh
- Support more flow types (browse abandonment, sunset/list-cleaning, VIP/loyalty)
- Let users save/version generated flows instead of regenerating from scratch
- A/B test result feedback loop: log which subject line variant won, feed it back
  into future prompts as a preference signal
