import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Wallet, TrendingUp, Target, ImageIcon, Trash2, Edit3, 
  Award, X, ListOrdered, Search, Info, Check, Activity 
} from 'lucide-react';

type ResultStatus = 'TP' | 'SL' | 'BE';

type Trade = {
  id: string;
  date: string;
  asset: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  stopLossPrice: number;
  leverage: number;
  margin: number;
  riskAmount: number;
  resultStatus: ResultStatus;
  pnl: number;
  rr: number;
  imagePaths?: string[];
};

const POPULAR_ASSETS = [
  'US30 / Dow Jones', 'NAS100 / NASDAQ', 'US500 / S&P 500', 'RUT / Russell 2000',
  'DAX40 (Almanya)', 'FTSE100 (İngiltere)', 'CAC40 (Fransa)', 'NIKKEI225 (Japonya)', 'HANG SENG (Hong Kong)',
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'USD/CHF',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'EUR/AUD', 'AUD/JPY', 'AUD/NZD', 'CAD/JPY', 'CHF/JPY',
  'EUR/CAD', 'EUR/CHF', 'EUR/NZD', 'GBP/AUD', 'GBP/CAD', 'GBP/CHF', 'GBP/NZD',
  'XAU/USD (Altın)', 'XAG/USD (Gümüş)', 'WTI/USD (Ham Petrol)', 'BRENT/USD (Brent Petrol)', 
  'XPT/USD (Platin)', 'XPD/USD (Paladyum)', 'NATGAS (Doğalgaz)', 'COPPER (Bakır)',
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT', 'XRP/USDT', 'DOGE/USDT', 
  'PEPE/USDT', 'RENDER/USDT', 'SUI/USDT', 'NEAR/USDT', 'ADA/USDT', 'DOT/USDT',
  'LINK/USDT', 'MATIC/USDT', 'SHIB/USDT', 'FET/USDT', 'APT/USDT', 'AR/USDT'
];

