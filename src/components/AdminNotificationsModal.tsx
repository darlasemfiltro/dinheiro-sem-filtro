import React, { useState, useEffect } from 'react';
import { Bell, Sparkles, Trash2, X, CheckCircle, Info, Calendar, ExternalLink } from 'lucide-react';
import { getAppwriteConfig, appwriteDatabases as databases, appwriteClient } from '../lib/appwrite';

interface AdminNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export const AdminNotificationsModal: React.FC<AdminNotificationsModalProps> = ({
  isOpen,
  onClose,
  userEmail,
}) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAllNotifications = async () => {
    try {
      const cleanEmail = (userEmail || '').trim().toLowerCase();

      // 1. Fetch from server API (/api/notifications)
      let serverNotifs: any[] = [];
      try {
        const res = await fetch(`/api/notifications?email=${encodeURIComponent(cleanEmail)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            serverNotifs = data.filter((n: any) => {
              const toE = (n.toEmail || '').trim().toLowerCase();
              return toE === 'all' || toE === 'todos' || toE === cleanEmail || toE === '';
            });
          }
        }
      } catch (err) {
        console.warn('[AdminNotifications] Server API fetch error:', err);
      }

      // 2. Fetch from Appwrite Notificacoes collection
      const cfg = getAppwriteConfig();
      const DATABASE_ID = cfg?.databaseId || '6a83aa8d0038331e040f';
      let appwriteDocs: any[] = [];
      try {
        const res = await databases.listDocuments(DATABASE_ID, 'Notificacoes');
        appwriteDocs = res.documents.filter((doc: any) => {
          const uId = (doc.userId || doc.toEmail || doc.targetEmail || '').trim().toLowerCase();
          if (uId && uId !== 'all' && uId !== 'todos' && uId !== cleanEmail) {
            return false;
          }
          return uId === cleanEmail || uId === 'all' || uId === 'todos' || uId === '';
        });
      } catch (err) {}

      // 3. Fetch embedded in user_financials
      let embeddedNotifs: any[] = [];
      try {
        const resList = await databases.listDocuments(DATABASE_ID, 'user_financials');
        const userDoc = resList.documents.find((d: any) => (d.userId || d.email || '').trim().toLowerCase() === cleanEmail);
        if (userDoc && userDoc.data) {
          const parsed = JSON.parse(userDoc.data);
          if (Array.isArray(parsed.notifications)) {
            embeddedNotifs = parsed.notifications;
          }
        }
      } catch (e) {}

      // 4. Local storage notifications
      let userSpecificLocal: any[] = [];
      try {
        userSpecificLocal = JSON.parse(localStorage.getItem(`darla_user_notifications_${cleanEmail}`) || '[]');
      } catch (e) {}

      let generalLocal: any[] = [];
      try {
        generalLocal = JSON.parse(localStorage.getItem('darla_notifications') || '[]');
      } catch (e) {}

      const localFiltered = generalLocal.filter((n: any) => {
        const target = (n.targetEmail || n.toEmail || 'all').toLowerCase().trim();
        if (target && target !== 'all' && target !== 'todos' && target !== cleanEmail) {
          return false;
        }
        return target === 'all' || target === 'todos' || target === cleanEmail;
      });

      const allLocalNotifs = [...userSpecificLocal, ...localFiltered];

      // Format all sources
      const formattedServer = serverNotifs.map((n: any) => {
        const msg = n.message || '';
        const parts = msg.split('\n\n');
        return {
          id: n.id || `srv_${Math.random()}`,
          title: parts.length > 1 ? parts[0] : (n.type === 'birthday' ? '🎉 Feliz Aniversário' : '📢 Comunicado do Administrador'),
          message: parts.length > 1 ? parts.slice(1).join('\n\n') : msg,
          type: n.type || 'announcement',
          link: n.link || undefined,
          createdAt: n.createdAt || new Date().toISOString()
        };
      });

      const formattedAppwrite = appwriteDocs.map((doc: any) => {
        const msg = doc.mensagem || '';
        const parts = msg.split('\n\n');
        return {
          id: doc.$id,
          title: parts.length > 1 ? parts[0] : (doc.budgetId || 'Nova Mensagem da Administração'),
          message: parts.length > 1 ? parts.slice(1).join('\n\n') : msg,
          type: doc.tipo || 'announcement',
          link: doc.link || undefined,
          createdAt: doc.$createdAt || new Date().toISOString()
        };
      });

      const formattedEmbedded = embeddedNotifs.map((n: any) => ({
        id: n.id || `emb_${Math.random()}`,
        title: n.title || 'Comunicado do Administrador',
        message: n.message || '',
        type: n.type || 'announcement',
        link: n.link || undefined,
        createdAt: n.createdAt || new Date().toISOString()
      }));

      const formattedLocal = allLocalNotifs.map((n: any) => ({
        id: n.id || `local_${Math.random()}`,
        title: n.title || 'Comunicado do Administrador',
        message: n.message || '',
        type: n.type || 'announcement',
        link: n.link || undefined,
        createdAt: n.createdAt || new Date().toISOString()
      }));

      const map = new Map();
      [...formattedServer, ...formattedAppwrite, ...formattedEmbedded, ...formattedLocal].forEach(item => {
        if (item && item.id) map.set(item.id, item);
      });

      setNotifications(Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error('[AdminNotifications] Error fetching:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userEmail) {
      fetchAllNotifications();

      // Realtime subscription via Appwrite WebSocket
      let unsubscribe: (() => void) | undefined;
      try {
        const cfg = getAppwriteConfig();
        const DATABASE_ID = cfg?.databaseId || '6a83aa8d0038331e040f';
        const channel = `databases.${DATABASE_ID}.collections.Notificacoes.documents`;
        unsubscribe = appwriteClient.subscribe(channel, (response) => {
          if (response.events.some(e => e.includes('.create') || e.includes('.update') || e.includes('.delete'))) {
            fetchAllNotifications();
          }
        });
      } catch (err) {
        console.warn('[AdminNotifications] Realtime subscription error:', err);
      }

      // Event listener for custom updates
      const handleCustomUpdate = () => {
        fetchAllNotifications();
      };
      window.addEventListener('notifications_updated', handleCustomUpdate);

      // Polling interval every 3 seconds for ultimate real-time sync across devices
      const interval = setInterval(() => {
        fetchAllNotifications();
      }, 3000);

      return () => {
        if (unsubscribe) {
          try { unsubscribe(); } catch (e) {}
        }
        window.removeEventListener('notifications_updated', handleCustomUpdate);
        clearInterval(interval);
      };
    }
  }, [isOpen, userEmail]);

  const handleDelete = async (id: string, notificationItem?: any) => {
    try {
      const cleanEmail = (userEmail || '').trim().toLowerCase();
      const cfg = getAppwriteConfig();
      const DATABASE_ID = cfg?.databaseId || '6a83aa8d0038331e040f';

      // 1. Delete from Appwrite Notificacoes collection
      try {
        if (id && !id.startsWith('local_') && !id.startsWith('emb_') && !id.startsWith('srv_')) {
          await databases.deleteDocument(DATABASE_ID, 'Notificacoes', id).catch(() => {});
        }
        const res = await databases.listDocuments(DATABASE_ID, 'Notificacoes');
        for (const doc of res.documents) {
          const msg = doc.mensagem || '';
          if (
            doc.$id === id || 
            (notificationItem && (msg.includes(notificationItem.title) || msg.includes(notificationItem.message)))
          ) {
            await databases.deleteDocument(DATABASE_ID, 'Notificacoes', doc.$id).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[AdminNotifications] Appwrite delete error:', err);
      }

      // 2. Delete from general local storage ('darla_notifications')
      try {
        const localStr = localStorage.getItem('darla_notifications') || '[]';
        const local = JSON.parse(localStr);
        const updated = local.filter((n: any) => {
          if (n.id === id) return false;
          if (notificationItem && n.title === notificationItem.title && n.message === notificationItem.message) return false;
          return true;
        });
        localStorage.setItem('darla_notifications', JSON.stringify(updated));
      } catch (e) {}

      // 3. Delete from user-specific local storage ('darla_user_notifications_<email>')
      try {
        if (cleanEmail) {
          const userKey = `darla_user_notifications_${cleanEmail}`;
          const userStr = localStorage.getItem(userKey) || '[]';
          const userNotifs = JSON.parse(userStr);
          const updatedUserNotifs = userNotifs.filter((n: any) => {
            if (n.id === id) return false;
            if (notificationItem && n.title === notificationItem.title && n.message === notificationItem.message) return false;
            return true;
          });
          localStorage.setItem(userKey, JSON.stringify(updatedUserNotifs));
        }
      } catch (e) {}

      // 4. Delete from embedded in user_financials in Appwrite
      try {
        const resList = await databases.listDocuments(DATABASE_ID, 'user_financials');
        const userDoc = resList.documents.find((d: any) => (d.userId || d.email || '').trim().toLowerCase() === cleanEmail);
        if (userDoc && userDoc.data) {
          const parsed = JSON.parse(userDoc.data);
          if (Array.isArray(parsed.notifications)) {
            parsed.notifications = parsed.notifications.filter((n: any) => {
              if (n.id === id) return false;
              if (notificationItem && n.title === notificationItem.title && n.message === notificationItem.message) return false;
              return true;
            });
            await databases.updateDocument(DATABASE_ID, 'user_financials', userDoc.$id, {
              data: JSON.stringify(parsed)
            });
          }
        }
      } catch (e) {}

      setNotifications(prev => prev.filter(n => n.id !== id));
      setDeletingId(null);
      window.dispatchEvent(new CustomEvent('notifications_updated'));
    } catch (e) {
      console.error('[AdminNotifications] Error deleting:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#18181b] border-2 border-[#D4AF37] rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden text-white max-h-[90vh] flex flex-col">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-black font-serif text-white flex items-center gap-2.5">
              <Bell className="w-6 h-6 text-[#D4AF37]" />
              Notificações
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading && notifications.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs font-bold animate-pulse">
              Carregando notificações em tempo real...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 bg-gray-800/80 rounded-full flex items-center justify-center mx-auto text-gray-500 border border-gray-700">
                <Bell className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-sm font-bold text-gray-300">Nenhuma notificação no momento.</p>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">Aniversários, avisos de inatividade e novidades enviadas pelo administrador aparecerão aqui automaticamente em tempo real.</p>
            </div>
          ) : (
            notifications.map(item => (
              <div
                key={item.id}
                className="bg-black/40 border border-gray-800 hover:border-[#D4AF37]/50 rounded-2xl p-4 transition space-y-3 relative group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-[#D4AF37]/15 rounded-xl text-[#D4AF37] shrink-0">
                      {item.type === 'birthday' ? <Sparkles className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-black tracking-wider text-[#D4AF37]">
                        {item.type === 'birthday' ? '🎉 Parabéns / Aniversário' : item.type === 'inactivity' ? '⏰ Alerta de Inatividade' : '📢 Comunicado & Novidades'}
                      </span>
                      <h4 className="text-sm font-black text-white">{item.title}</h4>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeletingId(item.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
                    title="Excluir notificação"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap pl-1">
                  {item.message}
                </p>

                {item.link && (
                  <div className="pt-2 pl-1">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#EAB308] hover:bg-[#CA8A04] text-neutral-900 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition cursor-pointer"
                    >
                      <span>SAIBA MAIS</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {deletingId === item.id && (
                  <div className="bg-red-950/90 border border-red-500/60 rounded-2xl p-3.5 flex flex-col gap-2.5 mt-3 animate-in fade-in duration-150 shadow-lg">
                    <p className="text-xs font-black text-red-200">Deseja realmente excluir esta notificação?</p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item)}
                        className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md"
                      >
                        Sim, Excluir
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2 border-t border-gray-800/80">
                  <span>Atualização Automática (Tempo Real)</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(item.createdAt || Date.now()).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-gray-800 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#c29f31] text-[#121212] font-black rounded-xl text-xs uppercase tracking-widest transition cursor-pointer shadow-lg"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
