const express = require("express");
const cors = require("cors");
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const Sentiment = require("sentiment");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Initialize sentiment analyzer
const sentimentAnalyzer = new Sentiment();

// Kimi API configuration
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_BASE_URL = "https://api.moonshot.ai/v1";

// Helper function to call Kimi API
async function callKimi(messages, temperature = 0.7, maxTokens = 2000) {
  const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KIMI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "kimi-k2.5",
      messages,
      temperature: 1,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`Kimi API error: ${response.status}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content || data.choices[0].message.reasoning_content;
  // Strip markdown code blocks if present
  content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  return content;
}

// Generate interview questions 
app.post("/api/questions", async (req, res) => {
  const { type = "software engineering", count = 5, jobDescription = "" } = req.body;

  const jdContext = jobDescription
    ? `\n\nThe candidate is applying for a role with this job description:\n"""${jobDescription}"""\n\nTailor the questions to this specific role and its requirements.`
    : "";

  try {
    const prompt = `You are an expert interviewer. Generate ${count} realistic interview questions for a ${type} position.${jdContext} Return ONLY a JSON array of strings, no other text.`;
    
    const content = await callKimi([
      { role: "system", content: prompt },
      { role: "user", content: `Generate ${count} interview questions for a ${type} role.` },
    ]);

    const questions = JSON.parse(content);
    res.json({ questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate questions" });
  }
});

// Analyze user's answer with sentiment
app.post("/api/analyze", async (req, res) => {
  const { question, transcript, sessionId } = req.body;

  if (!question || !transcript) {
    return res.status(400).json({ error: "question and transcript required" });
  }

  // Perform local analysis (always available)
  const sentimentResult = sentimentAnalyzer.analyze(transcript);
  const confidenceIndicators = analyzeConfidence(transcript);
  const clarityMetrics = analyzeClarity(transcript);

  // Build local fallback feedback from actual analysis
  const localConfidenceScore = calculateConfidenceScore(confidenceIndicators);
  const localClarityScore = calculateClarityScore(clarityMetrics);
  const localSentimentScore = Math.min(10, Math.max(1, 5 + sentimentResult.comparative * 3));
  const localOverall = Math.round((localConfidenceScore + localClarityScore + localSentimentScore) / 3 * 10) / 10;

  const localStrengths = [];
  const localImprovements = [];
  if (localClarityScore >= 7) localStrengths.push("Clear and well-structured response");
  if (clarityMetrics.hasStructure) localStrengths.push("Good use of structured approach (STAR method)");
  if (clarityMetrics.hasExamples) localStrengths.push("Included specific examples");
  if (localConfidenceScore >= 7) localStrengths.push("Confident delivery");
  if (localSentimentScore >= 7) localStrengths.push("Positive and engaging tone");
  if (localStrengths.length === 0) localStrengths.push("Completed the answer");

  if (confidenceIndicators.fillerCount > 2) localImprovements.push("Reduce filler words (um, uh, like) — try pausing instead");
  if (confidenceIndicators.hedgingCount > 1) localImprovements.push("Use more confident language — replace 'I think' with definitive statements");
  if (clarityMetrics.avgSentenceLength > 25) localImprovements.push("Break up long sentences for better clarity");
  if (!clarityMetrics.hasStructure) localImprovements.push("Use the STAR method: Situation, Task, Action, Result");
  if (!clarityMetrics.hasExamples) localImprovements.push("Include specific examples to strengthen your answer");
  if (sentimentResult.comparative < 0) localImprovements.push("Try to maintain a more positive and enthusiastic tone");
  if (localImprovements.length === 0) localImprovements.push("Keep practicing to further refine your delivery");

  const sentimentLabel = sentimentResult.comparative > 0.1 ? "positive" : sentimentResult.comparative < -0.1 ? "negative" : "neutral";
  const confidenceLevel = localConfidenceScore >= 7 ? "high" : localConfidenceScore >= 5 ? "medium" : "low";

  // Extract keywords from transcript
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'i', 'we', 'they', 'it', 'to', 'in', 'of', 'and', 'or', 'for', 'on', 'at', 'by', 'with', 'that', 'this', 'my', 'have', 'had', 'has']);
  const wordFreq = {};
  transcript.toLowerCase().split(/\s+/).forEach(w => {
    const clean = w.replace(/[^a-z]/g, '');
    if (clean.length > 3 && !stopWords.has(clean)) {
      wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    }
  });
  const localKeywords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);

  const localFeedback = {
    clarity: Math.round(localClarityScore * 10) / 10,
    confidence: Math.round(localConfidenceScore * 10) / 10,
    relevance: Math.round(localOverall * 10) / 10,
    overall: localOverall,
    sentiment_score: Math.round(localSentimentScore * 10) / 10,
    keywords: localKeywords.length > 0 ? localKeywords : ["interview", "response"],
    strengths: localStrengths,
    improvements: localImprovements,
    summary: `Your answer scored ${localOverall}/10 overall. ${localStrengths[0]}. ${localImprovements[0]}.`,
    sentiment_analysis: {
      label: sentimentLabel,
      score: Math.round(sentimentResult.comparative * 100) / 100,
      emotions: sentimentLabel === "positive" ? ["confident", "enthusiastic"] : sentimentLabel === "negative" ? ["hesitant", "uncertain"] : ["neutral", "measured"],
    },
    confidence_breakdown: {
      level: confidenceLevel,
      suggestions: localImprovements.slice(0, 2),
    },
  };

  let feedback;

  try {
    const prompt = `You are an expert interview coach. Analyze the candidate's answer to the interview question.

SENTIMENT DATA:
- Sentiment Score: ${sentimentResult.score}
- Comparative: ${sentimentResult.comparative}
- Positive words: ${sentimentResult.positive.length}
- Negative words: ${sentimentResult.negative.length}

CONFIDENCE INDICATORS:
- Filler words count: ${confidenceIndicators.fillerCount}
- Hedging phrases: ${confidenceIndicators.hedgingCount}
- Strong statements: ${confidenceIndicators.strongStatements}

CLARITY METRICS:
- Word count: ${clarityMetrics.wordCount}
- Sentence count: ${clarityMetrics.sentenceCount}
- Avg sentence length: ${clarityMetrics.avgSentenceLength}
- Has structure (STAR method): ${clarityMetrics.hasStructure}

Return ONLY valid JSON with this structure:
{
  "clarity": <1-10>,
  "confidence": <1-10>,
  "relevance": <1-10>,
  "overall": <1-10>,
  "sentiment_score": <normalized 1-10>,
  "keywords": ["keyword1", "keyword2"],
  "strengths": ["strength1", "strength2"],
  "improvements": ["suggestion1", "suggestion2"],
  "summary": "Brief overall feedback",
  "sentiment_analysis": {
    "label": "positive|neutral|negative",
    "score": <raw score>,
    "emotions": ["emotion1", "emotion2"]
  },
  "confidence_breakdown": {
    "level": "high|medium|low",
    "suggestions": ["suggestion1"]
  }
}`;

    const content = await callKimi([
      { role: "system", content: prompt },
      { role: "user", content: `Question: "${question}"\n\nCandidate's Answer: "${transcript}"` },
    ], 0.6);

    feedback = JSON.parse(content);
  } catch (err) {
    console.error("Kimi API failed, using local analysis:", err.message);
    feedback = localFeedback;
  }

  // Store session data if sessionId provided
  if (sessionId && sessions[sessionId]) {
    sessions[sessionId].responses.push({
      question,
      transcript,
      feedback,
      timestamp: new Date(),
    });
  }

  res.json({ feedback });
});

