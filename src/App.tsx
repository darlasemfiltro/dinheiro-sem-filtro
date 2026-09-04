// Background sync with Appwrite / storage
    const initAuthBackground = async () => {
      try {
        let appwriteUserActive: any = null;

        // 1. Se veio com parâmetros de OAuth, troca o token
        if (oauthUserId && oauthSecret) {
          try {
            await appwriteCompleteOAuthSession(oauthUserId, oauthSecret);
          } catch (e) {
            console.warn('[OAuth session exchange error]', e);
          }
        }

        // 2. Busca o usuário real logado na sessão ativa do Appwrite
        try {
          appwriteUserActive = await getAppwriteUser();
        } catch (err) {
          console.warn('[Appwrite User Fetch Error]', err);
        }

        if (appwriteUserActive?.email) {
          const email = appwriteUserActive.email.trim().toLowerCase();
          const name = appwriteUserActive.name || email.split('@')[0];
          const avatar = appwriteUserActive?.prefs?.avatar;

          // Limpa tokens da URL mantendo o endereço limpo
          window.history.replaceState({}, document.title, window.location.pathname);
          localStorage.removeItem('darla_explicit_logout');
          localStorage.removeItem('darla_oauth_pending');

          const synced = await StorageService.ensureUserAndDataSyncedAsync(
            email,
            undefined,
            name,
            avatar,
            'google'
          );

          if (synced && mounted) {
            localStorage.setItem('darla_current_user', JSON.stringify(synced));
            setCurrentUser(synced);
            refreshData(synced, true);
          }
        } else if (!savedUserInitial || !savedUserInitial.email) {
          // Se não há sessão ativa real no Appwrite nem no Storage, desloga para tela de login
          setCurrentUser(null);
          setIsAuthLoading(false);
        }
      } catch (e) {
        console.warn('[OAuth initAuth background error]', e);
      }
    };
