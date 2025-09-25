// ================================================================
// نظام "إلهام" - الإصدار الويب
// نظام إدارة المهام الذكي مع الذكاء الاصطناعي
// ================================================================

// متغيرات النظام العامة
let currentUser = null;
let tasksData = [];
let teamData = [];
let performanceData = [];
let configData = {};
let cache = {};
let currentPersonality = 'ودود'; // الشخصية الافتراضية

// إعدادات النظام
const CONFIG = {
  TIMEZONE: "Africa/Tunis",
  CACHE_DURATION: 3600
};

// ثوابت النظام
const TASK_STATUS = { NEW: "جديد", IN_PROGRESS: "قيد التنفيذ", COMPLETED: "مكتمل" };
const PRIORITIES = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
const PRIORITY_EMOJIS = { "High": "🔴", "Medium": "🟡", "Low": "🟢" };

// آلة الحالات
const STATE_MACHINE = {
  UPDATE_LIVE_TASK: "UPDATE_LIVE_TASK",
  GREETING: "GREETING",
  ADD_SIMPLE_TASK: "ADD_SIMPLE_TASK",
  ADD_MULTIPLE_TASKS: "ADD_MULTIPLE_TASKS",
  SHOW_TASKS: "SHOW_TASKS",
  SHOW_TEAM_TASKS: "SHOW_TEAM_TASKS",
  END_OF_DAY_REPORT: "END_OF_DAY_REPORT",
  PERSONAL_COACHING: "PERSONAL_COACHING",
  GENERAL_CHAT: "GENERAL_CHAT"
};

// إعدادات الشخصيات
const BOT_PERSONALITIES = {
  'ودود': {
    name: 'ودود',
    greeting: 'مرحباً! أنا إلهام مساعدك الودود 😊',
    style: 'ودود ومشجع',
    prompt: 'أنت مساعد ودود ومشجع. استخدم الإيموجي وكن لطيفاً في ردودك.',
    responses: {
      success: 'ممتاز! تم بنجاح 🎉',
      error: 'عذراً، حدث خطأ صغير 😅',
      help: 'أنا هنا لمساعدتك! قل لي ماذا تحتاج 🤗'
    }
  },
  'رسمي': {
    name: 'رسمي',
    greeting: 'تحية طيبة. أنا إلهام مساعدك الرسمي',
    style: 'رسمي ومهني',
    prompt: 'أنت مساعد رسمي ومهني. استخدم لغة رسمية وكن موجزاً.',
    responses: {
      success: 'تم إنجاز المهمة بنجاح',
      error: 'حدث خطأ في العملية',
      help: 'كيف يمكنني مساعدتك؟'
    }
  },
  'صارم': {
    name: 'صارم',
    greeting: 'أهلاً. أنا إلهام مساعدك الصارم',
    style: 'صارم ومباشر',
    prompt: 'أنت مساعد صارم ومباشر. كن واضحاً وموجزاً ولا تتردد في النقد البناء.',
    responses: {
      success: 'تم إنجاز المهمة',
      error: 'فشل في إنجاز المهمة',
      help: 'ما الذي تحتاجه؟'
    }
  }
};

// ================================================================
// تهيئة النظام
// ================================================================

async function initializeSystem() {
  try {
    console.log("🚀 بدء تهيئة نظام إلهام...");

    // تحميل البيانات من ملفات JSON
    await loadDataFiles();

    // تحميل الشخصية المحفوظة
    loadSavedPersonality();

    // إعداد واجهة المستخدم
    setupUI();

    // إعداد نظام المصادقة
    setupAuthentication();

    console.log("✅ تم تهيئة النظام بنجاح");
    console.log(`🎭 الشخصية الحالية: ${currentPersonality}`);
  } catch (error) {
    console.error("❌ خطأ في تهيئة النظام:", error);
    showError("فشل في تهيئة النظام: " + error.message);
  }
}

async function loadDataFiles() {
  try {
    console.log("📂 تحميل البيانات من قاعدة البيانات...");

    // تحميل البيانات من API مع إرسال بيانات المستخدم
    const headers = {};
    if (currentUser) {
      headers['user-id'] = currentUser.employeeId;
      headers['user-role'] = currentUser.role;
    }

    const [tasksResponse, teamResponse, performanceResponse, configResponse] = await Promise.all([
      fetch('/api/tasks', { headers }),
      fetch('/api/team'),
      fetch('/api/performance'),
      fetch('/api/config')
    ]);

    tasksData = await tasksResponse.json();
    teamData = await teamResponse.json();
    performanceData = await performanceResponse.json();
    configData = await configResponse.json();

    console.log("✅ تم تحميل البيانات بنجاح");
    console.log(`📊 تم تحميل ${tasksData.length} مهمة، ${teamData.length} موظف، ${performanceData.length} تقرير أداء`);
  } catch (error) {
    console.error("❌ خطأ في تحميل البيانات:", error);
    throw new Error("فشل في تحميل البيانات من قاعدة البيانات");
  }
}

// ================================================================
// إعداد واجهة المستخدم
// ================================================================

function setupUI() {
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const loginBtn = document.getElementById('loginBtn');

  // إعداد أحداث الإدخال
  messageInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);
  loginBtn.addEventListener('click', handleLogin);

  // إعداد التركيز الأولي
  if (!currentUser) {
    showLoginForm();
  }
}

function setupAuthentication() {
  // التحقق من تسجيل دخول سابق
  const savedUser = localStorage.getItem('elhem_current_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      updateUserInterface();
      enableChat();
    } catch (error) {
      console.error("خطأ في تحميل بيانات المستخدم المحفوظة:", error);
      localStorage.removeItem('elhem_current_user');
    }
  }
}

// ================================================================
// نظام المصادقة
// ================================================================

function showLoginForm() {
  document.getElementById('loginForm').classList.add('show');
}

function hideLoginForm() {
  document.getElementById('loginForm').classList.remove('show');
}

async function handleLogin() {
  const username = document.getElementById('usernameInput').value.trim();
  const password = document.getElementById('passwordInput').value;

  if (!username || !password) {
    showLoginError("يرجى إدخال اسم المستخدم وكلمة المرور");
    return;
  }

  try {
    // إرسال طلب المصادقة إلى الخادم
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    if (!result.success) {
      showLoginError(result.error || "فشل في تسجيل الدخول");
      return;
    }

    // تسجيل الدخول ناجح
    currentUser = result.user;
    localStorage.setItem('elhem_current_user', JSON.stringify(result.user));

    hideLoginForm();
    updateUserInterface();
    enableChat();

    addMessage("إلهام", `مرحباً ${result.user.name}! كيف يمكنني مساعدتك اليوم؟`, 'bot');

  } catch (error) {
    console.error("خطأ في تسجيل الدخول:", error);
    showLoginError("حدث خطأ أثناء تسجيل الدخول");
  }
}