export default function App() {
  const [balance, setBalance] = useState<number>(() => {
    const saved = localStorage.getItem('trade_balance');
    return saved ? Number(saved) : 2000;
  });

  const [trades, setTrades] = useState<Trade[]>(() => {
    const saved = localStorage.getItem('trade_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [form, setForm] = useState({ 
    asset: 'XAG/USD (Gümüş)', 
    type: 'LONG' as 'LONG' | 'SHORT', 
    entry: 0, 
    exit: 0, 
    stopLoss: 0, 
    leverage: 20, 
    riskPercent: 1, 
    resultStatus: 'TP' as ResultStatus, 
    rr: '2.0' 
  });

  const [assetSearch, setAssetSearch] = useState('XAG/USD (Gümüş)');
  const [isAssetDropdownOpen, setIsAssetDropdownOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeModalImage, setActiveModalImage] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [isHoveringImageDrop, setIsHoveringImageDrop] = useState(false);

  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [newBalanceInput, setNewBalanceInput] = useState(balance.toString());

  const tradeRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem('trade_balance', balance.toString());
    localStorage.setItem('trade_history', JSON.stringify(trades));
  }, [balance, trades]);

  const handleImageAdd = useCallback((file: File) => {
    const imageUrl = URL.createObjectURL(file);
    setSelectedImages(prev => [...prev, imageUrl]);
  }, []);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isHoveringImageDrop) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) handleImageAdd(file);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isHoveringImageDrop, handleImageAdd]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAssetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tradeDetails = useMemo(() => {
    if (!form.entry || !form.stopLoss || form.entry === form.stopLoss) {
      return { margin: 0, pnl: 0, riskAmount: 0 };
    }

    const riskAmount = balance * (form.riskPercent / 100); 
    const entryToStopPercent = Math.abs(form.entry - form.stopLoss) / form.entry;
    const positionSizeUSD = entryToStopPercent > 0 ? riskAmount / entryToStopPercent : 0;
    const requiredMargin = form.leverage > 0 ? positionSizeUSD / form.leverage : 0;

    let pnl = 0;
    if (form.resultStatus === 'SL') {
      pnl = -riskAmount;
    } else if (form.resultStatus === 'BE') {
      pnl = 0;
    } else {
      if (form.exit > 0) {
        const rewardDistancePercent = form.type === 'LONG' 
          ? (form.exit - form.entry) / form.entry 
          : (form.entry - form.exit) / form.entry;
        pnl = positionSizeUSD * rewardDistancePercent;
      }
    }

    return { margin: requiredMargin, pnl, riskAmount };
  }, [balance, form]);

  const handleSaveTrade = (e: React.FormEvent) => {
    e.preventDefault();
    const { pnl, margin, riskAmount } = tradeDetails;
    const numericRR = form.rr === '' ? 0 : Number(form.rr);
    
    if (editingId) {
      const oldTrade = trades.find(t => t.id === editingId);
      if (!oldTrade) return;

      const balanceDiff = pnl - oldTrade.pnl;
      setBalance(prev => prev + balanceDiff);

      setTrades(trades.map(t => t.id === editingId ? {
        ...t,
        asset: form.asset,
        type: form.type,
        entryPrice: form.entry,
        exitPrice: form.exit,
        stopLossPrice: form.stopLoss,
        leverage: form.leverage,
        margin,
        riskAmount,
        resultStatus: form.resultStatus,
        pnl,
        rr: numericRR,
        imagePaths: selectedImages.length > 0 ? selectedImages : t.imagePaths
      } : t));

      setEditingId(null);
    } else {
      const newTrade: Trade = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        asset: form.asset,
        type: form.type,
        entryPrice: form.entry,
        exitPrice: form.exit,
        stopLossPrice: form.stopLoss,
        leverage: form.leverage,
        margin,
        riskAmount,
        resultStatus: form.resultStatus,
        pnl,
        rr: numericRR,
        imagePaths: selectedImages.length > 0 ? selectedImages : undefined
      };

      setTrades([newTrade, ...trades]);
      setBalance(prev => prev + pnl);
    }

    setForm({ asset: 'XAG/USD (Gümüş)', type: 'LONG', entry: 0, exit: 0, stopLoss: 0, leverage: 20, riskPercent: 1, resultStatus: 'TP', rr: '2.0' });
    setSelectedImages([]);
    setAssetSearch('XAG/USD (Gümüş)');
  };

  const handleEditClick = (trade: Trade) => {
    setEditingId(trade.id);
    setForm({
      asset: trade.asset,
      type: trade.type,
      entry: trade.entryPrice,
      exit: trade.exitPrice,
      stopLoss: trade.stopLossPrice || 0,
      leverage: trade.leverage,
      riskPercent: trade.riskAmount ? (trade.riskAmount / balance) * 100 : 1,
      resultStatus: trade.resultStatus || 'TP',
      rr: trade.rr.toString()
    });
    setAssetSearch(trade.asset);
    setSelectedImages(trade.imagePaths || []);
  };

  const handleDeleteTrade = (id: string) => {
    const tradeToDelete = trades.find(t => t.id === id);
    if (!tradeToDelete) return;

    setBalance(prev => prev - tradeToDelete.pnl);
    setTrades(trades.filter(t => t.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm({ asset: 'XAG/USD (Gümüş)', type: 'LONG', entry: 0, exit: 0, stopLoss: 0, leverage: 20, riskPercent: 1, resultStatus: 'TP', rr: '2.0' });
      setAssetSearch('XAG/USD (Gümüş)');
    }
  };

  const handleJumpToTrade = (id: string) => {
    const element = tradeRefs.current[id];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(id);
      setTimeout(() => setHighlightedId(null), 2000);
    }
  };

  const filteredAssets = useMemo(() => {
    return POPULAR_ASSETS.filter(item => item.toLowerCase().includes(assetSearch.toLowerCase()));
  }, [assetSearch]);

  const stats = useMemo(() => {
    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const winRate = trades.length > 0 ? ((winningTrades / trades.length) * 100).toFixed(1) : '0.0';
    const totalProfit = trades.reduce((sum, t) => sum + t.pnl, 0).toFixed(2);
    const totalRR = trades.reduce((sum, t) => sum + t.rr, 0).toFixed(2);
    return { winRate, totalProfit, totalRR };
  }, [trades]);

  const chartData = useMemo(() => {
    let initialBase = balance - trades.reduce((acc, t) => acc + t.pnl, 0);
    const historyArr = [initialBase];
    let currentStepVal = initialBase;
    
    trades.slice().reverse().forEach(t => {
      currentStepVal += t.pnl;
      historyArr.push(currentStepVal);
    });

    const maxBal = Math.max(...historyArr, initialBase + 1000);
    const minBal = Math.min(...historyArr, initialBase - 1000);
    const range = maxBal - minBal || 1;

    const coords = historyArr.map((bal, idx) => {
      const x = 60 + (idx / (historyArr.length - 1 || 1)) * 320;
      const y = 15 + ((maxBal - bal) / range) * 105;
      return { x, y, bal };
    });

    return {
      points: coords.map(c => `${c.x},${c.y}`).join(' '),
      coords,
      initialBase
    };
  }, [balance, trades]);

  const getStatusColor = (status: ResultStatus) => {
    if (status === 'TP') return '#38bdf8';
    if (status === 'SL') return '#f43f5e';
    return '#f59e0b';
  };

  const inputStyle = {
    flex: 1,
    padding: '11px 14px',
    borderRadius: '10px',
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#f8fafc',
    fontSize: '0.9em',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s'
  };

  return (
    <div style={{ padding: '28px', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#0b1329', color: '#f8fafc', minHeight: '100vh', boxSizing: 'border-box' }}>
      
      {/* HEADER / MARKA ALANI */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', padding: '10px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)', display: 'flex' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18"/>
              <path d="m19 9-5 5-4-4-3 3"/>
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.2em', fontWeight: '800', letterSpacing: '0.5px', background: 'linear-gradient(to right, #60a5fa, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              LACIVERT<span style={{ color: '#f8fafc', WebkitTextFillColor: '#f8fafc' }}>FX</span> JOURNAL
            </h1>
            <span style={{ fontSize: '0.7em', color: '#64748b', fontWeight: '600', letterSpacing: '1px' }}>PRO TRADING TERMINAL</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1e293b', padding: '6px 14px', borderRadius: '20px', border: '1px solid #334155' }}>
          <Activity size={14} color="#38bdf8"/>
          <span style={{ fontSize: '0.75em', color: '#94a3b8', fontWeight: '600' }}>Sistem Aktif</span>
        </div>
      </div>

      {/* ÜST İSTATİSTİK KARTLARI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', marginBottom: '28px' }}>
        <div style={{ padding: '20px', background: '#0f172a', borderRadius: '14px', border: '1px solid #1e293b', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#94a3b8', fontSize: '0.8em', fontWeight: '600', textTransform: 'uppercase' }}>
              <Wallet size={15} color="#38bdf8"/> Kasa (Demo)
            </h3>
            <button 
              onClick={() => { setIsEditingBalance(!isEditingBalance); setNewBalanceInput(balance.toString()); }}
              style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: '2px' }}
              title="Kasayı Düzenle"
            >
              <Edit3 size={14} />
            </button>
          </div>

          {isEditingBalance ? (
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
              <input 
                type="number" 
                value={newBalanceInput} 
                onChange={e => setNewBalanceInput(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', background: '#1e293b', border: '1px solid #38bdf8', borderRadius: '6px', color: '#fff', fontSize: '0.95em' }}
              />
              <button 
                onClick={() => {
                  const val = Number(newBalanceInput);
                  if (!isNaN(val)) {
                    setBalance(val);
                    setIsEditingBalance(false);
                  }
                }}
                style={{ background: '#38bdf8', border: 'none', borderRadius: '6px', color: '#0f172a', padding: '0 10px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                <Check size={16}/>
              </button>
            </div>
          ) : (
            <h2 style={{ margin: '10px 0 0 0', fontSize: '1.6em', fontWeight: '800', color: '#f8fafc' }}>${balance.toFixed(2)}</h2>
          )}
        </div>

        <div style={{ padding: '20px', background: '#0f172a', borderRadius: '14px', border: '1px solid #1e293b', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#94a3b8', fontSize: '0.8em', fontWeight: '600', textTransform: 'uppercase' }}><Target size={15} color="#38bdf8"/> Win Rate</h3>
          <h2 style={{ margin: '10px 0 0 0', fontSize: '1.6em', fontWeight: '800', color: '#f8fafc' }}>%{stats.winRate}</h2>
        </div>

        <div style={{ padding: '20px', background: '#0f172a', borderRadius: '14px', border: '1px solid #1e293b', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#94a3b8', fontSize: '0.8em', fontWeight: '600', textTransform: 'uppercase' }}><TrendingUp size={15} color="#38bdf8"/> Toplam PnL</h3>
          <h2 style={{ margin: '10px 0 0 0', fontSize: '1.6em', fontWeight: '800', color: Number(stats.totalProfit) >= 0 ? '#38bdf8' : '#f43f5e' }}>${stats.totalProfit}</h2>
        </div>

        <div style={{ padding: '20px', background: '#0f172a', borderRadius: '14px', border: '1px solid #1e293b', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#94a3b8', fontSize: '0.8em', fontWeight: '600', textTransform: 'uppercase' }}><Award size={15} color="#38bdf8"/> Toplam RR</h3>
          <h2 style={{ margin: '10px 0 0 0', fontSize: '1.6em', fontWeight: '800', color: Number(stats.totalRR) >= 0 ? '#38bdf8' : '#f43f5e' }}>{stats.totalRR}R</h2>
        </div>
      </div>

      {/* ANA PANEL GÖVDESİ */}
      <div style={{ display: 'flex', gap: '24px' }}>
        
        {/* SOL FORM & ANALİZ KONTROLLERİ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: '#0f172a', padding: '22px', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ margin: 0, fontSize: '1.1em', fontWeight: '700', color: '#f8fafc' }}>{editingId ? 'İşlemi Düzenle' : 'Yeni İşlem Kaydı'}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setShowGuide(!showGuide)} style={{ background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Info size={13}/> Rehber
                </button>
                {editingId && (
                  <button onClick={() => { setEditingId(null); setSelectedImages([]); }} style={{ background: 'transparent', border: '1px solid #f43f5e', color: '#f43f5e', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75em' }}>İptal</button>
                )}
              </div>
            </div>

            {showGuide && (
              <div style={{ background: '#1e293b', border: '1px solid #3b82f6', padding: '12px', borderRadius: '10px', marginBottom: '16px', fontSize: '0.8em', color: '#94a3b8' }}>
                <p style={{ margin: 0 }}>• Grafik SS yüklemek için butonun üstüne gelip <strong>Ctrl + V</strong> yapman yeterlidir.</p>
              </div>
            )}

            <form onSubmit={handleSaveTrade} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '14px', color: '#64748b' }} />
                    <input 
                      type="text" 
                      value={assetSearch} 
                      onFocus={() => setIsAssetDropdownOpen(true)}
                      onChange={e => {
                        setAssetSearch(e.target.value);
                        setForm({...form, asset: e.target.value});
                        setIsAssetDropdownOpen(true);
                      }}
                      placeholder="Piyasa Ara (Örn: XAG/USD)" 
                      style={{ ...inputStyle, paddingLeft: '38px' }} 
                    />
                  </div>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value as 'LONG' | 'SHORT'})} style={{ ...inputStyle, flex: '0 0 110px', cursor: 'pointer', fontWeight: 'bold', color: form.type === 'LONG' ? '#38bdf8' : '#f43f5e' }}>
                    <option value="LONG" style={{ background: '#0f172a', color: '#38bdf8' }}>LONG 📈</option>
                    <option value="SHORT" style={{ background: '#0f172a', color: '#f43f5e' }}>SHORT 📉</option>
                  </select>
                </div>

                {isAssetDropdownOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', maxHeight: '160px', overflowY: 'auto', zIndex: 50, marginTop: '4px', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}>
                    {filteredAssets.length === 0 ? (
                      <div style={{ padding: '10px', color: '#64748b', fontSize: '0.8em', textAlign: 'center' }}>Sonuç bulunamadı</div>
                    ) : (
                      filteredAssets.map(item => (
                        <div 
                          key={item} 
                          onClick={() => {
                            setForm({...form, asset: item});
                            setAssetSearch(item);
                            setIsAssetDropdownOpen(false);
                          }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #1e293b', fontSize: '0.85em' }}
                        >
                          {item}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.7em', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>Giriş Fiyatı (Entry)</label>
                  <input type="number" step="any" value={form.entry || ''} placeholder="61.3" onChange={e => setForm({...form, entry: Number(e.target.value)})} style={inputStyle} required />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.7em', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>Stop Fiyatı (SL)</label>
                  <input type="number" step="any" value={form.stopLoss || ''} placeholder="60.5" onChange={e => setForm({...form, stopLoss: Number(e.target.value)})} style={inputStyle} required />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.7em', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>Hedef Fiyat (TP)</label>
                  <input type="number" step="any" value={form.exit || ''} placeholder="63.0" onChange={e => setForm({...form, exit: Number(e.target.value)})} style={inputStyle} required />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.7em', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>Kaldıraç</label>
                  <input type="number" value={form.leverage || ''} placeholder="20x" onChange={e => setForm({...form, leverage: Number(e.target.value)})} style={inputStyle} required />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.7em', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>Riske Edilen Kasa (%)</label>
                  <input type="number" step="any" value={form.riskPercent} onChange={e => setForm({...form, riskPercent: Number(e.target.value)})} style={inputStyle} required />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.7em', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>İşlem Sonucu</label>
                  <select 
                    value={form.resultStatus} 
                    onChange={e => setForm({...form, resultStatus: e.target.value as ResultStatus})} 
                    style={{ ...inputStyle, cursor: 'pointer', color: getStatusColor(form.resultStatus), fontWeight: 'bold' }}
                  >
                    <option value="TP" style={{ background: '#0f172a', color: '#38bdf8' }}>🎯 TP Oldu (Kâr)</option>
                    <option value="SL" style={{ background: '#0f172a', color: '#f43f5e' }}>🛑 SL Oldu (Zarar)</option>
                    <option value="BE" style={{ background: '#0f172a', color: '#f59e0b' }}>⚡ Entry Stop (Başa Baş)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.7em', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>Risk / Ödül Oranı (RR)</label>
                  <input type="text" value={form.rr} onChange={e => setForm({...form, rr: e.target.value})} style={inputStyle} placeholder="2.5" required />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.7em', color: '#94a3b8', marginBottom: '4px', fontWeight: '600' }}>Tahmini PnL</label>
                  <div style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <strong style={{ color: tradeDetails.pnl > 0 ? '#38bdf8' : tradeDetails.pnl < 0 ? '#f43f5e' : '#f59e0b', fontSize: '1em' }}>${tradeDetails.pnl.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              <div>
                <label 
                  onMouseEnter={() => setIsHoveringImageDrop(true)}
                  onMouseLeave={() => setIsHoveringImageDrop(false)}
                  style={{ padding: '12px', borderRadius: '10px', border: '1px dashed #334155', background: '#1e293b', color: '#f8fafc', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', justifyContent: 'center', fontSize: '0.85em' }}
                >
                  <ImageIcon size={16} color="#38bdf8"/> {selectedImages.length > 0 ? `✓ ${selectedImages.length} SS Eklendi` : 'Grafik SS Ekle (Üstüne gelip Ctrl+V yap)'}
                  <input type="file" accept="image/*" multiple onChange={e => e.target.files && Array.from(e.target.files).forEach(handleImageAdd)} style={{ display: 'none' }} />
                </label>

                {selectedImages.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {selectedImages.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <img src={img} alt="Önizleme" style={{ width: '40px', height: '32px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #38bdf8' }} />
                        <button 
                          type="button" 
                          onClick={() => setSelectedImages(selectedImages.filter((_, i) => i !== idx))}
                          style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#f43f5e', border: 'none', color: '#fff', borderRadius: '50%', width: '15px', height: '15px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" style={{ padding: '12px', borderRadius: '10px', border: 'none', fontWeight: '700', background: editingId ? '#f59e0b' : '#3b82f6', color: '#fff', cursor: 'pointer', marginTop: '4px', fontSize: '0.9em', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
                {editingId ? 'İşlemi Güncelle' : 'İşlemi Kaydet'}
              </button>
            </form>
          </div>

          {/* KASA SEVİYE GRAFİĞİ (SVG OPTİMİZE) */}
          <div style={{ background: '#0f172a', padding: '18px', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px 0', fontSize: '0.85em', color: '#f8fafc', fontWeight: '600' }}>
              <TrendingUp size={15} color="#38bdf8"/> Kasa Performans Grafiği
            </h3>
            <div style={{ background: '#0b1329', padding: '10px', borderRadius: '10px', border: '1px solid #1e293b', height: '120px', display: 'flex', alignItems: 'center' }}>
              {trades.length === 0 ? (
                <span style={{ color: '#64748b', fontSize: '0.8em', margin: 'auto' }}>Grafik için veri bekleniyor</span>
              ) : (
                <svg viewBox="0 0 400 135" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points={chartData.points} />
                  {chartData.coords.map((c, i) => (
                    <circle key={i} cx={c.x} cy={c.y} r="4" fill={i === 0 ? '#94a3b8' : (c.bal >= (chartData.coords[i-1]?.bal || chartData.initialBase) ? '#38bdf8' : '#f43f5e')} stroke="#0b1329" strokeWidth="1.5" />
                  ))}
                </svg>
              )}
            </div>
          </div>

          {/* İŞLEM ÖZETLERİ KISMI */}
          <div style={{ background: '#0f172a', padding: '18px', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 10px 0', fontSize: '0.85em', color: '#f8fafc', fontWeight: '600' }}>
              <ListOrdered size={15} color="#38bdf8"/> Hızlı İşlem Özetleri
            </h3>
            <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {trades.length === 0 ? (
                <span style={{ color: '#64748b', fontSize: '0.8em', textAlign: 'center', display: 'block', marginTop: '10px' }}>Özet bulunamadı</span>
              ) : (
                trades.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => handleJumpToTrade(t.id)}
                    style={{ background: '#1e293b', padding: '6px 10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '0.8em' }}
                  >
                    <span>{t.asset}</span>
                    <span style={{ color: getStatusColor(t.resultStatus || 'TP'), fontWeight: 'bold' }}>{t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* SAĞ İŞLEM GEÇMİŞİ LİSTESİ */}
        <div style={{ flex: 1.6, background: '#0f172a', padding: '22px', borderRadius: '16px', border: '1px solid #1e293b', height: 'fit-content', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1em', fontWeight: '700', color: '#f8fafc' }}>İşlem Geçmişi</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '680px', overflowY: 'auto', paddingRight: '4px' }}>
            {trades.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '40px', fontSize: '0.9em' }}>Henüz kaydedilmiş işlem yok.</p>
            ) : (
              trades.map(t => (
                <div 
                  key={t.id} 
                  ref={(node) => { tradeRefs.current[t.id] = node; }}
                  style={{ 
                    background: '#1e293b', 
                    padding: '14px 16px', 
                    borderRadius: '12px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    borderLeft: `4px solid ${getStatusColor(t.resultStatus || 'TP')}`,
                    borderTop: highlightedId === t.id ? '1px solid #38bdf8' : '1px solid #334155',
                    borderRight: highlightedId === t.id ? '1px solid #38bdf8' : '1px solid #334155',
                    borderBottom: highlightedId === t.id ? '1px solid #38bdf8' : '1px solid #334155',
                    boxShadow: highlightedId === t.id ? '0 0 15px rgba(56, 189, 248, 0.4)' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    {t.imagePaths && t.imagePaths.length > 0 ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {t.imagePaths.map((img, i) => (
                          <img key={i} src={img} alt="SS" onClick={() => setActiveModalImage(img)} style={{ width: '42px', height: '36px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid #334155' }} />
                        ))}
                      </div>
                    ) : (
                      <div style={{ width: '42px', height: '36px', background: '#0f172a', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.65em' }}>Yok</div>
                    )}

                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '2px' }}>
                        <strong style={{ fontSize: '0.9em', color: '#f8fafc' }}>{t.asset}</strong>
                        <span style={{ color: t.type === 'LONG' ? '#38bdf8' : '#f43f5e', fontSize: '0.75em', fontWeight: 'bold' }}>{t.type}</span>
                        <span style={{ background: 'rgba(255,255,255,0.05)', color: getStatusColor(t.resultStatus || 'TP'), padding: '2px 6px', borderRadius: '4px', fontSize: '0.7em', fontWeight: 'bold' }}>
                          {t.resultStatus === 'BE' ? 'Entry Stop' : t.resultStatus || 'TP'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78em', color: '#94a3b8' }}>
                        EP: {t.entryPrice} | SL: {t.stopLossPrice} | TP: {t.exitPrice}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1em', fontWeight: '800', color: t.pnl > 0 ? '#38bdf8' : t.pnl < 0 ? '#f43f5e' : '#f59e0b' }}>
                        {t.pnl > 0 ? '+' : ''}${t.pnl.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.72em', color: '#64748b' }}>
                        {t.rr}R
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => handleEditClick(t)} style={{ background: '#0f172a', border: 'none', color: '#38bdf8', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}><Edit3 size={14}/></button>
                      <button onClick={() => handleDeleteTrade(t.id)} style={{ background: '#0f172a', border: 'none', color: '#f43f5e', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}><Trash2 size={14}/></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* RESİM BÜYÜTME MODAL */}
      {activeModalImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setActiveModalImage(null)}>
          <div style={{ position: 'relative', background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setActiveModalImage(null)} style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#f43f5e', border: 'none', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              <X size={14}/>
            </button>
            <img src={activeModalImage} alt="SS" style={{ maxWidth: '80vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: '6px' }} />
          </div>
        </div>
      )}

    </div>
  );
}