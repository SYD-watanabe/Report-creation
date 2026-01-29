import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { renderer } from './renderer'
import type { Bindings } from './types'
import authRoutes from './routes/auth'
import templateRoutes from './routes/templates'
import formRoutes from './routes/forms'
import quoteRoutes from './routes/quotes'
import adminRoutes from './routes/admin'
import { authenticate } from './middleware/auth'
import { hashPassword } from './utils/auth'

const app = new Hono<{ Bindings: Bindings }>()

// CORS設定（APIルート用）
app.use('/api/*', cors())

// 静的ファイル提供
app.use('/static/*', serveStatic({ root: './public' }))

// APIルート
app.route('/api/auth', authRoutes)

// 認証が必要なauthエンドポイント
app.use('/api/auth/update-profile', authenticate)

// 認証が必要なAPIルート
app.use('/api/templates/*', authenticate)
app.route('/api/templates', templateRoutes)

app.use('/api/quotes/*', authenticate)
app.route('/api/quotes', quoteRoutes)

// 管理者APIルート（注意：本番環境では適切な管理者認証を追加してください）
app.route('/api/admin', adminRoutes)

// フォームAPIルート（一部認証不要）
app.use('/api/forms/*', async (c, next) => {
  const path = c.req.path;
  // 公開フォーム関連は認証不要（8文字の英小文字+数字のランダムURL）
  // 例: /api/forms/abc123xy または /api/forms/abc123xy/submit
  // 数字のみのformId（例: /api/forms/51）は認証必要
  if (path.match(/\/api\/forms\/[a-z0-9]{8}$/) && !path.match(/\/api\/forms\/\d+$/)) {
    return next();
  }
  if (path.match(/\/api\/forms\/[a-z0-9]{8}\/submit$/)) {
    return next();
  }
  // その他（数字のみのformId、template指定など）は認証必要
  return authenticate(c, next);
})
app.route('/api/forms', formRoutes)

// レンダラー適用
app.use(renderer)

// 共通ヘッダーコンポーネント
const Header = () => (
  <nav class="bg-white shadow-md relative">
    <div class="max-w-7xl mx-auto px-4 py-4">
      <div class="flex justify-between items-center mb-4">
        <a href="/dashboard" class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:opacity-80 transition cursor-pointer">
          🏠 エクセルまもる君
        </a>
        <div class="flex gap-3 items-center">
          <button id="upgradeBtn" class="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition shadow-md hover:shadow-lg">
            ⭐ プランアップグレード
          </button>
          <button id="settingsToggleBtn" class="text-gray-600 hover:text-gray-800 cursor-pointer px-4 py-2 border rounded-lg hover:bg-gray-50 transition">
            📋 メニュー ▼
          </button>
        </div>
      </div>
      
      {/* メインメニュー（常に表示） */}
      <div class="border-t pt-4">
        <ul class="flex gap-3 flex-wrap">
          <li>
            <a href="/dashboard" class="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-md hover:shadow-lg cursor-pointer">
              ➕ 新規フォーム作成
            </a>
          </li>
          <li>
            <a href="/quotes" class="inline-flex items-center gap-2 px-5 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition shadow-md hover:shadow-lg cursor-pointer">
              📋 フォーム受信見積書一覧
            </a>
          </li>
          <li>
            <button id="formsMenuBtn" class="inline-flex items-center gap-2 px-5 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition shadow-md hover:shadow-lg cursor-pointer">
              📝 フォーム管理
            </button>
          </li>
        </ul>
      </div>
    </div>
    
    {/* メニュー（折りたたみ） - 絶対配置で右寄せ */}
    <div id="settingsDropdown" class="hidden absolute right-4 top-20 bg-white border rounded-lg shadow-xl z-50 w-64">
      <ul class="py-2">
        <li>
          <button id="contactBtn" class="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-100 transition text-left">
            📧 お問い合わせ
          </button>
        </li>
        <li>
          <button id="accountBtn" class="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-100 transition text-left">
            👤 アカウント情報
          </button>
        </li>
        <li>
          <button id="logoutBtn" class="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-100 transition text-left">
            🚪 ログアウト
          </button>
        </li>
      </ul>
    </div>
  </nav>
)

