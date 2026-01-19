import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

// CORS設定（APIルート用）
app.use('/api/*', cors())

// 静的ファイル提供
app.use('/static/*', serveStatic({ root: './public' }))

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
        <form action="/api/auth/login" method="POST" id="loginForm">
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
    </div>,
    { title: 'ログイン - 帳票作成アプリ' }
  )
})

// ダッシュボード（仮）
app.get('/dashboard', (c) => {
  return c.render(
    <div class="min-h-screen">
      <nav class="bg-white shadow-md">
        <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            帳票作成アプリ
          </h1>
          <button onclick="window.location.href='/'" class="text-gray-600 hover:text-gray-800">
            ログアウト
          </button>
        </div>
      </nav>
      
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="mb-8">
          <h2 class="text-2xl font-bold mb-4">こんにちは、ユーザーさん</h2>
        </div>
        
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 class="text-lg font-bold mb-4">現在のプラン</h3>
          <div class="flex justify-between items-center">
            <div>
              <p class="text-xl font-bold">無料プラン</p>
              <p class="text-gray-600">テンプレート: 0 / 1 使用中</p>
            </div>
            <button class="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition">
              プレミアムプランにアップグレード
            </button>
          </div>
        </div>
        
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-bold">マイテンプレート</h3>
            <button class="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition">
              + 新しいテンプレートを作成
            </button>
          </div>
          <p class="text-gray-500 text-center py-8">テンプレートがまだありません</p>
        </div>
      </div>
    </div>,
    { title: 'ダッシュボード - 帳票作成アプリ' }
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
    await DB.prepare(`
      INSERT OR IGNORE INTO users (email, password_hash, name, current_plan, templates_created)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      'demo@example.com',
      '$2b$10$XQK0kCl7DkqH1HqNbJ1VNuH8yJPvE4qZ0ggXxF.vGQmLQK1xC0yXW',
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
