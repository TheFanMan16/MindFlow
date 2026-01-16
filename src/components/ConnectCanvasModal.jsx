import React, { useState } from 'react';
import { X, Check, AlertCircle, Loader2, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ConnectCanvasModal = ({ isOpen, onClose, onConnected }) => {
    const { user } = useAuth();
    const [domain, setDomain] = useState('');
    const [token, setToken] = useState('');
    const [status, setStatus] = useState('idle'); // idle, testing, success, error, saving
    const [errorMessage, setErrorMessage] = useState('');
    const [showWalkthrough, setShowWalkthrough] = useState(false);

    if (!isOpen) return null;

    const handleTestConnection = async () => {
        setStatus('testing');
        setErrorMessage('');

        try {
            const response = await fetch('http://localhost:3000/api/canvas/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, domain })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setStatus('success');
                toast.success('Connection verified!');
            } else {
                setStatus('error');
                setErrorMessage(data.error || 'Connection failed');
                toast.error(data.error || 'Connection failed');
            }
        } catch (error) {
            setStatus('error');
            setErrorMessage('Network error. Is the server running?');
            toast.error('Network error');
        }
    };

    const handleSave = async () => {
        setStatus('saving');

        try {
            const response = await fetch('http://localhost:3000/api/canvas/save-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, token, domain })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                toast.success('Canvas connected successfully!');
                if (onConnected) onConnected();
                onClose();
            } else {
                setStatus('error');
                setErrorMessage(data.error || 'Save failed');
                toast.error('Failed to save connection');
            }
        } catch (error) {
            setStatus('error');
            setErrorMessage('Save failed due to network error');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
                    <h2 className="text-xl font-semibold text-white">Connect Canvas</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">

                    {/* Domain Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Canvas URL</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="canvas.university.edu"
                                value={domain}
                                onChange={(e) => {
                                    setDomain(e.target.value.replace(/^https?:\/\//, '')); // Strip protocol
                                    setStatus('idle');
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <p className="text-xs text-slate-500">The web address you logging into for your courses.</p>
                    </div>

                    {/* Token Input */}
                    <div className="space-y-2">
                        <label className="flex items-center justify-between text-sm font-medium text-slate-300">
                            <span>Personal Access Token</span>
                            <button
                                onClick={() => setShowWalkthrough(!showWalkthrough)}
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                                <HelpCircle size={12} />
                                How to get this?
                            </button>
                        </label>
                        <input
                            type="password"
                            placeholder="1000~..."
                            value={token}
                            onChange={(e) => {
                                setToken(e.target.value);
                                setStatus('idle');
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Walkthrough (Conditional) */}
                    {showWalkthrough && (
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-sm text-slate-300 space-y-2">
                            <p className="font-semibold text-blue-200">Steps to generate a token:</p>
                            <ol className="list-decimal list-inside space-y-1 text-xs">
                                <li>Log in to your Canvas account.</li>
                                <li>Click <strong>Account</strong> (top left icon) {'>'} <strong>Settings</strong>.</li>
                                <li>Scroll down to <strong>Approved Integrations</strong>.</li>
                                <li>Click <strong>+ New Access Token</strong>.</li>
                                <li>Give it a purpose (e.g., "Study App") and click Generate.</li>
                                <li>Copy the long string (starts with 1000~).</li>
                            </ol>
                        </div>
                    )}

                    {/* Status Message */}
                    {status === 'error' && (
                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 p-3 rounded-lg border border-red-500/20">
                            <AlertCircle size={16} />
                            <span>{errorMessage}</span>
                        </div>
                    )}
                    {status === 'success' && (
                        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-950/30 p-3 rounded-lg border border-green-500/20">
                            <Check size={16} />
                            <span>Connection successful! You can now save.</span>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800 bg-slate-900/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                        disabled={status === 'saving'}
                    >
                        Cancel
                    </button>

                    {status !== 'success' ? (
                        <button
                            onClick={handleTestConnection}
                            disabled={!token || !domain || status === 'testing'}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {status === 'testing' ? <Loader2 size={16} className="animate-spin" /> : null}
                            Test Connection
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={status === 'saving'}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-500 rounded-lg shadow-lg shadow-green-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {status === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            Save & Connect
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default ConnectCanvasModal;