function showLoginError(message) {
  const errorDiv = document.getElementById('loginError');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function updateUserInterface() {
  if (currentUser) {
    document.getElementById('currentUser').textContent = `${currentUser.name} (${currentUser.role})`;
  } else {
    document.getElementById('currentUser').textContent = 'غير مسجل';
  }
}

function enableChat() {
  document.getElementById('messageInput').disabled = false;
  document.getElementById('sendBtn').disabled = false;
  document.getElementById('messageInput').focus();
}

function logout() {
  currentUser = null;
  localStorage.removeItem('elhem_current_user');
  updateUserInterface();
  disableChat();
  showLoginForm();
  clearMessages();
  addMessage("إلهام", "تم تسجيل الخروج بنجاح. يرجى تسجيل الدخول مرة أخرى.", 'bot');
}

function disableChat() {
  document.getElementById('messageInput').disabled = true;
  document.getElementById('sendBtn').disabled = true;
}

// ================================================================
// وظائف الدردشة
// ================================================================

function sendMessage() {
  if (!currentUser) {
    showLoginForm();
    return;
  }

  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value.trim();

  if (!message) return;

  // إضافة رسالة المستخدم
  addMessage(currentUser.name, message, 'user');

  // مسح حقل الإدخال
  messageInput.value = '';

  // معالجة الرسالة
  processUserMessage(message);
}

function addMessage(sender, content, type) {
  const messagesContainer = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;

  messageDiv.innerHTML = `
    <div class="sender">${sender}</div>
    <div class="content">${content}</div>
  `;

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function clearMessages() {
  document.getElementById('messages').innerHTML = '';
}

// ================================================================
// معالجة الرسائل والذكاء الاصطناعي
// ================================================================

async function processUserMessage(message) {
  try {
    // إظهار مؤشر التحميل
    showLoading();

    // تحديد النية باستخدام الذكاء الاصطناعي
    const intent = await determineUserIntent(message);

    // معالجة النية
    await processIntent(intent, message);

  } catch (error) {
    console.error("خطأ في معالجة الرسالة:", error);
    addMessage("إلهام", "عذراً، حدث خطأ أثناء معالجة رسالتك. يرجى المحاولة مرة أخرى.", 'bot');
  } finally {
    hideLoading();
  }
}

async function determineUserIntent(userQuery) {
  try {
    // قائمة الكلمات المفتاحية لكل نية
    const intentPatterns = {
      show_tasks: ['مهامي', 'اعرض مهامي', 'مهام', 'قائمة المهام', 'show tasks', 'my tasks', 'check my tasks'],
      show_team_tasks: ['مهام الفريق', 'مهام فريقي', 'فريق', 'team tasks', 'show all team tasks'],
      add_task: ['أضف مهمة', 'مهمة جديدة', 'اضافة', 'add task', 'new task'],
      new_project: ['مشروع جديد', 'إنشاء مشروع', 'new project', 'create project'],
      complete_task: ['اكمل', 'complete', 'انتهى', 'تم', 'finish', 'update task'],
      dashboard: ['لوحة التحكم', 'dashboard', 'الإحصائيات', 'statistics', 'تقارير'],
      admin_panel: ['لوحة الإدارة', 'admin panel', 'إدارة النظام', 'system admin'],
      change_personality: ['غير شخصيتك', 'شخصية', 'personality', 'style', 'ودود', 'رسمي', 'صارم'],
      coaching: ['تدريب', 'نصيحة', 'مساعدة', 'coaching', 'advice'],
      end_of_day_report: ['تقرير اليوم', 'إنهاء اليوم', 'end of day', 'daily report'],
      performance_reports: ['تقارير الأداء', 'performance reports', 'show performance reports']
    };

    // البحث عن تطابق الكلمات المفتاحية
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      if (patterns.some(pattern => userQuery.toLowerCase().includes(pattern))) {
        return intent;
      }
    }

    // استخدام الذكاء الاصطناعي للتحليل المتقدم
    if (configData.ai && configData.ai.openaiApiKey) {
      return await analyzeIntentWithAI(userQuery);
    }

    return 'general_chat';

  } catch (error) {
    console.error("خطأ في تحديد النية:", error);
    return 'general_chat';
  }
}

async function analyzeIntentWithAI(userQuery) {
  try {
    const prompt = `أنت نظام توجيه ذكي. صنف نية المستخدم إلى إحدى الفئات:
show_tasks, show_team_tasks, add_task, complete_task, performance_reports, coaching, end_of_day_report, general_chat

رسالة المستخدم: ${userQuery}

أجب بكلمة واحدة فقط.`;

    const response = await callOpenAI(prompt, configData.ai.model, 0.0, 10);
    const validIntents = ['show_tasks', 'show_team_tasks', 'add_task', 'new_project', 'complete_task', 'dashboard', 'admin_panel', 'change_personality', 'coaching', 'end_of_day_report', 'performance_reports', 'general_chat'];

    return validIntents.includes(response) ? response : 'general_chat';

  } catch (error) {
    console.error("خطأ في تحليل النية بالذكاء الاصطناعي:", error);
    return 'general_chat';
  }
}

async function callOpenAI(prompt, model = "gpt-4o-mini", temperature = 0.3, maxTokens = 200) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${configData.ai.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();

  } catch (error) {
    console.error("خطأ في استدعاء OpenAI:", error);
    throw error;
  }
}

// ================================================================
// معالجة النوايا
// ================================================================

async function processIntent(intent, message) {
  switch (intent) {
    case 'show_tasks':
      await handleShowTasksWithAgent(message);
      break;
    case 'show_team_tasks':
      await handleShowTeamTasksWithAgent(message);
      break;
    case 'add_task':
      await handleAddTask(message);
      break;
    case 'new_project':
      await handleNewProject(message);
      break;
    case 'complete_task':
      await handleCompleteTaskWithAgent(message);
      break;
    case 'performance_reports':
      await handlePerformanceReportsWithAgent(message);
      break;
    case 'dashboard':
      await handleDashboard();
      break;
    case 'admin_panel':
      await handleAdminPanel();
      break;
    case 'change_personality':
      await handleChangePersonality(message);
      break;
    case 'coaching':
      await handleCoaching(message);
      break;
    case 'end_of_day_report':
      await handleEndOfDayReport();
      break;
    default:
      await handleGeneralChat(message);
      break;
  }
}

