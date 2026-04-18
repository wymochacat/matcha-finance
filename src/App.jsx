import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  linkWithRedirect,
  signInWithRedirect,
  getRedirectResult
} from "firebase/auth";
import { getFirestore, collection, doc, addDoc, deleteDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { PlusCircle, MinusCircle, PieChart as PieChartIcon, List, Wallet, Search, Trash2, Settings, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const firebaseConfig = {
  apiKey: "AIzaSyDZwLj5uqNsKh0CXjLOD1bfaiyRxcB06mw",
  authDomain: "remarkable-haupia-a29fc0.netlify.app",
  projectId: "matcha-finance-c0ded",
  storageBucket: "matcha-finance-c0ded.firebasestorage.app",
  messagingSenderId: "1093233452978",
  appId: "1:1093233452978:web:2322b8f8191b3337e026ab"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const APP_ID = 'matcha-finance-app';

const CATEGORIES = {
  expense: ['飲食', '交通', '購物', '娛樂', '居住', '醫療', '教育', '其他'],
  income: ['薪資', '獎金', '投資', '零用錢', '其他']
};
const COLORS = ['#8FB996', '#596D48', '#B1C595', '#708238', '#C2D5A8', '#4E5F3E', '#A4B494', '#6B8E23'];

function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authDebug, setAuthDebug] = useState('');
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
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const formDetailsRef = useRef(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  // ─── Auth：先處理 redirect 結果，再啟動監聽 ──────────────────────────────
  // getRedirectResult 必須在 onAuthStateChanged 之前完成，
  // 否則 signInAnonymously 會在 Google session 建立前搶先執行把結果蓋掉。
  useEffect(() => {
    let unsubscribe = () => {};

    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setAuthDebug('✅ 登入成功：' + result.user.email);
        } else {
          setAuthDebug('');
        }
      })
      .catch((error) => {
        if (error.code === 'auth/credential-already-in-use') {
          signInWithRedirect(auth, googleProvider);
        } else if (error.code && error.code !== 'auth/no-auth-event') {
          setAuthDebug('❌ ' + error.code + ': ' + error.message);
        }
      })
      .finally(() => {
        unsubscribe = onAuthStateChanged(auth, (u) => {
          if (!u) signInAnonymously(auth);
          setUser(u);
        });
      });

    return () => unsubscribe();
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

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
        type, amount: parseFloat(amount), category, note, date: parseLocalDate(date), createdAt: Timestamp.now()
      });
      setAmount(''); setNote('');
      if (formDetailsRef.current) formDetailsRef.current.open = false;
    } catch (err) { console.error(err); }
  };

  const linkWithGoogle = async () => {
    try {
      if (auth.currentUser?.isAnonymous) {
        await linkWithRedirect(auth.currentUser, googleProvider);
      } else {
        await signInWithRedirect(auth, googleProvider);
      }
    } catch (error) {
      if (error.code !== 'auth/provider-already-linked') {
        setAuthDebug('❌ ' + error.code + ': ' + error.message);
        alert("連結失敗：" + error.message);
      }
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const deleteTx = async (id) => {
    if (!user) return;
    try { await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'transactions', id)); }
    catch (err) { console.error(err); }
  };

  const handlePrevMonth = () => {
    setViewDate(prev => {
      const d = new Date(prev);
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setViewDate(prev => {
      const d = new Date(prev);
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const d = darkMode ? {
    bg: 'bg-gray-950',
    card: 'bg-gray-800',
    text: 'text-white',
    textMuted: 'text-gray-400',
    input: 'bg-gray-700 text-white',
    nav: 'bg-gray-900/80 border-gray-700',
    tag: 'bg-gray-700 text-gray-300',
    empty: 'bg-gray-800/50 border-gray-700',
    progressBg: 'bg-gray-700',
    chartItem: 'bg-gray-700',
    borderColor: 'border-gray-700',
    navBorder: 'border-gray-900',
  } : {
    bg: 'bg-stone-50',
    card: 'bg-white',
    text: 'text-stone-800',
    textMuted: 'text-stone-400',
    input: 'bg-white text-stone-800',
    nav: 'bg-white/70 border-stone-100',
    tag: 'bg-stone-100 text-stone-400',
    empty: 'bg-white/50 border-stone-100',
    progressBg: 'bg-stone-100',
    chartItem: 'bg-stone-50',
    borderColor: 'border-stone-50',
    navBorder: 'border-stone-50',
  };

  if (loading) return (
    <div className={`flex items-center justify-center h-screen ${d.bg}`}>
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-stone-200 border-t-[#8FB996]"></div>
        <p className="text-stone-400 text-sm font-bold animate-pulse">連線到抹茶雲端...</p>
      </div>
    </div>
  );

  const budgetNum = Number(budget) || 0;

  return (
    <div className={`min-h-screen ${d.bg} pb-32 ${d.text} transition-colors duration-300`}>

      <header className="bg-[#8FB996] text-white p-6 pt-16 rounded-b-[3rem] shadow-xl sticky top-0 z-40">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-black tracking-tighter">抹茶記帳</h1>
            <div className="flex gap-2">
              <button onClick={() => setDarkMode(!darkMode)} className="p-3 bg-white/20 rounded-2xl">
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className="p-3 bg-white/20 rounded-2xl">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="bg-[#596D48]/80 p-6 rounded-[2.5rem] text-center">
            <p className="text-[#C2D5A8] text-xs font-bold mb-1">我的資產總計</p>
            <div className="text-4xl font-black">${stats.balance.toLocaleString()}</div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 mt-8">

        {showSettings && (
          <div className={`${d.card} rounded-3xl p-6 shadow-lg mb-8 space-y-6`}>
            <div>
              <h3 className={`font-black ${d.textMuted} mb-4 text-sm`}>每月預算限制</h3>
              <div className="flex gap-3">
                <input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} className={`flex-1 ${d.input} p-4 rounded-2xl outline-none font-bold text-lg`} />
                <button onClick={() => setShowSettings(false)} className="bg-[#596D48] text-white px-6 rounded-2xl font-black">儲存</button>
              </div>
            </div>
            <div className={`border-t ${d.borderColor} pt-6`}>
              <h3 className={`font-black ${d.textMuted} mb-4 text-sm`}>帳號</h3>
              {user?.isAnonymous ? (
                <div>
                  <p className={`text-xs ${d.textMuted} mb-3`}>連結 Google 帳號後，換手機也能看到所有資料</p>
                  <button onClick={linkWithGoogle} className="w-full py-4 rounded-2xl bg-[#596D48] text-white font-black text-sm">
                    連結 Google 帳號
                  </button>
                </div>
              ) : (
                <div>
                  <p className={`text-xs ${d.textMuted} mb-3`}>已登入：{user?.email || user?.displayName || '已連結 Google 帳號'}</p>
                  <button onClick={handleSignOut} className="w-full py-4 rounded-2xl bg-red-400 text-white font-black text-sm">
                    登出
                  </button>
                </div>
              )}
              {authDebug ? (
                <div className={`mt-3 p-3 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-stone-100'}`}>
                  <p className={`text-xs font-mono break-all ${d.textMuted}`}>{authDebug}</p>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className={`${d.card} rounded-3xl p-2 shadow-sm flex items-center justify-between`}>
            <button onClick={handlePrevMonth} className="p-4 text-[#596D48]"><ChevronLeft /></button>
            <span className={`font-black ${d.textMuted} text-sm`}>{viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月</span>
            <button onClick={handleNextMonth} className="p-4 text-[#596D48]"><ChevronRight /></button>
          </div>
          <div className={`${d.card} rounded-3xl p-5 shadow-sm`}>
            <div className={`flex justify-between text-xs mb-2 font-bold ${d.textMuted}`}>
              <span>本月消耗</span>
              <span className={stats.monthExpense > budgetNum ? 'text-red-500' : 'text-[#8FB996]'}>{budgetNum > 0 ? Math.round((stats.monthExpense / budgetNum) * 100) : 0}%</span>
            </div>
            <div className={`w-full ${d.progressBg} rounded-full h-2.5 overflow-hidden`}>
              <div className={`h-full rounded-full transition-all ${(stats.monthExpense / budgetNum) > 1 ? 'bg-red-400' : 'bg-[#8FB996]'}`} style={{ width: `${budgetNum > 0 ? Math.min((stats.monthExpense / budgetNum) * 100, 100) : 0}%` }}></div>
            </div>
          </div>
        </div>

        <details ref={formDetailsRef} className={`${d.card} rounded-[2.5rem] shadow-sm mb-8 overflow-hidden`}>
          <summary className="p-6 flex justify-between items-center cursor-pointer list-none">
            <div className="flex items-center gap-4">
              <div className="bg-[#E9F0EA] p-4 rounded-3xl text-[#8FB996]"><PlusCircle /></div>
              <span className={`font-black ${d.text}`}>新增收支紀錄</span>
            </div>
            <span className={`text-xs ${d.tag} font-bold px-4 py-1.5 rounded-full`}>Quick Add</span>
          </summary>
          <form onSubmit={handleSubmit} className={`p-6 border-t ${d.borderColor} space-y-5`}>
            <div className={`flex p-2 ${darkMode ? 'bg-gray-700' : 'bg-stone-200/40'} rounded-2xl`}>
              <button type="button" onClick={() => { setType('expense'); setCategory(CATEGORIES.expense[0]); }} className={`flex-1 py-3 text-xs font-black rounded-xl ${type === 'expense' ? `${d.card} text-red-500 shadow-lg` : d.textMuted}`}>支出</button>
              <button type="button" onClick={() => { setType('income'); setCategory(CATEGORIES.income[0]); }} className={`flex-1 py-3 text-xs font-black rounded-xl ${type === 'income' ? `${d.card} text-[#596D48] shadow-lg` : d.textMuted}`}>收入</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={`text-xs font-bold ${d.textMuted} ml-2`}>日期</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`w-full ${d.input} rounded-2xl p-4 text-sm outline-none shadow-sm`} />
              </div>
              <div className="space-y-2">
                <label className={`text-xs font-bold ${d.textMuted} ml-2`}>分類</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={`w-full ${d.input} rounded-2xl p-4 text-sm outline-none shadow-sm`}>
                  {CATEGORIES[type].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className={`text-xs font-bold ${d.textMuted} ml-2`}>金額</label>
              <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className={`w-full ${d.input} rounded-3xl p-6 text-4xl font-black outline-none text-[#596D48]`} />
            </div>
            <div className="space-y-2">
              <label className={`text-xs font-bold ${d.textMuted} ml-2`}>備註</label>
              <input type="text" placeholder="買了什麼？賺了什麼？" value={note} onChange={(e) => setNote(e.target.value)} className={`w-full ${d.input} rounded-2xl p-4 text-sm outline-none shadow-sm`} />
            </div>
            <button type="submit" className={`w-full py-6 rounded-3xl font-black text-white shadow-xl ${type === 'expense' ? 'bg-red-400' : 'bg-[#596D48]'}`}>確認儲存</button>
          </form>
        </details>

        <div className="flex gap-3 mb-8">
          <div className="relative flex-1">
            <Search className={`absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 ${d.textMuted}`} />
            <input type="text" placeholder="搜尋紀錄..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full pl-14 pr-6 py-5 ${d.input} rounded-[1.8rem] text-sm outline-none font-bold shadow-sm`} />
          </div>
          <div className={`flex ${d.card} rounded-2xl shadow-sm p-2`}>
            <button onClick={() => setActiveTab('list')} className={`p-3 rounded-xl ${activeTab === 'list' ? 'bg-[#E9F0EA] text-[#596D48]' : d.textMuted}`}><List className="w-5 h-5" /></button>
            <button onClick={() => setActiveTab('chart')} className={`p-3 rounded-xl ${activeTab === 'chart' ? 'bg-[#E9F0EA] text-[#596D48]' : d.textMuted}`}><PieChartIcon className="w-5 h-5" /></button>
          </div>
        </div>

        {activeTab === 'list' ? (
          <div className="space-y-4">
            {filtered.map((t) => (
              <div key={t.id} className={`${d.card} p-6 rounded-[2.5rem] shadow-sm flex items-center justify-between`}>
                <div className="flex items-center gap-5">
                  <div className={`p-4 rounded-[1.5rem] ${t.type === 'expense' ? 'bg-red-50 text-red-400' : 'bg-[#E9F0EA] text-[#596D48]'}`}>
                    {t.type === 'expense' ? <MinusCircle className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className={`font-black ${d.text}`}>{t.category}</div>
                    <div className={`text-xs ${d.textMuted} mt-1`}>{t.date.toLocaleDateString('zh-TW')}{t.note ? ` • ${t.note}` : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className={`font-black text-xl ${t.type === 'expense' ? d.text : 'text-[#596D48]'}`}>{t.type === 'expense' ? '-' : '+'}${t.amount.toLocaleString()}</div>
                  <button onClick={() => deleteTx(t.id)} className={`p-2 ${d.textMuted} hover:text-red-400`}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className={`text-center py-24 ${d.empty} rounded-[3rem] border-2 border-dashed`}>
                <Wallet className={`w-12 h-12 ${d.textMuted} mx-auto mb-3`} />
                <div className={`${d.textMuted} font-black text-sm`}>無任何收支紀錄</div>
              </div>
            )}
          </div>
        ) : (
          <div className={`${d.card} p-10 rounded-[3rem] shadow-sm min-h-[400px]`}>
            {stats.chartData.length > 0 ? (
              <>
                <h4 className={`text-center font-black ${d.textMuted} text-xs mb-8`}>支出比例分析</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.chartData} innerRadius={70} outerRadius={90} paddingAngle={8} dataKey="value" stroke="none">
                        {stats.chartData.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-8 grid grid-cols-2 gap-3">
                  {stats.chartData.map((item, idx) => (
                    <div key={item.name} className={`flex flex-col p-4 ${d.chartItem} rounded-3xl`}>
                      <span className={`flex items-center gap-2 text-xs font-bold ${d.textMuted} mb-1`}>
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                        {item.name}
                      </span>
                      <span className={`font-black ${d.text}`}>${item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={`text-center py-24 ${d.textMuted} font-black`}>本月尚未產生報表</div>
            )}
          </div>
        )}
      </main>

      <nav className={`fixed bottom-0 left-0 right-0 ${d.nav} backdrop-blur-xl border-t pb-8 pt-4 px-14 flex justify-between items-center z-50`}>
        <button onClick={() => setActiveTab('list')} className={`flex flex-col items-center gap-1 ${activeTab === 'list' ? 'text-[#596D48]' : d.textMuted}`}>
          <List className="w-6 h-6" />
          <span className="text-xs font-bold">列表</span>
        </button>
        <button onClick={() => { if (formDetailsRef.current) { formDetailsRef.current.open = true; formDetailsRef.current.scrollIntoView({ behavior: 'smooth' }); }}} className={`bg-[#8FB996] p-5 rounded-[2rem] shadow-xl -mt-12 border-8 ${d.navBorder}`}>
          <PlusCircle className="w-8 h-8 text-white" />
        </button>
        <button onClick={() => setActiveTab('chart')} className={`flex flex-col items-center gap-1 ${activeTab === 'chart' ? 'text-[#596D48]' : d.textMuted}`}>
          <PieChartIcon className="w-6 h-6" />
          <span className="text-xs font-bold">圖表</span>
        </button>
      </nav>
    </div>
  );
}
