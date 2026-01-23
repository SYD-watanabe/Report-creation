// 管理画面用JavaScript

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname === '/admin') {
    initAdminDashboard()
  } else if (window.location.pathname.startsWith('/admin/user/')) {
    initAdminUserDetail()
  }
})

// 管理ダッシュボード初期化
async function initAdminDashboard() {
  await loadStats()
  await loadUsers()
}

// 統計情報を読み込み
async function loadStats() {
  try {
    const { data } = await apiCall('/api/admin/stats')
    
    if (data.success) {
      const stats = data.data
      
      // 統計情報を表示
      document.getElementById('totalUsers').textContent = stats.users.total
      document.getElementById('totalTemplates').textContent = stats.templates
      document.getElementById('totalForms').textContent = stats.forms.total
      document.getElementById('activeForms').textContent = stats.forms.active
      document.getElementById('totalQuotes').textContent = stats.quotes
      
      // プラン別ユーザー数
      const freeUsers = stats.users.byPlan.find(p => p.current_plan === 'free')?.count || 0
      const premiumUsers = stats.users.byPlan.find(p => p.current_plan === 'premium')?.count || 0
      
      document.getElementById('freeUsers').textContent = freeUsers
      document.getElementById('premiumUsers').textContent = premiumUsers
    }
  } catch (error) {
    console.error('Load stats error:', error)
  }
}

// ユーザー一覧を読み込み
async function loadUsers() {
  try {
    const { data } = await apiCall('/api/admin/users')
    
    if (data.success) {
      renderUsers(data.data.users)
    } else {
      document.getElementById('usersList').innerHTML = '<p class="text-red-600 text-center py-8">ユーザー一覧の読み込みに失敗しました</p>'
    }
  } catch (error) {
    console.error('Load users error:', error)
    document.getElementById('usersList').innerHTML = '<p class="text-red-600 text-center py-8">ユーザー一覧の読み込みに失敗しました</p>'
  }
}

