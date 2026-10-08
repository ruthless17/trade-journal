import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Target, Image as ImageIcon, Trash2, Edit3, Award, X,
  ListOrdered, Search, Info, Check, Activity, Download, Upload, Flame, Scale, Calendar,
} from 'lucide-react';

/* ───────────────────────── Tipler ───────────────────────── */

type ResultStatus = 'TP' | 'SL' | 'BE';
type Filter = 'ALL' | ResultStatus;

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
  riskPercent: number;
  riskAmount: number;
  resultStatus: ResultStatus;
  pnl: number;
  rr: number;
  setup?: string;
  note?: string;
  imagePaths?: string[];
};

type FormState = {
  asset: string;
  type: 'LONG' | 'SHORT';
  entry: number;
  exit: number;
  stopLoss: number;
  leverage: number;
  riskPercent: number;
  resultStatus: ResultStatus;
  setup: string;
  note: string;
  date: string; // datetime-local formatı
};

/* ───────────────────────── Sabitler ───────────────────────── */

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
  'LINK/USDT', 'MATIC/USDT', 'SHIB/USDT', 'FET/USDT', 'APT/USDT', 'AR/USDT',
];

const SETUP_SUGGESTIONS = ['Breakout', 'Pullback', 'Reversal', 'Trend takibi', 'Range', 'Haber', 'Liquidity sweep'];

const DEFAULT_ASSET = 'XAG/USD (Gümüş)';
function emptyForm(): FormState {
  return {
    asset: DEFAULT_ASSET, type: 'LONG', entry: 0, exit: 0, stopLoss: 0,
    leverage: 20, riskPercent: 1, resultStatus: 'TP', setup: '', note: '',
    date: toLocalInput(new Date()),
  };
}

const COLORS = { tp: '#38bdf8', sl: '#f43f5e', be: '#f59e0b' };
const statusColor = (s: ResultStatus) => (s === 'TP' ? COLORS.tp : s === 'SL' ? COLORS.sl : COLORS.be);
const pnlColor = (n: number) => (n > 0 ? COLORS.tp : n < 0 ? COLORS.sl : COLORS.be);

/* ───────────────────────── Yardımcılar ───────────────────────── */

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
const signedMoney = (n: number) => `${n > 0 ? '+' : ''}${money(n)}`;

// En yeni işlem en üstte olacak şekilde tarihe göre sıralar
const sortTrades = (ts: Trade[]) => ts.slice().sort((a, b) => b.date.localeCompare(a.date));

// Date -> "YYYY-MM-DDTHH:mm" (yerel saat)
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Eski kayıtları yeni şemaya uyumlu hale getirir
const normalizeTrade = (t: any): Trade => ({
  ...t,
  riskPercent: typeof t.riskPercent === 'number' ? t.riskPercent : 1,
  rr: Number(t.rr) || 0,
  pnl: Number(t.pnl) || 0,
  resultStatus: t.resultStatus || 'TP',
});

// Ekran görüntüsünü küçültüp JPEG'e çevirir: localStorage kotası dolmasın diye
const compressImage = (file: File, maxW = 1280, quality = 0.72) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

