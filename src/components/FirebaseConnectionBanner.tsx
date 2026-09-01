import React, { useState, useEffect } from 'react';
import { firebaseConnectionManager, ConnectionState, FirebaseStatus } from '../lib/firebase';
import { AlertTriangle, RefreshCw, WifiOff, ChevronDown, ChevronUp } from 'lucide-react';

export const FirebaseConnectionBanner: React.FC = () => {
  const [connState, setConnState] = useState<ConnectionState>(() => firebaseConnectionManager.getState());
  const [connInfo, setConnInfo] = useState<FirebaseStatus | null>(() => firebaseConnectionManager.getLastStatus());
  const [isRetrying, setIsRetrying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsub = firebaseConnectionManager.subscribe((state, info) => {
      setConnState(state);
      if (info) setConnInfo(info);
      if (state === 'online') {
        setDismissed(false);
      }
    });

    // Run connection test on mount
    firebaseConnectionManager.testAndNotify();

    return () => unsub();
  }, []);

  const handleManualRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      const res = await firebaseConnectionManager.reconnectManual();
      if (res.connected) {
        setDismissed(false);
      }
    } finally {
      setIsRetrying(false);
    }
  };

  // If online or dismissed by user, do not render intrusive banner
  if (connState === 'online' || dismissed) {
    return null;
  }

  const isOffline = connState === 'offline' || connInfo?.isOffline;

  return (
    <div
      className={`w-full transition-all duration-300 border-b ${
        isOffline
          ? 'bg-amber-900/90 text-amber-100 border-amber-700'
          : 'bg-red-950/95 text-red-100 border-red-800'
      } shadow-lg px-3 sm:px-6 py-2.5 z-40 relative`}
      id="firebase-connection-banner"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 text-xs">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className={`p-1.5 rounded-lg shrink-0 ${isOffline ? 'bg-amber-800' : 'bg-red-800'}`}>
            {isOffline ? (
              <WifiOff className="w-4 h-4 text-amber-300" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-300 animate-pulse" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-white text-xs sm:text-sm">
                {isOffline ? 'Modo Offline Ativo' : 'Instabilidade de Conexão com a Nuvem'}
              </span>
              <span
                className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                  connState === 'reconnecting'
                    ? 'bg-yellow-400 text-black animate-pulse'
                    : isOffline
                    ? 'bg-amber-800 text-amber-200'
                    : 'bg-red-800 text-red-200'
                }`}
              >
                {connState === 'reconnecting' ? 'Tentando Reconectar...' : isOffline ? 'Sem Internet' : 'Erro de Conexão'}
              </span>
            </div>

            <p className="text-[11px] text-gray-200 mt-0.5 truncate">
              {connInfo?.message ||
                (isOffline
                  ? 'Seus dados continuam salvos localmente e serão sincronizados assim que a conexão retornar.'
                  : 'O app está usando o armazenamento local. Clique em "Tentar Novamente Agora" para restabelecer a nuvem.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {connInfo?.error && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-2 py-1 bg-black/25 hover:bg-black/40 rounded-lg text-[10px] font-bold text-gray-300 flex items-center gap-1 transition cursor-pointer"
              title="Ver detalhes técnicos do diagnóstico"
            >
              <span>Detalhes</span>
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          <button
            onClick={handleManualRetry}
            disabled={isRetrying || connState === 'reconnecting'}
            className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#F3E5AB] text-[#121212] font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            id="firebase-retry-btn"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying || connState === 'reconnecting' ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Testando...' : 'Tentar Novamente Agora'}</span>
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="px-2 py-1 text-gray-400 hover:text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
            title="Fechar aviso temporariamente"
          >
            Ocultar
          </button>
        </div>
      </div>

      {isExpanded && connInfo?.error && (
        <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-white/10 text-[11px] font-mono bg-black/40 p-2.5 rounded-xl overflow-x-auto text-gray-200">
          <p className="font-sans font-bold text-amber-300 text-xs mb-1">Diagnóstico da Nuvem:</p>
          <p className="text-gray-300">
            <strong className="text-white">Projeto ID:</strong> {connInfo.projectId}
          </p>
          <p className="text-gray-300">
            <strong className="text-white">Database ID:</strong> {connInfo.databaseId}
          </p>
          <p className="text-gray-300">
            <strong className="text-white">Mensagem de Erro:</strong> {connInfo.error}
          </p>
          {connInfo.latencyMs !== undefined && (
            <p className="text-gray-300">
              <strong className="text-white">Latência:</strong> {connInfo.latencyMs}ms
            </p>
          )}
        </div>
      )}
    </div>
  );
};
