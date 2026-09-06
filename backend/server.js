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
    const message = (status === 503) ? "The model is experiencing high demand right now." : "Failed to generate copy.";
    res.status(status).json({ error: message, details: err.message });
  }
});

// ---- Route 2: Push a generated email as a draft campaign to Klaviyo ----
// NOTE: This creates a DRAFT campaign only — it will never send automatically.
// Klaviyo's flow-creation API is more involved (flow definitions require
// trigger/action graph setup), so for a v1 portfolio demo, pushing each email
// as a draft Campaign is the fastest way to prove real API integration.
app.post("/api/push-to-klaviyo", async (req, res) => {
  const { subjectLine, previewText, body, listId } = req.body;

  if (!process.env.KLAVIYO_API_KEY) {
    return res.status(400).json({ error: "KLAVIYO_API_KEY is not configured on the server." });
  }
  if (!listId) {
    return res.status(400).json({ error: "listId is required (a Klaviyo list/segment ID to attach the draft to)." });
  }

  try {
    const klaviyoRes = await fetch("https://a.klaviyo.com/api/campaigns/", {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_API_KEY}`,
        "Content-Type": "application/json",
        revision: "2024-10-15",
      },
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
                    channel: "email",
                    content: {
                      subject: subjectLine,
                      preview_text: previewText,
                      body: body,
                    },
                  },
                },
              ],
            },
          },
        },
      }),
    });

    const data = await klaviyoRes.json();

    if (!klaviyoRes.ok) {
      return res.status(klaviyoRes.status).json({ error: "Klaviyo API error", details: data });
    }

    res.json({ success: true, klaviyoResponse: data });
  } catch (err) {
    console.error("Klaviyo push error:", err);
    res.status(500).json({ error: "Failed to push to Klaviyo.", details: err.message });
  }
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