// 共通モーダルコンポーネント
const CommonModals = () => (
  <>
    {/* アカウント情報モーダル */}
    <div id="accountModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <h3 class="text-2xl font-bold mb-6">アカウント情報</h3>
        <form id="accountForm">
          <div class="mb-4">
            <label class="block text-gray-700 mb-2">メールアドレス</label>
            <input 
              type="email" 
              id="accountEmail"
              disabled
              class="w-full px-4 py-3 border rounded-lg bg-gray-100 text-gray-600"
            />
          </div>
          <div class="mb-6">
            <label class="block text-gray-700 mb-2">ユーザー名</label>
            <input 
              type="text" 
              id="accountName"
              name="name"
              required
              class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="ユーザー名を入力"
            />
          </div>
          <div class="flex gap-4">
            <button 
              type="submit"
              class="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              変更を保存
            </button>
            <button 
              type="button"
              id="cancelAccountBtn"
              class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>

    {/* お問い合わせモーダル */}
    <div id="contactModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <h3 class="text-2xl font-bold mb-6">お問い合わせ</h3>
        
        <div class="mb-6">
          <h4 class="text-lg font-semibold mb-3 text-gray-800">会社概要</h4>
          <div class="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 space-y-2">
            <p class="font-semibold">株式会社SYD　ネットPR事業部</p>
            <p>東京都中央区日本橋小舟町9-4</p>
            <p>日本橋小舟町ビル7F</p>
            <p class="mt-3">
              <i class="fas fa-phone mr-2"></i>
              TEL：<a href="tel:03-6264-8977" class="text-blue-600 hover:underline">03-6264-8977</a> / 
              <a href="tel:050-3160-7004" class="text-blue-600 hover:underline">050-3160-7004</a>
            </p>
            <p class="text-gray-600">（平日10:00～17:50）</p>
          </div>
        </div>

        <div class="mb-6">
          <h4 class="text-lg font-semibold mb-3 text-gray-800">フォームからお問い合わせ</h4>
          <a 
            href="https://www.netpr.biz/report-creation-form" 
            target="_blank"
            rel="noopener noreferrer"
            class="block w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition text-center"
          >
            <i class="fas fa-external-link-alt mr-2"></i>
            お問い合わせフォームを開く
          </a>
        </div>

        <button 
          type="button"
          id="closeContactBtn"
          class="w-full bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition"
        >
          閉じる
        </button>
      </div>
    </div>
  </>
)

// ホームページ（ログイン画面）
app.get('/', (c) => {
  return c.render(
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h1 class="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          エクセルまもる君
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
    { title: 'ログイン - エクセルまもる君' }
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
    { title: '新規登録 - エクセルまもる君' }
  )
})

// ダッシュボード
app.get('/dashboard', (c) => {
  return c.render(
    <div class="min-h-screen bg-gray-50">
      <Header />
      
      <div class="max-w-7xl mx-auto px-4 py-8">
        {/* プランアップグレードボタン（左上） */}
        <div class="mb-6">
          <a 
            id="upgradeBtn"
            href="https://www.netpr.biz/report-creation-orderform" 
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition"
          >
            ⚡ プランアップグレード
          </a>
        </div>
        
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div id="templatesList">
            {/* テンプレート一覧がここに表示される */}
          </div>
          
          {/* 新しいフォームを作成ボタン（中央配置、拡大） */}
          <div class="flex justify-center mt-6">
            <button id="uploadBtn" class="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition shadow-md hover:shadow-lg">
              <i class="fas fa-upload mr-2"></i>新しいフォームを作成
            </button>
          </div>
        </div>
      </div>

      {/* アップロードモーダル */}
      <div id="uploadModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
          <h3 class="text-2xl font-bold mb-6">エクセルアップロード</h3>
          <form id="uploadForm" enctype="multipart/form-data">
            <div class="mb-6">
              <label class="block text-gray-700 mb-2">Excelファイル（.xlsx, .xls）</label>
              <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition">
                <input 
                  type="file" 
                  name="file" 
                  accept=".xlsx,.xls"
                  required
                  class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p class="text-gray-600 mt-3">📎 ドラッグ＆ドロップ可</p>
              </div>
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

      {/* アカウント情報モーダル */}
      <div id="accountModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
          <h3 class="text-2xl font-bold mb-6">アカウント情報</h3>
          <form id="accountForm">
            <div class="mb-4">
              <label class="block text-gray-700 mb-2">メールアドレス</label>
              <input 
                type="email" 
                id="accountEmail"
                disabled
                class="w-full px-4 py-3 border rounded-lg bg-gray-100 text-gray-600"
              />
            </div>
            <div class="mb-6">
              <label class="block text-gray-700 mb-2">ユーザー名</label>
              <input 
                type="text" 
                id="accountName"
                name="name"
                required
                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="ユーザー名を入力"
              />
            </div>
            <div class="flex gap-4">
              <button 
                type="submit"
                class="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                変更を保存
              </button>
              <button 
                type="button"
                id="cancelAccountBtn"
                class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* お問い合わせモーダル */}
      <div id="contactModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
          <h3 class="text-2xl font-bold mb-6">お問い合わせ</h3>
          
          <div class="mb-6">
            <h4 class="text-lg font-semibold mb-3 text-gray-800">会社概要</h4>
            <div class="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 space-y-2">
              <p class="font-semibold">株式会社SYD　ネットPR事業部</p>
              <p>東京都中央区日本橋小舟町9-4</p>
              <p>日本橋小舟町ビル7F</p>
              <p class="mt-3">
                <i class="fas fa-phone mr-2"></i>
                TEL：<a href="tel:03-6264-8977" class="text-blue-600 hover:underline">03-6264-8977</a> / 
                <a href="tel:050-3160-7004" class="text-blue-600 hover:underline">050-3160-7004</a>
              </p>
              <p class="text-gray-600">（平日10:00～17:50）</p>
            </div>
          </div>

          <div class="mb-6">
            <h4 class="text-lg font-semibold mb-3 text-gray-800">フォームからお問い合わせ</h4>
            <a 
              href="https://www.netpr.biz/report-creation-form" 
              target="_blank"
              rel="noopener noreferrer"
              class="block w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition text-center"
            >
              <i class="fas fa-external-link-alt mr-2"></i>
              お問い合わせフォームを開く
            </a>
          </div>

          <button 
            type="button"
            id="closeContactBtn"
            class="w-full bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition"
          >
            閉じる
          </button>
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
    { title: 'ダッシュボード - エクセルまもる君' }
  )
})

