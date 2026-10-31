class KnowledgeApp {
  constructor() {
    this.dbName = 'KnowledgeEncyclopediaDB';
    this.dbVersion = 2;
    this.db = null;
    this.currentView = 'home';
    this.userStats = JSON.parse(localStorage.getItem('kb_stats')) || { attempted: 0, correct: 0, bookmarks: [] };
    this.init();
  }

  async init() {
    await this.initDB();
    await this.loadInitialDataIfNeeded();
    this.renderView('home');
    this.registerServiceWorker();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error:', err));
    }
  }

  initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('questions')) {
          const store = db.createObjectStore('questions', { keyPath: 'id' });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('difficulty', 'difficulty', { unique: false });
        }
      };
    });
  }

  async loadInitialDataIfNeeded() {
    const count = await this.getQuestionCount();
    if (count === 0) {
      try {
        const response = await fetch('./data-sample.json');
        const data = await response.json();
        await this.importQuestions(data);
      } catch (e) {
        console.log('No local sample JSON found.');
      }
    }
  }

  getQuestionCount() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['questions'], 'readonly');
      const store = transaction.objectStore('questions');
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  importQuestions(questionsArray) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['questions'], 'readwrite');
      const store = transaction.objectStore('questions');
      questionsArray.forEach(q => store.put(q));
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  resetStats() {
    if (confirm('هل أنت متأكد من رغبتك في تصفير العدادات والبدء من الصفر؟')) {
      this.userStats = { attempted: 0, correct: 0, bookmarks: [] };
      localStorage.setItem('kb_stats', JSON.stringify(this.userStats));
      this.renderView('home');
    }
  }

  navigate(viewName, params = {}) {
    this.currentView = viewName;
    this.renderView(viewName, params);
  }

  async renderView(viewName, params = {}) {
    const container = document.getElementById('app-view');
    container.innerHTML = '<div class="flex justify-center items-center py-20"><i class="fa-solid fa-spinner fa-spin text-3xl text-indigo-500"></i></div>';
    const totalQ = await this.getQuestionCount();

    switch(viewName) {
      case 'home':
        container.innerHTML = `
          <div class="space-y-6">
            <div class="glass p-6 rounded-3xl relative overflow-hidden bg-gradient-to-br from-indigo-900/50 to-slate-900/80 border-indigo-500/20 shadow-xl">
              <div class="flex justify-between items-start mb-2">
                <h2 class="text-2xl font-black">موسوعة المعرفة</h2>
                <button onclick="app.resetStats()" class="bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 text-xs px-3 py-1.5 rounded-xl border border-rose-500/30 transition flex items-center gap-1.5" title="إعادة تعيين العدادات">
                  <i class="fa-solid fa-rotate-right"></i> تصفير الإحصائيات
                </button>
              </div>
              <p class="text-slate-400 text-sm mb-4">بوابتك الشاملة لمليون سؤال بدون إنترنت لخدمة المجتمع</p>
              <div class="grid grid-cols-2 gap-3 text-center">
                <div class="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
                  <span class="block text-2xl font-bold text-indigo-400">${totalQ.toLocaleString('ar-EG')}</span>
                  <span class="text-xs text-slate-400">إجمالي الأسئلة</span>
                </div>
                <div class="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
                  <span class="block text-2xl font-bold text-emerald-400">${this.userStats.correct} / ${this.userStats.attempted}</span>
                  <span class="text-xs text-slate-400">الصحيحة / المحاولات</span>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <button onclick="app.startQuizSetup('learning')" class="glass p-4 rounded-2xl text-right hover:border-indigo-500 transition">
                <div class="bg-indigo-600/20 text-indigo-400 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                  <i class="fa-solid fa-book-open text-lg"></i>
                </div>
                <h3 class="font-bold text-sm">نظام التعلم</h3>
                <p class="text-xs text-slate-400">تصفح الإجابات والشرح الفوري</p>
              </button>
              <button onclick="app.startQuizSetup('exam')" class="glass p-4 rounded-2xl text-right hover:border-indigo-500 transition">
                <div class="bg-purple-600/20 text-purple-400 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                  <i class="fa-solid fa-clock text-lg"></i>
                </div>
                <h3 class="font-bold text-sm">نظام الاختبار</h3>
                <p class="text-xs text-slate-400">حدد عدد الأسئلة واختبر نفسك</p>
              </button>
              <button onclick="app.startQuizSetup('genius')" class="glass p-4 rounded-2xl text-right hover:border-amber-500 transition">
                <div class="bg-amber-600/20 text-amber-400 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                  <i class="fa-solid fa-brain text-lg"></i>
                </div>
                <h3 class="font-bold text-sm">تحدي العباقرة</h3>
                <p class="text-xs text-slate-400">أسئلة صعبة ومتقدمة بعدد تختاره</p>
              </button>
              <button onclick="app.navigate('categories')" class="glass p-4 rounded-2xl text-right hover:border-emerald-500 transition">
                <div class="bg-emerald-600/20 text-emerald-400 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                  <i class="fa-solid fa-layer-group text-lg"></i>
                </div>
                <h3 class="font-bold text-sm">حسب التخصص</h3>
                <p class="text-xs text-slate-400">تصفح الأقسام والأسئلة</p>
              </button>
            </div>
          </div>
        `;
        break;

      case 'categories':
        const categories = [
          "الجغرافيا والدول", "التاريخ والحضارات", "العلوم العامة والفيزياء", 
          "هندسة المساحة والجيوماتكس", "الذكاء الاصطناعي وعلوم الحاسب", 
          "الفلك والفضاء", "التاريخ المصري القديم", "الرياضيات والهندسة التحليلية",
          "الأحياء والطب البشري", "الاقتصاد والأعمال"
        ];
        
        let catHtml = '';
        for (let cat of categories) {
          const qList = await this.getQuestionsByCategory(cat);
          catHtml += `
            <div onclick="app.startCategoryQuiz('${cat}')" class="glass p-4 rounded-2xl flex justify-between items-center cursor-pointer hover:border-indigo-500 transition">
              <span class="font-semibold text-sm">${cat}</span>
              <span class="text-xs bg-indigo-600/20 text-indigo-300 px-2.5 py-1 rounded-xl">(${qList.length} سؤال)</span>
            </div>
          `;
        }

        container.innerHTML = `
          <div class="space-y-4">
            <h2 class="text-xl font-bold">التخصصات المعرفية</h2>
            <div class="grid grid-cols-1 gap-2.5">
              ${catHtml}
            </div>
          </div>
        `;
        break;

      case 'search':
        container.innerHTML = `
          <div class="space-y-4">
            <h2 class="text-xl font-bold">بحث متقدم</h2>
            <input type="text" oninput="app.performSearch(this.value)" placeholder="ابحث عن سؤال أو معلومة..." class="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-indigo-500">
            <div id="search-results" class="space-y-3"><p class="text-center text-slate-500 text-sm py-10">اكتب للبحث...</p></div>
          </div>
        `;
        break;

      case 'dashboard':
        container.innerHTML = `
          <div class="space-y-4">
            <h2 class="text-xl font-bold">لوحة التحكم وإدارة الأسئلة</h2>
            <div class="glass p-5 rounded-3xl space-y-4">
              <h3 class="font-bold text-sm text-indigo-400">استيراد دفعة أسئلة جديدة (JSON)</h3>
              <input type="file" id="json-file-input" accept=".json" class="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700">
              <button onclick="app.handleImportFile()" class="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-2xl font-bold text-sm transition">حفظ الدفعة في قاعدة البيانات</button>
            </div>
          </div>
        `;
        break;
    }
  }

  async startQuizSetup(mode) {
    let questions = await this.getAllQuestions();
    if (mode === 'genius') {
      questions = questions.filter(q => q.difficulty === 'صعب' || q.difficulty === 'عباقرة');
      if (questions.length === 0) questions = await this.getAllQuestions();
    }
    if (questions.length === 0) { alert('لا توجد أسئلة متاحة.'); return; }

    const container = document.getElementById('app-view');
    container.innerHTML = `
      <div class="glass p-6 rounded-3xl space-y-6 text-center my-auto">
        <h2 class="text-xl font-bold">إعدادات الاختبار (${mode === 'learning' ? 'نظام التعلم' : mode === 'exam' ? 'نظام الاختبار' : 'تحدي العباقرة'})</h2>
        <p class="text-xs text-slate-400">إجمالي الأسئلة المتاحة في هذا القسم: <span class="text-indigo-400 font-bold">${questions.length}</span></p>
        <div class="space-y-2 text-right">
          <label class="text-xs font-semibold text-slate-300">حدد عدد الأسئلة التي تريد الإجابة عليها:</label>
          <input type="number" id="quiz-count-input" value="${Math.min(10, questions.length)}" min="1" max="${questions.length}" class="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 px-4 text-sm text-center focus:outline-none focus:border-indigo-500 font-bold">
        </div>
        <button onclick="app.launchQuizSession('${mode}')" class="w-full bg-indigo-600 hover:bg-indigo-700 py-3.5 rounded-2xl font-bold transition shadow-lg">ابدأ الآن</button>
        <button onclick="app.navigate('home')" class="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-2xl font-bold text-xs text-slate-400 transition">إلغاء والعودة</button>
      </div>
    `;
    this.setupQuestionsCache = questions;
  }

  async launchQuizSession(mode) {
    const countInput = document.getElementById('quiz-count-input');
    let limit = parseInt(countInput.value) || 5;
    let selectedQuestions = [...this.setupQuestionsCache].sort(() => 0.5 - Math.random()).slice(0, limit);
    this.runQuizSession(selectedQuestions);
  }

  async startCategoryQuiz(category) {
    let questions = await this.getQuestionsByCategory(category);
    if (questions.length === 0) { alert('لا توجد أسئلة في هذا التخصص.'); return; }
    this.runQuizSession(questions);
  }

  getAllQuestions() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['questions'], 'readonly');
      const store = transaction.objectStore('questions');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  getQuestionsByCategory(category) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['questions'], 'readonly');
      const store = transaction.objectStore('questions');
      const index = store.index('category');
      const request = index.getAll(category);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  runQuizSession(questions) {
    let currentIndex = 0;
    const container = document.getElementById('app-view');

    const renderQuestion = () => {
      if (currentIndex >= questions.length) {
        container.innerHTML = `
          <div class="glass p-6 rounded-3xl text-center space-y-4 my-auto">
            <div class="text-emerald-400 text-5xl mb-2"><i class="fa-solid fa-circle-check"></i></div>
            <h2 class="text-xl font-bold">أنهيت الأسئلة بنجاح!</h2>
            <p class="text-xs text-slate-400">تم حفظ نتيجتك وإحصائياتك بنجاح.</p>
            <button onclick="app.navigate('home')" class="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-2xl font-bold transition">العودة للرئيسية</button>
          </div>
        `;
        return;
      }

      const q = questions[currentIndex];
      container.innerHTML = `
        <div class="space-y-4">
          <div class="flex justify-between items-center text-xs text-slate-400">
            <span>السؤال ${currentIndex + 1} من ${questions.length}</span>
            <span class="bg-indigo-600/20 text-indigo-400 px-2.5 py-1 rounded-lg">${q.category}</span>
          </div>
          <div class="glass p-6 rounded-3xl space-y-4">
            <h3 class="font-bold text-base leading-relaxed">${q.question}</h3>
            <div class="space-y-2.5" id="options-container">
              ${q.options.map((opt) => `
                <button onclick="app.handleAnswerClick(this, '${opt.replace(/'/g, "\\'")}', '${q.answer.replace(/'/g, "\\'")}')" class="w-full text-right p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-sm transition font-medium">
                  ${opt}
                </button>
              `).join('')}
            </div>
            <div id="explanation-box" class="hidden mt-4 p-4 rounded-2xl bg-slate-800/90 border border-slate-700 text-xs space-y-2">
              <p class="font-bold text-indigo-400"><i class="fa-solid fa-circle-info ml-1"></i> الشرح والتوضيح:</p>
              <p class="text-slate-300">${q.explanation}</p>
              <p class="font-bold text-emerald-400 mt-2"><i class="fa-solid fa-lightbulb ml-1"></i> معلومة إضافية:</p>
              <p class="text-slate-300">${q.extraInfo}</p>
            </div>
          </div>
          <button onclick="app.nextQuestion('${questions.length}')" id="next-btn" class="hidden w-full bg-indigo-600 hover:bg-indigo-700 py-3.5 rounded-2xl font-bold transition shadow-lg shadow-indigo-600/30">السؤال التالي</button>
        </div>
      `;
      this.currentQuestions = questions;
      this.currentIndex = currentIndex;
    };

    renderQuestion();
  }

  handleAnswerClick(btnElement, selected, correct) {
    const container = document.getElementById('options-container');
    container.querySelectorAll('button').forEach(b => b.disabled = true);
    
    this.userStats.attempted++;
    if (selected.trim() === correct.trim()) {
      btnElement.classList.add('bg-emerald-600/30', 'border-emerald-500', 'text-emerald-300');
      this.userStats.correct++;
    } else {
      btnElement.classList.add('bg-rose-600/30', 'border-rose-500', 'text-rose-300');
      container.querySelectorAll('button').forEach(b => {
        if (b.textContent.trim() === correct.trim()) {
          b.classList.add('bg-emerald-600/30', 'border-emerald-500', 'text-emerald-300');
        }
      });
    }
    localStorage.setItem('kb_stats', JSON.stringify(this.userStats));

    document.getElementById('explanation-box').classList.remove('hidden');
    document.getElementById('next-btn').classList.remove('hidden');
  }

  nextQuestion(totalLength) {
    this.currentIndex++;
    if (this.currentIndex >= totalLength) {
      const container = document.getElementById('app-view');
      container.innerHTML = `
        <div class="glass p-6 rounded-3xl text-center space-y-4 my-auto">
          <div class="text-emerald-400 text-5xl mb-2"><i class="fa-solid fa-circle-check"></i></div>
          <h2 class="text-xl font-bold">أنهيت الاختبار بنجاح!</h2>
          <button onclick="app.navigate('home')" class="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-2xl font-bold transition">العودة للرئيسية</button>
        </div>
      `;
    } else {
      const q = this.currentQuestions[this.currentIndex];
      const container = document.getElementById('app-view');
      container.innerHTML = `
        <div class="space-y-4">
          <div class="flex justify-between items-center text-xs text-slate-400">
            <span>السؤال ${this.currentIndex + 1} من ${totalLength}</span>
            <span class="bg-indigo-600/20 text-indigo-400 px-2.5 py-1 rounded-lg">${q.category}</span>
          </div>
          <div class="glass p-6 rounded-3xl space-y-4">
            <h3 class="font-bold text-base leading-relaxed">${q.question}</h3>
            <div class="space-y-2.5" id="options-container">
              ${q.options.map((opt) => `
                <button onclick="app.handleAnswerClick(this, '${opt.replace(/'/g, "\\'")}', '${q.answer.replace(/'/g, "\\'")}')" class="w-full text-right p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-sm transition font-medium">
                  ${opt}
                </button>
              `).join('')}
            </div>
            <div id="explanation-box" class="hidden mt-4 p-4 rounded-2xl bg-slate-800/90 border border-slate-700 text-xs space-y-2">
              <p class="font-bold text-indigo-400"><i class="fa-solid fa-circle-info ml-1"></i> الشرح والتوضيح:</p>
              <p class="text-slate-300">${q.explanation}</p>
              <p class="font-bold text-emerald-400 mt-2"><i class="fa-solid fa-lightbulb ml-1"></i> معلومة إضافية:</p>
              <p class="text-slate-300">${q.extraInfo}</p>
            </div>
          </div>
          <button onclick="app.nextQuestion('${totalLength}')" id="next-btn" class="hidden w-full bg-indigo-600 hover:bg-indigo-700 py-3.5 rounded-2xl font-bold transition shadow-lg shadow-indigo-600/30">السؤال التالي</button>
        </div>
      `;
    }
  }

  async performSearch(query) {
    const resContainer = document.getElementById('search-results');
    if (!query || query.trim().length < 2) { 
      resContainer.innerHTML = '<p class="text-center text-slate-500 text-sm py-10">اكتب حرفين على الأقل للبحث...</p>'; 
      return; 
    }
    const all = await this.getAllQuestions();
    const filtered = all.filter(q => q.question.includes(query) || q.explanation.includes(query));
    resContainer.innerHTML = filtered.length === 0 ? '<p class="text-center text-slate-500 text-sm py-10">لا توجد نتائج مطابقة.</p>' : filtered.map(q => `
      <div class="glass p-4 rounded-2xl space-y-2">
        <span class="text-[10px] bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded">${q.category}</span>
        <h4 class="font-bold text-sm">${q.question}</h4>
        <p class="text-xs text-slate-400">الإجابة الصحيحة: <span class="text-emerald-400 font-bold">${q.answer}</span></p>
      </div>
    `).join('');
  }

  openDashboard() { this.navigate('dashboard'); }

  handleImportFile() {
    const fileInput = document.getElementById('json-file-input');
    if (!fileInput.files.length) { alert('اختر ملف JSON أولاً.'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        await this.importQuestions(data);
        alert('تم حفظ الأسئلة بنجاح!');
        this.navigate('home');
      } catch (err) { alert('خطأ في صيغة JSON.'); }
    };
    reader.readAsText(fileInput.files[0]);
  }
}

const app = new KnowledgeApp();
