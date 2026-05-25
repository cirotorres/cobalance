import { useState, useRef, useEffect } from 'react';
import styles from './AgenteTab.module.css';
import conexaoAgente from '../../../services/agenteService';
import quickPrompts from './quickPrompts';
import useVoiceInput from '../../../components/Speech/Speech'

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function MicrophoneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      
      <path d="M5 10a7 7 0 0 0 14 0" />
      
      <line x1="12" y1="17" x2="12" y2="22" />
      
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

  function StopIcon() {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <rect x="4" y="4" width="16" height="16" rx="2" />
      </svg>
    );
  }

function formatAgentReply(data) {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'object' && typeof data.message === 'string') {
    return data.message;
  }
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}


const agentVersion = "1.0"


function AgenteTab({ messages, setMessages, input, setInput }) {
  const [isThinking, setIsThinking] = useState(false);

  const { startListening, stopListening, isListening } = useVoiceInput({setInput});

  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      const data = await conexaoAgente(trimmed);
      const agentMsg = {
        id: `a-${Date.now()}`,
        role: 'agent',
        content: formatAgentReply(data),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (error) {
      console.error(error);
      const errMsg = {
        id: `e-${Date.now()}`,
        role: 'agent',
        content: `${error.message}`,
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleClear = () => {
    if (isThinking) return;
    setMessages([]);
  };

  const isEmpty = messages.length === 0;
  const canSend = input.trim().length > 0 && !isThinking;

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10}}>
          <h2 className={styles.title}>Agente</h2>
          <span style={{color: 'grey'}}>{agentVersion}</span>
        </div>
        <button
          type="button"
          className={styles.clearBtn}
          onClick={handleClear}
          disabled={isEmpty || isThinking}
          aria-label="Limpar conversa"
          title="Limpar conversa"
        >
          <TrashIcon />
        </button>
      </div>

      <div className={styles.chat} ref={listRef}>
        {isEmpty ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Como posso ajudar?</p>
            <p className={styles.emptyText}>
              Pergunte algo ou escolha uma sugestão abaixo.
            </p>
            <div className={styles.chips}>
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className={styles.chip}
                  onClick={() => send(prompt)}
                  disabled={isThinking}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className={styles.messages}>
            {messages.map((msg) => (
              <li
                key={msg.id}
                className={`${styles.bubbleRow} ${
                  msg.role === 'user' ? styles.rowUser : styles.rowAgent
                }`}
              >
                <div
                  className={`${styles.bubble} ${
                    msg.role === 'user' ? styles.bubbleUser : styles.bubbleAgent
                  } ${msg.isError ? styles.bubbleError : ''}`}
                >
                  <pre className={styles.bubbleContent}>{msg.content}</pre>
                </div>
              </li>
            ))}
            {isThinking && (
              <li className={`${styles.bubbleRow} ${styles.rowAgent}`}>
                <div className={`${styles.bubble} ${styles.bubbleAgent}`}>
                  <span className={styles.typing}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </div>
              </li>
            )}
          </ul>
        )}
      </div>

      <form className={styles.composer} onSubmit={handleSubmit}>
        <textarea
          className={styles.input}
          placeholder="Escreva uma mensagem..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isThinking}
        />

        <button
          type="button"
          className={`${styles.sendBtn} ${isListening ? styles.sendBtnActive : ""}`}
          onClick={isListening ? stopListening : startListening}
        >
          {isListening ? <StopIcon /> : <MicrophoneIcon />}
        </button>
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={!canSend}
          aria-label="Enviar mensagem"
        >
          <SendIcon />
        </button>
      </form>
    </section>
  );
}

export default AgenteTab;