// 管理ダッシュボードページ
app.get('/admin', (c) => {
  return c.render(
    <div class="min-h-screen bg-gray-50">
      {/* ナビゲーションバー */}
      <nav class="bg-white shadow-md">
        <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <a href="/dashboard" class="text-2xl font-bold text-gray-800 hover:opacity-80 transition cursor-pointer">
              <i class="fas fa-user-shield mr-2"></i>エクセルまもる君 - 管理
            </a>
          </div>
          <div class="flex gap-4">
            <a 
              href="https://www.netpr.biz/report-creation-orderform" 
              target="_blank"
              rel="noopener noreferrer"
              class="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:shadow-lg transition"
            >
              プランアップグレード
            </a>
            <a href="/dashboard" class="text-gray-600 hover:text-gray-800">
              <i class="fas fa-home mr-2"></i>通常ダッシュボード
            </a>
            <button id="logoutBtn" class="text-red-600 hover:text-red-800">
              <i class="fas fa-sign-out-alt mr-2"></i>ログアウト
            </button>
          </div>
        </div>
      </nav>

      <div class="max-w-7xl mx-auto px-4 py-8">
        {/* 統計情報カード */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-600 text-sm">総ユーザー数</p>
                <p id="totalUsers" class="text-3xl font-bold text-blue-600">0</p>
              </div>
              <i class="fas fa-users text-4xl text-blue-200"></i>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-600 text-sm">テンプレート数</p>
                <p id="totalTemplates" class="text-3xl font-bold text-green-600">0</p>
              </div>
              <i class="fas fa-file-excel text-4xl text-green-200"></i>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-600 text-sm">フォーム数</p>
                <p id="totalForms" class="text-3xl font-bold text-purple-600">0</p>
                <p class="text-xs text-gray-500">
                  アクティブ: <span id="activeForms">0</span>
                </p>
              </div>
              <i class="fas fa-wpforms text-4xl text-purple-200"></i>
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-600 text-sm">見積書数</p>
                <p id="totalQuotes" class="text-3xl font-bold text-orange-600">0</p>
              </div>
              <i class="fas fa-file-invoice text-4xl text-orange-200"></i>
            </div>
          </div>
        </div>

        {/* プラン別ユーザー数 */}
        <div class="bg-white rounded-lg shadow p-6 mb-8">
          <h2 class="text-xl font-bold mb-4">プラン別ユーザー数</h2>
          <div class="grid grid-cols-2 gap-4">
            <div class="text-center p-4 bg-gray-50 rounded-lg">
              <p class="text-gray-600 mb-2">無料プラン</p>
              <p id="freeUsers" class="text-3xl font-bold text-gray-700">0</p>
            </div>
            <div class="text-center p-4 bg-purple-50 rounded-lg">
              <p class="text-gray-600 mb-2">プレミアムプラン</p>
              <p id="premiumUsers" class="text-3xl font-bold text-purple-700">0</p>
            </div>
          </div>
        </div>

        {/* ユーザー一覧 */}
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-bold mb-4">
            <i class="fas fa-users mr-2"></i>ユーザー一覧
          </h2>
          <div id="usersList">
            <p class="text-gray-500 text-center py-8">読み込み中...</p>
          </div>
        </div>
      </div>

      <script src="/static/app.js"></script>
      <script src="/static/admin.js"></script>
    </div>,
    { title: '管理ダッシュボード - エクセルまもる君' }
  )
})

// ユーザー詳細ページ
app.get('/admin/user/:userId', (c) => {
  const userId = c.req.param('userId')
  
  return c.render(
    <div class="min-h-screen bg-gray-50">
      {/* ナビゲーションバー */}
      <nav class="bg-white shadow-md">
        <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <a href="/dashboard" class="text-2xl font-bold text-gray-800 hover:opacity-80 transition cursor-pointer">
              <i class="fas fa-user mr-2"></i>エクセルまもる君 - ユーザー詳細
            </a>
          </div>
          <div class="flex gap-4">
            <a 
              href="https://www.netpr.biz/report-creation-orderform" 
              target="_blank"
              rel="noopener noreferrer"
              class="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:shadow-lg transition"
            >
              プランアップグレード
            </a>
            <a href="/admin" class="text-blue-600 hover:text-blue-800">
              <i class="fas fa-arrow-left mr-2"></i>管理ダッシュボードに戻る
            </a>
            <button id="logoutBtn" class="text-red-600 hover:text-red-800">
              <i class="fas fa-sign-out-alt mr-2"></i>ログアウト
            </button>
          </div>
        </div>
      </nav>

      <div class="max-w-7xl mx-auto px-4 py-8">
        <div id="userDetailContent">
          <p class="text-gray-500 text-center py-8">読み込み中...</p>
        </div>
      </div>

      <script src="/static/app.js"></script>
      <script src="/static/admin.js"></script>
      <script dangerouslySetInnerHTML={{ __html: `window.USER_ID = '${userId}'` }}></script>
    </div>,
    { title: 'ユーザー詳細 - エクセルまもる君' }
  )
})

// テンプレート詳細ページ
app.get('/templates/:id', (c) => {
  const templateId = c.req.param('id')
  
  return c.render(
    <div class="min-h-screen bg-gray-50">
      <Header />
      
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="mb-8">
          <h2 class="text-2xl font-bold mb-4" id="templateTitle">テンプレート詳細</h2>
        </div>
        
        {/* テンプレート情報は非表示 */}
        
        {/* プロトタイプ: 2カラムレイアウト（7:3比率） */}
        <div class="grid grid-cols-10 gap-6 mb-8">
          {/* 左側: Excelプレビュー（70%幅） */}
          <div class="col-span-7 bg-white rounded-xl shadow-lg p-6">
            <div class="mb-4 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p class="text-base font-semibold text-blue-800">📌 担当者に入力して欲しい箇所のセルを選択してください</p>
            </div>
            <div id="excelPreview" class="border rounded-lg overflow-auto" style="max-height: 600px;">
              <p class="text-gray-500 text-center py-8">読み込み中...</p>
            </div>
          </div>
          
          {/* 右側: フォームプレビュー（30%幅） */}
          <div class="col-span-3 bg-white rounded-xl shadow-lg p-6">
            <h3 class="text-lg font-bold mb-4">📝 担当者入力フォーム プレビュー</h3>
            <div id="formPreview" class="border rounded-lg p-4 overflow-auto" style="max-height: 500px;">
              <p class="text-gray-500 text-center py-8">項目がありません</p>
            </div>
            
            {/* フォーム作成ボタン */}
            <div class="mt-4">
              <button 
                id="createFormFromPreviewBtn" 
                class="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition flex items-center justify-center"
              >
                <i class="fas fa-plus-circle mr-2"></i>
                フォーム作成
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* フォーム名入力モーダル */}
      <div id="formNameModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
          <h3 class="text-2xl font-bold mb-6">フォーム名を入力</h3>
          <form id="formNameForm">
            <div class="mb-6">
              <input 
                type="text" 
                id="formNameSuffix"
                name="form_name_suffix"
                required
                class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="例: 営業用"
              />
            </div>
            <div class="flex gap-4">
              <button 
                type="submit"
                class="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                作成
              </button>
              <button 
                type="button"
                id="cancelFormNameBtn"
                class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-400 transition"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <CommonModals />
      
      <script src="/static/app.js"></script>
      <script dangerouslySetInnerHTML={{
        __html: `window.TEMPLATE_ID = '${templateId}'`
      }}></script>
    </div>,
    { title: 'テンプレート詳細 - エクセルまもる君' }
  )
})

