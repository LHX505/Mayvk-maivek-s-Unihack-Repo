"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback, Suspense } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Feedback {
  clarity: number;
  confidence: number;
  relevance: number;
  overall: number;
  keywords: string[];
  strengths: string[];
  improvements: string[];
  summary: string;
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

function InterviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get("type") || "software-engineering";
  const typeLabel = type.replace(/-/g, " ");

  const [jobDescription, setJobDescription] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<"setup" | "interview" | "feedback">("setup");
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

  // Read job description from sessionStorage on mount
  useEffect(() => {
    const jd = sessionStorage.getItem("jobDescription") || "";
    setJobDescription(jd);
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
      // Fallback questions if backend is not running
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

  // Start interview
  const handleStartInterview = async () => {
    await startCamera();
    await fetchQuestions();
    setStep("interview");
  };

  // Speech recognition
  const startRecording = () => {
    setTranscript("");
    setIsRecording(true);
    setTimer(0);

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

    // Speak the question
    const utterance = new SpeechSynthesisUtterance(questions[currentQ]);
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
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
        }),
      });
      const data = await res.json();
      setFeedback(data.feedback);
      setHistory((prev) => [
        ...prev,
        {
          question: questions[currentQ],
          transcript: transcript.trim(),
          feedback: data.feedback,
        },
      ]);
    } catch {
      // Fallback feedback
      setFeedback({
        clarity: 7,
        confidence: 6,
        relevance: 7,
        overall: 7,
        keywords: ["communication", "teamwork"],
        strengths: ["Good structure", "Clear delivery"],
        improvements: [
          "Add specific examples",
          "Use the STAR method for behavioral questions",
        ],
        summary:
          "Solid answer! Try to include more specific examples and measurable results to strengthen your response.",
      });
    }
    setLoading(false);
    setStep("feedback");
  };

  const nextQuestion = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ((q) => q + 1);
      setTranscript("");
      setFeedback(null);
      setTimer(0);
      setStep("interview");
    } else {
      // End of interview
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      router.push("/");
    }
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
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // SETUP SCREEN
  if (step === "setup") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
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
              <li>3. AI analyzes your answer and gives feedback</li>
              <li>4. Review scores and move to the next question</li>
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
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition cursor-pointer"
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
      <main className="min-h-screen flex flex-col items-center px-6 py-8">
        <div className="max-w-4xl w-full">
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
          <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-5 mb-6">
            <p className="text-sm text-blue-400 mb-1">Question:</p>
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

            {/* Live transcript */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">
                Live Transcript
              </h3>
              <div className="text-sm text-gray-300 min-h-[200px]">
                {transcript || (
                  <span className="text-gray-600 italic">
                    Click &quot;Start Answering&quot; and begin speaking...
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // FEEDBACK SCREEN
  if (step === "feedback") {
    return (
      <main className="min-h-screen flex flex-col items-center px-6 py-8">
        <div className="max-w-4xl w-full">
          <h2 className="text-2xl font-bold mb-6">Feedback</h2>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-400">Analyzing your answer...</p>
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

                <div className="mt-4">
                  <p className="text-sm text-gray-400 mb-2">Keywords used:</p>
                  <div className="flex flex-wrap gap-2">
                    {feedback.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
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
                        - {s}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-6">
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
              className="px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition cursor-pointer"
            >
              {currentQ < questions.length - 1
                ? "Next Question"
                : "Finish Interview"}
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
        <div className="min-h-screen flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <InterviewContent />
    </Suspense>
  );
}
