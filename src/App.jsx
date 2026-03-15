import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, deleteDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { PlusCircle, MinusCircle, PieChart as PieChartIcon, List, Wallet, Search, Trash2, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const firebaseConfig = {
  apiKey: "AIzaSyDZwLj5uqNsKh0CXjLOD1bfaiyRxcB06mw",
  authDomain: "matcha-finance-c0ded.firebaseapp.com",
  projectId: "matcha-finance-c0ded",
  storageBucket: "matcha-finance-c0ded.firebasestorage.app",
  messagingSenderId: "1093233452978",
  appId: "1:1093233452978:web:2322b8f8191b3337e026ab"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = 'matcha-finance-app';

const CATEGORIES = {
  expense: ['飲食', '交通', '購物', '娛樂', '居住', '醫療', '教育', '其他'],
  income: ['薪資', '獎金', '投資', '零用錢', '其他']
};
const COLORS = ['#8FB996', '#596D48', '#B1C595', '#708238', '#C2D5A8', '#4E5F3E', '#A4B494', '#6B8E23'];

export default function App() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES.expense[0]);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [budget, setBudget] = useState(15000);
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('list');
  const formDetailsRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) signInAnonymously(auth);
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'transactions');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate ? d.data().date.toDate() : new Date(d.data().date)
      }));
      setTransactions(data.sort((a, b) => b.date - a.date));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, [user]);

  const stats = useMemo(() => {
    const m = viewDate.getMonth();
    const y = viewDate.getFullYear();
    let totalIncome = 0, totalExpense = 0, monthIncome = 0, monthExpense = 0;
    const categoryDataMap = {};
    transactions.forEach(t => {
      const val = parseFloat(t.amount);
      if (t.type === 'income') totalIncome += val; else totalExpense += val;
      if (t.date.getMonth() === m && t.date.getFullYear() === y) {
        if (t.type === 'income') monthIncome += val;
        else { monthExpense += val; categoryDataMap[t.category] = (categoryDataMap[t.category] || 0) + val; }
      }
    });
    return {
      balance: totalIncome - totalExpense, monthIncome, monthExpense,
      chartData: Object.keys(categoryDataMap).map(k => ({ name: k, value: categoryDataMap[k] })),
      monthTransactions: transactions.filter(t => t.date.getMonth() === m && t.date.getFullYear() === y)
    };
  }, [transactions, viewDate]);

  const filtered = stats.monthTransactions.filter(t =>
    (t.note || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || !user) return;
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'transactions'), {
        type, amount: parseFloat(amount), category, note, date: new Date(date), createdAt: Timestamp.now()
      });
      setAmount(''); setNote('');
      if (formDetailsRef.current) formDetailsRef.current.open = false;
    } catch (e) { console.error(e); }
  };

  const deleteTx = async (id) => {
    if (!user) return;
    try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'transactions', id)); }
    catch (e) { console.error(e); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-stone-50">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-stone-200 border-t-[#8FB996]"></div>
        <p className="text-stone-400 text-sm font-bold animate-pulse">連線到抹茶雲端...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 pb-32 text-stone-800">
      <header className="bg-[#8FB996] text-white p-6 pt-16 rounded-b-[3rem] shadow-xl sticky top-0 z-40">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-black tracking-tighter">抹茶記帳</h1>
            <button onClick={() => setShowSettings(!showSettings)} className="p-3 bg-white/20 rounded-2xl">
              <Settings className="w-5 h-5" />
            </button>
          </div>
          <div className="bg-[#596D48]/80 p-6 rounded-[2.5rem] text-center">
            <p className="text-[#C2D5A8] text-xs font-bold mb-1">我的資產總計</p>
            <div className="text-4xl font-black">${stats.balance.toLocaleString()}</div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 mt-8">
        {showSettings && (
          <div className="bg-white rounded-3xl p-6 shadow-lg mb-8">
            <h3 className="font-black text-stone-700 mb-4 text-sm">每月預算限制</h3>
            <div className="flex gap-3">
              <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="flex-1 bg-stone-50 p-4 rounded-2xl outline-none font-bold text-lg" />
              <button onClick={() => setShowSettings(false)} className="bg-[#596D48] text-white px-6 rounded-2xl font-black">儲存</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-3xl p-2 shadow-sm flex items-center justify-between">
            <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="p-4 text-[#596D48]"><ChevronLeft /></button>
            <span className="font-black text-stone-600 text-sm">{viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月</span>
            <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="p-4 text-[#596D48]"><ChevronRight /></button>
          </div>
          <div className="bg-white rounded-3xl p-5 shadow-sm">
            <div className="flex justify-between text-xs mb-2 font-bold text-stone-400">
              <span>本月消耗</span>
              <span className={stats.monthExpense > budget ? 'text-red-500' : 'text-[#8FB996]'}>{Math.round((stats.monthExpense / budget) * 100)}%</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${(stats.monthExpense / budget) > 1 ? 'bg-red-400' : 'bg-[#8FB996]'}`} style={{ width: `${Math.min((stats.monthExpense / budget) * 100, 100)}%` }}></div>
            </div>
          </div>
        </div>

        <details ref={formDetailsRef} className="bg-white rounded-[2.5rem] shadow-sm mb-8 overflow-hidden">
          <summary className="p-6 flex justify-between items-center cursor-pointer list-none">
            <div className="flex items-center gap-4">
              <div className="bg-[#E9F0EA] p-4 rounded-3xl text-[#8FB996]"><PlusCircle /></div>
              <span className="font-black text-stone-700">新增收支紀錄</span>
            </div>
            <span className="text-xs bg-stone-100 text-stone-400 font-bold px-4 py-1.5 rounded-full">Quick Add</span>
          </summary>
          <form onSubmit={handleSubmit} className="p-6 border-t space-y-5">
            <div className="flex p-2 bg-stone-200/40 rounded-2xl">
              <button type="button" onClick={() => setType('expense')} className={`flex-1 py-3 text-xs font-black rounded-xl ${type === 'expense' ? 'bg-white text-red-500 shadow-lg' : 'text-stone-400'}`}>支出</button>
              <button type="button" onClick={() => setType('income')} className={`flex-1 py-3 text-xs font-black rounded-xl ${type === 'income' ? 'bg-white text-[#596D48] shadow-lg' : 'text-stone-400'}`}>收入</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 ml-2">日期</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-white rounded-2xl p-4 text-sm outline-none shadow-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 ml-2">分類</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-white rounded-2xl p-4 text-sm outline-none shadow-sm">
                  {CATEGORIES[type].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 ml-2">金額</label>
              <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full bg-white rounded-3xl p-6 text-4xl font-black outline-none text-[#596D48]" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 ml-2">備註</label>
              <input type="text" placeholder="買了什麼？賺了什麼？" value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-white rounded-2xl p-4 text-sm outline-none shadow-sm" />
            </div>
            <button type="submit" className={`w-full py-6 rounded-3xl font-black text-white shadow-xl ${type === 'expense' ? 'bg-red-400' : 'bg-[#596D48]'}`}>確認儲存</button>
          </form>
        </details>

        <div className="flex gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
            <input type="text" placeholder="搜尋紀錄..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-5 bg-white rounded-[1.8rem] text-sm outline-none font-bold shadow-sm" />
          </div>
          <div className="flex bg-white rounded-2xl shadow-sm p-2">
            <button onClick={() => setActiveTab('list')} className={`p-3 rounded-xl ${activeTab === 'list' ? 'bg-[#E9F0EA] text-[#596D48]' : 'text-stone-300'}`}><List className="w-5 h-5" /></button>
            <button onClick={() => setActiveTab('chart')} className={`p-3 rounded-xl ${activeTab === 'chart' ? 'bg-[#E9F0EA] text-[#596D48]' : 'text-stone-300'}`}><PieChartIcon className="w-5 h-5" /></button>
          </div>
        </div>

        {activeTab === 'list' ? (
          <div className="space-y-4">
            {filtered.map((t) => (
              <div key={t.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className={`p-4 rounded-[1.5rem] ${t.type === 'expense' ? 'bg-red-50 text-red-400' : 'bg-[#E9F0EA] text-[#596D48]'}`}>
                    {t.type === 'expense' ? <MinusCircle className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-black text-stone-700">{t.category}</div>
                    <div className="text-xs text-stone-400 mt-1">{t.date.toLocaleDateString('zh-TW')}{t.note ? ` • ${t.note}` : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className={`font-black text-xl ${t.type === 'expense' ? 'text-stone-700' : 'text-[#596D48]'}`}>{t.type === 'expense' ? '-' : '+'}${t.amount.toLocaleString()}</div>
                  <button onClick={() => deleteTx(t.id)} className="p-2 text-stone-200 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-24 bg-white/50 rounded-[3rem] border-2 border-dashed border-stone-100">
                <Wallet className="w-12 h-12 text-stone-200 mx-auto mb-3" />
                <div className="text-stone-300 font-black text-sm">無任何收支紀錄</div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white p-10 rounded-[3rem] shadow-sm min-h-[400px]">
            {stats.chartData.length > 0 ? (
              <>
                <h4 className="text-center font-black text-stone-400 text-xs mb-8">支出比例分析</h4>
                <div className="h-64">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={stats.chartData} innerRadius={70} outerRadius={90} paddingAngle={8} dataKey="value" stroke="none">
                        {stats.chartData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  {stats.chartData.map((item, idx) => (
                    <div key={item.name} className="flex flex-col p-4 bg-stone-50 rounded-3xl">
                      <span className="flex items-center gap-2 text-xs font-bold text-stone-400 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                        {item.name}
                      </span>
                      <span className="font-black text-stone-700">${item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-24 text-stone-300 font-black">本月尚未產生報表</div>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-xl border-t border-stone-100 pb-8 pt-4 px-14 flex justify-between items-center z-50">
        <button onClick={() => setActiveTab('list')} className={`flex flex-col items-center gap-1 ${activeTab === 'list' ? 'text-[#596D48]' : 'text-stone-300'}`}>
          <List className="w-6 h-6" />
          <span className="text-xs font-bold">列表</span>
        </button>
        <button onClick={() => { if (formDetailsRef.current) { formDetailsRef.current.open = true; formDetailsRef.current.scrollIntoView({ behavior: 'smooth' }); }}} className="bg-[#8FB996] p-5 rounded-[2rem] shadow-xl -mt-12 border-8 border-stone-50">
          <PlusCircle className="w-8 h-8 text-white" />
        </button>
        <button onClick={() => setActiveTab('chart')} className={`flex flex-col items-center gap-1 ${activeTab === 'chart' ? 'text-[#596D48]' : 'text-stone-300'}`}>
          <PieChartIcon className="w-6 h-6" />
          <span className="text-xs font-bold">圖表</span>
        </button>
      </nav>
    </div>
  );
}