// ユーザー一覧を描画
function renderUsers(users) {
  const usersList = document.getElementById('usersList')
  
  if (!usersList) return
  
  if (users.length === 0) {
    usersList.innerHTML = '<p class="text-gray-500 text-center py-8">ユーザーがいません</p>'
    return
  }
  
  usersList.innerHTML = `
    <div class="overflow-x-auto">
      <table class="min-w-full bg-white border">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">ID</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">メール</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">名前</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">プラン</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">テンプレート数</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">ステータス</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">登録日</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          ${users.map(user => `
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3 text-sm">${user.user_id}</td>
              <td class="px-4 py-3 text-sm">${escapeHtml(user.email)}</td>
              <td class="px-4 py-3 text-sm">${escapeHtml(user.name)}</td>
              <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 rounded text-xs font-semibold ${
                  user.current_plan === 'premium' 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-gray-100 text-gray-800'
                }">
                  ${user.current_plan === 'premium' ? 'プレミアム' : '無料'}
                </span>
              </td>
              <td class="px-4 py-3 text-sm">${user.templates_created} / ${user.template_limit === -1 ? '∞' : user.template_limit}</td>
              <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 rounded text-xs font-semibold ${
                  user.payment_status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }">
                  ${user.payment_status === 'active' ? 'アクティブ' : user.payment_status || '未設定'}
                </span>
              </td>
              <td class="px-4 py-3 text-sm">${formatDate(user.created_at)}</td>
              <td class="px-4 py-3 text-sm">
                <a href="/admin/user/${user.user_id}" class="text-blue-600 hover:underline">詳細</a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

// ユーザー詳細ページ初期化
async function initAdminUserDetail() {
  const pathParts = window.location.pathname.split('/')
  const userId = pathParts[pathParts.length - 1]
  
  await loadUserDetail(userId)
}

// ユーザー詳細を読み込み
async function loadUserDetail(userId) {
  try {
    const { data } = await apiCall(`/api/admin/user/${userId}`)
    
    if (data.success) {
      renderUserDetail(data.data)
    } else {
      document.getElementById('userDetailContent').innerHTML = '<p class="text-red-600 text-center py-8">ユーザー情報の読み込みに失敗しました</p>'
    }
  } catch (error) {
    console.error('Load user detail error:', error)
    document.getElementById('userDetailContent').innerHTML = '<p class="text-red-600 text-center py-8">ユーザー情報の読み込みに失敗しました</p>'
  }
}

// ユーザー詳細を描画
function renderUserDetail(detail) {
  const content = document.getElementById('userDetailContent')
  const user = detail.user
  
  content.innerHTML = `
    <div class="space-y-6">
      <!-- ユーザー基本情報 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-xl font-bold mb-4">基本情報</h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-gray-600">ユーザーID</p>
            <p class="font-semibold">${user.user_id}</p>
          </div>
          <div>
            <p class="text-gray-600">メールアドレス</p>
            <p class="font-semibold">${escapeHtml(user.email)}</p>
          </div>
          <div>
            <p class="text-gray-600">名前</p>
            <p class="font-semibold">${escapeHtml(user.name)}</p>
          </div>
          <div>
            <p class="text-gray-600">現在のプラン</p>
            <p class="font-semibold">
              <span class="px-2 py-1 rounded text-xs ${
                user.current_plan === 'premium' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-gray-100 text-gray-800'
              }">
                ${user.current_plan === 'premium' ? 'プレミアム' : '無料'}
              </span>
            </p>
          </div>
          <div>
            <p class="text-gray-600">テンプレート作成数</p>
            <p class="font-semibold">${user.templates_created} / ${user.template_limit === -1 ? '∞' : user.template_limit}</p>
          </div>
          <div>
            <p class="text-gray-600">登録日</p>
            <p class="font-semibold">${formatDate(user.created_at)}</p>
          </div>
        </div>
      </div>
      
      <!-- サブスクリプション情報 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-xl font-bold mb-4">サブスクリプション情報</h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-gray-600">プランタイプ</p>
            <p class="font-semibold">${user.plan_type || 'N/A'}</p>
          </div>
          <div>
            <p class="text-gray-600">支払いステータス</p>
            <p class="font-semibold">
              <span class="px-2 py-1 rounded text-xs ${
                user.payment_status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }">
                ${user.payment_status || '未設定'}
              </span>
            </p>
          </div>
          <div>
            <p class="text-gray-600">開始日</p>
            <p class="font-semibold">${user.start_date ? formatDate(user.start_date) : 'N/A'}</p>
          </div>
          <div>
            <p class="text-gray-600">有効期限</p>
            <p class="font-semibold">${user.expiry_date ? formatDate(user.expiry_date) : '無期限'}</p>
          </div>
          ${user.stripe_subscription_id ? `
          <div class="col-span-2">
            <p class="text-gray-600">Stripe サブスクリプションID</p>
            <p class="font-mono text-xs">${user.stripe_subscription_id}</p>
          </div>
          ` : ''}
        </div>
      </div>
      
      <!-- テンプレート一覧 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-xl font-bold mb-4">テンプレート (${detail.templates.length}件)</h3>
        ${detail.templates.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="min-w-full border">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-semibold">ID</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">テンプレート名</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">ファイル形式</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">サイズ</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">見積書数</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">作成日</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                ${detail.templates.map(t => `
                  <tr>
                    <td class="px-4 py-2 text-sm">${t.template_id}</td>
                    <td class="px-4 py-2 text-sm">${escapeHtml(t.template_name)}</td>
                    <td class="px-4 py-2 text-sm">${t.file_type}</td>
                    <td class="px-4 py-2 text-sm">${formatFileSize(t.file_size)}</td>
                    <td class="px-4 py-2 text-sm">${t.quotes_created}</td>
                    <td class="px-4 py-2 text-sm">${formatDate(t.created_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p class="text-gray-500">テンプレートがありません</p>'}
      </div>
      
      <!-- フォーム一覧 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-xl font-bold mb-4">フォーム (${detail.forms.length}件)</h3>
        ${detail.forms.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="min-w-full border">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-semibold">ID</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">タイトル</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">URL</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">ステータス</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">アクセス数</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">送信数</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">作成日</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                ${detail.forms.map(f => `
                  <tr>
                    <td class="px-4 py-2 text-sm">${f.form_id}</td>
                    <td class="px-4 py-2 text-sm">${escapeHtml(f.form_title)}</td>
                    <td class="px-4 py-2 text-sm"><code class="text-xs">${f.form_url}</code></td>
                    <td class="px-4 py-2 text-sm">
                      <span class="px-2 py-1 rounded text-xs ${f.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                        ${f.is_active ? '公開中' : '非公開'}
                      </span>
                    </td>
                    <td class="px-4 py-2 text-sm">${f.access_count}</td>
                    <td class="px-4 py-2 text-sm">${f.submission_count}</td>
                    <td class="px-4 py-2 text-sm">${formatDate(f.created_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p class="text-gray-500">フォームがありません</p>'}
      </div>
      
      <!-- 見積書一覧（最新10件） -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-xl font-bold mb-4">見積書 (最新10件)</h3>
        ${detail.quotes.length > 0 ? `
          <div class="overflow-x-auto">
            <table class="min-w-full border">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-semibold">ID</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">ファイル名</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">テンプレートID</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">フォームID</th>
                  <th class="px-4 py-2 text-left text-xs font-semibold">作成日</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                ${detail.quotes.map(q => `
                  <tr>
                    <td class="px-4 py-2 text-sm">${q.quote_id}</td>
                    <td class="px-4 py-2 text-sm">${escapeHtml(q.file_name)}</td>
                    <td class="px-4 py-2 text-sm">${q.template_id}</td>
                    <td class="px-4 py-2 text-sm">${q.form_id}</td>
                    <td class="px-4 py-2 text-sm">${formatDate(q.created_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p class="text-gray-500">見積書がありません</p>'}
      </div>
    </div>
  `
}

// ユーティリティ関数
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// API呼び出しヘルパー
if (typeof apiCall === 'undefined') {
  async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('token')
    
    const config = {
      ...options,
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      }
    }
    
    if (!(options.body instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json'
    }
    
    const response = await fetch(endpoint, config)
    const data = await response.json()
    
    return { response, data }
  }
}
