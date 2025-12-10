import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, AlertTriangle, CheckCircle, Database } from 'lucide-react';

interface UpdateState {
  status: string; // checking, available, none, error, ready
  msg: string;
}

interface ProgressState {
  percent: number;
  speed: number;
  transferred: number;
  total: number;
}

export const UpdateOverlay: React.FC = () => {
  const [updateState, setUpdateState] = useState<UpdateState>({ status: '', msg: '' });
  const [progress, setProgress] = useState<ProgressState>({ percent: 0, speed: 0, transferred: 0, total: 0 });
  const [hexDump, setHexDump] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.electron) return;

    const removeStatusListener = window.electron.onUpdateStatus((data) => {
      console.log("Update Status:", data);
      setUpdateState(data);
      if (data.status === 'checking' || data.status === 'available' || data.status === 'ready') {
        setVisible(true);
      } else if (data.status === 'none' || data.status === 'error') {
        // Hide after a brief delay
        setTimeout(() => setVisible(false), 3000);
      }
    });

    const removeProgressListener = window.electron.onUpdateProgress((data) => {
      setProgress(data);
      // Generate random hex for effect
      const newHex = `0x${Math.floor(Math.random()*16777215).toString(16).toUpperCase().padStart(6, '0')} : ${Math.random().toString(2).substr(2, 8)}`;
      setHexDump(prev => [newHex, ...prev].slice(0, 8));
    });

    return () => {
      removeStatusListener();
      removeProgressListener();
    };
  }, []);

  if (!visible) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center font-mono text-green-500">
        <div className="w-[600px] border-2 border-green-700 bg-black p-8 relative shadow-[0_0_50px_rgba(0,255,0,0.2)]">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 border-b border-green-900 pb-2">
                <h2 className="text-2xl font-black tracking-[0.2em] animate-pulse">SYSTEM UPDATER</h2>
                <div className="text-xs text-green-700">V.1.0.X</div>
            </div>

            {/* Status Message */}
            <div className="flex items-center gap-4 mb-8">
                {updateState.status === 'checking' && <RefreshCw className="animate-spin" size={32} />}
                {updateState.status === 'available' && <Download className="animate-bounce" size={32} />}
                {updateState.status === 'ready' && <CheckCircle className="text-green-400" size={32} />}
                {updateState.status === 'error' && <AlertTriangle className="text-red-500" size={32} />}
                <div className="text-xl uppercase">{updateState.msg}</div>
            </div>

            {/* Progress Bar */}
            {(updateState.status === 'available' || progress.percent > 0) && (
                <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1 text-green-400">
                        <span>DOWNLOADING PATCH...</span>
                        <span>{progress.percent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-4 bg-green-900/30 border border-green-800 p-0.5">
                        <div 
                            className="h-full bg-green-500 shadow-[0_0_10px_#00FF00]" 
                            style={{ width: `${progress.percent}%`, transition: 'width 0.1s linear' }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-[10px] mt-1 text-green-600">
                        <span>{formatBytes(progress.transferred)} / {formatBytes(progress.total)}</span>
                        <span>SPEED: {formatBytes(progress.speed)}/s</span>
                    </div>
                </div>
            )}

            {/* Decorative Hex Dump */}
            <div className="h-32 bg-black border border-green-900/50 p-2 overflow-hidden font-mono text-[10px] text-green-800 flex flex-col-reverse">
                {hexDump.map((hex, i) => (
                    <div key={i} className="opacity-70">{hex} ... PACKET_RECEIVED</div>
                ))}
                {updateState.status === 'checking' && <div className="animate-pulse">SCANNING REPOSITORIES...</div>}
            </div>

            {/* Footer */}
            <div className="mt-4 flex justify-between items-center">
                <div className="flex gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                    <div className="text-[10px]">SECURE CONNECTION ESTABLISHED</div>
                </div>
                <Database size={16} />
            </div>
        </div>
    </div>
  );
};
