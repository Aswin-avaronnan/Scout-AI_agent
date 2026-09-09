'use client';

import React, { useState, useRef } from 'react';
import { fetchBackend } from '../lib/api';
import { useRouter } from 'next/navigation';
import { usePipelineStore } from '../store/pipeline';
import { useSessionStore } from '../store/session';
import { UploadCloud, FileText, ListPlus, Trash2, User, PlusCircle, Layers } from 'lucide-react';

type Tab = 'manual' | 'resume' | 'sheet';

export function JDInput() {
  const [activeTab, setActiveTab] = useState<Tab>('manual');
  const [jdText, setJdText] = useState('');
  const [usernames, setUsernames] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [maxResumeLimit, setMaxResumeLimit] = useState<number>(10);
  const [enrichGithub, setEnrichGithub] = useState(true);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const setPipelineData = usePipelineStore((state) => state.setPipelineData);
  const { provider, model } = useSessionStore();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const chosenFiles = Array.from(e.target.files);
      addFiles(chosenFiles);
    }
  };

  const addFiles = (incomingFiles: File[]) => {
    if (activeTab === 'resume') {
      const pdfFiles = incomingFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
      const nonPdfCount = incomingFiles.length - pdfFiles.length;
      
      if (nonPdfCount > 0) {
        alert(`${nonPdfCount} non-PDF file(s) ignored. Only PDF resumes are supported.`);
      }
      
      if (pdfFiles.length === 0) return;
      
      setSelectedFiles(prev => {
        const existingKeys = new Set(prev.map(f => `${f.name}-${f.size}`));
        const newFiles = pdfFiles.filter(f => !existingKeys.has(`${f.name}-${f.size}`));
        return [...prev, ...newFiles];
      });
    } else if (activeTab === 'sheet') {
      const validSheet = incomingFiles.find(
        f => f.name.toLowerCase().endsWith('.csv') || f.name.toLowerCase().endsWith('.json')
      );
      
      if (!validSheet) {
        alert('For sheets, only CSV or JSON formats are supported.');
        return;
      }
      setSelectedFiles([validSheet]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return next;
    });
  };

  const removeAllFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleScout = async () => {
    if (!jdText) {
      alert('Please provide a job description first.');
      return;
    }
    
    setLoading(true);
    
    try {
      let data;
      
      if (activeTab === 'manual') {
        if (!usernames.trim()) {
          alert('Please enter at least one GitHub username.');
          setLoading(false);
          return;
        }
        const usernameList = usernames.split(/[,\n]+/).map(u => u.trim()).filter(u => u);
        data = await fetchBackend('/scout', {
          method: 'POST',
          body: JSON.stringify({
            jd_text: jdText,
            github_usernames: usernameList,
            provider: provider,
            model: model,
          }),
        });
      } else {
        if (selectedFiles.length === 0) {
          alert('Please select at least one file to upload.');
          setLoading(false);
          return;
        }
        
        const formData = new FormData();
        formData.append('jd_text', jdText);
        formData.append('provider', provider);
        formData.append('model', model || '');

        if (activeTab === 'resume') {
          formData.append('enrich_github', String(enrichGithub));
          if (maxResumeLimit > 0) {
            formData.append('max_resumes', String(maxResumeLimit));
          }

          const filesToUpload = maxResumeLimit > 0 ? selectedFiles.slice(0, maxResumeLimit) : selectedFiles;
          filesToUpload.forEach(file => {
            formData.append('files', file);
          });
        } else {
          formData.append('file', selectedFiles[0]);
        }
        
        const endpoint = activeTab === 'resume' ? '/upload/resume' : '/upload/candidates';
        
        data = await fetchBackend(endpoint, {
          method: 'POST',
          body: formData,
        });
      }
      
      const failed = data.candidates?.filter((c: any) => c.error) || [];
      if (failed.length > 0) {
        alert(`Failed to process some candidate(s):\n${failed.map((f: any) => `- ${f.filename || f.username || 'Candidate'}: ${f.error}`).join('\n')}`);
      }

      const successful = data.candidates?.filter((c: any) => !c.error) || [];
      if (successful.length === 0) {
        throw new Error('All candidate lookups failed. Please check your files and try again.');
      }
      
      setPipelineData(data); 
      router.push('/pipeline');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Scouting pipeline execution failed.');
    } finally {
      setLoading(false);
    }
  };

  const effectiveResumeCount = activeTab === 'resume' && maxResumeLimit > 0 
    ? Math.min(selectedFiles.length, maxResumeLimit) 
    : selectedFiles.length;

  return (
    <div className="w-full max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-250">
      
      {/* 1. Job Description Area */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Job Description</label>
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the full job requirements or description here..."
          className="w-full h-60 bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-zinc-200 outline-none focus:ring-1 focus:ring-zinc-700 resize-none transition-all duration-200"
        />
      </div>

      {/* 2. Mode / Input Tabs */}
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-zinc-900 pb-2">
          <button
            onClick={() => { setActiveTab('manual'); removeAllFiles(); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all ${
              activeTab === 'manual' 
                ? 'bg-zinc-900 border border-zinc-800 text-white' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <User size={14} /> Enter Usernames
          </button>
          
          <button
            onClick={() => { setActiveTab('resume'); removeAllFiles(); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all ${
              activeTab === 'resume' 
                ? 'bg-zinc-900 border border-zinc-800 text-white' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <FileText size={14} /> Parse Resumes (PDF)
          </button>
          
          <button
            onClick={() => { setActiveTab('sheet'); removeAllFiles(); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all ${
              activeTab === 'sheet' 
                ? 'bg-zinc-900 border border-zinc-800 text-white' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ListPlus size={14} /> Upload Sheet (CSV/JSON)
          </button>
        </div>

        {/* 3. Input Panels depending on Tab */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 min-h-[160px] flex flex-col justify-center">
          
          {activeTab === 'manual' && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                GitHub Usernames (comma separated)
              </label>
              <input
                type="text"
                value={usernames}
                onChange={(e) => setUsernames(e.target.value)}
                placeholder="e.g. aswin-avaronnan, torvalds, gaearon..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-zinc-200 outline-none focus:ring-1 focus:ring-zinc-700 font-mono text-sm"
              />
              <p className="text-[10px] text-zinc-600 mt-1">
                Fetches profile details, top repos, and primary languages on-the-fly.
              </p>
            </div>
          )}

          {(activeTab === 'resume' || activeTab === 'sheet') && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept={activeTab === 'resume' ? '.pdf' : '.csv,.json'}
                multiple={activeTab === 'resume'}
                className="hidden"
              />

              {/* Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${
                  dragActive 
                    ? 'border-white bg-zinc-900/50' 
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/10'
                }`}
              >
                <UploadCloud size={32} className="text-zinc-500" />
                <span className="text-xs text-zinc-400 font-medium">
                  Drag and drop {activeTab === 'resume' ? 'PDF resume file(s)' : 'candidate sheet'} here, or <span className="text-white underline">browse</span>
                </span>
                <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest font-mono">
                  {activeTab === 'resume' ? 'PDF Resumes (Multiple allowed • Max 10MB each)' : 'CSV or JSON (Max 10MB)'}
                </span>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-3 bg-zinc-900/40 border border-zinc-850 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Layers size={14} className="text-zinc-400" />
                      <span>Selected Files ({selectedFiles.length})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {activeTab === 'resume' && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-all"
                        >
                          <PlusCircle size={13} /> Add More
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={removeAllFiles}
                        className="text-[11px] text-zinc-500 hover:text-red-400 transition-all"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${file.size}-${idx}`}
                        className={`flex items-center justify-between bg-zinc-900 border p-3 rounded-md transition-all ${
                          activeTab === 'resume' && maxResumeLimit > 0 && idx >= maxResumeLimit
                            ? 'border-amber-900/50 bg-amber-950/10 text-amber-300/70'
                            : 'border-zinc-800 text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-zinc-950 border border-zinc-800 rounded text-zinc-400 shrink-0">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold block truncate max-w-[400px]">
                              {file.name}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {(file.size / 1024).toFixed(1)} KB
                              {activeTab === 'resume' && maxResumeLimit > 0 && idx >= maxResumeLimit && (
                                <span className="ml-2 text-amber-500 font-bold">(Exceeds current limit)</span>
                              )}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded hover:bg-zinc-800 transition-all shrink-0"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* User Limit Control for Resumes */}
              {activeTab === 'resume' && (
                <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <label htmlFor="max-resume-limit" className="text-xs font-bold text-white block">
                        Max Resumes Processing Limit
                      </label>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">
                        Set how many resumes to process in this batch (decided by you).
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="max-resume-limit"
                        type="number"
                        min={1}
                        max={100}
                        value={maxResumeLimit || ''}
                        onChange={(e) => setMaxResumeLimit(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 bg-zinc-900 border border-zinc-700 text-white font-mono text-center text-xs py-1.5 px-2 rounded-md outline-none focus:ring-1 focus:ring-zinc-500"
                      />
                      <span className="text-xs text-zinc-500 font-mono font-bold">files</span>
                    </div>
                  </div>

                  {selectedFiles.length > maxResumeLimit && (
                    <div className="text-[11px] text-amber-400 bg-amber-950/30 border border-amber-900/40 p-2.5 rounded-md">
                      ⚠️ Limit applied: Processing the first <strong>{effectiveResumeCount}</strong> of <strong>{selectedFiles.length}</strong> selected resumes.
                    </div>
                  )}

                  <label className="flex items-start gap-3 pt-2 border-t border-zinc-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enrichGithub}
                      onChange={(e) => setEnrichGithub(e.target.checked)}
                      className="mt-0.5 accent-white h-4 w-4"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Enrich with live GitHub data
                      </span>
                      <span className="text-[10px] text-zinc-500 leading-normal block mt-0.5">
                        If a GitHub link is found on the resume, fetch their real profile, repos, and
                        languages. Turn this off to score from resume text alone.
                      </span>
                    </div>
                  </label>
                </div>
              )}

              {activeTab === 'sheet' && (
                <p className="text-[10px] text-zinc-600 leading-normal">
                  💡 **CSV Schema Tip:** Ensure your sheet has a column labeled <span className="text-zinc-400 font-mono font-bold">username</span>, <span className="text-zinc-400 font-mono font-bold">github_username</span>, or <span className="text-zinc-400 font-mono font-bold">github_url</span>. Any additional columns (e.g. name) will be parsed and enriched automatically.
                </p>
              )}
            </div>
          )}

        </div>
      </div>

      {/* 4. Action Button */}
      <button
        onClick={handleScout}
        disabled={loading || !jdText || (activeTab === 'manual' ? !usernames.trim() : selectedFiles.length === 0)}
        className="w-full py-4 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all flex items-center justify-center gap-2 border border-zinc-700"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 border-2 border-zinc-600 border-t-black rounded-full animate-spin"></span>
            <span>Running Scouting Pipeline for {activeTab === 'resume' ? `${effectiveResumeCount} Resume(s)` : 'Candidates'}...</span>
          </>
        ) : (
          `Run Scouting Pipeline ${activeTab === 'resume' && selectedFiles.length > 0 ? `(${effectiveResumeCount} Resume${effectiveResumeCount > 1 ? 's' : ''})` : ''}`
        )}
      </button>
    </div>
  );
}