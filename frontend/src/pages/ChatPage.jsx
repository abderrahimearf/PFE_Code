 import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Bot,
  User,
  Send,
  BarChart3,
  LineChart,
  PieChart,
  ScatterChart,
  CircleDot,
  ChevronDown,
  Sparkles,
  Download,
  GripVertical,
  Eye,
  EyeOff,
  RefreshCw // Ajout de l'icône de rafraîchissement
} from 'lucide-react';
import { useConversations } from '../hooks/useConversations';
import SqlCard from '../components/SqlCard';
import Sidebar from '../components/Sidebar';
import Header from '../layout/Header';
import './ChatPage.css';

const API_BASE = 'http://localhost:8000/api';

const STARTER_PROMPTS = [
  'Posez une question sur votre base de données',
  'Analyse des comptes par pays de résidence',
  'Quels sont les clients les plus actifs ?',
];

const CHART_TYPES = [
  { value: 'bar', label: 'Barres', icon: BarChart3 },
  { value: 'line', label: 'Lignes', icon: LineChart },
  { value: 'pie', label: 'Circulaire', icon: PieChart },
  { value: 'scatter', label: 'Nuage', icon: ScatterChart },
  { value: 'bubble', label: 'Bulles', icon: CircleDot },
];

// -------------------- UTILS --------------------
const truncate = (text, max = 38) =>
  !text ? '' : text.length > max ? `${text.slice(0, max)}...` : text;

const isNumericValue = (val) =>
  val !== null &&
  val !== undefined &&
  val !== '' &&
  !Number.isNaN(Number(val));

const normalizeResult = (rawResult) => {
  const data = Array.isArray(rawResult?.data) ? rawResult.data : [];
  const columns =
    rawResult?.columns && Array.isArray(rawResult.columns)
      ? rawResult.columns
      : data.length > 0
        ? Object.keys(data[0])
        : [];

  return {
    success: Boolean(rawResult?.success),
    data,
    columns,
    row_count:
      typeof rawResult?.row_count === 'number'
        ? rawResult.row_count
        : data.length,
    error: rawResult?.error || null,
    details: rawResult?.details || null,
  };
};

const getColumnType = (data, col) => {
  if (!data?.length) return 'string';
  const sample = data.find(
    (row) => row[col] !== null && row[col] !== undefined && row[col] !== ''
  );
  return sample && isNumericValue(sample[col]) ? 'number' : 'string';
};

const getNumericColumns = (result) =>
  (result?.columns || []).filter((col) => getColumnType(result?.data, col) === 'number');

