import { useMe } from '../App';
import { useT } from '../i18n';
import { CheckIn } from './CheckIn';
import { ChatList } from './ChatList';

export function StudentHome() {
  const t = useT();
  const { me, logout } = useMe();
  return (
    <>
      <header className="topbar">
        <h1>
          {me.user.name}
          <span className="sub">{[me.hostel?.name, me.campus.name].filter(Boolean).join(' · ')}</span>
        </h1>
        <button className="btn ghost" onClick={logout}>{t.logOut}</button>
      </header>
      <main className="page">
        <CheckIn />
        <div className="section-title">{t.chats}</div>
        <ChatList />
      </main>
    </>
  );
}
