const express = require("express");
const cors = require("cors");
require("dotenv").config();
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Generate interview questions
app.post("/api/questions", async (req, res) => {
  const { type = "software engineering", count = 5, jobDescription = "" } = req.body;

  const jdContext = jobDescription
    ? `\n\nThe candidate is applying for a role with this job description:\n"""${jobDescription}"""\n\nTailor the questions to this specific role and its requirements.`
    : "";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert interviewer. Generate ${count} realistic interview questions for a ${type} position.${jdContext} Return ONLY a JSON array of strings, no other text.`,
        },
        {
          role: "user",
          content: `Generate ${count} interview questions for a ${type} role.`,
        },
      ],
      temperature: 0.8,
    });

    const questions = JSON.parse(response.choices[0].message.content);
    res.json({ questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate questions" });
  }
});

// Analyze user's answer
app.post("/api/analyze", async (req, res) => {
  const { question, transcript } = req.body;

  if (!question || !transcript) {
    return res.status(400).json({ error: "question and transcript required" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert interview coach. Analyze the candidate's answer to the interview question. Return ONLY valid JSON with this structure:
{
  "clarity": <1-10>,
  "confidence": <1-10>,
  "relevance": <1-10>,
  "overall": <1-10>,
  "keywords": ["keyword1", "keyword2"],
  "strengths": ["strength1", "strength2"],
  "improvements": ["suggestion1", "suggestion2"],
  "summary": "Brief overall feedback"
}`,
        },
        {
          role: "user",
          content: `Question: "${question}"\n\nCandidate's Answer: "${transcript}"`,
        },
      ],
      temperature: 0.6,
    });

    const feedback = JSON.parse(response.choices[0].message.content);
    res.json({ feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to analyze answer" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
