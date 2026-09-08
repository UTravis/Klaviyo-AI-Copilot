require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { buildPrompt } = require("./promptBuilder");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("../frontend"));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

// Klaviyo Template Builder helper
function buildTemplateHtml(body, templateType) {
  const paragraphs = body
    .split("\n")
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join("");

  if (templateType === "HYBRID") {
    return `<html><body>
      <table role="presentation" width="100%"><tr>
        <td align="center" data-klaviyo-region="true" data-klaviyo-region-width-pixels="600">
          <div class="klaviyo-block klaviyo-text-block">${paragraphs}</div>
        </td>
      </tr></table>
    </body></html>`;
  }

  return `<html><body>${paragraphs}</body></html>`;
}

// ---- Route 1: Generate flow copy ----
app.post("/api/generate", async (req, res) => {
  const {  brandName, productDescription, toneNotes, flowType, campaignObjective, targetAudience } = req.body;

  if (!brandName || !productDescription || !flowType) {
    return res.status(400).json({
      error: "brandName, productDescription, and flowType are required.",
    });
  }

  try {
    const prompt = buildPrompt({ brandName, productDescription, toneNotes, flowType, campaignObjective, targetAudience });

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();

    // Defensive cleanup in case the model wraps output in code fences anyway
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");

    const parsed = JSON.parse(cleaned);
    res.json(parsed);
  } catch (err) {
    console.error("Generate error:", err);
    const status = err.status || 500;
    const message = (status === 503) ? "The model is experiencing high demand right now." : "Failed to generate copy."; //change error message here
    res.status(status).json({ error: message, details: err.message });
  }
});

// ---- Route 2: Push a generated email as a draft campaign to Klaviyo ----
// NOTE: This creates a DRAFT campaign only — it will never send automatically.
//
// This is a 3-step chain, verified manually via Postman:
//   1. POST /api/campaigns/                     -> get campaign.id + message.id
//   2. POST /api/templates/                      -> create a template with the
//                                                    actual HTML body, get template.id
//   3. POST /api/campaign-message-assign-template/
//                                                 -> clone that template onto the
//                                                    message from step 1
// Klaviyo's Create Campaign call alone only sets subject/preview/from info —
// the actual body content has to be attached via a template, separately.
const KLAVIYO_REVISION = "2026-07-15";
const KLAVIYO_HEADERS = {
  Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_API_KEY}`,
  "Content-Type": "application/json",
  revision: KLAVIYO_REVISION,
};

app.post("/api/push-to-klaviyo", async (req, res) => {
  const { subjectLine, previewText, body, listId, fromEmail, fromLabel, templateType } = req.body;

  if (!process.env.KLAVIYO_API_KEY) {
    return res.status(400).json({ error: "KLAVIYO_API_KEY is not configured on the server." });
  }
  if (!listId) {
    return res.status(400).json({ error: "listId is required (a Klaviyo list/segment ID to attach the draft to)." });
  }
  if (!fromEmail) {
    return res.status(400).json({ error: "fromEmail is required (the sender email address on your verified Klaviyo domain)." });
  }

  try {
    // --- Step 1: Create the campaign shell + message ---
    const campaignRes = await fetch("https://a.klaviyo.com/api/campaigns/", {
      method: "POST",
      headers: KLAVIYO_HEADERS,
      body: JSON.stringify({
        data: {
          type: "campaign",
          attributes: {
            name: subjectLine.slice(0, 50),
            audiences: { included: [listId] },
            "campaign-messages": {
              data: [
                {
                  type: "campaign-message",
                  attributes: {
                    definition: {
                      channel: "email",
                      label: "AI Generated",
                      content: {
                        subject: subjectLine,
                        preview_text: previewText,
                        from_email: fromEmail,
                        from_label: fromLabel || fromEmail,
                        reply_to_email: fromEmail,
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      }),
    });

    const campaignData = await campaignRes.json();
    if (!campaignRes.ok) {
      return res.status(campaignRes.status).json({ error: "Failed to create campaign.", details: campaignData });
    }

    const campaignId = campaignData.data.id;
    const messageId = campaignData.data.relationships["campaign-messages"].data[0].id;

    // --- Step 2: Create a template with the actual body copy ---
    const templateRes = await fetch("https://a.klaviyo.com/api/templates/", {
      method: "POST",
      headers: KLAVIYO_HEADERS,
      body: JSON.stringify({
        data: {
          type: "template",
          attributes: {
            name: `${subjectLine.slice(0, 40)} — AI Template`,
            editor_type: templateType === "HYBRID" ? "USER_DRAGGABLE" : "CODE",
            html: buildTemplateHtml(body, templateType),
          },
        },
      }),
    });

    const templateData = await templateRes.json();
    if (!templateRes.ok) {
      console.error("Klaviyo template creation failed:", JSON.stringify(templateData, null, 2));
      return res.status(templateRes.status).json({
        error: "Campaign was created, but failed to create template.",
        campaignId,
        details: templateData,
      });
    }

    const templateId = templateData.data.id;

    // --- Step 3: Assign the template to the campaign message ---
    const assignRes = await fetch("https://a.klaviyo.com/api/campaign-message-assign-template/", {
      method: "POST",
      headers: KLAVIYO_HEADERS,
      body: JSON.stringify({
        data: {
          type: "campaign-message",
          id: messageId,
          relationships: {
            template: { data: { type: "template", id: templateId } },
          },
        },
      }),
    });

  const assignData = await assignRes.json();
  if (!assignRes.ok) {
    console.error("Klaviyo template assignment failed:", JSON.stringify(assignData, null, 2));
    return res.status(assignRes.status).json({
      error: "Campaign and template were created, but failed to assign template to the message.",
      campaignId,
      templateId,
      details: assignData,
    });
  }

    res.json({
      success: true,
      campaignId,
      messageId,
      templateId,
      klaviyoResponse: assignData,
    });
  } catch (err) {
    console.error("Klaviyo push error:", err);
    res.status(500).json({ error: "Failed to push to Klaviyo.", details: err.message });
  }
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));