async function handleShowTasks() {
  try {
    // التحقق من الصلاحيات
    if (!checkPermission('canViewOwnTasks')) {
      addMessage("إلهام", "عذراً، ليس لديك صلاحية لعرض المهام.", 'bot');
      return;
    }

    const userTasks = tasksData.filter(task =>
      task.assignedToId === currentUser.employeeId &&
      task.status !== TASK_STATUS.COMPLETED
    );

    if (userTasks.length === 0) {
      addMessage("إلهام", "🎉 رائع! لا توجد مهام معلقة حالياً.", 'bot');
      return;
    }

    // ترتيب المهام حسب الأولوية
    userTasks.sort((a, b) => {
      const priorityOrder = { "High": 1, "Medium": 2, "Low": 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    if (userTasks.length === 0) {
      addMessage("إلهام", "🎉 رائع! لا توجد مهام معلقة حالياً.", 'bot');
      return;
    }

    let response = `📋 مهامك (${userTasks.length} مهمة):\n\n`;

    userTasks.forEach((task, index) => {
      const priorityEmoji = PRIORITY_EMOJIS[task.priority] || "⚪";
      const statusEmoji = task.status === TASK_STATUS.COMPLETED ? "✅" : "⏳";
      response += `${index + 1}. ${priorityEmoji} ${statusEmoji} ${task.taskName}\n`;
      response += `   📅 ${task.dueDate || 'غير محدد'}\n`;
      response += `   📝 ${task.description}\n`;
      if (task.status !== TASK_STATUS.COMPLETED) {
        response += `   🔘 اكتب "اكمل ${task.taskId}" لإكمال هذه المهمة\n`;
      }
      response += `\n`;
    });

    addMessage("إلهام", response, 'bot');

  } catch (error) {
    console.error("خطأ في عرض المهام:", error);
    addMessage("إلهام", "عذراً، حدث خطأ في عرض المهام.", 'bot');
  }
}

async function handleShowTeamTasks() {
  try {
    // التحقق من الصلاحيات
    if (!checkPermission('canViewTeamTasks')) {
      addMessage("إلهام", "عذراً، ليس لديك صلاحية لعرض مهام الفريق.", 'bot');
      return;
    }

    const teamMembers = teamData.filter(member => member.managerId === currentUser.employeeId);
    const teamMemberIds = teamMembers.map(member => member.employeeId);

    const teamTasks = tasksData.filter(task =>
      teamMemberIds.includes(task.assignedToId) &&
      task.status !== TASK_STATUS.COMPLETED
    );

    if (teamTasks.length === 0) {
      addMessage("إلهام", "👥 لا توجد مهام نشطة لأعضاء فريقك حالياً.", 'bot');
      return;
    }

    let response = `👥 مهام الفريق (${teamTasks.length} مهمة):\n\n`;

    teamTasks.forEach((task, index) => {
      const priorityEmoji = PRIORITY_EMOJIS[task.priority] || "⚪";
      const assignee = teamData.find(member => member.employeeId === task.assignedToId);
      const assigneeName = assignee ? assignee.name : 'غير معروف';

      response += `${index + 1}. ${priorityEmoji} ${task.taskName}\n`;
      response += `   👤 ${assigneeName}\n`;
      response += `   📅 ${task.dueDate || 'غير محدد'}\n\n`;
    });

    addMessage("إلهام", response, 'bot');

  } catch (error) {
    console.error("خطأ في عرض مهام الفريق:", error);
    addMessage("إلهام", "عذراً، حدث خطأ في عرض مهام الفريق.", 'bot');
  }
}

async function handleAddTask(message) {
  try {
    // التحقق من الصلاحيات
    if (!checkPermission('canCreateTasks')) {
      addMessage("إلهام", "عذراً، ليس لديك صلاحية لإضافة مهام.", 'bot');
      return;
    }

    // تحليل المهمة من الرسالة
    const taskData = await analyzeTaskRequest(message);

    if (!taskData.success) {
      addMessage("إلهام", taskData.error || "لم أتمكن من فهم المهمة. جرب: أضف مهمة: مراجعة التقرير", 'bot');
      return;
    }

    // إنشاء المهمة
    const newTask = await createTask(taskData.taskData);

    if (newTask.success) {
      const priorityEmoji = PRIORITY_EMOJIS[newTask.task.priority] || "⚪";
      const response = `✅ تم إنشاء المهمة بنجاح!\n\n${priorityEmoji} ${newTask.task.taskName}\n📅 ${newTask.task.dueDate || 'غير محدد'}\n📝 ${newTask.task.description}`;
      addMessage("إلهام", response, 'bot');
    } else {
      addMessage("إلهام", "عذراً، فشل في إنشاء المهمة.", 'bot');
    }

  } catch (error) {
    console.error("خطأ في إضافة المهمة:", error);
    addMessage("إلهام", "عذراً، حدث خطأ في إضافة المهمة.", 'bot');
  }
}

async function handleCompleteTask(message) {
  try {
    // التحقق من الصلاحيات
    if (!checkPermission('canUpdateOwnTasks')) {
      addMessage("إلهام", "عذراً، ليس لديك صلاحية لتحديث المهام.", 'bot');
      return;
    }

    // استخراج معرف المهمة من الرسالة
    const taskIdMatch = message.match(/(?:اكمل|complete)\s+(T\d+|[A-Za-z0-9]+)/i);
    if (!taskIdMatch) {
      addMessage("إلهام", "يرجى تحديد معرف المهمة. مثال: اكمل T001", 'bot');
      return;
    }

    const taskId = taskIdMatch[1];

    // البحث عن المهمة
    const taskIndex = tasksData.findIndex(task =>
      task.taskId === taskId && task.assignedToId === currentUser.employeeId
    );

    if (taskIndex === -1) {
      addMessage("إلهام", "لم أجد المهمة المطلوبة أو أنها ليست مخصصة لك.", 'bot');
      return;
    }

    const task = tasksData[taskIndex];

    if (task.status === TASK_STATUS.COMPLETED) {
      addMessage("إلهام", "هذه المهمة مكتملة بالفعل!", 'bot');
      return;
    }

    // تحديث المهمة في قاعدة البيانات
    const updateData = {
      status: TASK_STATUS.COMPLETED,
      completionDate: new Date().toISOString().split('T')[0]
    };

    const updateResponse = await fetch(`/api/tasks/${task.taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'user-id': currentUser.employeeId,
        'user-role': currentUser.role
      },
      body: JSON.stringify(updateData)
    });

    const updateResult = await updateResponse.json();

    if (updateResult.success) {
      // تحديث البيانات المحلية
      tasksData[taskIndex].status = TASK_STATUS.COMPLETED;
      tasksData[taskIndex].completionDate = updateData.completionDate;

      const response = `✅ تم إكمال المهمة بنجاح!\n\n🎉 ${task.taskName}\n📅 تاريخ الإكمال: ${tasksData[taskIndex].completionDate}`;
      addMessage("إلهام", response, 'bot');
    } else {
      addMessage("إلهام", "عذراً، فشل في تحديث المهمة في قاعدة البيانات.", 'bot');
    }

  } catch (error) {
    console.error("خطأ في إكمال المهمة:", error);
    addMessage("إلهام", "عذراً، حدث خطأ في إكمال المهمة.", 'bot');
  }
}

async function handleNewProject(message) {
  try {
    // التحقق من الصلاحيات
    if (!checkPermission('canCreateTasks')) {
      addMessage("إلهام", "عذراً، ليس لديك صلاحية لإنشاء مشاريع.", 'bot');
      return;
    }

    // فتح النافذة المنبثقة لإنشاء المشروع
    showNewProjectModal();

  } catch (error) {
    console.error("خطأ في فتح نافذة المشروع الجديد:", error);
    addMessage("إلهام", "عذراً، حدث خطأ في فتح نافذة إنشاء المشروع.", 'bot');
  }
}

async function handleDashboard() {
  try {
    // التحقق من الصلاحيات
    if (!checkPermission('canViewReports')) {
      addMessage("إلهام", "عذراً، ليس لديك صلاحية لعرض لوحة التحكم.", 'bot');
      return;
    }

    // حساب مؤشرات الأداء الرئيسية
    const kpis = calculateKPIs();

    let dashboard = `📊 لوحة التحكم - ${currentUser.name}\n\n`;

    // إحصائيات المهام
    dashboard += `📋 إحصائيات المهام:\n`;
    dashboard += `✅ المهام المكتملة: ${kpis.tasksDone}\n`;
    dashboard += `⏳ المهام النشطة: ${kpis.tasksActive}\n`;
    dashboard += `⏰ المهام المتأخرة: ${kpis.tasksDelayed}\n`;
    dashboard += `📅 إجمالي المهام: ${kpis.totalTasks}\n\n`;

    // مؤشر الإنتاجية
    dashboard += `🎯 مؤشر الإنتاجية:\n`;
    dashboard += `📈 معدل الإنجاز: ${kpis.productivityIndex}%\n`;
    dashboard += `⭐ متوسط التقييم: ${kpis.averageRating}/5\n\n`;

    // إحصائيات الفريق (للمديرين)
    if (currentUser.role === 'Manager') {
      dashboard += `👥 إحصائيات الفريق:\n`;
      dashboard += `👤 أعضاء الفريق: ${kpis.teamMembers}\n`;
      dashboard += `📊 مهام الفريق النشطة: ${kpis.teamActiveTasks}\n`;
      dashboard += `🎯 متوسط إنتاجية الفريق: ${kpis.teamProductivity}%\n\n`;
    }

    // تحليل الأداء
    dashboard += `🔍 تحليل الأداء:\n`;
    if (kpis.productivityIndex >= 80) {
      dashboard += `🌟 أداء ممتاز! استمر في العمل الرائع\n`;
    } else if (kpis.productivityIndex >= 60) {
      dashboard += `👍 أداء جيد، يمكن تحسينه أكثر\n`;
    } else {
      dashboard += `⚠️ يحتاج إلى تحسين وتركيز أكبر\n`;
    }

    addMessage("إلهام", dashboard, 'bot');

  } catch (error) {
    console.error("خطأ في عرض لوحة التحكم:", error);
    addMessage("إلهام", "عذراً، حدث خطأ في عرض لوحة التحكم.", 'bot');
  }
}

function calculateKPIs() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // حساب مؤشرات الأداء الأساسية
  const userTasks = tasksData.filter(task => task.assignedToId === currentUser.employeeId);
  const completedTasks = userTasks.filter(task => task.status === TASK_STATUS.COMPLETED);
  const activeTasks = userTasks.filter(task => task.status !== TASK_STATUS.COMPLETED);
  const delayedTasks = activeTasks.filter(task => {
    if (!task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    return dueDate < now;
  });

  // حساب معدل الإنتاجية
  const totalTasks = userTasks.length;
  const productivityIndex = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  // متوسط التقييم من تقارير الأداء
  const userReports = performanceData.filter(report => report.employeeEmail === currentUser.email);
  const averageRating = userReports.length > 0 ?
    Math.round(userReports.reduce((sum, report) => sum + (report.rating || 0), 0) / userReports.length * 10) / 10 : 0;

  let kpis = {
    tasksDone: completedTasks.length,
    tasksActive: activeTasks.length,
    tasksDelayed: delayedTasks.length,
    totalTasks: totalTasks,
    productivityIndex: productivityIndex,
    averageRating: averageRating,
    teamMembers: 0,
    teamActiveTasks: 0,
    teamProductivity: 0
  };

  // إحصائيات الفريق للمديرين
  if (currentUser.role === 'Manager') {
    const teamMembers = teamData.filter(member => member.managerId === currentUser.employeeId);
    const teamMemberIds = teamMembers.map(member => member.employeeId);
    const teamTasks = tasksData.filter(task => teamMemberIds.includes(task.assignedToId));
    const teamActiveTasks = teamTasks.filter(task => task.status !== TASK_STATUS.COMPLETED);

    // حساب متوسط إنتاجية الفريق
    const teamCompletedTasks = teamTasks.filter(task => task.status === TASK_STATUS.COMPLETED);
    const teamProductivity = teamTasks.length > 0 ?
      Math.round((teamCompletedTasks.length / teamTasks.length) * 100) : 0;

    kpis.teamMembers = teamMembers.length;
    kpis.teamActiveTasks = teamActiveTasks.length;
    kpis.teamProductivity = teamProductivity;
  }

  return kpis;
}

async function handleChangePersonality(message) {
  try {
    // التحقق من الصلاحيات (فقط المدراء والمسؤولين يمكنهم تغيير الشخصية)
    if (!checkPermission('canManageConfig')) {
      addMessage("إلهام", "عذراً، تغيير شخصية البوت متاح للمدراء والمسؤولين فقط.", 'bot');
      return;
    }

    // استخراج اسم الشخصية من الرسالة
    let newPersonality = null;

    // البحث عن أسماء الشخصيات في الرسالة
    for (const personalityName of Object.keys(BOT_PERSONALITIES)) {
      if (message.includes(personalityName)) {
        newPersonality = personalityName;
        break;
      }
    }

    if (!newPersonality) {
      // عرض الشخصيات المتاحة
      let availablePersonalities = "الشخصيات المتاحة:\n";
      Object.keys(BOT_PERSONALITIES).forEach(personality => {
        const isCurrent = personality === currentPersonality;
        availablePersonalities += `${isCurrent ? '✅' : '○'} ${personality} - ${BOT_PERSONALITIES[personality].style}\n`;
      });
      availablePersonalities += `\nالشخصية الحالية: ${currentPersonality}\n`;
      availablePersonalities += `للتغيير قل: "غير شخصيتك إلى [اسم الشخصية]"`;

      addMessage("إلهام", availablePersonalities, 'bot');
      return;
    }

    if (!BOT_PERSONALITIES[newPersonality]) {
      addMessage("إلهام", "عذراً، هذه الشخصية غير متاحة.", 'bot');
      return;
    }

    // تغيير الشخصية
    const oldPersonality = currentPersonality;
    currentPersonality = newPersonality;

    // حفظ الشخصية في localStorage
    localStorage.setItem('elhem_personality', currentPersonality);

    const personality = BOT_PERSONALITIES[currentPersonality];
    const response = `🎭 تم تغيير شخصيتي بنجاح!\n\n` +
                     `من: ${oldPersonality}\n` +
                     `إلى: ${newPersonality}\n\n` +
                     `${personality.greeting}\n` +
                     `الأسلوب: ${personality.style}`;

    addMessage("إلهام", response, 'bot');

  } catch (error) {
    console.error("خطأ في تغيير الشخصية:", error);
    addMessage("إلهام", "عذراً، حدث خطأ في تغيير الشخصية.", 'bot');
  }
}

async function handleAdminPanel() {
  try {
    // التحقق من الصلاحيات
    if (!checkPermission('canManageConfig')) {
      addMessage("إلهام", "عذراً، ليس لديك صلاحية الوصول إلى لوحة الإدارة.", 'bot');
      return;
    }

    // فتح لوحة الإدارة
    showAdminPanel();

  } catch (error) {
    console.error("خطأ في فتح لوحة الإدارة:", error);
    addMessage("إلهام", "عذراً، حدث خطأ في فتح لوحة الإدارة.", 'bot');
  }
}

// تحميل الشخصية المحفوظة عند بدء التطبيق
function loadSavedPersonality() {
  try {
    const saved = localStorage.getItem('elhem_personality');
    if (saved && BOT_PERSONALITIES[saved]) {
      currentPersonality = saved;
    }
  } catch (error) {
    console.error("خطأ في تحميل الشخصية المحفوظة:", error);
  }
}

async function analyzeTaskRequest(message) {
  try {
    // استخراج اسم المهمة
    let taskName = message.replace(/^(أضف|اضافة|مهمة|اضف مهمة|add task)/i, "").trim();
    taskName = taskName.replace(/^[:：-]\s*/, "").trim();

    if (taskName.length < 3) {
      return { success: false, error: "اسم المهمة قصير جداً. مثال: أضف مهمة: مراجعة التقرير" };
    }

    // تحديد الأولوية
    let priority = "Medium";
    const lowerText = message.toLowerCase();
    if (lowerText.includes("عاجل") || lowerText.includes("مهم")) {
      priority = "High";
    } else if (lowerText.includes("عادي") || lowerText.includes("منخفض")) {
      priority = "Low";
    }

    // تحديد التاريخ
    let dueDate = "";
    if (lowerText.includes("غدا") || lowerText.includes("بكرا")) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dueDate = tomorrow.toISOString().split('T')[0];
    }

    return {
      success: true,
      taskData: {
        taskName: taskName.substring(0, 100),
        description: message.substring(0, 200),
        priority: priority,
        dueDate: dueDate
      }
    };

  } catch (error) {
    console.error("خطأ في تحليل المهمة:", error);
    return { success: false, error: "حدث خطأ في تحليل المهمة" };
  }
}

async function createTask(taskData) {
  try {
    const taskId = generateTaskId();
    const currentDate = new Date().toISOString().split('T')[0];

    const newTask = {
      taskId: taskId,
      taskName: taskData.taskName,
      description: taskData.description,
      assignedToId: currentUser.employeeId,
      assignedToName: currentUser.name,
      department: currentUser.department,
      priority: taskData.priority,
      status: TASK_STATUS.NEW,
      startDate: currentDate,
      dueDate: taskData.dueDate,
      completionDate: "",
      notes: "",
      agentFeedback: ""
    };

    // إرسال المهمة إلى قاعدة البيانات
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-id': currentUser.employeeId,
        'user-role': currentUser.role
      },
      body: JSON.stringify(newTask)
    });

    const result = await response.json();

    if (result.success) {
      // إضافة المهمة للبيانات المحلية
      tasksData.push(newTask);
      return { success: true, task: newTask };
    } else {
      return { success: false, error: result.error };
    }

  } catch (error) {
    console.error("خطأ في إنشاء المهمة:", error);
    return { success: false, error: error.message };
  }
}

function generateTaskId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return 'T' + timestamp + randomPart;
}

async function handleCoaching(message) {
  try {
    // التحقق من الصلاحيات
    if (!checkPermission('canViewOwnTasks')) {
      addMessage("إلهام", "عذراً، ليس لديك صلاحية للحصول على النصائح.", 'bot');
      return;
    }

    let coachingMessage = "🎯 نصائح لتطوير الأداء:\n\n";

    // نصائح عامة
    const generalTips = [
      "📈 حدد أهدافاً واضحة وقابلة للقياس",
      "⏰ إدارة الوقت بفعالية - ركز على المهام المهمة أولاً",
      "🤝 تعاون مع الفريق وتبادل الخبرات",
      "📚 التعلم المستمر - تابع أحدث التطورات في مجالك",
      "💪 الحفاظ على التوازن بين العمل والحياة الشخصية"
    ];

    generalTips.forEach(tip => {
      coachingMessage += `• ${tip}\n`;
    });

    // نصائح مخصصة حسب الدور
    if (currentUser.role === 'Manager') {
      coachingMessage += "\n👔 نصائح للمديرين:\n";
      coachingMessage += "• شجع فريقك وأعطِ الملاحظات البناءة\n";
      coachingMessage += "• ضع أهدافاً جماعية واضحة\n";
      coachingMessage += "• كن قدوة حسنة للموظفين\n";
    }

    addMessage("إلهام", coachingMessage, 'bot');

  } catch (error) {
    console.error("خطأ في تقديم النصائح:", error);
    addMessage("إلهام", "عذراً، حدث خطأ في تقديم النصائح.", 'bot');
  }
}

async function handleEndOfDayReport() {
  try {
    // التحقق من الصلاحيات
    if (!checkPermission('canViewReports')) {
      addMessage("إلهام", "عذراً، ليس لديك صلاحية لعرض التقارير.", 'bot');
      return;
    }

    const todayTasks = tasksData.filter(task =>
      task.assignedToId === currentUser.employeeId &&
      task.completionDate === new Date().toISOString().split('T')[0]
    );

    let report = `📊 تقرير نهاية اليوم - ${currentUser.name}\n\n`;
    report += `✅ المهام المكتملة: ${todayTasks.length}\n`;

    if (todayTasks.length > 0) {
      report += "\n📋 المهام المكتملة:\n";
      todayTasks.forEach((task, index) => {
        report += `${index + 1}. ${task.taskName}\n`;
      });
    }

    // إضافة تقييم بسيط
    const rating = todayTasks.length >= 3 ? "ممتاز" : todayTasks.length >= 1 ? "جيد" : "يحتاج تحسين";
    report += `\n⭐ التقييم العام: ${rating}`;

    addMessage("إلهام", report, 'bot');

  } catch (error) {
    console.error("خطأ في إنشاء التقرير:", error);
    addMessage("إلهام", "عذراً، حدث خطأ في إنشاء التقرير.", 'bot');
  }
}

// ================================================================
// وظائف التعامل مع وكلاء CrewAI
// ================================================================

async function callCrewAIAgent(agentType, userId, userMessage) {
  try {
    const endpoint = `/api/agents/${agentType}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-id': currentUser.employeeId,
        'user-role': currentUser.role
      },
      body: JSON.stringify({
        [`${agentType}Id`]: userId,
        message: userMessage
      })
    });

    const result = await response.json();

    if (result.success) {
      return result.response;
    } else {
      throw new Error(result.error || 'Agent processing failed');
    }
  } catch (error) {
    console.error(`Error calling ${agentType} agent:`, error);
    throw error;
  }
}

async function handleShowTasksWithAgent(message) {
  try {
    // التحقق من الصلاحيات
    if (!checkPermission('canViewOwnTasks')) {
      addMessage("إلهام", "عذراً، ليس لديك صلاحية لعرض المهام.", 'bot');
      return;
    }

    // استدعاء وكيل الموظف
    const agentResponse = await callCrewAIAgent('employee', currentUser.employeeId, message);

    // تنسيق الرد وإضافته للدردشة
    addMessage("إلهام", `🤖 ${agentResponse}`, 'bot');

  } catch (error) {
    console.error("خطأ في استدعاء وكيل الموظف:", error);
    addMessage("إلهام", "عذراً، حدث خطأ في عرض المهام. جرب مرة أخرى.", 'bot');
  }
}

async function handleShowTeamTasksWithAgent(message) {
  try {
    // التحقق من الصلاحيات
    if (!checkPermission('canViewTeamTasks')) {
      addMessage("إلهام", "عذراً، ليس لديك صلاحية لعرض مهام الفريق.", 'bot');
      return;
    }

    // استدعاء وكيل المدير
    const agentResponse = await callCrewAIAgent('manager', currentUser.employeeId, message);

    // تنسيق الرد وإضافته للدردشة
    addMessage("إلهام", `🤖 ${agentResponse}`, 'bot');

  } catch (error) {
    console.error("خطأ في استدعاء وكيل المدير:", error);
    addMessage("إلهام", "عذراً، حدث خطأ في عرض مهام الفريق. جرب مرة أخرى.", 'bot');
  }
}

async function handleCompleteTaskWithAgent(message) {
  try {
    // التحقق من الصلاحيات
    if (!checkPermission('canUpdateOwnTasks')) {
      addMessage("إلهام", "عذراً، ليس لديك صلاحية لتحديث المهام.", 'bot');
      return;
    }

    // استدعاء وكيل الموظف لتحديث المهمة
    const agentResponse = await callCrewAIAgent('employee', currentUser.employeeId, message);

    // تنسيق الرد وإضافته للدردشة
    addMessage("إلهام", `🤖 ${agentResponse}`, 'bot');

    // تحديث البيانات المحلية بعد التحديث الناجح
    await loadDataFiles();

  } catch (error) {
    console.error("خطأ في استدعاء وكيل الموظف لتحديث المهمة:", error);
    addMessage("إلهام", "عذراً، حدث خطأ في تحديث المهمة. جرب مرة أخرى.", 'bot');
  }
}

async function handlePerformanceReportsWithAgent(message) {
  try {
    // التحقق من الصلاحيات
    if (!checkPermission('canViewReports')) {
      addMessage("إلهام", "عذراً، ليس لديك صلاحية لعرض تقارير الأداء.", 'bot');
      return;
    }

    // استدعاء وكيل المدير لعرض التقارير
    const agentResponse = await callCrewAIAgent('manager', currentUser.employeeId, message);

    // تنسيق الرد وإضافته للدردشة
    addMessage("إلهام", `🤖 ${agentResponse}`, 'bot');

  } catch (error) {
    console.error("خطأ في استدعاء وكيل المدير للتقارير:", error);
    addMessage("إلهام", "عذراً، حدث خطأ في عرض التقارير. جرب مرة أخرى.", 'bot');
  }
}

async function handleGeneralChat(message) {
  try {
    const personality = BOT_PERSONALITIES[currentPersonality];

    // استخدام الذكاء الاصطناعي إذا كان متاحاً
    if (configData.ai && configData.ai.openaiApiKey) {
      const prompt = `${personality.prompt}\n\nأنت إلهام، مساعد ذكي بأسلوب ${personality.style}.\n` +
                     `استخدم لهجة ${personality.name} في ردودك.\n\n` +
                     `رسالة المستخدم: ${message}\n` +
                     `${currentUser ? `المستخدم: ${currentUser.name} (${currentUser.role})` : ''}\n\n` +
                     `تذكر: أجب باللغة العربية وكن ${personality.style}.`;

      const aiResponse = await callOpenAI(prompt, configData.ai.model, 0.7, 150);
      if (aiResponse) {
        addMessage("إلهام", aiResponse, 'bot');
        return;
      }
    }

    // ردود احتياطية حسب الشخصية
    const personalityResponses = {
      'ودود': [
        "كيف يمكنني مساعدتك في إدارة مهامك اليوم؟ 😊",
        "أنا هنا لمساعدتك في تنظيم عملك وتحسين إنتاجيتك! 🤗",
        "هل تريد إضافة مهمة جديدة أو مراجعة مهامك الحالية؟ 🎯",
        "يمكنني مساعدتك في: إضافة مهام، عرض المهام، تقارير الأداء، والنصائح الودية! 💪",
        "ما الذي يمكنني فعله لك اليوم؟ 🌟"
      ],
      'رسمي': [
        "كيف يمكنني مساعدتك في إدارة مهامك اليوم؟",
        "أنا هنا لمساعدتك في تنظيم عملك وتحسين إنتاجيتك.",
        "هل تريد إضافة مهمة جديدة أو مراجعة مهامك الحالية؟",
        "يمكنني مساعدتك في: إضافة مهام، عرض المهام، تقارير الأداء، والنصائح.",
        "ما الذي يمكنني فعله لك اليوم؟"
      ],
      'صارم': [
        "كيف يمكنني مساعدتك في إدارة مهامك اليوم؟",
        "أنا هنا لمساعدتك في تنظيم عملك وتحسين إنتاجيتك.",
        "هل تريد إضافة مهمة جديدة أو مراجعة مهامك الحالية؟",
        "يمكنني مساعدتك في: إضافة مهام، عرض المهام، تقارير الأداء، والنصائح.",
        "ما الذي تحتاجه؟"
      ]
    };

    const responses = personalityResponses[currentPersonality] || personalityResponses['ودود'];
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    addMessage("إلهام", randomResponse, 'bot');

  } catch (error) {
    console.error("خطأ في المحادثة العامة:", error);
    const personality = BOT_PERSONALITIES[currentPersonality];
    const errorResponse = personality.responses.error || "عذراً، حدث خطأ في المحادثة.";
    addMessage("إلهام", errorResponse, 'bot');
  }
}

// ================================================================
// نظام الصلاحيات (RBAC)
// ================================================================

function checkPermission(permission) {
  if (!currentUser || !currentUser.role) return false;

  const rolePermissions = configData.permissions.roles[currentUser.role];
  if (!rolePermissions) return false;

  return rolePermissions[permission] === true;
}

// ================================================================
// وظائف مساعدة
// ================================================================

function showLoading() {
  document.getElementById('sendText').style.display = 'none';
  document.getElementById('loading').style.display = 'inline-block';
  document.getElementById('sendBtn').disabled = true;
}

function hideLoading() {
  document.getElementById('sendText').style.display = 'inline';
  document.getElementById('loading').style.display = 'none';
  document.getElementById('sendBtn').disabled = false;
}

function showError(message) {
  addMessage("إلهام", `❌ ${message}`, 'bot');
}

function saveTasksToStorage() {
  try {
    localStorage.setItem('elhem_tasks', JSON.stringify(tasksData));
  } catch (error) {
    console.error("خطأ في حفظ المهام:", error);
  }
}

function loadTasksFromStorage() {
  try {
    const savedTasks = localStorage.getItem('elhem_tasks');
    if (savedTasks) {
      const parsedTasks = JSON.parse(savedTasks);
      // دمج المهام المحفوظة مع البيانات الأصلية
      parsedTasks.forEach(savedTask => {
        const existingTask = tasksData.find(t => t.taskId === savedTask.taskId);
        if (!existingTask) {
          tasksData.push(savedTask);
        }
      });
    }
  } catch (error) {
    console.error("خطأ في تحميل المهام:", error);
  }
}

// ================================================================
// وظائف النافذة المنبثقة للمشاريع الجديدة
// ================================================================

function showNewProjectModal() {
  if (!currentUser) {
    addMessage("إلهام", "يرجى تسجيل الدخول أولاً لإنشاء مشروع جديد.", 'bot');
    return;
  }

  if (!checkPermission('canCreateTasks')) {
    addMessage("إلهام", "عذراً، ليس لديك صلاحية لإنشاء مشاريع.", 'bot');
    return;
  }

  populateAssignees();
  document.getElementById('newProjectModal').classList.add('show');
}

function hideNewProjectModal() {
  document.getElementById('newProjectModal').classList.remove('show');
  resetProjectForm();
}

function populateAssignees() {
  const assigneeSelects = document.querySelectorAll('.task-assignee');

  // الحصول على قائمة الموظفين المتاحين
  let availableEmployees = teamData;

  // إذا كان المستخدم مديراً، أضف أعضاء فريقه
  if (currentUser.role === 'Manager') {
    const teamMembers = teamData.filter(member => member.managerId === currentUser.employeeId);
    availableEmployees = [currentUser, ...teamMembers];
  }

  assigneeSelects.forEach(select => {
    select.innerHTML = '<option value="">اختر المسؤول</option>';
    availableEmployees.forEach(employee => {
      const option = document.createElement('option');
      option.value = employee.employeeId;
      option.textContent = employee.name;
      select.appendChild(option);
    });
  });
}

function addTask() {
  const tasksList = document.getElementById('tasksList');
  const taskItem = document.createElement('div');
  taskItem.className = 'task-item';

  taskItem.innerHTML = `
    <input type="text" class="task-name" placeholder="اسم المهمة">
    <select class="task-assignee">
      <option value="">اختر المسؤول</option>
    </select>
    <button class="remove-task" onclick="removeTask(this)">حذف</button>
  `;

  tasksList.appendChild(taskItem);
  populateAssignees();
}

function removeTask(button) {
  const taskItem = button.parentElement;
  const tasksList = document.getElementById('tasksList');

  // تأكد من وجود مهمة واحدة على الأقل
  if (tasksList.children.length > 1) {
    taskItem.remove();
  } else {
    alert('يجب أن يحتوي المشروع على مهمة واحدة على الأقل');
  }
}

function resetProjectForm() {
  document.getElementById('projectName').value = '';
  document.getElementById('projectDescription').value = '';
  document.getElementById('projectPriority').value = 'Medium';
  document.getElementById('projectDueDate').value = '';

  // إعادة تعيين قائمة المهام
  const tasksList = document.getElementById('tasksList');
  tasksList.innerHTML = `
    <div class="task-item">
      <input type="text" class="task-name" placeholder="اسم المهمة">
      <select class="task-assignee">
        <option value="">اختر المسؤول</option>
      </select>
      <button class="remove-task" onclick="removeTask(this)">حذف</button>
    </div>
  `;
}

async function createProject() {
  try {
    const projectName = document.getElementById('projectName').value.trim();
    const projectDescription = document.getElementById('projectDescription').value.trim();
    const projectPriority = document.getElementById('projectPriority').value;
    const projectDueDate = document.getElementById('projectDueDate').value;

    if (!projectName) {
      alert('يرجى إدخال اسم المشروع');
      return;
    }

    // جمع المهام
    const taskItems = document.querySelectorAll('.task-item');
    const tasks = [];

    for (let item of taskItems) {
      const taskName = item.querySelector('.task-name').value.trim();
      const assigneeId = item.querySelector('.task-assignee').value;

      if (taskName && assigneeId) {
        const assignee = teamData.find(emp => emp.employeeId === assigneeId);
        tasks.push({
          taskName: taskName,
          assigneeId: assigneeId,
          assigneeName: assignee ? assignee.name : 'غير معروف',
          priority: projectPriority,
          dueDate: projectDueDate,
          description: `مهمة من مشروع: ${projectName}\n${projectDescription}`
        });
      }
    }

    if (tasks.length === 0) {
      alert('يرجى إضافة مهمة واحدة على الأقل');
      return;
    }

    // إنشاء المهام
    let createdCount = 0;
    for (let task of tasks) {
      const taskData = {
        taskName: task.taskName,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate
      };

      // إرسال المهمة إلى قاعدة البيانات مباشرة
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': currentUser.employeeId,
          'user-role': currentUser.role
        },
        body: JSON.stringify({
          ...taskData,
          assignedToId: task.assigneeId,
          assignedToName: task.assigneeName
        })
      });

      const result = await response.json();
      if (result.success) {
        createdCount++;
      }
    }

    hideNewProjectModal();

    const response = `✅ تم إنشاء المشروع بنجاح!\n\n🏗️ ${projectName}\n📊 تم إنشاء ${createdCount} مهمة\n👥 المشاركون: ${[...new Set(tasks.map(t => t.assigneeName))].join(', ')}`;
    addMessage("إلهام", response, 'bot');

  } catch (error) {
    console.error("خطأ في إنشاء المشروع:", error);
    alert('حدث خطأ في إنشاء المشروع');
  }
}