// 公開フォーム表示ページ
app.get('/forms/:formUrl', (c) => {
  const formUrl = c.req.param('formUrl')
  
  return c.render(
    <div class="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <nav class="bg-white shadow-md">
        <div class="max-w-3xl mx-auto px-4 py-4">
          <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent text-center">
            エクセルまもる君 - フォーム入力
          </h1>
        </div>
      </nav>
      
      <div class="max-w-3xl mx-auto px-4 py-8">
        <div id="formContainer" class="bg-white rounded-xl shadow-lg p-8">
          <div class="text-center py-12">
            <i class="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
            <p class="text-gray-600">フォームを読み込み中...</p>
          </div>
        </div>
        
        <div id="successMessage" class="hidden mt-6 bg-green-50 border-l-4 border-green-500 p-6 rounded-lg">
          <div class="flex items-center mb-2">
            <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
            <h3 class="text-lg font-bold text-green-800">送信完了！</h3>
          </div>
          <p class="text-green-700 mb-4">見積書を作成しました。</p>
          <button 
            onclick="window.location.reload()"
            class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
          >
            <i class="fas fa-redo mr-2"></i>もう一度入力する
          </button>
        </div>
      </div>
      
      <script dangerouslySetInnerHTML={{
        __html: `window.FORM_URL = '${formUrl}'`
      }}></script>
      <script src="/static/forms.js"></script>
    </div>,
    { title: 'フォーム入力 - エクセルまもる君' }
  )
})

