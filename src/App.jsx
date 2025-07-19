import { useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import './App.css';

// Set the workerSrc to the local file for pdfjs-dist@5.3.93
GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

function App() {
  const [pdfText, setPdfText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [reviewRequested, setReviewRequested] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Remove hardcoded API key and use environment variable
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
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
    const file = e.target.files[0];
    if (!file) return;
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
      setError('Failed to extract text from PDF.');
    }
    setLoading(false);
  };

  const handleReview = async () => {
    setReviewLoading(true);
    setReviewError('');
    setReviewResult(null);
    try {
      const prompt = buildPrompt(pdfText, jobDesc);
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      const data = await response.json();
      // Try to extract JSON from the AI response
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let result = null;
      try {
        // Try to parse as JSON directly
        result = JSON.parse(text);
      } catch {
        // Try to extract JSON substring if AI wrapped it in markdown
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          result = JSON.parse(match[0]);
        }
      }
      if (!result) throw new Error('Could not parse AI response.');
      setReviewResult(result);
    } catch (err) {
      setReviewError('Failed to get review from Gemini.');
      console.error(err);
    }
    setReviewLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-100 p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md flex flex-col items-center transition-all duration-300">
        <h1 className="text-2xl font-bold mb-4 text-purple-700">Resume Reviewer</h1>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="mb-4 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 transition-all duration-200"
        />
        <textarea
          className="w-full h-24 p-2 border rounded bg-gray-50 text-gray-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 transition-all duration-200 mb-4"
          placeholder="Paste Job Description here..."
          value={jobDesc}
          onChange={e => setJobDesc(e.target.value)}
        />
        <button
          className="w-full py-2 px-4 rounded bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold shadow-md hover:scale-105 hover:from-purple-600 hover:to-blue-600 transition-all duration-200 mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!pdfText || !jobDesc || loading || reviewLoading}
          onClick={handleReview}
        >
          {reviewLoading ? (
            <span className="animate-pulse">Reviewing...</span>
          ) : (
            'Review Resume'
          )}
        </button>
        {loading && <div className="animate-pulse text-purple-500">Extracting text...</div>}
        {error && <div className="text-red-500 mt-2">{error}</div>}
        {/* Removed extracted PDF text display for a cleaner UI */}
        {reviewError && <div className="text-red-500 mt-4">{reviewError}</div>}
        {reviewResult && (
          <div className="w-full mt-6 p-4 rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 shadow-inner animate-fade-in flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-purple-700 mb-2 animate-fade-in">AI Review</h2>
            <p className="mb-2 text-gray-700 animate-fade-in delay-100">{reviewResult.review}</p>
            <div className="flex items-center mb-2 animate-fade-in delay-200">
              <span className="font-semibold text-purple-600 mr-2">AI Rating:</span>
              <div className="relative w-32 h-4 bg-purple-100 rounded-full overflow-hidden mr-2">
                <div className="absolute left-0 top-0 h-4 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full transition-all duration-700" style={{ width: `${reviewResult.ai_rating}%` }}></div>
              </div>
              <span className="text-xl font-bold">{reviewResult.ai_rating} / 100</span>
            </div>
            <div className="flex items-center mb-2 animate-fade-in delay-300">
              <span className="font-semibold text-blue-600 mr-2">ATS Score:</span>
              <div className="relative w-32 h-4 bg-blue-100 rounded-full overflow-hidden mr-2">
                <div className="absolute left-0 top-0 h-4 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full transition-all duration-700" style={{ width: `${reviewResult.ats_score}%` }}></div>
              </div>
              <span className="text-xl font-bold">{reviewResult.ats_score} / 100</span>
            </div>
            <div className="mb-2 animate-fade-in delay-400">
              <span className="font-semibold text-purple-600">Suggestions:</span>
              <ul className="list-disc ml-6 mt-1">
                {reviewResult.suggestions?.map((s, i) => {
                  let suggestionText;
                  if (typeof s === 'string') {
                    suggestionText = s;
                  } else if (
                    s &&
                    typeof s === 'object' &&
                    'replace' in s &&
                    'with' in s &&
                    s.replace &&
                    s.with
                  ) {
                    suggestionText = `Replace: ${s.replace} With: ${s.with}`;
                  } else {
                    suggestionText = typeof s === 'object' ? JSON.stringify(s) : 'Invalid suggestion format';
                  }
                  return (
                    <li
                      key={i}
                      className="transition-all duration-300 hover:bg-purple-100 rounded px-2 py-1 animate-fade-in delay-500"
                      style={{ animationDelay: `${500 + i * 100}ms` }}
                    >
                      {suggestionText}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="animate-fade-in delay-500">
              <span className="font-semibold text-red-500">Spelling Errors:</span>
              <ul className="list-disc ml-6 mt-1">
                {reviewResult.spelling_errors?.length ? reviewResult.spelling_errors.map((e, i) => (
                  <li key={i} className="transition-all duration-300 hover:bg-red-100 rounded px-2 py-1 animate-fade-in delay-600" style={{ animationDelay: `${600 + i * 100}ms` }}>{e}</li>
                )) : <li>None</li>}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