// إضافة أمر "مشروع جديد" لفتح النافذة المنبثقة
function addNewProjectIntent() {
  // إضافة الأمر للكشف
  const newProjectPatterns = ['مشروع جديد', 'new project', 'إنشاء مشروع', 'create project'];
  // سيتم التعامل مع هذا في determineUserIntent
}

// ================================================================
// بدء تشغيل النظام
// ================================================================

document.addEventListener('DOMContentLoaded', function() {
  initializeSystem();

  // إعداد أحداث النافذة المنبثقة
  document.getElementById('closeProjectModal').addEventListener('click', hideNewProjectModal);
  document.getElementById('cancelProject').addEventListener('click', hideNewProjectModal);
  document.getElementById('createProject').addEventListener('click', createProject);

  // إغلاق النافذة عند النقر خارجها
  document.getElementById('newProjectModal').addEventListener('click', function(e) {
    if (e.target === this) {
      hideNewProjectModal();
    }
  });
});

// ================================================================
// وظائف لوحة الإدارة
// ================================================================

function showAdminPanel() {
  if (!currentUser) {
    addMessage("إلهام", "يرجى تسجيل الدخول أولاً.", 'bot');
    return;
  }

  if (!checkPermission('canManageConfig')) {
    addMessage("إلهام", "عذراً، ليس لديك صلاحية الوصول إلى لوحة الإدارة.", 'bot');
    return;
  }

  populateAdminPanel();
  document.getElementById('adminPanelModal').classList.add('show');
}

