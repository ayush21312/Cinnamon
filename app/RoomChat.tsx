'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, ChevronDown, Send } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import type { ChatMessage, Reply } from '../lib/types';

export default function RoomChat({
  socket,
  code,
  me,
  connected,
  open,
  onToggle,
}: {
  socket: Socket | null;
  code: string;
  me: string;
  connected: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState(''),
    [error, setError] = useState('');
  const [sending, setSending] = useState(false),
    [unread, setUnread] = useState(0);
  const openRef = useRef(open),
    stick = useRef(true),
    list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    openRef.current = open;
    if (open) setUnread(0);
  }, [open]);
  useEffect(() => {
    if (!socket) return;
    let active = true;
    function receive(message: ChatMessage) {
      setMessages((current) => [...current.filter((m) => m.id !== message.id), message].slice(-50));
      if (!openRef.current && message.playerId !== me) setUnread((count) => count + 1);
    }
    function history() {
      socket!.timeout(5000).emit('chat:history', {}, (err: Error | null, reply: Reply) => {
        if (!active || err || !reply?.ok) return;
        setMessages((current) =>
          [...new Map([...(reply.messages ?? []), ...current].map((m) => [m.id, m])).values()]
            .sort((a, b) => a.at - b.at)
            .slice(-50),
        );
      });
    }
    socket.on('chat:message', receive);
    socket.on('connect', history);
    if (socket.connected) history();
    return () => {
      active = false;
      socket.off('chat:message', receive);
      socket.off('connect', history);
    };
  }, [socket, code, me]);
  useEffect(() => {
    if (open && list.current && stick.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages, open]);
  function send(event: FormEvent) {
    event.preventDefault();
    if (!socket?.connected || sending || !text.trim()) return;
    setSending(true);
    setError('');
    socket.timeout(5000).emit('chat:send', { text }, (err: Error | null, reply: Reply) => {
      setSending(false);
      if (err || !reply?.ok) {
        setError(
          err
            ? 'Message could not be sent. Try again.'
            : (reply.error ?? 'Message could not be sent.'),
        );
        return;
      }
      setText('');
      stick.current = true;
    });
  }
  return (
    <aside className={`room-chat ${open ? 'is-open' : ''}`} aria-label="Room chat">
      <button
        className="chat-toggle"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="room-chat-body"
      >
        <MessageCircle size={17} />
        <span>Chat</span>
        {!open && unread > 0 && (
          <span className="chat-unread" aria-label={`${unread} unread messages`}>
            {Math.min(unread, 99)}
          </span>
        )}
        <ChevronDown size={17} className="chat-chevron" aria-hidden="true" />
      </button>
      <div id="room-chat-body" className="chat-body" aria-hidden={!open} inert={!open}>
        <div
          className="chat-messages"
          ref={list}
          role="log"
          aria-label="Messages"
          aria-live={open ? 'polite' : 'off'}
          aria-relevant="additions"
          onScroll={() => {
            const el = list.current;
            if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
        >
          {messages.length === 0 && (
            <p className="chat-empty">Messages are visible to everyone in this room.</p>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message ${message.playerId === me ? 'own-message' : ''}`}
            >
              <strong>
                {message.name}
                <small>{message.playerId === me ? ' · you' : ''}</small>
              </strong>
              <p>{message.text}</p>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="chat-compose">
          <input
            aria-label="Chat message"
            placeholder={connected ? 'Message the room…' : 'Reconnecting…'}
            maxLength={200}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError('');
            }}
            disabled={!connected || sending}
            autoComplete="off"
          />
          <button aria-label="Send message" disabled={!connected || sending || !text.trim()}>
            <Send size={16} />
          </button>
        </form>
        {error && (
          <p className="chat-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </aside>
  );
}