// Real-time sentiment analysis endpoint
app.post("/api/sentiment", async (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: "text required" });
  }

  try {
    const sentimentResult = sentimentAnalyzer.analyze(text);
    const confidenceIndicators = analyzeConfidence(text);
    const clarityMetrics = analyzeClarity(text);

    // Calculate real-time scores
    const sentimentScore = Math.min(10, Math.max(1, (sentimentResult.score + 5) / 10 * 10));
    const confidenceScore = calculateConfidenceScore(confidenceIndicators);
    const clarityScore = calculateClarityScore(clarityMetrics);

    res.json({
      sentiment: {
        score: sentimentResult.score,
        comparative: sentimentResult.comparative,
        label: sentimentResult.score > 0 ? "positive" : sentimentResult.score < 0 ? "negative" : "neutral",
        positive: sentimentResult.positive,
        negative: sentimentResult.negative,
      },
      confidence: {
        score: confidenceScore,
        indicators: confidenceIndicators,
        level: confidenceScore >= 7 ? "high" : confidenceScore >= 4 ? "medium" : "low",
      },
      clarity: {
        score: clarityScore,
        metrics: clarityMetrics,
      },
      real_time_suggestions: generateRealTimeSuggestions(
        sentimentResult, 
        confidenceIndicators, 
        clarityMetrics
      ),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to analyze sentiment" });
  }
});

// Get session progress
app.get("/api/progress/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  
  if (!sessions[sessionId]) {
    return res.status(404).json({ error: "Session not found" });
  }

  const session = sessions[sessionId];
  const progress = calculateProgress(session);

  res.json({
    sessionId,
    totalQuestions: session.totalQuestions,
    completedQuestions: session.responses.length,
    averageScores: progress.averageScores,
    overallProgress: (session.responses.length / session.totalQuestions) * 100,
    trend: progress.trend,
    recommendations: progress.recommendations,
  });
});