function hideAdminPanel() {
  document.getElementById('adminPanelModal').classList.remove('show');
}

function showAdminTab(tabName) {
  // إخفاء جميع التبويبات
  const tabs = document.querySelectorAll('.admin-tab-content');
  tabs.forEach(tab => tab.classList.remove('active'));

  // إزالة التفعيل من جميع الأزرار
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => btn.classList.remove('active'));

  // تفعيل التبويب المطلوب
  document.getElementById(tabName + 'Tab').classList.add('active');
  event.target.classList.add('active');

  // تحديث محتوى التبويب
  updateAdminTabContent(tabName);
}

function populateAdminPanel() {
  // عرض الشخصية الحالية
  const currentPersonalityDisplay = document.getElementById('currentPersonalityDisplay');
  const personality = BOT_PERSONALITIES[currentPersonality];
  currentPersonalityDisplay.innerHTML = `
    <strong>${personality.name}</strong> - ${personality.style}
    <br><small>${personality.greeting}</small>
  `;

  // تعيين القيمة الحالية في القائمة المنسدلة
  document.getElementById('personalitySelect').value = currentPersonality;

  // تحديث الإحصائيات
  updateAdminTabContent('stats');

  // تحديث قائمة المستخدمين
  updateAdminTabContent('users');

  // تحديث إعدادات الذكاء الاصطناعي
  document.getElementById('openaiKey').value = configData.ai?.openaiApiKey || '';
  document.getElementById('aiModel').value = configData.ai?.model || 'gpt-4o-mini';
}

