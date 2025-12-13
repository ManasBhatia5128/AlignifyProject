import { useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import './App.css';

// Set the workerSrc
GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// --- UI Components ---

const RadialProgress = ({ score, color, label }) => {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white/50 rounded-xl border border-white/60 shadow-sm">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="transform -rotate-90 w-24 h-24">
          <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-200" />
          <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`transition-all duration-1000 ease-out ${color}`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-xl font-bold text-slate-700">{score}%</span>
      </div>
      <span className="mt-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
  );
};

const StatusBadge = ({ type, text }) => {
  const styles = {
    error: 'bg-red-100 text-red-700 border-red-200',
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-md border ${styles[type] || styles.neutral}`}>
      {text}
    </span>
  );
};

// --- Main App ---

function App() {
  const [pdfText, setPdfText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [reviewResult, setReviewResult] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  // FIX: Changed model to gemini-1.5-flash
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  const buildPrompt = (resume, jd) => `You are a professional resume reviewer and ATS (Applicant Tracking System) expert. Given the following resume and job description (JD), do the following:
1. Give an overall AI review of the resume for this JD (max 5 lines).
2. Give an AI rating out of 100 for how well the resume matches the JD.
3. Give an ATS score (keyword match score out of 100) for the resume against the JD.
4. Suggest improvements in the form: "Replace: <current line> With: <suggested line>" (at least 3 suggestions).
5. List any spelling errors to correct (if any).

Resume:
"""
${resume}
"""

Job Description:
"""
${jd}
"""

Respond in JSON with keys: review, ai_rating, ats_score, suggestions (array), spelling_errors (array).`;

  const handleFileChange = async (e) => {
    setError('');
    setPdfText('');
    setFileName('');
    const file = e.target.files[0];
    if (!file) return;
    
    setFileName(file.name);
    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
      }
      setPdfText(text);
    } catch (err) {
      console.error(err);
      setError('Failed to extract text.');
    }
    setLoading(false);
  };

  const handleReview = async () => {
    setReviewLoading(true);
    setReviewError('');
    setReviewResult(null);
    try {
      const prompt = buildPrompt(pdfText, jobDesc);
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      // FIX: Better Error Handling
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
      }

      const data = await response.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Clean up markdown code blocks if present (```json ... ```)
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      let result = null;
      try {
        result = JSON.parse(text);
      } catch (e) {
        // Fallback: Try to find JSON object in text
        const match = text.match(/\{[\s\S]*\}/);
        if (match) result = JSON.parse(match[0]);
      }
      
      if (!result) throw new Error('Could not parse AI response.');
      setReviewResult(result);
    } catch (err) {
      setReviewError(err.message || 'Failed to get review.');
      console.error(err);
    }
    setReviewLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 font-sans text-slate-800 relative overflow-hidden bg-slate-100">
      {/* Background Image Layer */}
      <div className="bg-image fixed inset-0 z-0 scale-105 blur-sm opacity-80" aria-hidden="true" />
      
      {/* Decorative Gradient Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

      {/* Main Glass Dashboard Container */}
      <div className="relative z-10 w-full max-w-6xl min-h-[80vh] bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] rounded-3xl flex flex-col md:flex-row overflow-hidden transition-all duration-500">
        
        {/* --- LEFT PANEL: Input Control --- */}
        <div className="w-full md:w-5/12 p-8 border-b md:border-b-0 md:border-r border-white/30 flex flex-col gap-6 bg-white/20">
          
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
              ResumeAI
            </h1>
            <p className="text-sm font-medium text-slate-500">Optimize your career path with precision.</p>
          </div>

          {/* 1. Resume Upload Card */}
          <div className="group relative">
            <label className="block w-full cursor-pointer">
              <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
              <div className={`p-6 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center gap-3
                ${fileName ? 'border-emerald-400 bg-emerald-50/50' : 'border-indigo-300 hover:border-indigo-500 hover:bg-white/40 bg-white/20'}`}>
                
                {loading ? (
                  <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
                ) : fileName ? (
                   <>
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800 break-all">{fileName}</p>
                      <p className="text-xs text-emerald-600">PDF Processed Ready</p>
                    </div>
                   </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-indigo-900">Upload Resume</p>
                      <p className="text-xs text-indigo-600">Click to browse (PDF)</p>
                    </div>
                  </>
                )}
              </div>
            </label>
            {error && <p className="text-xs text-red-500 mt-2 ml-1">{error}</p>}
          </div>

          {/* 2. Job Description Input */}
          <div className="flex-grow flex flex-col">
            <label className="text-xs font-bold uppercase text-slate-500 mb-2 tracking-wider">Job Description</label>
            <textarea
              className="w-full flex-grow min-h-[150px] p-4 rounded-xl border border-white/50 bg-white/40 focus:bg-white/80 focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-sm text-slate-700 placeholder-slate-400 transition-all resize-none shadow-inner"
              placeholder="Paste the job description here to analyze match..."
              value={jobDesc}
              onChange={e => setJobDesc(e.target.value)}
            />
          </div>

          {/* Action Button */}
          <button
            className="w-full py-4 px-6 rounded-xl bg-slate-900 text-white font-bold text-lg shadow-xl shadow-slate-900/20 hover:shadow-slate-900/40 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 group"
            disabled={!pdfText || !jobDesc || loading || reviewLoading}
            onClick={handleReview}
          >
            {reviewLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <span>Run Analysis</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </>
            )}
          </button>
          
          {reviewError && <div className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-100">{reviewError}</div>}
        </div>

        {/* --- RIGHT PANEL: Dashboard Results --- */}
        <div className="w-full md:w-7/12 bg-white/30 backdrop-blur-md p-8 overflow-y-auto relative">
          
          {!reviewResult ? (
            // Empty State
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
              <svg className="w-24 h-24 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
              <p className="text-lg font-medium">Results will appear here</p>
              <p className="text-sm">Upload a resume and JD to begin.</p>
            </div>
          ) : (
            // Results Dashboard
            <div className="space-y-6 animate-fade-in-up">
              
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-slate-800">Analysis Report</h2>
                <div className="h-1 w-20 bg-indigo-500 rounded-full"></div>
              </div>

              {/* 1. Score Cards */}
              <div className="grid grid-cols-2 gap-4">
                <RadialProgress score={reviewResult.ai_rating} color="text-indigo-600" label="Match Score" />
                <RadialProgress score={reviewResult.ats_score} color="text-blue-600" label="ATS Compatibility" />
              </div>

              {/* 2. Executive Summary */}
              <div className="bg-white/60 p-5 rounded-2xl border border-white/60 shadow-sm">
                <h3 className="text-sm font-bold uppercase text-slate-500 tracking-wider mb-3">Executive Summary</h3>
                <p className="text-slate-700 leading-relaxed text-sm md:text-base">
                  {reviewResult.review}
                </p>
              </div>

              {/* 3. Improvements (The "Diff" View) */}
              <div>
                <h3 className="text-sm font-bold uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-2">
                  <span>Suggested Optimization</span>
                  <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">{reviewResult.suggestions?.length || 0}</span>
                </h3>
                <div className="space-y-3">
                  {reviewResult.suggestions?.map((s, i) => (
                    <div key={i} className="bg-white/70 rounded-xl p-4 border border-white/50 shadow-sm transition-all hover:shadow-md hover:bg-white/90">
                      {typeof s === 'object' && s.replace && s.with ? (
                         <div className="flex flex-col gap-2">
                           <div className="text-xs font-semibold text-red-500 uppercase tracking-wide">Replace</div>
                           <div className="text-sm text-slate-500 line-through bg-red-50 p-2 rounded border border-red-100">{s.replace}</div>
                           
                           <div className="flex items-center justify-center my-1 opacity-50">
                             <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
                           </div>
                           
                           <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">With</div>
                           <div className="text-sm text-slate-800 font-medium bg-emerald-50/50 p-2 rounded border border-emerald-100">{s.with}</div>
                         </div>
                      ) : (
                        <p className="text-sm text-slate-700">{typeof s === 'string' ? s : JSON.stringify(s)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Typos */}
              {reviewResult.spelling_errors?.length > 0 && (
                <div className="bg-red-50/80 p-5 rounded-2xl border border-red-100">
                  <h3 className="text-sm font-bold uppercase text-red-500 tracking-wider mb-3">Attention Needed</h3>
                  <div className="flex flex-wrap gap-2">
                    {reviewResult.spelling_errors.map((e, i) => (
                      <StatusBadge key={i} type="error" text={e} />
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;