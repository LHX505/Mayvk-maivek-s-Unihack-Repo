"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const interviewTypes = [
  {
    id: "software-engineering",
    title: "Software Engineering",
    icon: "💻",
    description: "Data structures, algorithms, system design & behavioral",
  },
  {
    id: "marketing",
    title: "Marketing",
    icon: "📈",
    description: "Campaign strategy, analytics, brand management",
  },
  {
    id: "business",
    title: "Business",
    icon: "💼",
    description: "Case studies, strategy, leadership & operations",
  },
  {
    id: "hr",
    title: "Human Resources",
    icon: "🤝",
    description: "People management, conflict resolution, culture fit",
  },
];

export default function Home() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const handleStart = () => {
    if (selected) {
      router.push(`/interview?type=${selected}`);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-3xl w-full text-center">
        <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          InterviewAI
        </h1>
        <p className="text-lg text-gray-400 mb-12">
          Practice video interviews with AI-powered feedback. Select your field
          and start practicing.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {interviewTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelected(type.id)}
              className={`p-6 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer ${
                selected === type.id
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-gray-700 bg-gray-800/50 hover:border-gray-500"
              }`}
            >
              <div className="text-3xl mb-2">{type.icon}</div>
              <h3 className="text-lg font-semibold mb-1">{type.title}</h3>
              <p className="text-sm text-gray-400">{type.description}</p>
            </button>
          ))}
        </div>

        <button
          onClick={handleStart}
          disabled={!selected}
          className={`px-8 py-3 rounded-lg text-lg font-semibold transition-all duration-200 cursor-pointer ${
            selected
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          }`}
        >
          Start Interview
        </button>
      </div>
    </main>
  );
}
