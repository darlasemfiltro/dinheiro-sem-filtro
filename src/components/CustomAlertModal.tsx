import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, Trash2 } from 'lucide-react';

interface AlertButton {
  label: string;
  onClick: () => void;
  variant?: 'secondary' | 'primary' | 'danger';
}

interface CustomAlertModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'confirm' | 'delete';
  confirmText?: string;
  cancelText?: string;
  onClose: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  buttons?: AlertButton[];
}

export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({
  isOpen,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText = 'Não',
  onClose,
  onConfirm,
  onCancel,
  buttons,
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-10 h-10 text-emerald-400" />;
      case 'error':
      case 'delete':
        return <Trash2 className="w-10 h-10 text-rose-500" />;
      case 'warning':
      case 'confirm':
        return <AlertTriangle className="w-10 h-10 text-amber-400" />;
      case 'info':
      default:
        return <Info className="w-10 h-10 text-amber-400" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500/15 border border-emerald-500/30';
      case 'error':
      case 'delete':
        return 'bg-rose-500/15 border border-rose-500/30';
      case 'confirm':
      case 'warning':
      case 'info':
      default:
        return 'bg-amber-500/15 border border-amber-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#12141a] border border-amber-500/40 rounded-2xl p-6 max-w-sm sm:max-w-md w-full mx-auto shadow-2xl text-center relative">
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${getIconBg()}`}>
          {getIcon()}
        </div>

        {title && (
          <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        )}

        <p className="text-zinc-200 text-sm leading-relaxed mb-6 whitespace-pre-line">
          {message}
        </p>

        {buttons && buttons.length > 0 ? (
          <div className="flex flex-col sm:flex-row gap-2.5">
            {buttons.map((btn, idx) => {
              let btnClass = 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700';
              if (btn.variant === 'primary') {
                btnClass = 'bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-amber-500/20';
              } else if (btn.variant === 'danger') {
                btnClass = 'bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-rose-900/30';
              }
              return (
                <button
                  key={idx}
                  onClick={btn.onClick}
                  className={`flex-1 py-3 px-4 rounded-xl transition-all text-sm shadow-md cursor-pointer ${btnClass}`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className={`flex gap-3 ${type === 'confirm' ? 'grid grid-cols-2' : 'justify-center'}`}>
            {type === 'confirm' && (
              <button
                onClick={() => {
                  if (onCancel) onCancel();
                  onClose();
                }}
                className="w-full py-3 px-4 rounded-xl font-medium bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 transition-all text-sm"
              >
                {cancelText}
              </button>
            )}

            <button
              onClick={() => {
                if (onConfirm) onConfirm();
                onClose();
              }}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all text-sm shadow-lg ${
                type === 'confirm' || type === 'error'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/30'
                  : 'bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/20'
              }`}
            >
              {confirmText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
