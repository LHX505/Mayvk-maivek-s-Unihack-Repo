"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen gradient-bg flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5">
        <span className="text-xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Interview
          </span>
          AI
        </span>
        <button
          onClick={() => router.push("/setup")}
          className="px-5 py-2 text-sm rounded-full border border-white/10 text-gray-300 hover:bg-white/5 transition cursor-pointer"
        >
          Get Started
        </button>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="animate-float mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl shadow-lg shadow-indigo-500/20">
            🎯
          </div>
        </div>

        <h1 className="text-6xl md:text-7xl font-bold text-center mb-6 leading-tight tracking-tight">
          Ace your next
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            interview
          </span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 text-center max-w-xl mb-12 leading-relaxed">
          Practice with an AI interviewer that watches, listens, and gives you
          real feedback. Tailored to your role.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <button
            onClick={() => router.push("/setup")}
            className="px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-lg transition-all shadow-lg shadow-indigo-500/25 cursor-pointer pulse-ring"
          >
            Start Practicing
          </button>
          <span className="text-sm text-gray-500">No sign up needed</span>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-16">
          {[
            "Video Interview Sim",
            "Live Speech-to-Text",
            "AI Feedback & Scoring",
            "Role-Specific Questions",
          ].map((feature) => (
            <span
              key={feature}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-400"
            >
              {feature}
            </span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="px-8 pb-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-sm font-semibold text-gray-500 uppercase tracking-widest mb-10">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Pick your role",
                desc: "Choose your field and paste the job description for tailored questions.",
              },
              {
                step: "02",
                title: "Answer on camera",
                desc: "Your webcam turns on and AI asks questions. Speak naturally like a real interview.",
              },
              {
                step: "03",
                title: "Get AI feedback",
                desc: "Instant scores on clarity, confidence, and relevance with tips to improve.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="card-glow rounded-2xl bg-white/[0.03] p-6"
              >
                <span className="text-xs font-mono text-indigo-400">
                  {item.step}
                </span>
                <h3 className="text-lg font-semibold mt-2 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
