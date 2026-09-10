// Real-Time WebSocket Client for instant cross-device synchronization
import { StorageService } from './storage';
import { PortfolioStorageService } from './portfolioStorage';

export type SyncConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type RealtimeMessage = {
  type:
    | 'DATA_UPDATED'
    | 'PORTFOLIO_UPDATED'
    | 'BUDGET_GOALS_UPDATED'
    | 'NOTIFICATIONS_UPDATED'
    | 'SHARED_BUDGET_UPDATED'
    | 'USER_UPDATED'
    | 'GAMIFICATION_UPDATED'
    | 'USER_DELETED'
    | 'SESSION_REVOKED'
    | 'FORCE_DISCONNECT_ALL'
    | 'PING'
    | 'PONG';
  payload?: any;
};

class RealtimeSyncService {
  private socket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private broadcastChannel: any = null;
  private isConnecting = false;
  private activeUserEmail: string | null = null;
  private activeBudgetId: string | null = null;
  public status: SyncConnectionStatus = 'disconnected';
  private statusListeners: Set<(status: SyncConnectionStatus) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('darla_data_sync_channel');
        this.broadcastChannel.onmessage = (event: MessageEvent) => {
          if (event.data?.type === 'DATA_UPDATED') {
            console.log('[RealtimeSync] BroadcastChannel message received:', event.data);
            window.dispatchEvent(new CustomEvent('remote_data_updated', { detail: event.data }));
          }
        };
      } catch (e) {}
    }

    if (typeof window !== 'undefined') {


      // Mobile lifecycle & foreground wake-up listeners (AppState / Visibility / Pageshow)
      const handleWakeup = (e: Event) => {
        console.log(`[RealtimeSync] Lifecycle wake-up trigger: ${e.type}, document.hidden: ${document.hidden}`);
        if (document.visibilityState === 'visible' || !document.hidden) {
          if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.log('[RealtimeSync] Reconnecting socket on app foregrounding...');
            this.connect(this.activeUserEmail || undefined, this.activeBudgetId || undefined);
          }
          // Notify app to perform foreground refetch
          window.dispatchEvent(new CustomEvent('remote_data_updated', { detail: { reason: 'foreground_wakeup', event: e.type } }));
        }
      };

      document.addEventListener('visibilitychange', handleWakeup);
      window.addEventListener('pageshow', handleWakeup);
      window.addEventListener('focus', handleWakeup);
      window.addEventListener('online', () => {
        this.setStatus('connected');
        handleWakeup(new Event('online'));
      });
      window.addEventListener('offline', () => {
        this.setStatus('disconnected');
      });
      window.addEventListener('resume' as any, handleWakeup); // Cordova/Capacitor/React Native Webview bridge
    }
  }

  public getStatus(): SyncConnectionStatus {
    return this.status;
  }

  public onStatusChange(callback: (status: SyncConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private setStatus(newStatus: SyncConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      console.log(`[RealtimeSync Status] Changed to: ${newStatus}`);
      this.statusListeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (e) {}
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync_status_changed', { detail: { status: newStatus } }));
      }
    }
  }

  connect(userEmail?: string, budgetId?: string) {
    if (userEmail) this.activeUserEmail = userEmail.trim().toLowerCase();
    if (budgetId) this.activeBudgetId = budgetId;

    if (typeof window === 'undefined') return;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.socket = new WebSocket(wsUrl);
      this.socket.onopen = () => {
        this.setStatus('connected');
        if (this.activeUserEmail) {
          this.sendMessage('REGISTER', { email: this.activeUserEmail, budgetId: this.activeBudgetId });
        }
      };
      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleIncomingMessage(msg);
        } catch (e) {}
      };
      this.socket.onclose = () => {
        this.setStatus('disconnected');
        this.socket = null;
        this.scheduleReconnect();
      };
      this.socket.onerror = () => {
        this.setStatus('error');
      };
    } catch (e) {
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[RealtimeSync] Attempting scheduled reconnection...');
      this.connect(this.activeUserEmail || undefined, this.activeBudgetId || undefined);
    }, 2500);
  }

  private handleIncomingMessage(msg: RealtimeMessage) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'DATA_UPDATED':
        if (msg.payload?.deletedId) {
          StorageService.markAsDeleted(
            msg.payload.deletedId,
            msg.payload.userId || msg.payload.rawUserId,
            msg.payload.deletedType
          );
        }
        window.dispatchEvent(new CustomEvent('remote_data_updated', { detail: msg.payload }));
        break;
      case 'PORTFOLIO_UPDATED':
        if (msg.payload?.deletedId) {
          PortfolioStorageService.markPortfolioItemAsDeleted(
            msg.payload.deletedId,
            msg.payload.deletedType || 'assets',
            msg.payload.userId || msg.payload.rawUserId
          );
        }
        window.dispatchEvent(new CustomEvent('portfolio_updated', { detail: msg.payload }));
        break;
      case 'BUDGET_GOALS_UPDATED':
        window.dispatchEvent(new CustomEvent('budget_goals_updated', { detail: msg.payload }));
        window.dispatchEvent(new CustomEvent('remote_data_updated', { detail: msg.payload }));
        break;
      case 'NOTIFICATIONS_UPDATED':
        window.dispatchEvent(new CustomEvent('notifications_updated', { detail: msg.payload }));
        break;
      case 'SHARED_BUDGET_UPDATED':
        window.dispatchEvent(new CustomEvent('shared_budget_updated', { detail: msg.payload }));
        window.dispatchEvent(new CustomEvent('remote_data_updated', { detail: msg.payload }));
        break;
      case 'USER_UPDATED':
        window.dispatchEvent(new CustomEvent('user_profile_updated', { detail: msg.payload }));
        break;
      case 'GAMIFICATION_UPDATED':
        window.dispatchEvent(new CustomEvent('gamification_updated_event', { detail: msg.payload?.state || msg.payload }));
        break;
      case 'USER_DELETED':
        window.dispatchEvent(new CustomEvent('user_deleted_event', { detail: msg.payload }));
        break;
      case 'SESSION_REVOKED':
        window.dispatchEvent(new CustomEvent('session_revoked_event', { detail: msg.payload }));
        break;
      case 'FORCE_DISCONNECT_ALL':
        window.dispatchEvent(new CustomEvent('user_deleted_event', { detail: { all: true } }));
        break;
      default:
        break;
    }
  }

  sendMessage(type: string, payload?: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify({ type, payload }));
      } catch (e) {
        console.warn('[RealtimeSync] Send error:', e);
      }
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type, payload });
      } catch (e) {}
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {}
      this.socket = null;
    }
    this.isConnecting = false;
    this.setStatus('disconnected');
  }
}

export const realtimeSync = new RealtimeSyncService();
