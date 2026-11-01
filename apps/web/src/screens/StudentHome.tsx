import { useMe } from '../App';
import { useT } from '../i18n';
import { CheckIn } from './CheckIn';
import { ChatList } from './ChatList';

export function StudentHome() {
  const t = useT();
  const { me } = useMe();
  const first = me.user.name.split(/\s+/)[0];
  return (
    <div className="page">
      <h1 className="page-title">
        {t.hello} {first}
      </h1>
      <CheckIn />
      <div className="section-title">{t.chats}</div>
      <ChatList />
    </div>
  );
}
