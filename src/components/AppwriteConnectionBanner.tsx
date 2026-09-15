import React, { useState, useEffect } from 'react';
import { checkAppwriteConnection, AppwriteStatus } from '../lib/appwrite';
import { Cloud, AlertTriangle, RefreshCw, ChevronRight, CheckCircle } from 'lucide-react';

interface AppwriteConnectionBannerProps {
  onOpenSettings: () => void;
}

export const AppwriteConnectionBanner: React.FC<AppwriteConnectionBannerProps> = ({ onOpenSettings }) => {
  const [status, setStatus] = useState<AppwriteStatus | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const checkStatus = async () => {
    try {
      const res = await checkAppwriteConnection();
      setStatus(res);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // If connected or dismissed, don't show the warning banner
  if (status?.connected || isDismissed) {
    return null;
  }

  return (
    <div
      className="w-full bg-amber-950/90 text-amber-100 border-b border-amber-600/60 shadow-md px-3 sm:px-6 py-2 z-40 relative transition-all animate-in fade-in"
      id="appwrite-connection-banner"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 text-xs">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="p-1.5 rounded-lg bg-amber-800 shrink-0">
            <Cloud className="w-4 h-4 text-amber-300" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-white text-xs sm:text-sm">
                Sincronização Nuvem (Appwrite)
              </span>
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-800 text-amber-200">
                Pendente / Configuração
              </span>
            </div>

            <p className="text-[11px] text-gray-200 mt-0.5 truncate">
              Para sincronizar celular e computador sem divergências, configure o Project ID do Appwrite.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            onClick={onOpenSettings}
            className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#b5952f] text-[#121212] font-black rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <span>Configurar Appwrite</span>
            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-[10px] transition cursor-pointer"
            title="Fechar aviso temporariamente"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