const exportToExcel = (result) => {
  if (!result || !result.data?.length) return;

  const SEP = ';';
  const headerLine = `sep=${SEP}`;
  const columns = result.columns.join(SEP);

  const rows = result.data.map((row) =>
    result.columns
      .map((col) => {
        let value = row[col] ?? '';
        return `"${String(value).replace(/"/g, '""').replace(/;/g, ' ')}"`;
      })
      .join(SEP)
  );

  const csvContent = '\uFEFF' + [headerLine, columns, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `export_donnees_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const buildChartPoints = (result, xKey, yKey, zKey = null) => {
  if (!result?.data?.length || !xKey || !yKey) return [];

  return result.data
    .map((row, index) => ({
      x: row[xKey] ?? `Ligne ${index + 1}`,
      y: Number(row[yKey]),
      z: zKey ? Number(row[zKey]) : 1,
      label: row[xKey],
    }))
    .filter((item) => !Number.isNaN(item.y));
};

const getDefaultChartConfig = (result) => {
  const columns = result?.columns || [];
  const numericColumns = getNumericColumns(result);

  const xColumn =
    columns.find((c) => getColumnType(result.data, c) === 'string') ||
    columns[0] ||
    '';

  const yColumn = numericColumns[0] || '';
  const zColumn = numericColumns[1] || numericColumns[0] || '';

  return {
    enabled: Boolean(result?.data?.length && xColumn && yColumn),
    type: 'bar',
    xColumn,
    yColumn,
    zColumn,
  };
};

// -------------------- SSE POST HELPER --------------------
async function streamGenerateQuery({ question, threadId, onEvent }) {
  const response = await fetch(`${API_BASE}/query/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      question,
      thread_id: threadId,
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(txt || `Erreur HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Le navigateur ne supporte pas le streaming.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const evt of events) {
      const lines = evt.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr);
            onEvent?.(parsed);
          } catch (e) {
            console.error('Erreur parsing SSE:', e, jsonStr);
          }
        }
      }
    }
  }
}

// -------------------- CHART COMPONENTS --------------------
const ChartAxes = ({ width, height, padding, maxY }) => (
  <g className="chart-axes">
    <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#ccc" strokeWidth="1" />
    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#ccc" strokeWidth="1" />
    {[0, 0.5, 1].map((p, i) => (
      <text key={i} x={padding - 10} y={height - padding - p * (height - padding * 2)} fontSize="10" textAnchor="end" fill="#999">
        {Math.round(maxY * p)}
      </text>
    ))}
  </g>
);

const SimpleBarChart = ({ data, xKey, yKey }) => {
  const points = buildChartPoints(data, xKey, yKey);
  if (!points.length) return <div className="chart-empty">Données non chargées. Cliquez sur "Exécuter".</div>;

  const max = Math.max(...points.map((p) => p.y), 1);

  return (
    <div className="mini-chart bar-chart">
      <div className="bar-chart-grid">
        {points.slice(0, 20).map((item, index) => (
          <div className="bar-item" key={index}>
            <div className="bar-fill" style={{ height: `${Math.max((item.y / max) * 150, 5)}px` }} title={`${item.x}: ${item.y}`} />
            <span className="bar-value">{item.y}</span>
            <span className="bar-label">{truncate(String(item.x), 10)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SimpleLineChart = ({ data, xKey, yKey }) => {
  const points = buildChartPoints(data, xKey, yKey);
  if (points.length < 2) return <div className="chart-empty">Au moins 2 points requis.</div>;

  const width = 600;
  const height = 250;
  const padding = 40;
  const limitedPoints = points.slice(0, 30);
  const maxY = Math.max(...limitedPoints.map((p) => p.y), 1);

  const svgPoints = limitedPoints.map((p, i) => ({
    sx: padding + (i * (width - padding * 2)) / (Math.max(limitedPoints.length - 1, 1)),
    sy: height - padding - (p.y / maxY) * (height - padding * 2),
  }));

  const pathD = svgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.sx} ${p.sy}`).join(' ');

  return (
    <div className="mini-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        <ChartAxes width={width} height={height} padding={padding} maxY={maxY} />
        <path d={pathD} fill="none" stroke="#0d5395" strokeWidth="2" />
        {svgPoints.map((p, i) => (
          <circle key={i} cx={p.sx} cy={p.sy} r="4" fill="#0d5395" />
        ))}
      </svg>
    </div>
  );
};

const SimpleScatterBubble = ({ data, xKey, yKey, zKey, isBubble }) => {
  const points = buildChartPoints(data, xKey, yKey, zKey);
  const width = 600;
  const height = 250;
  const padding = 40;

  if (!points.length) return <div className="chart-empty">Données insuffisantes.</div>;

  const limitedPoints = points.slice(0, 50);
  const maxY = Math.max(...limitedPoints.map((p) => p.y), 1);
  const maxZ = Math.max(...limitedPoints.map((p) => p.z), 1);

  return (
    <div className="mini-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        <ChartAxes width={width} height={height} padding={padding} maxY={maxY} />
        {limitedPoints.map((p, i) => {
          const cx = padding + (i * (width - padding * 2)) / (Math.max(limitedPoints.length - 1, 1));
          const cy = height - padding - (p.y / maxY) * (height - padding * 2);
          const radius = isBubble ? Math.max((p.z / maxZ) * 20, 4) : 5;
          return (
            <circle key={i} cx={cx} cy={cy} r={radius} fill="#0d5395" opacity="0.6" stroke="#0d5395">
              <title>{`${p.label}: Y=${p.y}${zKey ? `, Z=${p.z}` : ''}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
};

const SimplePieChart = ({ data, xKey, yKey }) => {
  const points = buildChartPoints(data, xKey, yKey);
  const total = points.reduce((acc, cur) => acc + cur.y, 0);

  if (total <= 0) return <div className="chart-empty">Valeurs nulles.</div>;

  const palette = ['#0f4c81', '#2c7fb8', '#38bdf8', '#14b8a6', '#22c55e', '#f59e0b'];
  let currentAngle = 0;

  const gradient = points
    .slice(0, 6)
    .map((p, i) => {
      const start = currentAngle;
      currentAngle += (p.y / total) * 360;
      return `${palette[i % palette.length]} ${start}deg ${currentAngle}deg`;
    })
    .join(', ');

  return (
    <div className="mini-chart pie-chart-wrap">
      <div className="pie-chart-circle" style={{ background: `conic-gradient(${gradient})` }} />
      <div className="pie-legend">
        {points.slice(0, 6).map((p, i) => (
          <div key={i} className="legend-item">
            <span className="dot" style={{ background: palette[i % palette.length] }} />
            <span className="label">{truncate(String(p.x), 12)}: <strong>{p.y}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChartRenderer = ({ chartType, result, config }) => {
  if (!result?.data?.length) return <div className="chart-empty" style={{padding: '20px', textAlign: 'center'}}>Aucune donnée en mémoire.</div>;

  const props = {
    data: result,
    xKey: config.xColumn,
    yKey: config.yColumn,
    zKey: config.zColumn,
  };

  switch (chartType) {
    case 'bar': return <SimpleBarChart {...props} />;
    case 'line': return <SimpleLineChart {...props} />;
    case 'pie': return <SimplePieChart {...props} />;
    case 'scatter': return <SimpleScatterBubble {...props} isBubble={false} />;
    case 'bubble': return <SimpleScatterBubble {...props} isBubble={true} />;
    default: return <SimpleBarChart {...props} />;
  }
};

// -------------------- MAIN COMPONENT --------------------
const ChatPage = () => {
  const {
    conversations,
    setConversations,
    activeChatId,
    setActiveChatId,
    sidebarSettings,
    updateSidebarSetting,
  } = useConversations();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [prevMsgCount, setPrevMsgCount] = useState(0);
  const messagesEndRef = useRef(null);

  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeChatId) || conversations[0];
  }, [conversations, activeChatId]);

  const isConversationEmpty = !activeConversation?.messages?.length;

  // NOUVEAU CODE (Réglé)
  useEffect(() => {
  const currentMsgCount = activeConversation?.messages?.length || 0;
  
  // On ne scroll que si le nombre de messages a réellement augmenté 
  // (nouveau message envoyé ou reçu)
  if (currentMsgCount > prevMsgCount) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
  
  // On met à jour le compteur de messages
  setPrevMsgCount(currentMsgCount);
  
}, [activeConversation?.messages?.length]); // Retrait de 'loading' des dépendances

  const createNewChat = () => {
    const newId = `chat-${Date.now()}`;
    const newChat = {
      id: newId,
      title: 'Nouvelle conversation',
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setConversations((prev) => [newChat, ...prev]);
    setActiveChatId(newId);
    return newId;
  };

  const handleDragStart = (e, msg) => {
    const dragData = {
      result: msg.result,
      config: msg.chartConfig,
      title: activeConversation?.title || 'Dashboard',
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
  };

  const updateMessageInChat = (chatId, messageId, updater) => {
    setConversations((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: (chat.messages || []).map((msg) =>
                msg.id === messageId ? updater(msg) : msg
              ),
            }
          : chat
      )
    );
  };

  const handleSendMessage = async (forcedMessage) => {
    const userInput = (forcedMessage ?? input).trim();
    if (!userInput || loading) return;

    let targetChatId = activeChatId || (conversations.length > 0 ? conversations[0].id : null);
    if (!targetChatId) targetChatId = createNewChat();

    const now = new Date().toISOString();
    const userMsg = { id: `user-${Date.now()}`, role: 'user', content: userInput, createdAt: now };
    const botMsgId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const botPlaceholder = {
      id: botMsgId, role: 'bot', content: 'Initialisation...', sql: '', agentLogs: [],
      chartConfig: { enabled: false, type: 'bar' }, chartOpen: false, tableOpen: false,
      streaming: true, createdAt: now,
    };

    setConversations((prev) =>
      prev.map((chat) => {
        if (chat.id !== targetChatId) return chat;
        return {
          ...chat,
          title: (!chat.messages || chat.messages.length === 0 || chat.title === 'Nouvelle conversation')
            ? truncate(userInput) : chat.title,
          messages: [...(chat.messages || []), userMsg, botPlaceholder],
        };
      })
    );

    setInput('');
    setLoading(true);

    try {
      let lastStatus = 'Traitement...';
      let finalSql = '';
      await streamGenerateQuery({
        question: userInput,
        threadId: targetChatId,
        onEvent: (event) => {
          if (event?.error) {
            updateMessageInChat(targetChatId, botMsgId, (msg) => ({ ...msg, content: `Erreur : ${event.error}`, streaming: false }));
            return;
          }
          const agent = event?.agent || 'agent';
          const status = event?.status || 'Traitement...';
          const sql = event?.sql || '';
          lastStatus = status;
          if (sql) finalSql = sql;
          updateMessageInChat(targetChatId, botMsgId, (msg) => ({
            ...msg, content: status, sql: sql || msg.sql,
            agentLogs: [...(msg.agentLogs || []), { agent, status, at: new Date().toISOString() }],
          }));
        },
      });

      updateMessageInChat(targetChatId, botMsgId, (msg) => ({
        ...msg, content: finalSql ? 'Voici le SQL généré.' : lastStatus,
        sql: finalSql || msg.sql, streaming: false,
      }));
    } catch (err) {
      updateMessageInChat(targetChatId, botMsgId, (msg) => ({ ...msg, content: 'Erreur serveur.', streaming: false }));
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (messageId, sqlToExecute) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/database/execute`, { sql: sqlToExecute });
      const result = normalizeResult(response.data);
      if (!result.success) { alert(result.error); return; }

      setConversations((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                messages: chat.messages.map((msg) =>
                  msg.id === messageId ? { ...msg, result, chartConfig: getDefaultChartConfig(result), tableOpen: true } : msg
                ),
              } : chat
        )
      );
    } catch (err) { alert('Erreur SQL.'); } finally { setLoading(false); }
  };

  const updateChartConfig = (msgId, partial) => {
    setConversations((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? { ...chat, messages: chat.messages.map((m) => m.id === msgId ? { ...m, chartConfig: { ...m.chartConfig, ...partial } } : m) }
          : chat
      )
    );
  };

  const toggleTable = (msgId) => {
    setConversations((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? { ...chat, messages: chat.messages.map((m) => m.id === msgId ? { ...m, tableOpen: !m.tableOpen } : m) }
          : chat
      )
    );
  };

  const toggleChart = (msgId) => {
    setConversations((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? { ...chat, messages: chat.messages.map((m) => m.id === msgId ? { ...m, chartOpen: !m.chartOpen } : m) }
          : chat
      )
    );
  };

  return (
    <div className={`chatpage ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        isMobile={window.innerWidth <= 980}
        conversations={conversations}
        activeChatId={activeChatId}
        handleConversationSelect={setActiveChatId}
        createNewChat={createNewChat}
        sidebarSettings={sidebarSettings}
        updateSidebarSetting={updateSidebarSetting}
        formatDate={(d) => new Date(d).toLocaleDateString('fr-FR')}
        deleteConversation={(id) => setConversations((prev) => prev.filter((c) => c.id !== id))}
      />

      <main className="workspace">
        <Header setSidebarCollapsed={setSidebarCollapsed} activeConversationTitle={activeConversation?.title} />

        <div className="messages-area">
          <div className={`messages-wrap ${isConversationEmpty ? 'messages-wrap-empty' : ''}`}>
            {isConversationEmpty ? (
              <div className="home-empty-state">
                <div className="home-empty-icon"><Sparkles size={34} /></div>
                <h2 className="home-empty-title">Assistant Crédit du Maroc</h2>
                <div className="home-empty-prompts">
                  {STARTER_PROMPTS.map((p) => (
                    <button key={p} className="home-empty-prompt" onClick={() => handleSendMessage(p)}>{p}</button>
                  ))}
                </div>
              </div>
            ) : (
              activeConversation.messages.map((msg) => (
                <div key={msg.id} className="message-block">
                  <div className={`message-row ${msg.role}`}>
                    <div className={`avatar ${msg.role}`}>{msg.role === 'bot' ? <Bot size={18} /> : <User size={18} />}</div>
                    <div className="message-main">
                      <div className={`bubble ${msg.role}`}>
                        {msg.content}
                        {msg.streaming && <span style={{ marginLeft: 8 }}>⏳</span>}
                      </div>
                      {msg.sql && <SqlCard sql={msg.sql} onExecute={(val) => handleExecute(msg.id, val)} />}
                    </div>
                  </div>

                  {msg.result && (
                    <div className="result-panel">
                      <div className="result-panel-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="result-count"><strong>{msg.result.row_count}</strong> lignes</span>
                          <button className="table-toggle-btn" onClick={() => toggleTable(msg.id)}>
                            {msg.tableOpen ? <><EyeOff size={14} /> Masquer</> : <><Eye size={14} /> Voir</>}
                          </button>
                        </div>
                        <button className="download-btn" onClick={() => exportToExcel(msg.result)} disabled={!msg.result.data.length}>
                          <Download size={14} /> Exporter
                        </button>
                      </div>

                      <div className="result-panel-body">
                        {msg.tableOpen && (
                          <div className="data-table-shell">
                            {msg.result.data && msg.result.data.length > 0 ? (
                              <table>
                                <thead><tr>{msg.result.columns.map((c) => (<th key={c}>{c}</th>))}</tr></thead>
                                <tbody>
                                  {msg.result.data.map((row, i) => (
                                    <tr key={i}>{msg.result.columns.map((col) => (<td key={col}>{String(row[col] ?? '')}</td>))}</tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div style={{textAlign: 'center', padding: '20px'}}>
                                <p style={{fontSize: '13px', color: '#666', marginBottom: '10px'}}>Données volatiles purgées du LocalStorage.</p>
                                <button 
                                  onClick={() => handleExecute(msg.id, msg.sql)}
                                  style={{display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#0d5395', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
                                >
                                  <RefreshCw size={14} /> Recharger les données
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="chart-accordion">
                          <button className={`chart-expand-btn ${msg.chartOpen ? 'open' : ''}`} onClick={() => toggleChart(msg.id)}>
                            <div className="btn-content"><BarChart3 size={16} /> <span>Visualiser</span></div>
                            <ChevronDown size={18} className={`arrow-icon ${msg.chartOpen ? 'rotate' : ''}`} />
                          </button>

                          {msg.chartOpen && (
                            <div className="chart-panel-expanded" draggable onDragStart={(e) => handleDragStart(e, msg)}>
                              <div className="chart-toolbar">
                                <div className="select-group">
                                  <label>X</label>
                                  <select value={msg.chartConfig?.xColumn || ''} onChange={(e) => updateChartConfig(msg.id, { xColumn: e.target.value })}>
                                    {msg.result.columns.map((c) => (<option key={c} value={c}>{c}</option>))}
                                  </select>
                                </div>
                                <div className="select-group">
                                  <label>Y</label>
                                  <select value={msg.chartConfig?.yColumn || ''} onChange={(e) => updateChartConfig(msg.id, { yColumn: e.target.value })}>
                                    {getNumericColumns(msg.result).map((c) => (<option key={c} value={c}>{c}</option>))}
                                  </select>
                                </div>
                              </div>
                              <div className="chart-controls">
                                {CHART_TYPES.map((t) => (
                                  <button key={t.value} className={`chart-mini-btn ${msg.chartConfig?.type === t.value ? 'active' : ''}`} onClick={() => updateChartConfig(msg.id, { type: t.value })}>
                                    <t.icon size={14} /> {t.label}
                                  </button>
                                ))}
                              </div>
                              <ChartRenderer chartType={msg.chartConfig.type} result={msg.result} config={msg.chartConfig} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="composer">
          <div className="composer-inner">
            <div className="composer-box">
              <input type="text" placeholder="Posez votre question..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} />
              <button className="send-btn" onClick={() => handleSendMessage()} disabled={loading}><Send size={18} /></button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChatPage;