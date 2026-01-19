import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'
import type { Bindings } from './types'
import authRoutes from './routes/auth'
import templateRoutes from './routes/templates'
import { authenticate } from './middleware/auth'
import { hashPassword } from './utils/auth'

const app = new Hono<{ Bindings: Bindings }>()

// CORS設定（APIルート用）
app.use('/api/*', cors())

// 静的ファイル提供
app.use('/static/*', serveStatic({ root: './public' }))

// APIルート
app.route('/api/auth', authRoutes)

// 認証が必要なAPIルート
app.use('/api/templates/*', authenticate)
app.route('/api/templates', templateRoutes)

// レンダラー適用
app.use(renderer)

// ホームページ（ログイン画面）
app.get('/', (c) => {
  return c.render(
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 class="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          帳票作成アプリ
        </h1>
        <form id="loginForm">
          <div class="mb-4">
            <label class="block text-gray-700 mb-2">メールアドレス</label>
            <input 
              type="email" 
              name="email" 
              value="demo@example.com"
              required
              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="mb-6">
            <label class="block text-gray-700 mb-2">パスワード</label>
            <input 
              type="password" 
              name="password" 
              value="demo123456"
              required
              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button 
            type="submit"
            class="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition"
          >
            ログイン
          </button>
        </form>
        <div class="mt-4 text-center">
          <a href="/register" class="text-blue-600 hover:underline">新規登録</a>
        </div>
      </div>
      <script src="/static/app.js"></script>
    </div>,
    { title: 'ログイン - 帳票作成アプリ' }
  )
})

// 新規登録ページ
app.get('/register', (c) => {
  return c.render(
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 class="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          新規登録
        </h1>
        <form id="registerForm">
          <div class="mb-4">
            <label class="block text-gray-700 mb-2">お名前</label>
            <input 
              type="text" 
              name="name" 
              required
              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="mb-4">
            <label class="block text-gray-700 mb-2">メールアドレス</label>
            <input 
              type="email" 
              name="email" 
              required
              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="mb-4">
            <label class="block text-gray-700 mb-2">パスワード（8文字以上）</label>
            <input 
              type="password" 
              name="password" 
              required
              minlength="8"
              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div class="mb-6">
            <label class="block text-gray-700 mb-2">パスワード（確認）</label>
            <input 
              type="password" 
              name="confirmPassword" 
              required
              minlength="8"
              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button 
            type="submit"
            class="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition"
          >
            登録
          </button>
        </form>
        <div class="mt-4 text-center">
          <a href="/" class="text-blue-600 hover:underline">ログインはこちら</a>
        </div>
      </div>
      <script src="/static/app.js"></script>
    </div>,
    { title: '新規登録 - 帳票作成アプリ' }
  )
})

// ダッシュボード
app.get('/dashboard', (c) => {
  return c.render(
    <div class="min-h-screen">
      <nav class="bg-white shadow-md">
        <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            帳票作成アプリ
          </h1>
          <button id="logoutBtn" class="text-gray-600 hover:text-gray-800 cursor-pointer">
            ログアウト
          </button>
        </div>
      </nav>
      
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="mb-8">
          <h2 class="text-2xl font-bold mb-4" id="userGreeting">こんにちは、ユーザーさん</h2>
        </div>
        
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 class="text-lg font-bold mb-4">現在のプラン</h3>
          <div class="flex justify-between items-center">
            <div>
              <p class="text-xl font-bold" id="planName">無料プラン</p>
              <p class="text-gray-600" id="planStatus">テンプレート: 0 / 1 使用中</p>
            </div>
            <button id="upgradeBtn" class="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition">
              プレミアムプランにアップグレード
            </button>
          </div>
        </div>
        
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-bold">マイテンプレート</h3>
            <button id="uploadBtn" class="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition">
              <i class="fas fa-upload mr-2"></i>新しいテンプレートを作成
            </button>
          </div>
          <div id="templatesList">
            <p class="text-gray-500 text-center py-8">テンプレートがまだありません</p>
          </div>
        </div>
      </div>

      {/* アップロードモーダル */}
      <div id="uploadModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
          <h3 class="text-2xl font-bold mb-6">テンプレートアップロード</h3>
          <form id="uploadForm" enctype="multipart/form-data">
            <div class="mb-4">
              <label class="block text-gray-700 mb-2">テンプレート名</label>
              <input 
                type="text" 
                name="template_name" 
                required
                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="例: 見積書テンプレート"
              />
            </div>
            <div class="mb-6">
              <label class="block text-gray-700 mb-2">Excelファイル（.xlsx, .xls）</label>
              <input 
                type="file" 
                name="file" 
                accept=".xlsx,.xls"
                required
                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p class="text-sm text-gray-500 mt-2">最大10MBまで</p>
            </div>
            <div class="flex gap-4">
              <button 
                type="submit"
                class="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                アップロード
              </button>
              <button 
                type="button"
                id="cancelUploadBtn"
                class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      </div>

      <script src="/static/app.js"></script>
      <script>{`
        // ページ読み込み時にユーザー情報を表示
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        if (!user.name) {
          window.location.href = '/'
        } else {
          document.getElementById('userGreeting').textContent = 'こんにちは、' + user.name + 'さん'
          document.getElementById('planName').textContent = user.current_plan === 'premium' ? 'プレミアムプラン' : '無料プラン'
        }
      `}</script>
    </div>,
    { title: 'ダッシュボード - 帳票作成アプリ' }
  )
})

// テンプレート詳細ページ
app.get('/templates/:id', (c) => {
  const templateId = c.req.param('id')
  
  return c.render(
    <div class="min-h-screen">
      <nav class="bg-white shadow-md">
        <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            帳票作成アプリ
          </h1>
          <div class="flex gap-4 items-center">
            <a href="/dashboard" class="text-gray-600 hover:text-gray-800">
              <i class="fas fa-arrow-left mr-2"></i>ダッシュボードへ戻る
            </a>
            <button id="logoutBtn" class="text-gray-600 hover:text-gray-800 cursor-pointer">
              ログアウト
            </button>
          </div>
        </div>
      </nav>
      
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="mb-8">
          <h2 class="text-2xl font-bold mb-4" id="templateTitle">テンプレート詳細</h2>
        </div>
        
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 class="text-lg font-bold mb-4">テンプレート情報</h3>
          <div id="templateInfo" class="text-gray-600">
            読み込み中...
          </div>
        </div>
        
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-bold">抽出された項目</h3>
            <button 
              id="extractBtn" 
              class="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition"
            >
              <i class="fas fa-magic mr-2"></i>AI項目抽出を実行
            </button>
          </div>
          <div id="extractionStatus" class="hidden mb-4">
            <div class="bg-blue-50 border-l-4 border-blue-500 p-4">
              <p class="text-blue-700">
                <i class="fas fa-spinner fa-spin mr-2"></i>
                AI項目抽出中... しばらくお待ちください
              </p>
            </div>
          </div>
          <div id="fieldsList">
            <p class="text-gray-500 text-center py-8">まだ項目が抽出されていません</p>
          </div>
        </div>
      </div>
      
      <script src="/static/app.js"></script>
      <script>{`
        window.TEMPLATE_ID = '${templateId}'
      `}</script>
    </div>,
    { title: 'テンプレート詳細 - 帳票作成アプリ' }
  )
})

// APIルート
app.get('/api/health', (c) => {
  return c.json({ success: true, message: 'API is working' })
})

// テスト用：データベース接続確認
app.get('/api/test-db', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT 1 as test').first()
    return c.json({ success: true, message: 'Database connected', data: result })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// データベース初期化（開発環境のみ）
app.post('/api/db/init', async (c) => {
  try {
    const { DB } = c.env
    
    // テーブル作成
    const schema = `
      CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        current_plan TEXT DEFAULT 'free' CHECK (current_plan IN ('free', 'premium')),
        templates_created INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_subscriptions (
        subscription_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'premium')),
        template_limit INTEGER NOT NULL DEFAULT 1,
        start_date TEXT NOT NULL,
        expiry_date TEXT,
        payment_status TEXT DEFAULT 'active',
        stripe_subscription_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS templates (
        template_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        template_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        quotes_created INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS template_fields (
        field_id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        field_type TEXT NOT NULL,
        data_type TEXT DEFAULT 'text',
        cell_position TEXT,
        calculation_formula TEXT,
        fixed_value TEXT,
        is_required INTEGER DEFAULT 0,
        display_order INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS forms (
        form_id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        form_url TEXT UNIQUE NOT NULL,
        form_title TEXT NOT NULL,
        form_description TEXT,
        is_active INTEGER DEFAULT 1,
        access_count INTEGER DEFAULT 0,
        submission_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS quotes (
        quote_id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER NOT NULL,
        template_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        input_data TEXT NOT NULL,
        calculated_data TEXT,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (form_id) REFERENCES forms(form_id) ON DELETE CASCADE,
        FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      );
    `

    // SQLを分割して実行
    const statements = schema.split(';').filter(s => s.trim())
    for (const statement of statements) {
      await DB.prepare(statement).run()
    }

    // サンプルユーザーを挿入
    const demoPasswordHash = await hashPassword('demo123456')
    await DB.prepare(`
      INSERT OR IGNORE INTO users (email, password_hash, name, current_plan, templates_created)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      'demo@example.com',
      demoPasswordHash,
      'デモユーザー',
      'free',
      0
    ).run()

    // サブスクリプションを挿入
    const user = await DB.prepare('SELECT user_id FROM users WHERE email = ?')
      .bind('demo@example.com')
      .first()
    
    if (user) {
      await DB.prepare(`
        INSERT OR IGNORE INTO user_subscriptions (user_id, plan_type, template_limit, start_date, payment_status)
        VALUES (?, ?, ?, date('now'), ?)
      `).bind(user.user_id, 'free', 1, 'active').run()
    }

    return c.json({ success: true, message: 'Database initialized successfully' })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

export default app
