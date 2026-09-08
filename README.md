# Klaviyo Copilot

Generates on-brand Klaviyo copy for lifecycle flows (welcome, abandoned cart, win-back,
post-purchase) and one-off campaigns, using Gemini with real lifecycle-marketing
strategy baked into the prompt — then pushes campaign copy straight into Klaviyo as a
real draft campaign with content attached, via their API.

## Why this exists

Built as a portfolio piece to demonstrate CRM/lifecycle expertise + the ability to
ship a working AI tool, not just prompt an AI chatbot. The value isn't "AI writes an
email" — it's "AI writes an email using an actual flow strategist's playbook, and can
put it live in Klaviyo."

## What's new in v2

- **Real Klaviyo integration, not just generation**: "Push to Klaviyo" creates an actual
  draft campaign in your account with full body content attached, not just a subject
  line shell. This required chaining 3 Klaviyo API calls (create campaign → create
  template → assign template to message), since Klaviyo's Create Campaign endpoint
  alone doesn't accept body content directly.
- **Campaign support alongside flows**: added a Campaign (single send) option with
  dedicated Campaign Objective and Target Audience inputs, so the AI writes toward a
  specific goal and audience instead of generic lifecycle copy.
- **Drag-and-drop editable templates**: when pushing a campaign, choose between a plain
  HTML template or a hybrid template that's editable in Klaviyo's native drag-and-drop
  editor, using Klaviyo's `data-klaviyo-region` hybrid template snippet.
- **Pick your list from a dropdown, not an ID**: the push modal fetches your actual
  Klaviyo lists by name via the API, so you never need to go find a raw list ID.
- **Custom campaign naming**: set your own internal campaign name (separate from the
  AI-generated subject line) when pushing to Klaviyo, capped at 60 characters.
- **Cleaner, more human copy**: prompt rules strip AI-sounding jargon ("unlock",
  "elevate", "seamless", etc.) and em dashes from generated copy.
- **Modal-based UX**: replaced browser `prompt()`/`alert()` calls with an in-app modal
  for entering Klaviyo details and viewing a success state with a direct link to the
  created campaign.
- **Dev vs. production API key handling**: locally, the server uses your own
  `KLAVIYO_API_KEY` from `.env` for convenience. In production, every visitor supplies
  their own Klaviyo key in the form, used only in-memory for that request — see Setup
  below for how this is controlled.
- **Clearer roadmap signaling**: flows show a "Coming Soon" badge for direct Klaviyo
  Flow integration, since flows require a different (and more complex) API approach
  than campaigns — see "What's next" below.
- Rebranded from "Klaviyo AI Flow Copy Generator" to **Klaviyo Copilot**, since it now
  does more than generate copy.

## Project structure

```
klaviyo-ai-tool/
└── backend/
    ├── public/
    │   └── index.html      # Single-page UI, no build step needed
    ├── server.js           # Express server, API routes, Klaviyo integration
    ├── promptBuilder.js    # Encodes flow/campaign strategy into the Gemini prompt
    ├── package.json        # Includes the "stage" field — see Setup
    └── .env.example        # Copy to .env and fill in your keys
```


## Setup

1. `cd backend && npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `GEMINI_API_KEY` — free at aistudio.google.com/apikey
   - `KLAVIYO_API_KEY` — your Klaviyo private API key (Settings > API Keys). Needs
     `campaigns:write`, `templates:write`, and `lists:read` scopes. Only used locally —
     see the `stage` setting below.
3. In `backend/package.json`, set `"stage"` to `"development"` for local use, or
   `"production"` before deploying publicly (e.g. to Vercel):
   - **`"development"`**: the server uses your own `KLAVIYO_API_KEY` from `.env`
     automatically. The Klaviyo push modal won't ask for a key.
   - **`"production"`**: the server ignores `KLAVIYO_API_KEY` entirely and requires
     each visitor to enter their own Klaviyo key in the modal, used only for that one
     request. This matters for a public deployment — without it, every visitor's
     "Push to Klaviyo" click would create campaigns in *your* Klaviyo account.
4. `npm start` (runs on http://localhost:3001)
5. Open `http://localhost:3001` in your browser — the frontend is served by the same
   server.

## How it works

1. Fill in brand name, product/offer description, tone/voice notes, and pick a flow
   type (or Campaign for a single send, with its own objective and audience fields).
2. The backend builds a prompt using `promptBuilder.js`, which encodes the actual
   send-timing and strategic structure for that flow type (e.g. abandoned cart: no
   discount on email 1, objection-handling on email 2, incentive + urgency on email 3).
3. Gemini returns structured JSON: each email's send timing, 2 subject line A/B
   variants, preview text, and full body copy, written in plain language without AI
   jargon or em dashes.
4. For campaigns, click "Push to Klaviyo" to create it as a real **draft campaign**
   (never sends automatically — you review and send manually): name the campaign, pick
   a list from a live dropdown, enter your sender email, and choose plain HTML or a
   drag-and-drop editable template.

## The Klaviyo integration, in detail

Creating a campaign with real content in Klaviyo isn't a single API call — it's three,
chained together:

1. `POST /api/campaigns/` — creates the campaign shell and a campaign-message with
   subject/preview/from info, returns `campaign.id` and `message.id`.
2. `POST /api/templates/` — creates a template containing the actual HTML body. Set
   `editor_type: "CODE"` for plain HTML, or `editor_type: "USER_DRAGGABLE"` with the
   `data-klaviyo-region` / `klaviyo-block klaviyo-text-block` snippet for a hybrid
   template that's editable in Klaviyo's drag-and-drop editor.
3. `POST /api/campaign-message-assign-template/` — clones that template and attaches
   it to the message from step 1.

`GET /api/lists/` powers the list dropdown in the push modal, so you pick a list by
name instead of needing to know its raw ID.

Flows currently show a "Coming Soon" badge instead of a push button, because Klaviyo's
Flows API doesn't support creating a flow's trigger/timing logic from scratch — see
"What's next" below.

## Customizing the strategy

Everything in `FLOW_GUIDANCE` inside `promptBuilder.js` is where your own lifecycle
playbook lives — edit the `structure` and `goal` fields for each flow type to reflect
your own point of view. This is the part worth talking about on LinkedIn: the tool is
only as good as the strategy encoded into it.

## What's next (v3 idea)

Direct Klaviyo Flow integration is scoped but not yet built: Klaviyo's Flows API
doesn't support creating a flow from scratch via API. The planned approach is to
pre-build one template flow per flow type manually in the Klaviyo UI, then clone that
flow's structure via the API and swap in AI-generated copy for each email step.

Other ideas:
- Pull a brand's actual Klaviyo flow performance via API and flag underperforming
  flows that need a copy refresh
- Support more flow types (browse abandonment, sunset/list-cleaning, VIP/loyalty)
- Let users save/version generated copy instead of regenerating from scratch
- A/B test result feedback loop: log which subject line variant won, feed it back
  into future prompts as a preference signal