const downloadFile = (name: string, content: string, mime: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

// Sayıyı yumuşakça yeni değere kaydırır
function useCountUp(target: number, duration = 650) {
  const [val, setVal] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      current.current = from + (target - from) * eased;
      setVal(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// Giriş, stop ve hedeften pozisyon büyüklüğü, margin, PnL ve RR hesaplar
function computeTrade(baseBalance: number, f: FormState) {
  const out = { margin: 0, pnl: 0, riskAmount: 0, rr: 0, error: '' };
  if (!f.entry || !f.stopLoss) return out;
  if (f.entry === f.stopLoss) return { ...out, error: 'Giriş ve stop aynı olamaz.' };

  const long = f.type === 'LONG';
  if (long && f.stopLoss >= f.entry) return { ...out, error: 'LONG işlemde stop, girişin altında olmalı.' };
  if (!long && f.stopLoss <= f.entry) return { ...out, error: 'SHORT işlemde stop, girişin üstünde olmalı.' };

  const riskAmount = baseBalance * (f.riskPercent / 100);
  const stopPct = Math.abs(f.entry - f.stopLoss) / f.entry;
  const positionSize = riskAmount / stopPct;
  const margin = f.leverage > 0 ? positionSize / f.leverage : 0;

  let pnl = 0;
  let rr = 0;
  if (f.resultStatus === 'SL') {
    pnl = -riskAmount;
    rr = -1;
  } else if (f.resultStatus === 'TP') {
    if (f.exit <= 0) return { ...out, riskAmount, margin };
    const rewardPct = long ? (f.exit - f.entry) / f.entry : (f.entry - f.exit) / f.entry;
    if (rewardPct <= 0) return { ...out, riskAmount, margin, error: 'Hedef fiyat yönle uyuşmuyor. Sonuç TP ise hedef kâr tarafında olmalı.' };
    pnl = positionSize * rewardPct;
    rr = rewardPct / stopPct;
  }
  return { margin, pnl, riskAmount, rr: Number(rr.toFixed(2)), error: '' };
}

/* ───────────────────────── Stiller ───────────────────────── */

const CSS = `
.lfx{--bg:#0b1329;--card:#0f172a;--line:#1e293b;--line2:#334155;--txt:#f8fafc;--mut:#94a3b8;--dim:#64748b;--blue:#38bdf8;--red:#f43f5e;--amb:#f59e0b;--pri:#3b82f6;
  font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--txt);min-height:100vh;padding:28px}
.lfx *{box-sizing:border-box}
.lfx button{font-family:inherit}
@keyframes lfx-draw{to{stroke-dashoffset:0}}
@keyframes lfx-area{from{opacity:0}to{opacity:1}}
@keyframes lfx-slide{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
@keyframes lfx-pop{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:none}}
@keyframes lfx-toast{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes lfx-pulse{0%,100%{box-shadow:0 0 0 0 rgba(56,189,248,.55)}50%{box-shadow:0 0 0 6px rgba(56,189,248,0)}}
@keyframes lfx-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.lfx-header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:24px}
.lfx-logo{background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:10px;border-radius:12px;display:flex;box-shadow:0 4px 12px rgba(59,130,246,.3)}
.lfx-brand{margin:0;font-size:1.2em;font-weight:800;letter-spacing:.5px;background:linear-gradient(to right,#60a5fa,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.lfx-live{display:flex;align-items:center;gap:8px;background:var(--line);padding:6px 14px;border-radius:20px;border:1px solid var(--line2);font-size:.75em;color:var(--mut);font-weight:600}
.lfx-dot{width:8px;height:8px;border-radius:50%;background:var(--blue);animation:lfx-pulse 2.2s infinite}
.lfx-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:0 10px 25px -5px rgba(0,0,0,.4)}
.lfx-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}
.lfx-stat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;box-shadow:0 10px 25px -5px rgba(0,0,0,.4);transition:border-color .2s,transform .2s}
.lfx-stat:hover{border-color:var(--line2);transform:translateY(-2px)}
.lfx-stat h3{display:flex;align-items:center;gap:8px;margin:0;color:var(--mut);font-size:.78em;font-weight:600}
.lfx-stat h2{margin:10px 0 0;font-size:1.5em;font-weight:800;font-variant-numeric:tabular-nums}
.lfx-sub{margin-top:4px;font-size:.7em;color:var(--dim)}
.lfx-layout{display:grid;grid-template-columns:minmax(340px,1fr) 1.6fr;gap:24px;align-items:start;margin-top:12px}
.lfx-col{display:flex;flex-direction:column;gap:20px;min-width:0}
.lfx-title{margin:0 0 14px;font-size:.9em;font-weight:700;display:flex;align-items:center;gap:8px}
.lfx-row{display:flex;gap:10px}
.lfx-field{flex:1;display:flex;flex-direction:column;min-width:0}
.lfx-field label{font-size:.7em;color:var(--mut);margin-bottom:4px;font-weight:600}
.lfx-input{width:100%;padding:11px 14px;border-radius:10px;border:1px solid var(--line2);background:var(--card);color:var(--txt);font-size:.9em;outline:none;transition:border-color .2s,box-shadow .2s;font-family:inherit}
.lfx-input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(56,189,248,.15)}
textarea.lfx-input{resize:vertical;min-height:56px}
.lfx-btn{border:none;border-radius:10px;font-weight:700;cursor:pointer;transition:transform .12s,filter .2s,box-shadow .2s}
.lfx-btn:hover{filter:brightness(1.1)}
.lfx-btn:active{transform:scale(.97)}
.lfx-btn:disabled{opacity:.45;cursor:not-allowed;filter:none;transform:none}
.lfx-ghost{background:var(--line);border:1px solid var(--line2);color:var(--blue);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:.75em;display:flex;align-items:center;gap:4px;transition:background .2s}
.lfx-ghost:hover{background:var(--line2)}
.lfx-trade{background:var(--line);padding:14px 16px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid var(--line2);animation:lfx-slide .35s ease both;transition:border-color .3s,box-shadow .3s,transform .2s}
.lfx-trade:hover{transform:translateX(-2px)}
.lfx-trade.hl{border-color:var(--blue);box-shadow:0 0 15px rgba(56,189,248,.4)}
.lfx-icon-btn{background:var(--card);border:none;padding:7px;border-radius:6px;cursor:pointer;display:flex;transition:transform .12s,background .2s}
.lfx-icon-btn:hover{background:#162036;transform:scale(1.08)}
.lfx-thumb{width:42px;height:36px;object-fit:cover;border-radius:6px;cursor:zoom-in;border:1px solid var(--line2);transition:transform .15s}
.lfx-thumb:hover{transform:scale(1.12)}
.lfx-chip{border:1px solid var(--line2);background:var(--line);color:var(--mut);padding:4px 10px;border-radius:14px;font-size:.72em;cursor:pointer;transition:all .2s}
.lfx-chip:hover{color:var(--txt)}
.lfx-chip.on{background:rgba(56,189,248,.14);border-color:var(--blue);color:var(--blue)}
.lfx-dd{position:absolute;top:100%;left:0;right:0;background:var(--card);border:1px solid var(--line2);border-radius:10px;max-height:170px;overflow-y:auto;z-index:50;margin-top:4px;box-shadow:0 10px 20px rgba(0,0,0,.5);animation:lfx-pop .15s ease}
.lfx-dd div{padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--line);font-size:.85em}
.lfx-dd div:hover{background:var(--line)}
.lfx-chart-line{stroke-dasharray:1;stroke-dashoffset:1;animation:lfx-draw 1.1s ease-out .1s forwards}
.lfx-chart-area{opacity:0;animation:lfx-area .8s ease-out .7s forwards}
.lfx-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.lfx-cal-d{aspect-ratio:1.25;border-radius:6px;background:var(--line);font-size:.68em;color:var(--dim);padding:3px 5px;display:flex;flex-direction:column;justify-content:space-between;transition:transform .15s}
.lfx-cal-d:hover{transform:scale(1.08);z-index:1}
.lfx-modal{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;justify-content:center;align-items:center;z-index:1000;animation:lfx-area .2s ease}
.lfx-modal-box{position:relative;background:var(--card);padding:16px;border-radius:12px;border:1px solid var(--line);animation:lfx-pop .22s ease}
.lfx-toast{position:fixed;bottom:24px;right:24px;background:var(--line);border:1px solid var(--blue);color:var(--txt);padding:10px 16px;border-radius:10px;font-size:.85em;z-index:2000;animation:lfx-toast .25s ease;box-shadow:0 10px 25px rgba(0,0,0,.5)}
.lfx-warn{background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.45);color:#fda4af;padding:8px 12px;border-radius:8px;font-size:.78em;animation:lfx-rise .2s ease}
.lfx ::-webkit-scrollbar{width:8px}
.lfx ::-webkit-scrollbar-thumb{background:var(--line2);border-radius:4px}
@media (max-width:1100px){.lfx-stats{grid-template-columns:repeat(2,1fr)}.lfx-layout{grid-template-columns:1fr}}
@media (max-width:520px){.lfx{padding:14px}.lfx-stats{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.lfx *{animation:none!important;transition:none!important}.lfx-chart-line{stroke-dashoffset:0}.lfx-chart-area{opacity:1}}
`;

/* ───────────────────────── Küçük bileşenler ───────────────────────── */

type StatProps = {
  icon: React.ReactNode;
  label: string;
  value: number;
  format: (n: number) => string;
  color?: string;
  sub?: string;
};

const StatCard = React.memo(function StatCard({ icon, label, value, format, color, sub }: StatProps) {
  const v = useCountUp(value);
  return (
    <div className="lfx-stat">
      <h3>{icon}{label}</h3>
      <h2 style={{ color: color || 'var(--txt)' }}>{format(v)}</h2>
      {sub && <div className="lfx-sub">{sub}</div>}
    </div>
  );
});

/* ───────────────────────── Ana uygulama ───────────────────────── */

export default function App() {
  const [balance, setBalance] = useState<number>(() => load<number>('trade_balance', 2000));
  const [trades, setTrades] = useState<Trade[]>(() => sortTrades(load<any[]>('trade_history', []).map(normalizeTrade)));

  const [form, setForm] = useState<FormState>(emptyForm);
  const [assetSearch, setAssetSearch] = useState(DEFAULT_ASSET);
  const [isAssetOpen, setIsAssetOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [hoverDrop, setHoverDrop] = useState(false);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [listSearch, setListSearch] = useState('');
  const [monthOffset, setMonthOffset] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const tradeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }, []);

  /* Kayıt: yazmayı biraz geciktirir, kota dolarsa uyarır */
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem('trade_balance', String(balance));
        localStorage.setItem('trade_history', JSON.stringify(trades));
      } catch {
        showToast('Depolama dolu. Eski işlemlerin ekran görüntülerini silin veya yedek alın.');
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [balance, trades, showToast]);

  /* Resim ekleme (sıkıştırarak) */
  const handleImageAdd = useCallback(async (file: File) => {
    try {
      const data = await compressImage(file);
      setSelectedImages(prev => [...prev, data]);
    } catch {
      showToast('Resim okunamadı.');
    }
  }, [showToast]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!hoverDrop) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) handleImageAdd(file);
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [hoverDrop, handleImageAdd]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsAssetOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalImage(null); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  /* Düzenleme sırasında risk, eski işlemin PnL'i çıkarılmış kasa üzerinden hesaplanır */
  const editingTrade = useMemo(() => trades.find(t => t.id === editingId) || null, [trades, editingId]);
  // Risk, işlemin tarihindeki kasadan hesaplanır (geçmiş güne eklerken de doğru çalışır)
  const startBalance = useMemo(() => balance - trades.reduce((s, t) => s + t.pnl, 0), [balance, trades]);
  const baseBalance = useMemo(() => {
    const ts = form.date ? new Date(form.date).getTime() : Date.now();
    return startBalance + trades.reduce(
      (s, t) => (t.id !== editingId && new Date(t.date).getTime() < ts ? s + t.pnl : s), 0);
  }, [startBalance, trades, editingId, form.date]);
  const calc = useMemo(() => computeTrade(baseBalance, form), [baseBalance, form]);
  const marginTooHigh = calc.margin > baseBalance && baseBalance > 0;

  const resetForm = useCallback(() => {
    setForm(emptyForm());
    setAssetSearch(DEFAULT_ASSET);
    setSelectedImages([]);
    setEditingId(null);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (calc.error) return showToast(calc.error);

    const dt = new Date(form.date);
    if (isNaN(dt.getTime())) return showToast('Geçerli bir tarih seç.');

    const fields = {
      date: dt.toISOString(),
      asset: form.asset.trim() || DEFAULT_ASSET,
      type: form.type,
      entryPrice: form.entry,
      exitPrice: form.exit,
      stopLossPrice: form.stopLoss,
      leverage: form.leverage,
      margin: calc.margin,
      riskPercent: form.riskPercent,
      riskAmount: calc.riskAmount,
      resultStatus: form.resultStatus,
      pnl: calc.pnl,
      rr: calc.rr,
      setup: form.setup.trim() || undefined,
      note: form.note.trim() || undefined,
      imagePaths: selectedImages.length ? selectedImages : undefined,
    };

    if (editingTrade) {
      setBalance(b => b - editingTrade.pnl + calc.pnl);
      setTrades(ts => sortTrades(ts.map(t => (t.id === editingTrade.id ? { ...t, ...fields } : t))));
      showToast('İşlem güncellendi');
    } else {
      setTrades(ts => sortTrades([{ id: crypto.randomUUID(), ...fields }, ...ts]));
      setBalance(b => b + calc.pnl);
      showToast('İşlem kaydedildi');
    }
    resetForm();
  };

  const handleEdit = (t: Trade) => {
    setEditingId(t.id);
    setForm({
      date: toLocalInput(new Date(t.date)),
      asset: t.asset, type: t.type, entry: t.entryPrice, exit: t.exitPrice,
      stopLoss: t.stopLossPrice || 0, leverage: t.leverage, riskPercent: t.riskPercent,
      resultStatus: t.resultStatus, setup: t.setup || '', note: t.note || '',
    });
    setAssetSearch(t.asset);
    setSelectedImages(t.imagePaths || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    const t = trades.find(x => x.id === id);
    if (!t || !window.confirm(`${t.asset} işlemi silinsin mi? Kasa buna göre geri alınır.`)) return;
    setBalance(b => b - t.pnl);
    setTrades(ts => ts.filter(x => x.id !== id));
    if (editingId === id) resetForm();
    showToast('İşlem silindi');
  };

  const jumpToTrade = (id: string) => {
    setFilter('ALL');
    setListSearch('');
    requestAnimationFrame(() => {
      tradeRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(id);
      window.setTimeout(() => setHighlightedId(null), 2000);
    });
  };

  /* ───── Yedekleme ───── */
  const exportJSON = () => {
    downloadFile(`lacivertfx-yedek-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ version: 2, balance, trades }, null, 2), 'application/json');
    showToast('Yedek indirildi');
  };

  const exportCSV = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Tarih', 'Piyasa', 'Yön', 'Giriş', 'Stop', 'Hedef', 'Kaldıraç', 'Risk %', 'Sonuç', 'PnL', 'RR', 'Setup', 'Not'];
    const rows = trades.slice().reverse().map(t => [
      new Date(t.date).toLocaleString('tr-TR'), t.asset, t.type, t.entryPrice, t.stopLossPrice, t.exitPrice,
      t.leverage, t.riskPercent, t.resultStatus, t.pnl.toFixed(2), t.rr, t.setup, t.note,
    ].map(esc).join(','));
    downloadFile('lacivertfx-islemler.csv', '\ufeff' + [head.map(esc).join(','), ...rows].join('\n'), 'text/csv;charset=utf-8');
    showToast('CSV indirildi');
  };

  const importJSON = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.trades) || typeof data.balance !== 'number') throw new Error();
      if (!window.confirm('Mevcut tüm veriler bu yedekle değiştirilecek. Devam edilsin mi?')) return;
      setTrades(sortTrades(data.trades.map(normalizeTrade)));
      setBalance(data.balance);
      resetForm();
      showToast('Yedek yüklendi');
    } catch {
      showToast('Geçersiz yedek dosyası.');
    }
  };

  /* ───── Analizler ───── */
  const analytics = useMemo(() => {
    const chrono = trades.slice().reverse();
    const start = balance - trades.reduce((s, t) => s + t.pnl, 0);
    const series = [start];
    let v = start;
    chrono.forEach(t => { v += t.pnl; series.push(v); });

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);
    const be = trades.length - wins.length - losses.length;
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const totalPnl = grossProfit - grossLoss;
    const totalRR = trades.reduce((s, t) => s + t.rr, 0);
    const decided = wins.length + losses.length;

    let peak = series[0], maxDD = 0, maxDDPct = 0;
    series.forEach(val => {
      peak = Math.max(peak, val);
      const dd = peak - val;
      if (dd > maxDD) { maxDD = dd; maxDDPct = peak > 0 ? (dd / peak) * 100 : 0; }
    });

    let streak = 0, sign = 0;
    for (const t of trades) {
      if (t.pnl === 0) continue;
      const s = t.pnl > 0 ? 1 : -1;
      if (!sign) sign = s;
      if (s !== sign) break;
      streak++;
    }

    return {
      chrono, series, start,
      wins: wins.length, losses: losses.length, be,
      winRate: decided ? (wins.length / decided) * 100 : 0,
      totalPnl, totalRR,
      avgRR: trades.length ? totalRR / trades.length : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0,
      maxDD, maxDDPct,
      streak: streak * sign,
      best: trades.length ? Math.max(...trades.map(t => t.pnl)) : 0,
      worst: trades.length ? Math.min(...trades.map(t => t.pnl)) : 0,
    };
  }, [trades, balance]);

  /* ───── Kasa grafiği ───── */
  const W = 600, H = 230, PL = 56, PR = 16, PT = 16, PB = 26;
  const chart = useMemo(() => {
    const { series } = analytics;
    const max = Math.max(...series), min = Math.min(...series);
    // Aralık gerçek veriden hesaplanır; böylece küçük hareketler de görünür
    const pad = (max - min) * 0.18 || Math.abs(max) * 0.01 || 1;
    const hi = max + pad, lo = min - pad;
    const n = series.length;
    const pts = series.map((val, i) => ({
      x: PL + (n === 1 ? 0 : i / (n - 1)) * (W - PL - PR),
      y: PT + ((hi - val) / (hi - lo)) * (H - PT - PB),
      val,
    }));
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[n - 1].x.toFixed(1)} ${H - PB} L${pts[0].x.toFixed(1)} ${H - PB} Z`;
    const ticks = [0, 1, 2, 3].map(i => ({ val: hi - ((hi - lo) * i) / 3, y: PT + (i / 3) * (H - PT - PB) }));
    return { pts, line, area, ticks };
  }, [analytics]);

  const onChartMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    chart.pts.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = i; } });
    setHoverIdx(best);
  };

  /* ───── Takvim ───── */
  const cal = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const y = base.getFullYear(), m = base.getMonth();
    const map: Record<number, number> = {};
    trades.forEach(t => {
      const d = new Date(t.date);
      if (d.getFullYear() === y && d.getMonth() === m) map[d.getDate()] = (map[d.getDate()] || 0) + t.pnl;
    });
    const vals = Object.values(map);
    return {
      label: base.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
      days: new Date(y, m + 1, 0).getDate(),
      offset: (base.getDay() + 6) % 7, // hafta Pazartesi başlar
      map,
      maxAbs: Math.max(1, ...vals.map(Math.abs)),
      total: vals.reduce((a, b) => a + b, 0),
    };
  }, [trades, monthOffset]);

  /* ───── Liste filtreleri ───── */
  const filteredAssets = useMemo(
    () => POPULAR_ASSETS.filter(a => a.toLowerCase().includes(assetSearch.toLowerCase())),
    [assetSearch],
  );

  const visibleTrades = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return trades.filter(t =>
      (filter === 'ALL' || t.resultStatus === filter) &&
      (!q || t.asset.toLowerCase().includes(q) || (t.setup || '').toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q)),
    );
  }, [trades, filter, listSearch]);

  const animatedBalance = useCountUp(balance);
  const hp = hoverIdx !== null ? chart.pts[hoverIdx] : null;
  const hoverTrade = hoverIdx !== null && hoverIdx > 0 ? analytics.chrono[hoverIdx - 1] : null;

  /* ───────────────────────── Render ───────────────────────── */
  return (
    <div className="lfx">
      <style>{CSS}</style>

      {/* HEADER */}
      <div className="lfx-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="lfx-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </div>
          <div>
            <h1 className="lfx-brand">LACIVERT<span style={{ color: '#f8fafc', WebkitTextFillColor: '#f8fafc' }}>FX</span> JOURNAL</h1>
            <span style={{ fontSize: '.7em', color: 'var(--dim)', fontWeight: 600, letterSpacing: 1 }}>PRO TRADING TERMINAL</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="lfx-ghost" onClick={exportCSV} title="İşlemleri Excel için CSV indir"><Download size={13} /> CSV</button>
          <button className="lfx-ghost" onClick={exportJSON} title="Tam yedek al"><Download size={13} /> Yedek al</button>
          <button className="lfx-ghost" onClick={() => importRef.current?.click()} title="Yedekten geri yükle"><Upload size={13} /> Yedek yükle</button>
          <input ref={importRef} type="file" accept="application/json" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) importJSON(f); e.target.value = ''; }} />
          <div className="lfx-live"><span className="lfx-dot" /><Activity size={14} color="#38bdf8" /> Veriler yerelde</div>
        </div>
      </div>

      {/* İSTATİSTİKLER */}
      <div className="lfx-stats">
        <div className="lfx-stat">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3><Wallet size={15} color="#38bdf8" /> Kasa (Demo)</h3>
            <button onClick={() => { setIsEditingBalance(v => !v); setBalanceInput(String(Math.round(balance * 100) / 100)); }}
              style={{ background: 'transparent', border: 'none', color: 'var(--blue)', cursor: 'pointer', padding: 2 }} title="Kasayı düzenle">
              <Edit3 size={14} />
            </button>
          </div>
          {isEditingBalance ? (
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <input type="number" className="lfx-input" style={{ padding: '6px 8px' }} value={balanceInput} autoFocus
                onChange={e => setBalanceInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget.nextSibling as HTMLButtonElement)?.click(); }} />
              <button className="lfx-btn" style={{ background: 'var(--blue)', color: '#0f172a', padding: '0 10px' }}
                onClick={() => {
                  const val = Number(balanceInput);
                  if (balanceInput !== '' && !isNaN(val)) { setBalance(val); setIsEditingBalance(false); }
                }}>
                <Check size={16} />
              </button>
            </div>
          ) : (
            <h2>{money(animatedBalance)}</h2>
          )}
          <div className="lfx-sub">Başlangıç: {money(analytics.start)}</div>
        </div>

        <StatCard icon={<Target size={15} color="#38bdf8" />} label="Win Rate" value={analytics.winRate}
          format={n => `%${n.toFixed(1)}`} sub={`${analytics.wins} kazanç, ${analytics.losses} kayıp, ${analytics.be} başa baş`} />
        <StatCard icon={<TrendingUp size={15} color="#38bdf8" />} label="Toplam PnL" value={analytics.totalPnl}
          format={signedMoney} color={pnlColor(analytics.totalPnl)} sub={`En iyi ${signedMoney(analytics.best)}, en kötü ${signedMoney(analytics.worst)}`} />
        <StatCard icon={<Award size={15} color="#38bdf8" />} label="Toplam RR" value={analytics.totalRR}
          format={n => `${n > 0 ? '+' : ''}${n.toFixed(2)}R`} color={pnlColor(analytics.totalRR)} sub={`Ortalama ${analytics.avgRR.toFixed(2)}R / işlem`} />
      </div>
      <div className="lfx-stats">
        <StatCard icon={<Scale size={15} color="#38bdf8" />} label="Profit Factor" value={analytics.profitFactor}
          format={n => (n >= 99 ? '∞' : n.toFixed(2))} sub="Brüt kâr / brüt zarar" />
        <StatCard icon={<TrendingDown size={15} color="#f43f5e" />} label="Max Drawdown" value={analytics.maxDD}
          format={money} color={analytics.maxDD > 0 ? COLORS.sl : undefined} sub={`Zirveden %${analytics.maxDDPct.toFixed(1)} düşüş`} />
        <StatCard icon={<Flame size={15} color="#f59e0b" />} label="Güncel Seri" value={analytics.streak}
          format={n => (Math.round(n) === 0 ? '-' : `${Math.abs(Math.round(n))} ${n > 0 ? 'kazanç' : 'kayıp'}`)}
          color={analytics.streak > 0 ? COLORS.tp : analytics.streak < 0 ? COLORS.sl : undefined} sub="Başa baş işlemler seriyi bozmaz" />
        <StatCard icon={<ListOrdered size={15} color="#38bdf8" />} label="Toplam İşlem" value={trades.length}
          format={n => String(Math.round(n))} sub={trades.length ? `Son: ${new Date(trades[0].date).toLocaleDateString('tr-TR')}` : 'Henüz işlem yok'} />
      </div>

      {/* ANA GÖVDE */}
      <div className="lfx-layout">
        {/* SOL: FORM, GRAFİK, TAKVİM */}
        <div className="lfx-col">
          <div className="lfx-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.1em', fontWeight: 700 }}>{editingId ? 'İşlemi düzenle' : 'Yeni işlem kaydı'}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="lfx-ghost" onClick={() => setShowGuide(v => !v)}><Info size={13} /> Rehber</button>
                {editingId && (
                  <button type="button" className="lfx-ghost" style={{ color: 'var(--red)', borderColor: 'var(--red)', background: 'transparent' }} onClick={resetForm}>İptal</button>
                )}
              </div>
            </div>

            {showGuide && (
              <div style={{ background: 'var(--line)', border: '1px solid var(--pri)', padding: 12, borderRadius: 10, marginBottom: 14, fontSize: '.8em', color: 'var(--mut)', animation: 'lfx-rise .2s ease' }}>
                <p style={{ margin: '0 0 4px' }}>• Ekran görüntüsü eklemek için alanın üstüne gelip <strong>Ctrl + V</strong> yap.</p>
                <p style={{ margin: '0 0 4px' }}>• RR otomatik hesaplanır: TP için hedef/stop oranı, SL için -1R, başa baş için 0R.</p>
                <p style={{ margin: '0 0 4px' }}>• Risk yüzdesi, işlemin tarihindeki kasadan hesaplanır. Geçmiş güne eklediğinde de doğru çalışır.</p>
                <p style={{ margin: 0 }}>• Grafikteki bir noktaya tıklarsan o işlem listede açılır.</p>
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <div className="lfx-row">
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--dim)' }} />
                    <input className="lfx-input" style={{ paddingLeft: 38 }} type="text" value={assetSearch} placeholder="Piyasa ara (örn: XAG/USD)"
                      onFocus={() => setIsAssetOpen(true)}
                      onChange={e => { setAssetSearch(e.target.value); setForm(f => ({ ...f, asset: e.target.value })); setIsAssetOpen(true); }} />
                  </div>
                  <select className="lfx-input" style={{ flex: '0 0 112px', cursor: 'pointer', fontWeight: 'bold', color: form.type === 'LONG' ? COLORS.tp : COLORS.sl }}
                    value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'LONG' | 'SHORT' }))}>
                    <option value="LONG">LONG 📈</option>
                    <option value="SHORT">SHORT 📉</option>
                  </select>
                </div>
                {isAssetOpen && (
                  <div className="lfx-dd">
                    {filteredAssets.length === 0
                      ? <div style={{ color: 'var(--dim)', textAlign: 'center', cursor: 'default' }}>Listede yok, yazdığın isim kullanılır</div>
                      : filteredAssets.map(item => (
                        <div key={item} onClick={() => { setForm(f => ({ ...f, asset: item })); setAssetSearch(item); setIsAssetOpen(false); }}>{item}</div>
                      ))}
                  </div>
                )}
              </div>

              <div className="lfx-field"><label>İşlem tarihi (geçmiş bir gün de seçebilirsin)</label>
                <input className="lfx-input" type="datetime-local" value={form.date} max={toLocalInput(new Date())} required
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>

              <div className="lfx-row">
                <div className="lfx-field"><label>Giriş fiyatı</label>
                  <input className="lfx-input" type="number" step="any" value={form.entry || ''} placeholder="61.3" required
                    onChange={e => setForm(f => ({ ...f, entry: Number(e.target.value) }))} /></div>
                <div className="lfx-field"><label>Stop fiyatı</label>
                  <input className="lfx-input" type="number" step="any" value={form.stopLoss || ''} placeholder="60.5" required
                    onChange={e => setForm(f => ({ ...f, stopLoss: Number(e.target.value) }))} /></div>
              </div>

              <div className="lfx-row">
                <div className="lfx-field"><label>Hedef fiyat {form.resultStatus === 'TP' ? '' : '(opsiyonel)'}</label>
                  <input className="lfx-input" type="number" step="any" value={form.exit || ''} placeholder="63.0" required={form.resultStatus === 'TP'}
                    onChange={e => setForm(f => ({ ...f, exit: Number(e.target.value) }))} /></div>
                <div className="lfx-field"><label>Kaldıraç</label>
                  <input className="lfx-input" type="number" value={form.leverage || ''} placeholder="20" required min={1}
                    onChange={e => setForm(f => ({ ...f, leverage: Number(e.target.value) }))} /></div>
              </div>

              <div className="lfx-row">
                <div className="lfx-field"><label>Riske edilen kasa (%)</label>
                  <input className="lfx-input" type="number" step="any" min={0} value={form.riskPercent} required
                    onChange={e => setForm(f => ({ ...f, riskPercent: Number(e.target.value) }))} /></div>
                <div className="lfx-field"><label>İşlem sonucu</label>
                  <select className="lfx-input" style={{ cursor: 'pointer', fontWeight: 'bold', color: statusColor(form.resultStatus) }}
                    value={form.resultStatus} onChange={e => setForm(f => ({ ...f, resultStatus: e.target.value as ResultStatus }))}>
                    <option value="TP">🎯 TP oldu (kâr)</option>
                    <option value="SL">🛑 SL oldu (zarar)</option>
                    <option value="BE">⚡ Entry stop (başa baş)</option>
                  </select></div>
              </div>

              <div className="lfx-row">
                <div className="lfx-field"><label>Risk / ödül (otomatik)</label>
                  <div className="lfx-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{calc.rr}R</div></div>
                <div className="lfx-field"><label>Tahmini PnL</label>
                  <div className="lfx-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: pnlColor(calc.pnl) }}>{money(calc.pnl)}</div></div>
                <div className="lfx-field"><label>Gereken margin</label>
                  <div className="lfx-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: marginTooHigh ? COLORS.sl : undefined }}>{money(calc.margin)}</div></div>
              </div>

              {calc.error && <div className="lfx-warn">{calc.error}</div>}
              {!calc.error && marginTooHigh && <div className="lfx-warn">Gereken margin kasayı aşıyor. Kaldıracı artır veya riski düşür.</div>}

              <div className="lfx-field"><label>Setup</label>
                <input className="lfx-input" list="lfx-setups" value={form.setup} placeholder="Örn: Breakout"
                  onChange={e => setForm(f => ({ ...f, setup: e.target.value }))} />
                <datalist id="lfx-setups">{SETUP_SUGGESTIONS.map(s => <option key={s} value={s} />)}</datalist></div>

              <div className="lfx-field"><label>Not (neden girdin, ne öğrendin?)</label>
                <textarea className="lfx-input" value={form.note} placeholder="Giriş nedeni, duygu durumun, hatalar..."
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></div>

              <div>
                <label onMouseEnter={() => setHoverDrop(true)} onMouseLeave={() => setHoverDrop(false)}
                  style={{ padding: 12, borderRadius: 10, border: `1px dashed ${hoverDrop ? 'var(--blue)' : 'var(--line2)'}`, background: 'var(--line)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', justifyContent: 'center', fontSize: '.85em', transition: 'border-color .2s' }}>
                  <ImageIcon size={16} color="#38bdf8" />
                  {selectedImages.length ? `✓ ${selectedImages.length} SS eklendi` : 'Grafik SS ekle (üstüne gelip Ctrl+V yap)'}
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={e => { Array.from(e.target.files || []).forEach(handleImageAdd); e.target.value = ''; }} />
                </label>
                {selectedImages.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {selectedImages.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative', animation: 'lfx-pop .2s ease' }}>
                        <img src={img} alt="Önizleme" style={{ width: 40, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--blue)' }} />
                        <button type="button" onClick={() => setSelectedImages(s => s.filter((_, i) => i !== idx))}
                          style={{ position: 'absolute', top: -5, right: -5, background: 'var(--red)', border: 'none', color: '#fff', borderRadius: '50%', width: 15, height: 15, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" className="lfx-btn" disabled={!!calc.error}
                style={{ padding: 12, background: editingId ? 'var(--amb)' : 'var(--pri)', color: '#fff', fontSize: '.9em', boxShadow: '0 4px 12px rgba(59,130,246,.3)' }}>
                {editingId ? 'İşlemi güncelle' : 'İşlemi kaydet'}
              </button>
            </form>
          </div>

          {/* KASA GRAFİĞİ */}
          <div className="lfx-card">
            <h3 className="lfx-title"><TrendingUp size={15} color="#38bdf8" /> Kasa performans grafiği</h3>
            <div style={{ background: 'var(--bg)', padding: 8, borderRadius: 10, border: '1px solid var(--line)' }}>
              {trades.length === 0 ? (
                <div style={{ color: 'var(--dim)', fontSize: '.8em', textAlign: 'center', padding: '50px 0' }}>İlk işlemini kaydet, kasa eğrin burada çizilsin.</div>
              ) : (
                <svg key={trades.length} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}
                  onMouseMove={onChartMove} onMouseLeave={() => setHoverIdx(null)}>
                  <defs>
                    <linearGradient id="lfx-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity=".35" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {chart.ticks.map((t, i) => (
                    <g key={i}>
                      <line x1={PL} x2={W - PR} y1={t.y} y2={t.y} stroke="#1e293b" strokeDasharray="3 4" />
                      <text x={PL - 8} y={t.y + 4} textAnchor="end" fontSize="11" fill="#64748b">{t.val.toFixed(0)}</text>
                    </g>
                  ))}
                  <path className="lfx-chart-area" d={chart.area} fill="url(#lfx-grad)" />
                  <path className="lfx-chart-line" d={chart.line} pathLength={1} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {chart.pts.map((p, i) => {
                    const prev = chart.pts[i - 1]?.val ?? p.val;
                    return (
                      <circle key={i} cx={p.x} cy={p.y} r={hoverIdx === i ? 6 : 3.5}
                        fill={i === 0 ? '#94a3b8' : p.val >= prev ? '#38bdf8' : '#f43f5e'} stroke="#0b1329" strokeWidth="1.5"
                        style={{ transition: 'r .12s', cursor: i > 0 ? 'pointer' : 'default' }}
                        onClick={() => { if (i > 0) jumpToTrade(analytics.chrono[i - 1].id); }} />
                    );
                  })}
                  {hp && (
                    <g pointerEvents="none">
                      <line x1={hp.x} x2={hp.x} y1={PT} y2={H - PB} stroke="#475569" strokeDasharray="3 3" />
                      <g transform={`translate(${Math.min(Math.max(hp.x - 75, PL), W - PR - 150)},${PT})`}>
                        <rect width="150" height="42" rx="8" fill="#0f172a" stroke="#334155" />
                        <text x="10" y="17" fontSize="11" fill="#94a3b8">{hoverTrade ? hoverTrade.asset.slice(0, 22) : 'Başlangıç'}</text>
                        <text x="10" y="34" fontSize="13" fontWeight="700" fill="#f8fafc">
                          {money(hp.val)}{hoverTrade ? `  (${signedMoney(hoverTrade.pnl)})` : ''}
                        </text>
                      </g>
                    </g>
                  )}
                </svg>
              )}
            </div>
          </div>

          {/* PNL TAKVİMİ */}
          <div className="lfx-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 className="lfx-title" style={{ margin: 0 }}><Calendar size={15} color="#38bdf8" /> Günlük PnL takvimi</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.8em' }}>
                <button className="lfx-ghost" onClick={() => setMonthOffset(o => o - 1)}>‹</button>
                <span style={{ minWidth: 110, textAlign: 'center', textTransform: 'capitalize' }}>{cal.label}</span>
                <button className="lfx-ghost" onClick={() => setMonthOffset(o => o + 1)} disabled={monthOffset >= 0}>›</button>
              </div>
            </div>
            <div className="lfx-cal" style={{ marginBottom: 4 }}>
              {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(d => (
                <div key={d} style={{ fontSize: '.65em', color: 'var(--dim)', textAlign: 'center' }}>{d}</div>
              ))}
            </div>
            <div className="lfx-cal">
              {Array.from({ length: cal.offset }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: cal.days }).map((_, i) => {
                const day = i + 1, v = cal.map[day];
                const bg = v === undefined ? undefined
                  : `rgba(${v >= 0 ? '56,189,248' : '244,63,94'},${0.18 + 0.6 * Math.min(1, Math.abs(v) / cal.maxAbs)})`;
                return (
                  <div key={day} className="lfx-cal-d" style={bg ? { background: bg, color: '#f8fafc' } : undefined} title={v !== undefined ? signedMoney(v) : ''}>
                    <span>{day}</span>
                    {v !== undefined && <strong style={{ fontSize: '1.05em', alignSelf: 'flex-end' }}>{v > 0 ? '+' : ''}{Math.round(v)}</strong>}
                  </div>
                );
              })}
            </div>
            <div className="lfx-sub" style={{ marginTop: 10 }}>Ay toplamı: <strong style={{ color: pnlColor(cal.total) }}>{signedMoney(cal.total)}</strong></div>
          </div>
        </div>

        {/* SAĞ: İŞLEM GEÇMİŞİ */}
        <div className="lfx-card" style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: '1.1em', fontWeight: 700 }}>İşlem geçmişi <span style={{ color: 'var(--dim)', fontWeight: 500, fontSize: '.8em' }}>({visibleTrades.length})</span></h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['ALL', 'TP', 'SL', 'BE'] as Filter[]).map(f => (
                <button key={f} className={`lfx-chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
                  {f === 'ALL' ? 'Tümü' : f === 'BE' ? 'Entry stop' : f}
                </button>
              ))}
            </div>
          </div>
          <input className="lfx-input" style={{ marginBottom: 14 }} placeholder="Piyasa, setup veya notlarda ara..." value={listSearch} onChange={e => setListSearch(e.target.value)} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(100vh - 220px)', minHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
            {visibleTrades.length === 0 ? (
              <p style={{ color: 'var(--dim)', textAlign: 'center', padding: 40, fontSize: '.9em' }}>
                {trades.length === 0 ? 'Henüz kayıtlı işlem yok. Soldaki formdan ilk işlemini ekle.' : 'Bu filtreyle eşleşen işlem yok.'}
              </p>
            ) : visibleTrades.map(t => (
              <div key={t.id} ref={node => { tradeRefs.current[t.id] = node; }}
                className={`lfx-trade ${highlightedId === t.id ? 'hl' : ''}`} style={{ borderLeft: `4px solid ${statusColor(t.resultStatus)}` }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
                  {t.imagePaths?.length ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {t.imagePaths.map((img, i) => <img key={i} src={img} alt="SS" className="lfx-thumb" loading="lazy" onClick={() => setModalImage(img)} />)}
                    </div>
                  ) : (
                    <div style={{ width: 42, height: 36, background: 'var(--card)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '.65em' }}>Yok</div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '.9em' }}>{t.asset}</strong>
                      <span style={{ color: t.type === 'LONG' ? COLORS.tp : COLORS.sl, fontSize: '.75em', fontWeight: 'bold' }}>{t.type}</span>
                      <span style={{ background: 'rgba(255,255,255,.05)', color: statusColor(t.resultStatus), padding: '2px 6px', borderRadius: 4, fontSize: '.7em', fontWeight: 'bold' }}>
                        {t.resultStatus === 'BE' ? 'Entry stop' : t.resultStatus}
                      </span>
                      {t.setup && <span style={{ color: 'var(--mut)', border: '1px solid var(--line2)', padding: '1px 6px', borderRadius: 10, fontSize: '.68em' }}>{t.setup}</span>}
                    </div>
                    <div style={{ fontSize: '.78em', color: 'var(--mut)' }}>
                      EP: {t.entryPrice} | SL: {t.stopLossPrice} | TP: {t.exitPrice || '-'} · {new Date(t.date).toLocaleDateString('tr-TR')}
                    </div>
                    {t.note && <div style={{ fontSize: '.74em', color: 'var(--dim)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }} title={t.note}>📝 {t.note}</div>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: pnlColor(t.pnl), fontVariantNumeric: 'tabular-nums' }}>{signedMoney(t.pnl)}</div>
                    <div style={{ fontSize: '.72em', color: 'var(--dim)' }}>{t.rr}R</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="lfx-icon-btn" style={{ color: 'var(--blue)' }} onClick={() => handleEdit(t)} title="Düzenle"><Edit3 size={14} /></button>
                    <button className="lfx-icon-btn" style={{ color: 'var(--red)' }} onClick={() => handleDelete(t.id)} title="Sil"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RESİM MODAL */}
      {modalImage && (
        <div className="lfx-modal" onClick={() => setModalImage(null)}>
          <div className="lfx-modal-box" onClick={e => e.stopPropagation()}>
            <button onClick={() => setModalImage(null)}
              style={{ position: 'absolute', top: -10, right: -10, background: 'var(--red)', border: 'none', color: '#fff', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} />
            </button>
            <img src={modalImage} alt="SS" style={{ maxWidth: '80vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 6, display: 'block' }} />
          </div>
        </div>
      )}

      {toast && <div className="lfx-toast">{toast}</div>}
    </div>
  );
}