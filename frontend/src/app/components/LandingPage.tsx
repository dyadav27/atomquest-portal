import React from 'react';
import { ArrowRight, Target, Brain, ShieldAlert, BarChart3, CheckCircle2 } from 'lucide-react';

interface LandingPageProps {
  onLoginClick: () => void;
}

export default function LandingPage({ onLoginClick }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1D9E75] rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full" />
            </div>
            <span className="text-xl font-bold tracking-tight">AtomQuest</span>
          </div>
          <button 
            onClick={onLoginClick}
            className="text-sm font-semibold text-slate-600 hover:text-[#1D9E75] transition-colors"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-20 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-[#1D9E75] to-emerald-300 blur-[100px] rounded-full mix-blend-multiply" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-[#1D9E75] text-sm font-medium mb-8 border border-emerald-100">
            <span className="flex h-2 w-2 rounded-full bg-[#1D9E75] animate-pulse"></span>
            Enterprise OKR Platform
          </div>
          
          <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight mb-8 text-slate-900">
            Align your teams.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1D9E75] to-emerald-500">
              Achieve your goals.
            </span>
          </h1>
          
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            The intelligent performance tracking portal that uses AI to analyze goals, detect anomalies, and automate managerial workflows.
          </p>
          
          <button 
            onClick={onLoginClick}
            className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-[#1D9E75] rounded-full overflow-hidden transition-all hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/20"
          >
            <span className="relative z-10 flex items-center gap-2">
              Access Portal <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-[#1D9E75] opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Powered by Advanced Analytics</h2>
            <p className="text-slate-600">Everything you need to track performance at scale.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6">
                <Target className="text-blue-600" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Dynamic OKR Cycles</h3>
              <p className="text-slate-600 leading-relaxed">
                Administrators can provision strict financial quarters. Enforce 100% weightage distributions across strategic thrust areas.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-6">
                <Brain className="text-purple-600" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">AI DNA Scoring</h3>
              <p className="text-slate-600 leading-relaxed">
                Powered by Gemini AI. Every submitted goal is automatically evaluated for specificity, ambition, and strategic alignment.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mb-6">
                <ShieldAlert className="text-rose-600" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Automated Escalations</h3>
              <p className="text-slate-600 leading-relaxed">
                Never miss a deadline. Our cron engine detects late check-ins and fires high-severity escalations directly to managers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-6">Seamless Role-Based Workflows</h2>
              <ul className="space-y-6">
                <li className="flex items-start gap-4">
                  <div className="mt-1 bg-emerald-100 rounded-full p-1"><CheckCircle2 size={16} className="text-[#1D9E75]"/></div>
                  <div>
                    <strong className="block text-slate-900 mb-1">Employees</strong>
                    <span className="text-slate-600">Draft individual targets and log quarterly actuals.</span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="mt-1 bg-emerald-100 rounded-full p-1"><CheckCircle2 size={16} className="text-[#1D9E75]"/></div>
                  <div>
                    <strong className="block text-slate-900 mb-1">Managers</strong>
                    <span className="text-slate-600">Review approval queues and utilize AI anomaly detection.</span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="mt-1 bg-emerald-100 rounded-full p-1"><CheckCircle2 size={16} className="text-[#1D9E75]"/></div>
                  <div>
                    <strong className="block text-slate-900 mb-1">Administrators</strong>
                    <span className="text-slate-600">Monitor live completion heatmaps and audit logs.</span>
                  </div>
                </li>
              </ul>
            </div>
            <div className="flex-1">
              <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#1D9E75] blur-[80px] opacity-20 rounded-full"></div>
                <BarChart3 size={48} className="text-[#1D9E75] mb-6" />
                <h3 className="text-2xl font-bold text-white mb-4">Enterprise Grade</h3>
                <p className="text-slate-400">Built with React, Node.js, and Supabase PostgreSQL. Engineered for speed and massive scalability.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} AtomQuest Portal. All rights reserved.</p>
      </footer>
    </div>
  );
}
