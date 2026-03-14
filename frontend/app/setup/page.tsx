"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const interviewTypes = [
  {
    id: "software-engineering",
    title: "Software Engineering",
    icon: "💻",
    color: "from-blue-500/20 to-cyan-500/20",
    border: "border-blue-500",
    description: "Technical, system design & behavioral",
  },
  {
    id: "marketing",
    title: "Marketing",
    icon: "📈",
    color: "from-emerald-500/20 to-green-500/20",
    border: "border-emerald-500",
    description: "Campaign strategy & analytics",
  },
  {
    id: "business",
    title: "Business",
    icon: "💼",
    color: "from-amber-500/20 to-orange-500/20",
    border: "border-amber-500",
    description: "Case studies & leadership",
  },
  {
    id: "hr",
    title: "Human Resources",
    icon: "🤝",
    color: "from-pink-500/20 to-rose-500/20",
    border: "border-pink-500",
    description: "People management & culture",
  },
];

export default function SetupPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  const handleContinue = () => {
    if (selected) setStep(2);
  };

  const handleStart = () => {
    if (selected) {
      if (jobDescription.trim()) {
        sessionStorage.setItem("jobDescription", jobDescription.trim());
      } else {
        sessionStorage.removeItem("jobDescription");
      }
      router.push(`/interview?type=${selected}`);
    }
  };

  return (
    <main className="min-h-screen gradient-bg flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5">
        <button
          onClick={() => router.push("/")}
          className="text-xl font-bold tracking-tight cursor-pointer"
        >
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Interview
          </span>
          AI
        </button>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div
              className={`w-2 h-2 rounded-full ${
                step >= 1 ? "bg-indigo-500" : "bg-gray-700"
              }`}
            />
            <div
              className={`w-2 h-2 rounded-full ${
                step >= 2 ? "bg-indigo-500" : "bg-gray-700"
              }`}
            />
          </div>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="max-w-2xl w-full">
          {/* Step 1: Select type */}
          {step === 1 && (
            <div>
              <div className="mb-10">
                <p className="text-sm font-medium text-indigo-400 mb-2">
                  Step 1
                </p>
                <h1 className="text-3xl md:text-4xl font-bold mb-3">
                  What role are you interviewing for?
                </h1>
                <p className="text-gray-400">
                  Pick the category that best matches your target position.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                {interviewTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelected(type.id)}
                    className={`group relative p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer ${
                      selected === type.id
                        ? `${type.border} bg-gradient-to-br ${type.color}`
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-2xl mt-0.5">{type.icon}</span>
                      <div>
                        <h3 className="font-semibold mb-0.5">{type.title}</h3>
                        <p className="text-sm text-gray-400">
                          {type.description}
                        </p>
                      </div>
                    </div>
                    {selected === type.id && (
                      <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push("/")}
                  className="px-6 py-3 rounded-xl text-sm text-gray-400 hover:text-gray-200 transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleContinue}
                  disabled={!selected}
                  className={`flex-1 py-3.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    selected
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-white/5 text-gray-600 cursor-not-allowed"
                  }`}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Job description */}
          {step === 2 && (
            <div>
              <div className="mb-10">
                <p className="text-sm font-medium text-indigo-400 mb-2">
                  Step 2
                </p>
                <h1 className="text-3xl md:text-4xl font-bold mb-3">
                  Paste the job description
                </h1>
                <p className="text-gray-400">
                  This helps the AI ask questions specific to the role.
                  You can skip this if you want general questions.
                </p>
              </div>

              <div className="relative mb-4">
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  rows={8}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] resize-none transition-all"
                />
                {jobDescription && (
                  <button
                    onClick={() => setJobDescription("")}
                    className="absolute top-4 right-4 text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {jobDescription && (
                <p className="text-xs text-gray-500 mb-6">
                  {jobDescription.trim().split(/\s+/).length} words
                </p>
              )}

              <div className="flex items-center gap-4 mt-8">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl text-sm text-gray-400 hover:text-gray-200 transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleStart}
                  className="flex-1 py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  {jobDescription.trim()
                    ? "Start Tailored Interview"
                    : "Start with General Questions"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