// フォーム管理ページ
app.get('/templates/:id/forms', (c) => {
  const templateId = c.req.param('id')
  
  return c.render(
    <div class="min-h-screen bg-gray-50">
      <Header />
      
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="mb-8">
          <h2 class="text-2xl font-bold mb-4">フォーム管理</h2>
        </div>
        
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div class="mb-6">
            <h3 class="text-lg font-bold mb-4">フォーム一覧</h3>
            <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p class="text-base font-semibold text-blue-800">📌 URLをコピーして担当者様に送りましょう</p>
            </div>
          </div>
          <div id="formsList">
            <p class="text-gray-500 text-center py-8">読み込み中...</p>
          </div>
        </div>
      </div>
      
      <CommonModals />
      
      <script src="/static/app.js"></script>
      <script dangerouslySetInnerHTML={{
        __html: `window.TEMPLATE_ID = '${templateId}'`
      }}></script>
    </div>,
    { title: 'フォーム管理 - エクセルまもる君' }
  )
})

// フォーム受信見積書一覧ページ
app.get('/quotes', (c) => {
  return c.render(
    <div class="min-h-screen bg-gray-50">
      <Header />
      
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="mb-8">
          <h2 class="text-2xl font-bold mb-4">フォーム受信見積書一覧</h2>
        </div>
        
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-bold">見積書一覧</h3>
            <div class="text-sm text-gray-600">
              <span id="quoteCount">0</span>件の見積書
            </div>
          </div>
          <div id="quotesList">
            <p class="text-gray-500 text-center py-8">読み込み中...</p>
          </div>
        </div>
      </div>

      {/* 見積書詳細モーダル */}
      <div id="quoteDetailModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
        <div class="bg-white rounded-xl shadow-2xl p-8 w-full max-w-4xl m-4 max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-2xl font-bold">見積書詳細</h3>
            <button 
              id="closeDetailBtn"
              class="text-gray-600 hover:text-gray-800 text-2xl"
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div id="quoteDetailContent">
            <p class="text-gray-500 text-center py-8">読み込み中...</p>
          </div>
        </div>
      </div>
      
      <CommonModals />
      
      <script src="/static/app.js"></script>
      <script src="/static/quotes.js"></script>
    </div>,
    { title: 'フォーム受信見積書一覧 - エクセルまもる君' }
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
        include_in_form INTEGER DEFAULT 1,
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
