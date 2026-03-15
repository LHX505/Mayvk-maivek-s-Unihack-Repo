"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "";

interface Feedback {
  clarity: number;
  confidence: number;
  relevance: number;
  overall: number;
  sentiment_score: number;
  keywords: string[];
  strengths: string[];
  improvements: string[];
  summary: string;
  sentiment_analysis: {
    label: string;
    score: number;
    emotions: string[];
  };
  confidence_breakdown: {
    level: string;
    suggestions: string[];
  };
}

interface RealTimeFeedback {
  sentiment: {
    label: string;
    score: number;
  };
  confidence: {
    score: number;
    level: string;
  };
  clarity: {
    score: number;
  };
  suggestions: string[];
}

interface ProgressData {
  totalQuestions: number;
  completedQuestions: number;
  averageScores: {
    clarity: number;
    confidence: number;
    relevance: number;
    overall: number;
  };
  overallProgress: number;
  trend: string;
  recommendations: string[];
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 7 ? "bg-green-500" : score >= 5 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="font-semibold">{score}/10</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
    </div>
  );
}

function RealTimeMetrics({ feedback }: { feedback: RealTimeFeedback | null }) {
  if (!feedback) return null;

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-4">
      <h4 className="text-sm font-semibold text-gray-400 mb-3">Live Metrics</h4>
      
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <div className={`text-lg font-bold ${
            feedback.sentiment.score >= 7 ? 'text-green-400' : 
            feedback.sentiment.score >= 4 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {feedback.sentiment.score.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">Sentiment</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-bold ${
            feedback.confidence.score >= 7 ? 'text-green-400' : 
            feedback.confidence.score >= 4 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {feedback.confidence.score.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">Confidence</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-bold ${
            feedback.clarity.score >= 7 ? 'text-green-400' : 
            feedback.clarity.score >= 4 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {feedback.clarity.score.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">Clarity</div>
        </div>
      </div>

      {feedback.suggestions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-xs text-gray-500 mb-2">Suggestions:</p>
          <ul className="space-y-1">
            {feedback.suggestions.slice(0, 2).map((s, i) => (
              <li key={i} className="text-xs text-yellow-400 flex items-start gap-1">
                <span>💡</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ProgressPanel({ progress }: { progress: ProgressData | null }) {
  if (!progress) return null;

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-gray-400 mb-3">Session Progress</h4>
      
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Questions</span>
          <span className="text-gray-300">{progress.completedQuestions}/{progress.totalQuestions}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress.overallProgress}%` }}
          />
        </div>
      </div>

      {progress.averageScores && (
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Avg Overall</span>
            <span className="text-gray-300">{progress.averageScores.overall.toFixed(1)}/10</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Trend</span>
            <span className={
              progress.trend === 'improving' ? 'text-green-400' :
              progress.trend === 'declining' ? 'text-red-400' : 'text-yellow-400'
            }>
              {progress.trend}
            </span>
          </div>
        </div>
      )}

      {progress.recommendations.length > 0 && (
        <div className="pt-3 border-t border-gray-700">
          <p className="text-xs text-gray-500 mb-2">Recommendations:</p>
          <ul className="space-y-1">
            {progress.recommendations.map((r, i) => (
              <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                <span>→</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InterviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get("type") || "software-engineering";
  const typeLabel = type.replace(/-/g, " ");

  const [jobDescription, setJobDescription] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const transcriptIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [step, setStep] = useState<"setup" | "interview" | "feedback" | "summary">("setup");
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [history, setHistory] = useState<
    { question: string; transcript: string; feedback: Feedback }[]
  >([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [realTimeFeedback, setRealTimeFeedback] = useState<RealTimeFeedback | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize socket connection (only if SOCKET_URL is configured)
  useEffect(() => {
    if (!SOCKET_URL) return;

    try {
      const socket = io(SOCKET_URL, { reconnectionAttempts: 3 });
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("Connected to server");
      });

      socket.on("real-time-feedback", (data: RealTimeFeedback) => {
        setRealTimeFeedback(data);
      });

      return () => {
        socket.disconnect();
      };
    } catch {
      console.warn("Socket.IO connection skipped");
    }
  }, []);

  // Read job description from sessionStorage on mount
  useEffect(() => {
    const jd = sessionStorage.getItem("jobDescription") || "";
    setJobDescription(jd);
  }, []);

  // Create session on start
  const createSession = async () => {
    try {
      const res = await fetch(`${API_URL}/api/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, difficulty: "intermediate" }),
      });
      const data = await res.json();
      setSessionId(data.sessionId);
      
      if (socketRef.current) {
        socketRef.current.emit("join-session", data.sessionId);
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  // Start webcam
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("Please allow camera and microphone access to continue.");
    }
  }, []);

  // Fetch questions from backend
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: typeLabel,
          count: 5,
          jobDescription,
        }),
      });
      const data = await res.json();
      setQuestions(data.questions);
    } catch {
      setQuestions([
        "Tell me about yourself.",
        "What is your greatest strength?",
        "Describe a challenge you faced and how you overcame it.",
        "Why are you interested in this role?",
        "Where do you see yourself in 5 years?",
      ]);
    }
    setLoading(false);
  }, [typeLabel, jobDescription]);

  // Fetch progress
  const fetchProgress = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      const res = await fetch(`${API_URL}/api/progress/${sessionId}`);
      const data = await res.json();
      setProgress(data);
    } catch (err) {
      console.error("Failed to fetch progress:", err);
    }
  }, [sessionId]);

  // Start interview
  const handleStartInterview = async () => {
    await createSession();
    await startCamera();
    await fetchQuestions();
    setStep("interview");
  };

  // Speech recognition
  const startRecording = () => {
    setTranscript("");
    setIsRecording(true);
    setTimer(0);
    setRealTimeFeedback(null);

    timerRef.current = setInterval(() => {
      setTimer((t) => t + 1);
    }, 1000);

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + " ";
        } else {
          interim = t;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = (event) => {
      console.error("Speech error:", event.error);
    };

    recognition.start();
    recognitionRef.current = recognition;

    // Start real-time analysis
    transcriptIntervalRef.current = setInterval(() => {
      if (socketRef.current && finalTranscript.trim().length > 10) {
        socketRef.current.emit("analyze-stream", {
          text: finalTranscript,
          questionIndex: currentQ,
        });
      }
    }, 2000);

    // Speak the question
    const utterance = new SpeechSynthesisUtterance(questions[currentQ]);
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (transcriptIntervalRef.current) clearInterval(transcriptIntervalRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (!transcript.trim()) return;

    // Analyze answer
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questions[currentQ],
          transcript: transcript.trim(),
          sessionId,
        }),
      });
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
      const data = await res.json();
      if (!data.feedback) {
        throw new Error("No feedback returned from server");
      }
      setFeedback(data.feedback);
      setHistory((prev) => [
        ...prev,
        {
          question: questions[currentQ],
          transcript: transcript.trim(),
          feedback: data.feedback,
        },
      ]);

      // Fetch updated progress
      await fetchProgress();
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Failed to analyze your answer. Please check your connection and try again.");
    }
    setLoading(false);
    setStep("feedback");
  };

  const nextQuestion = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ((q) => q + 1);
      setTranscript("");
      setFeedback(null);
      setRealTimeFeedback(null);
      setError(null);
      setTimer(0);
      setStep("interview");
    } else {
      // End of interview - show summary
      setStep("summary");
    }
  };

  const finishInterview = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    router.push("/");
  };

  // Attach stream to video element when interview screen renders
  useEffect(() => {
    if (step === "interview" && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [step]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (transcriptIntervalRef.current) clearInterval(transcriptIntervalRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // SETUP SCREEN
  if (step === "setup") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 gradient-bg">
        <div className="max-w-lg w-full text-center">
          <h1 className="text-3xl font-bold mb-2 capitalize">{typeLabel}</h1>
          <p className="text-gray-400 mb-8">
            Your camera and microphone will be used. The AI will ask you
            questions and you&apos;ll answer on video, just like a real
            interview.
          </p>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-8 text-left">
            <h3 className="font-semibold mb-3">How it works:</h3>
            <ol className="space-y-2 text-gray-300 text-sm">
              <li>1. AI reads you a question</li>
              <li>2. You answer on camera (speech is transcribed live)</li>
              <li>3. Get real-time feedback on sentiment & confidence</li>
              <li>4. AI analyzes your answer and gives detailed feedback</li>
              <li>5. Track your progress across all questions</li>
            </ol>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push("/")}
              className="px-6 py-3 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={handleStartInterview}
              className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition cursor-pointer"
            >
              {loading ? "Preparing..." : "Begin Interview"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // INTERVIEW SCREEN
  if (step === "interview") {
    return (
      <main className="min-h-screen flex flex-col items-center px-6 py-8 gradient-bg">
        <div className="max-w-5xl w-full">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm text-gray-400 capitalize">
              {typeLabel} Interview
            </span>
            <span className="text-sm text-gray-400">
              Question {currentQ + 1} of {questions.length}
            </span>
          </div>

          {/* Question */}
          <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-xl p-5 mb-6">
            <p className="text-sm text-indigo-400 mb-1">Question:</p>
            <p className="text-xl font-semibold">
              {questions[currentQ] || "Loading..."}
            </p>
          </div>

          {/* Video + Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Webcam */}
            <div className="lg:col-span-2">
              <div className="relative rounded-xl overflow-hidden bg-gray-900 aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
                {isRecording && (
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-mono bg-black/50 px-2 py-1 rounded">
                      {formatTime(timer)}
                    </span>
                  </div>
                )}
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-gray-500">Starting camera...</p>
                  </div>
                )}
              </div>

              {/* Record button */}
              <div className="flex justify-center mt-4">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    disabled={!cameraReady}
                    className="px-8 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <div className="w-3 h-3 rounded-full bg-white" />
                    Start Answering
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="px-8 py-3 rounded-full bg-gray-600 hover:bg-gray-700 text-white font-semibold transition flex items-center gap-2 cursor-pointer"
                  >
                    <div className="w-3 h-3 rounded bg-red-500" />
                    Stop & Get Feedback
                  </button>
                )}
              </div>
            </div>

            {/* Side panel */}
            <div className="space-y-4">
              {/* Live transcript */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">
                  Live Transcript
                </h3>
                <div className="text-sm text-gray-300 min-h-[100px] max-h-[150px] overflow-y-auto">
                  {transcript || (
                    <span className="text-gray-600 italic">
                      Click &quot;Start Answering&quot; and begin speaking...
                    </span>
                  )}
                </div>
              </div>

              {/* Real-time metrics */}
              {isRecording && <RealTimeMetrics feedback={realTimeFeedback} />}

              {/* Progress */}
              <ProgressPanel progress={progress} />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // FEEDBACK SCREEN
  if (step === "feedback") {
    return (
      <main className="min-h-screen flex flex-col items-center px-6 py-8 gradient-bg">
        <div className="max-w-4xl w-full">
          <h2 className="text-2xl font-bold mb-6">Feedback</h2>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-400">Analyzing your answer...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 max-w-md mx-auto">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={() => { setError(null); setStep("interview"); }}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition mr-3"
                >
                  Try Again
                </button>
                <button
                  onClick={nextQuestion}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Skip to Next
                </button>
              </div>
            </div>
          ) : feedback ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Scores */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Scores</h3>
                <ScoreBar label="Clarity" score={feedback.clarity} />
                <ScoreBar label="Confidence" score={feedback.confidence} />
                <ScoreBar label="Relevance" score={feedback.relevance} />
                <ScoreBar label="Overall" score={feedback.overall} />
                <ScoreBar label="Sentiment" score={feedback.sentiment_score} />

                <div className="mt-4">
                  <p className="text-sm text-gray-400 mb-2">Keywords used:</p>
                  <div className="flex flex-wrap gap-2">
                    {feedback.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded text-xs"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {feedback.sentiment_analysis && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-sm text-gray-400 mb-1">Sentiment: 
                      <span className={
                        feedback.sentiment_analysis.label === 'positive' ? 'text-green-400' :
                        feedback.sentiment_analysis.label === 'negative' ? 'text-red-400' : 'text-yellow-400'
                      }>
                        {' '}{feedback.sentiment_analysis.label}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Emotions: {feedback.sentiment_analysis.emotions.join(", ")}
                    </p>
                  </div>
                )}
              </div>

              {/* Feedback details */}
              <div className="space-y-4">
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="font-semibold mb-2 text-green-400">
                    Strengths
                  </h3>
                  <ul className="space-y-1">
                    {feedback.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-gray-300">
                        + {s}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <h3 className="font-semibold mb-2 text-yellow-400">
                    Improvements
                  </h3>
                  <ul className="space-y-1">
                    {feedback.improvements.map((s, i) => (
                      <li key={i} className="text-sm text-gray-300">
                        → {s}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-xl p-6">
                  <h3 className="font-semibold mb-2">Summary</h3>
                  <p className="text-sm text-gray-300">{feedback.summary}</p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Your answer */}
          <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="font-semibold mb-2 text-gray-400">Your Answer</h3>
            <p className="text-sm text-gray-300">{transcript}</p>
          </div>

          {/* Next button */}
          <div className="flex justify-center mt-8">
            <button
              onClick={nextQuestion}
              className="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition cursor-pointer"
            >
              {currentQ < questions.length - 1
                ? "Next Question"
                : "View Summary"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // SUMMARY SCREEN
  if (step === "summary") {
    const overallStats = history.length > 0 ? {
      avgClarity: history.reduce((sum, h) => sum + h.feedback.clarity, 0) / history.length,
      avgConfidence: history.reduce((sum, h) => sum + h.feedback.confidence, 0) / history.length,
      avgRelevance: history.reduce((sum, h) => sum + h.feedback.relevance, 0) / history.length,
      avgOverall: history.reduce((sum, h) => sum + h.feedback.overall, 0) / history.length,
    } : null;

    return (
      <main className="min-h-screen flex flex-col items-center px-6 py-8 gradient-bg">
        <div className="max-w-4xl w-full">
          <h2 className="text-3xl font-bold mb-2 text-center">Interview Complete! 🎉</h2>
          <p className="text-gray-400 text-center mb-8">Here&apos;s how you performed</p>

          {overallStats && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6">
              <h3 className="font-semibold mb-4 text-center">Overall Performance</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-700/50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-400">
                    {overallStats.avgOverall.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">Overall</div>
                </div>
                <div className="text-center p-4 bg-gray-700/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-400">
                    {overallStats.avgClarity.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">Clarity</div>
                </div>
                <div className="text-center p-4 bg-gray-700/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-400">
                    {overallStats.avgConfidence.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">Confidence</div>
                </div>
                <div className="text-center p-4 bg-gray-700/50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-400">
                    {overallStats.avgRelevance.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">Relevance</div>
                </div>
              </div>
            </div>
          )}

          {/* Question breakdown */}
          <div className="space-y-4 mb-8">
            <h3 className="font-semibold">Question Breakdown</h3>
            {history.map((h, i) => (
              <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-medium text-gray-300">Q{i + 1}: {h.question}</p>
                  <span className="text-sm font-bold text-indigo-400">{h.feedback.overall}/10</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{h.feedback.summary}</p>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                    Clarity: {h.feedback.clarity}
                  </span>
                  <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded">
                    Confidence: {h.feedback.confidence}
                  </span>
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
                    Relevance: {h.feedback.relevance}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-4">
            <button
              onClick={() => router.push("/setup")}
              className="px-6 py-3 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition cursor-pointer"
            >
              Practice Again
            </button>
            <button
              onClick={finishInterview}
              className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition cursor-pointer"
            >
              Finish
            </button>
          </div>
        </div>
      </main>
    );
  }

  return null;
}

export default function InterviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center gradient-bg">
          Loading...
        </div>
      }
    >
      <InterviewContent />
    </Suspense>
  );
}
