class KnowledgeApp {
  constructor() {
    this.dbName = 'KnowledgeEncyclopediaDB';
    this.dbVersion = 1;
    this.db = null;
    this.currentView = 'home';
    this.userStats = JSON.parse(localStorage.getItem('kb_stats')) || { attempted: 0, correct: 0, bookmarks: [] };
    this.isDarkMode = true;
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
              <h2 class="text-2xl font-black mb-1">مرحباً بك في موسوعة المعرفة</h2>
              <p class="text-slate-400 text-sm mb-4">بوابتك الشاملة لمليون سؤال بدون إنترنت</p>
              <div class="grid grid-cols-2 gap-3 text-center">
                <div class="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
                  <span class="block text-2xl font-bold text-indigo-400">${totalQ.toLocaleString('ar-EG')}</span>
                  <span class="text-xs text-slate-400">إجمالي الأسئلة</span>
                </div>
                <div class="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
                  <span class="block text-2xl font-bold text-emerald-400">${this.userStats.correct}</span>
                  <span class="text-xs text-slate-400">إجابات صحيحة</span>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <button onclick="app.startQuiz('learning')" class="glass p-4 rounded-2xl text-right hover:border-indigo-500 transition">
                <div class="bg-indigo-600/20 text-indigo-400 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                  <i class="fa-solid fa-book-open text-lg"></i>
                </div>
                <h3 class="font-bold text-sm">نظام التعلم</h3>
                <p class="text-xs text-slate-400">تصفح الإجابات والشرح الفوري</p>
              </button>
              <button onclick="app.startQuiz('exam')" class="glass p-4 rounded-2xl text-right hover:border-indigo-500 transition">
                <div class="bg-purple-600/20 text-purple-400 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                  <i class="fa-solid fa-clock text-lg"></i>
                </div>
                <h3 class="font-bold text-sm">نظام الاختبار</h3>
                <p class="text-xs text-slate-400">اختبر معلوماتك بنتيجة نهائية</p>
              </button>
              <button onclick="app.startQuiz('genius')" class="glass p-4 rounded-2xl text-right hover:border-amber-500 transition">
                <div class="bg-amber-600/20 text-amber-400 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                  <i class="fa-solid fa-brain text-lg"></i>
                </div>
                <h3 class="font-bold text-sm">تحدي العباقرة</h3>
                <p class="text-xs text-slate-400">أسئلة صعبة ومتقدمة</p>
              </button>
              <button onclick="app.navigate('categories')" class="glass p-4 rounded-2xl text-right hover:border-emerald-500 transition">
                <div class="bg-emerald-600/20 text-emerald-400 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                  <i class="fa-solid fa-layer-group text-lg"></i>
                </div>
                <h3 class="font-bold text-sm">حسب المجال</h3>
                <p class="text-xs text-slate-400">اختر مجالاً تخصصياً</p>
              </button>
            </div>
          </div>
        `;
        break;

      case 'categories':
        const categories = ["الجغرافيا والدول", "التاريخ والحضارات", "العلوم العامة والفيزياء", "هندسة المساحة والجيوماتكس", "الذكاء الاصطناعي وعلوم الحاسب"];
        container.innerHTML = `
          <div class="space-y-4">
            <h2 class="text-xl font-bold">المجالات المعرفية</h2>
            <div class="grid grid-cols-1 gap-2.5">
              ${categories.map(cat => `
                <div onclick="app.startCategoryQuiz('${cat}')" class="glass p-4 rounded-2xl flex justify-between items-center cursor-pointer hover:border-indigo-500 transition">
                  <span class="font-semibold text-sm">${cat}</span>
                  <i class="fa-solid fa-chevron-left text-slate-500 text-sm"></i>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        break;

      case 'search':
        container.innerHTML = `
          <div class="space-y-4">
            <h2 class="text-xl font-bold">بحث متقدم</h2>
            <input type="text" oninput="app.performSearch(this.value)" placeholder="ابحث عن سؤال أو معلومة..." class="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-indigo-500">
            <div id="search-results" class="space-y-3"><p class="text-center text-slate-500 text-sm py-10">اكتب حرفين للبحث...</p></div>
          </div>
        `;
        break;

      case 'stats':
        const successRate = this.userStats.attempted > 0 ? Math.round((this.userStats.correct / this.userStats.attempted) * 100) : 0;
        container.innerHTML = `
          <div class="space-y-6 text-center">
            <h2 class="text-xl font-bold">الإحصائيات والتقدم</h2>
            <div class="glass p-6 rounded-3xl space-y-3">
              <div class="text-4xl font-black text-indigo-400">${successRate}%</div>
              <p class="text-xs text-slate-400">نسبة الإجابات الصحيحة</p>
              <div class="grid grid-cols-2 gap-2 mt-4 text-sm">
                <div class="bg-slate-800/80 p-3 rounded-xl">المحاولات: <b>${this.userStats.attempted}</b></div>
                <div class="bg-slate-800/80 p-3 rounded-xl">الصحيحة: <b>${this.userStats.correct}</b></div>
              </div>
            </div>
          </div>
        `;
        break;

      case 'bookmarks':
        const allQ = await this.getAllQuestions();
        const bookmarkedQ = allQ.filter(q => this.userStats.bookmarks.includes(q.id));
        container.innerHTML = `
          <div class="space-y-4">
            <h2 class="text-xl font-bold">المفضلة (${bookmarkedQ.length})</h2>${bookmarkedQ.length === 0 ? '<p class="text-center text-slate-500 text-sm py-10">لا توجد أسئلة مفضلة حالياً.</p>' : 
              bookmarkedQ.map(q => `
                <div class="glass p-4 rounded-2xl space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="text-[10px] bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded">${q.category}</span>
                    <button onclick="app.toggleBookmark('${q.id}')" class="text-amber-400"><i class="fa-solid fa-star"></i></button>
                  </div>
                  <h4 class="font-bold text-sm">${q.question}</h4>
                  <p class="text-xs text-emerald-400">الإجابة: ${q.answer}</p>
                </div>
              `).join('')}
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

  async startQuiz(mode) {
    let questions = await this.getAllQuestions();
    if (mode === 'genius') {
      questions = questions.filter(q => q.difficulty === 'صعب' || q.difficulty === 'عباقرة');
      if (questions.length === 0) questions = await this.getAllQuestions();
    }
    if (questions.length === 0) { alert('لا توجد أسئلة متاحة حالياً.'); return; }
    this.runQuizSession(questions, mode);
  }

  async startCategoryQuiz(category) {
    const questions = await this.getQuestionsByCategory(category);
    if (questions.length === 0) { alert('لا توجد أسئلة في هذا المجال.'); return; }
    this.runQuizSession(questions, 'learning');
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

  runQuizSession(questions, mode) {
    let currentIndex = 0;
    const container = document.getElementById('app-view');

    const renderQuestion = () => {
      if (currentIndex >= questions.length) {
        container.innerHTML = `
          <div class="glass p-6 rounded-3xl text-center space-y-4 my-auto">
            <div class="text-emerald-400 text-5xl mb-2"><i class="fa-solid fa-circle-check"></i></div>
            <h2 class="text-xl font-bold">أنهيت الاختبار بنجاح!</h2>
            <button onclick="app.navigate('home')" class="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-2xl font-bold transition">العودة للرئيسية</button>
          </div>
        `;
        return;
      }
      const q = questions[currentIndex];
      const isBookmarked = this.userStats.bookmarks.includes(q.id);

      container.innerHTML = `
        <div class="space-y-4">
          <div class="flex justify-between items-center text-xs text-slate-400">
            <span>السؤال ${currentIndex + 1} من ${questions.length}</span>
            <div class="flex items-center gap-2">
              <span class="bg-indigo-600/20 text-indigo-400 px-2.5 py-1 rounded-lg">${q.category}</span>
              <button onclick="app.toggleBookmark('${q.id}')" class="text-lg ${isBookmarked ? 'text-amber-400' : 'text-slate-500'}">
                <i class="fa-${isBookmarked ? 'solid' : 'regular'} fa-star"></i>
              </button>
            </div>
          </div>
          <div class="glass p-6 rounded-3xl space-y-4">
            <h3 class="font-bold text-base leading-relaxed">${q.question}</h3>
            <div class="space-y-2.5" id="options-container">
              ${q.options.map((opt) => `
                <button onclick="app.handleAnswerClick(this, '${opt.replace(/'/g, "\\'")}', '${q.answer.replace(/'/g, "\\'")}', ${mode === 'learning'})" class="w-full text-right p-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-sm transition font-medium">
                  ${opt}
                </button>
              `).join('')}
            </div>
            <div id="explanation-box" class="hidden mt-4 p-4 rounded-2xl bg