// Get final session report
app.get("/api/report/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  
  if (!sessions[sessionId]) {
    return res.status(404).json({ error: "Session not found" });
  }

  const session = sessions[sessionId];
  
  try {
    const report = await generateFinalReport(session);
    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// Session storage (in production, use Redis or database)
const sessions = {};

// Create new session
app.post("/api/session", (req, res) => {
  const { type, difficulty = "intermediate" } = req.body;
  const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  
  sessions[sessionId] = {
    id: sessionId,
    type,
    difficulty,
    createdAt: new Date(),
    responses: [],
    totalQuestions: 5,
  };

  res.json({ sessionId });
});

// Helper functions
function analyzeConfidence(text) {
  const fillerWords = ['um', 'uh', 'like', 'you know', 'so', 'actually', 'basically', 'literally'];
  const hedgingPhrases = ['i think', 'i believe', 'maybe', 'perhaps', 'sort of', 'kind of', 'probably'];
  const strongIndicators = ['definitely', 'certainly', 'absolutely', 'confident', 'expert', 'achieved', 'successfully'];
  
  const textLower = text.toLowerCase();
  const words = textLower.split(/\s+/);
  
  const fillerCount = fillerWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    return count + (textLower.match(regex) || []).length;
  }, 0);
  
  const hedgingCount = hedgingPhrases.reduce((count, phrase) => {
    return count + (textLower.includes(phrase) ? 1 : 0);
  }, 0);
  
  const strongStatements = strongIndicators.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    return count + (textLower.match(regex) || []).length;
  }, 0);
  
  return {
    fillerCount,
    hedgingCount,
    strongStatements,
    wordCount: words.length,
  };
}

function analyzeClarity(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  const starIndicators = ['situation', 'task', 'action', 'result', 'outcome', 'context'];
  const hasStructure = starIndicators.some(indicator => 
    text.toLowerCase().includes(indicator)
  );
  
  const exampleIndicators = ['for example', 'for instance', 'such as', 'like when'];
  const hasExamples = exampleIndicators.some(indicator => 
    text.toLowerCase().includes(indicator)
  );
  
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgSentenceLength: sentences.length > 0 ? words.length / sentences.length : 0,
    hasStructure,
    hasExamples,
  };
}

function calculateConfidenceScore(indicators) {
  let score = 7;
  score -= indicators.fillerCount * 0.5;
  score -= indicators.hedgingCount * 0.8;
  score += indicators.strongStatements * 0.5;
  return Math.min(10, Math.max(1, score));
}

function calculateClarityScore(metrics) {
  let score = 7;
  
  // Optimal sentence length is 15-20 words
  if (metrics.avgSentenceLength > 25) score -= 1;
  if (metrics.avgSentenceLength < 10) score -= 0.5;
  
  if (metrics.hasStructure) score += 1;
  if (metrics.hasExamples) score += 0.5;
  
  return Math.min(10, Math.max(1, score));
}

function generateRealTimeSuggestions(sentiment, confidence, clarity) {
  const suggestions = [];
  
  if (confidence.fillerCount > 2) {
    suggestions.push("Try to reduce filler words (um, uh, like). Pause instead.");
  }
  
  if (confidence.hedgingCount > 1) {
    suggestions.push("Use more confident language. Replace 'I think' with 'I believe'.");
  }
  
  if (clarity.avgSentenceLength > 25) {
    suggestions.push("Break up long sentences for better clarity.");
  }
  
  if (!clarity.hasStructure) {
    suggestions.push("Use the STAR method: Situation, Task, Action, Result.");
  }
  
  if (sentiment.score < 0) {
    suggestions.push("Maintain a more positive tone.");
  }
  
  return suggestions;
}

function calculateProgress(session) {
  if (session.responses.length === 0) {
    return {
      averageScores: null,
      trend: null,
      recommendations: ["Start answering questions to see your progress."],
    };
  }

  const scores = session.responses.map(r => r.feedback);
  
  const averageScores = {
    clarity: scores.reduce((sum, s) => sum + s.clarity, 0) / scores.length,
    confidence: scores.reduce((sum, s) => sum + s.confidence, 0) / scores.length,
    relevance: scores.reduce((sum, s) => sum + s.relevance, 0) / scores.length,
    overall: scores.reduce((sum, s) => sum + s.overall, 0) / scores.length,
  };

  // Calculate trend (improving, declining, stable)
  const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, s) => sum + s.overall, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, s) => sum + s.overall, 0) / secondHalf.length;
  
  const trend = secondAvg > firstAvg + 0.5 ? "improving" : 
                secondAvg < firstAvg - 0.5 ? "declining" : "stable";

  // Generate recommendations
  const recommendations = [];
  if (averageScores.confidence < 6) {
    recommendations.push("Work on confidence: practice speaking clearly and avoid filler words.");
  }
  if (averageScores.clarity < 6) {
    recommendations.push("Improve clarity: structure your answers using the STAR method.");
  }
  if (averageScores.relevance < 6) {
    recommendations.push("Stay more focused on the question asked.");
  }

  return { averageScores, trend, recommendations };
}

