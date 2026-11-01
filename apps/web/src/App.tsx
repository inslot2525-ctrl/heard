import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError, session, type Me } from './api';
import { connectChat, disconnectChat } from './chat-client';
import { LangContext } from './i18n';
import { go, useRoute } from './router';
import { ChatScreen } from './screens/ChatScreen';
import { FlagScreen } from './screens/FlagScreen';
import { MentorHome } from './screens/MentorHome';
import { StudentHome } from './screens/StudentHome';
import { WardenHome } from './screens/WardenHome';
import { Welcome } from './screens/Welcome';
import { SpikeLab } from './SpikeLab';

interface MeState {
  me: Me;
  refresh: () => Promise<void>;
  logout: () => void;
}
const MeContext = createContext<MeState | null>(null);
export const useMe = () => useContext(MeContext)!;

export function App() {
  const route = useRoute();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(Boolean(session.get()));
  const [chatError, setChatError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session.get()) return setMe(null);
    try {
      setMe(await api<Me>('/auth/me'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!me) return;
    connectChat(me.user.id).catch((e) => setChatError(String(e)));
  }, [me]);

  const logout = useCallback(() => {
    session.clear();
    void disconnectChat();
    setMe(null);
    go();
  }, []);

  if (route[0] === 'lab') return <SpikeLab />;
  if (loading) return <div className="app"><div className="page center muted">…</div></div>;
  if (!me) return <Welcome onLoggedIn={refresh} initialCode={route[0] === 'join' ? route[1] : undefined} />;

  let screen;
  if (route[0] === 'chat') screen = <ChatScreen route={route.slice(1)} />;
  else if (route[0] === 'flag' && route[1]) screen = <FlagScreen flagId={route[1]} />;
  else if (me.user.role === 'student') screen = <StudentHome />;
  else if (me.user.role === 'mentor') screen = <MentorHome tab={route[0] === 'chats' ? 'chats' : 'inbox'} />;
  else screen = <WardenHome />;

  return (
    <MeContext.Provider value={{ me, refresh, logout }}>
      <LangContext.Provider value={me.user.lang}>
        <div className="app">
          {chatError && <div className="status error">Chat unavailable: {chatError}</div>}
          {screen}
        </div>
      </LangContext.Provider>
    </MeContext.Provider>
  );
}
