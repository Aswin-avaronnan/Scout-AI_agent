'use client';

import React, { useState, useRef } from 'react';
import { fetchBackend } from '../lib/api';
import { useRouter } from 'next/navigation';
import { usePipelineStore } from '../store/pipeline';
import { useSessionStore } from '../store/session';
import { UploadCloud, FileText, ListPlus, Trash2, CheckCircle2, User } from 'lucide-react';

type Tab = 'manual' | 'resume' | 'sheet';

export function JDInput() {
  const [activeTab, setActiveTab] = useState<Tab>('manual');
  const [jdText, setJdText] = useState('');
  const [usernames, setUsernames] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    if (activeTab === 'resume') {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('For resumes, only PDF format is supported.');
        return;
      }
    } else if (activeTab === 'sheet') {
      if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.json')) {
        alert('For sheets, only CSV or JSON formats are supported.');
        return;
      }
    }
    setSelectedFile(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
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
        const usernameList = usernames.split(',').map(u => u.trim()).filter(u => u);
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
        if (!selectedFile) {
          alert('Please select a file to upload.');
          setLoading(false);
          return;
        }
        
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('jd_text', jdText);
        formData.append('provider', provider);
        formData.append('model', model || '');
        
        const endpoint = activeTab === 'resume' ? '/upload/resume' : '/upload/candidates';
        
        data = await fetchBackend(endpoint, {
          method: 'POST',
          body: formData,
        });
      }
      
      const failed = data.candidates?.filter((c: any) => c.error) || [];
      if (failed.length > 0) {
        alert(`Failed to scout some candidates:\n${failed.map((f: any) => `- ${f.username || 'Candidate'}: ${f.error}`).join('\n')}`);
      }

      const successful = data.candidates?.filter((c: any) => !c.error) || [];
      if (successful.length === 0) {
        throw new Error('All candidate lookups failed. Please check the credentials and try again.');
      }
      
      setPipelineData(data); 
      router.push('/pipeline');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Scouting pipeline execution failed.');
    } finally {
      setLoading(false);
    }
  };

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
            onClick={() => { setActiveTab('manual'); removeFile(); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all ${
              activeTab === 'manual' 
                ? 'bg-zinc-900 border border-zinc-800 text-white' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <User size={14} /> Enter Usernames
          </button>
          
          <button
            onClick={() => { setActiveTab('resume'); removeFile(); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all ${
              activeTab === 'resume' 
                ? 'bg-zinc-900 border border-zinc-800 text-white' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <FileText size={14} /> Parse Resume (PDF)
          </button>
          
          <button
            onClick={() => { setActiveTab('sheet'); removeFile(); }}
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
              {!selectedFile ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${
                    dragActive 
                      ? 'border-white bg-zinc-900/50' 
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/10'
                  }`}
                >
                  <UploadCloud size={32} className="text-zinc-500" />
                  <span className="text-xs text-zinc-400 font-medium">
                    Drag and drop file here, or <span className="text-white underline">browse</span>
                  </span>
                  <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest font-mono">
                    {activeTab === 'resume' ? 'PDF (Max 10MB)' : 'CSV or JSON (Max 10MB)'}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    accept={activeTab === 'resume' ? '.pdf' : '.csv,.json'}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between bg-zinc-900/40 border border-zinc-850 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-300">
                      <FileText size={18} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block max-w-[320px] truncate">{selectedFile.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={removeFile}
                    className="p-2 text-zinc-500 hover:text-red-400 rounded-md hover:bg-zinc-900 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
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
        disabled={loading || !jdText || (activeTab === 'manual' ? !usernames.trim() : !selectedFile)}
        className="w-full py-4 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all flex items-center justify-center gap-2 border border-zinc-700"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 border-2 border-zinc-600 border-t-black rounded-full animate-spin"></span>
            <span>Running Scouting Pipeline...</span>
          </>
        ) : (
          'Run Scouting Pipeline'
        )}
      </button>
    </div>
  );
}