async function generateFinalReport(session) {
  const progress = calculateProgress(session);
  
  // Generate AI summary using Kimi
  const transcriptSummary = session.responses.map((r, i) => 
    `Q${i + 1}: ${r.question}\nA: ${r.transcript}\nScores: Clarity ${r.feedback.clarity}, Confidence ${r.feedback.confidence}, Overall ${r.feedback.overall}`
  ).join('\n\n');

  const prompt = `Based on this interview practice session, provide a comprehensive summary report:

${transcriptSummary}

Overall Stats:
- Average Scores: ${JSON.stringify(progress.averageScores)}
- Trend: ${progress.trend}

Return JSON with:
{
  "executive_summary": "brief overall assessment",
  "key_strengths": ["strength1", "strength2"],
  "priority_improvements": ["improvement1", "improvement2"],
  "practice_recommendations": ["recommendation1", "recommendation2"],
  "next_steps": "what to focus on next"
}`;

  try {
    const content = await callKimi([
      { role: "system", content: "You are an expert interview coach providing final session reports." },
      { role: "user", content: prompt },
    ], 0.6);

    const aiSummary = JSON.parse(content);

    return {
      sessionId: session.id,
      completedAt: new Date(),
      totalQuestions: session.totalQuestions,
      answeredQuestions: session.responses.length,
      averageScores: progress.averageScores,
      trend: progress.trend,
      questionBreakdown: session.responses.map((r, i) => ({
        questionNumber: i + 1,
        question: r.question,
        scores: {
          clarity: r.feedback.clarity,
          confidence: r.feedback.confidence,
          relevance: r.feedback.relevance,
          overall: r.feedback.overall,
        },
        summary: r.feedback.summary,
      })),
      ...aiSummary,
    };
  } catch (err) {
    console.error("Error generating final report:", err);
    return {
      sessionId: session.id,
      completedAt: new Date(),
      totalQuestions: session.totalQuestions,
      answeredQuestions: session.responses.length,
      averageScores: progress.averageScores,
      trend: progress.trend,
      executive_summary: "Session completed successfully.",
      key_strengths: ["Completed all questions"],
      priority_improvements: ["Continue practicing regularly"],
      practice_recommendations: ["Review feedback for each question"],
      next_steps: "Schedule another practice session",
    };
  }
}

// WebSocket connection handler
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  
  let currentSession = null;

  // Join session
  socket.on("join-session", (sessionId) => {
    currentSession = sessionId;
    socket.join(sessionId);
    console.log(`User ${socket.id} joined session ${sessionId}`);
  });

  // Real-time chat event
  socket.on("chat-message", async (data) => {
    const { message } = data;
    try {
      const content = await callKimi([
        { role: "user", content: message },
      ]);
      socket.emit("chat-response", { content, done: true });
    } catch (err) {
      socket.emit("error", { message: "Chat failed" });
    }
  });

  // Real-time sentiment analysis during interview
  socket.on("analyze-stream", async (data) => {
    const { text, questionIndex } = data;
    
    try {
      const sentimentResult = sentimentAnalyzer.analyze(text);
      const confidenceIndicators = analyzeConfidence(text);
      const clarityMetrics = analyzeClarity(text);

      const sentimentScore = Math.min(10, Math.max(1, (sentimentResult.score + 5) / 10 * 10));
      const confidenceScore = calculateConfidenceScore(confidenceIndicators);
      const clarityScore = calculateClarityScore(clarityMetrics);

      socket.emit("real-time-feedback", {
        questionIndex,
        sentiment: {
          label: sentimentResult.score > 0 ? "positive" : sentimentResult.score < 0 ? "negative" : "neutral",
          score: sentimentScore,
        },
        confidence: {
          score: confidenceScore,
          level: confidenceScore >= 7 ? "high" : confidenceScore >= 4 ? "medium" : "low",
        },
        clarity: {
          score: clarityScore,
        },
        suggestions: generateRealTimeSuggestions(sentimentResult, confidenceIndicators, clarityMetrics),
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error("Real-time analysis error:", err);
    }
  });

  // Voice data placeholder
  socket.on("voice-data", (audioChunk) => {
    socket.emit("voice-feedback", { transcript: "Transcribed text" });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Interview AI Backend running on port ${PORT}`));