function updateAdminTabContent(tabName) {
  switch (tabName) {
    case 'stats':
      updateSystemStats();
      break;
    case 'users':
      updateUsersList();
      break;
  }
}

function updateSystemStats() {
  const statsContainer = document.getElementById('systemStats');

  const stats = {
    totalUsers: teamData.length,
    totalTasks: tasksData.length,
    completedTasks: tasksData.filter(t => t.status === TASK_STATUS.COMPLETED).length,
    activeTasks: tasksData.filter(t => t.status !== TASK_STATUS.COMPLETED).length,
    totalMessages: 0, // يمكن إضافتها لاحقاً
    aiRequests: 0 // يمكن إضافتها لاحقاً
  };

  statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-number">${stats.totalUsers}</div>
      <div class="stat-label">إجمالي المستخدمين</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${stats.totalTasks}</div>
      <div class="stat-label">إجمالي المهام</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${stats.completedTasks}</div>
      <div class="stat-label">المهام المكتملة</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${stats.activeTasks}</div>
      <div class="stat-label">المهام النشطة</div>
    </div>
  `;
}

function updateUsersList() {
  const usersContainer = document.getElementById('usersList');

  usersContainer.innerHTML = teamData.map(user => `
    <div class="user-item">
      <div class="user-info">
        <h4>${user.name}</h4>
        <div class="user-role">${user.role} - ${user.department}</div>
      </div>
      <div class="user-actions">
        <small>ID: ${user.employeeId}</small>
      </div>
    </div>
  `).join('');
}

function changePersonalityFromAdmin() {
  const newPersonality = document.getElementById('personalitySelect').value;

  if (!BOT_PERSONALITIES[newPersonality]) {
    alert('شخصية غير صحيحة');
    return;
  }

  const oldPersonality = currentPersonality;
  currentPersonality = newPersonality;
  localStorage.setItem('elhem_personality', currentPersonality);

  const personality = BOT_PERSONALITIES[currentPersonality];
  const response = `✅ تم تغيير شخصية البوت بنجاح!\n\nمن: ${oldPersonality}\nإلى: ${newPersonality}\n\n${personality.greeting}`;

  addMessage("إلهام", response, 'bot');
  populateAdminPanel(); // تحديث العرض
}

function saveAISettings() {
  const openaiKey = document.getElementById('openaiKey').value.trim();
  const aiModel = document.getElementById('aiModel').value;

  if (configData.ai) {
    configData.ai.openaiApiKey = openaiKey;
    configData.ai.model = aiModel;

    // حفظ في localStorage
    localStorage.setItem('elhem_config', JSON.stringify(configData));

    addMessage("إلهام", "✅ تم حفظ إعدادات الذكاء الاصطناعي بنجاح!", 'bot');
  } else {
    addMessage("إلهام", "❌ خطأ في حفظ الإعدادات", 'bot');
  }
}

// إضافة أمر "لوحة الإدارة" لفتح لوحة الإدارة
function addAdminPanelIntent() {
  // إضافة الأمر للكشف
  const adminPatterns = ['لوحة الإدارة', 'admin panel', 'إدارة', 'admin'];
  // سيتم التعامل مع هذا في determineUserIntent
}

// ================================================================
// بدء تشغيل النظام
// ================================================================

document.addEventListener('DOMContentLoaded', function() {
  initializeSystem();

  // إعداد أحداث النافذة المنبثقة
  document.getElementById('closeProjectModal').addEventListener('click', hideNewProjectModal);
  document.getElementById('cancelProject').addEventListener('click', hideNewProjectModal);
  document.getElementById('createProject').addEventListener('click', createProject);

  // إعداد أحداث لوحة الإدارة
  document.getElementById('closeAdminModal').addEventListener('click', hideAdminPanel);
  document.getElementById('closeAdminPanel').addEventListener('click', hideAdminPanel);

  // إغلاق النافذة عند النقر خارجها
  document.getElementById('newProjectModal').addEventListener('click', function(e) {
    if (e.target === this) {
      hideNewProjectModal();
    }
  });

  document.getElementById('adminPanelModal').addEventListener('click', function(e) {
    if (e.target === this) {
      hideAdminPanel();
    }
  });
});

// إضافة وظيفة تسجيل الخروج للواجهة
window.logout = logout;
window.showNewProjectModal = showNewProjectModal;
window.addTask = addTask;
window.removeTask = removeTask;
window.showAdminPanel = showAdminPanel;