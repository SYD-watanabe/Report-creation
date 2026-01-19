// グローバルな状態管理
const AppState = {
  token: localStorage.getItem('token') || null,
  user: null,
  templates: []
}

// API呼び出しヘルパー
async function apiCall(endpoint, options = {}) {
  const config = {
    ...options,
    headers: {
      ...(AppState.token && { 'Authorization': `Bearer ${AppState.token}` }),
      ...options.headers
    }
  }
  
  // multipart/form-dataの場合はContent-Typeヘッダーを自動設定させる
  if (!(options.body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json'
  }
  
  const response = await fetch(endpoint, config)
  const data = await response.json()
  
  return { response, data }
}

// ログイン処理
async function handleLogin(event) {
  event.preventDefault()
  
  const form = event.target
  const email = form.email.value
  const password = form.password.value
  
  try {
    const { response, data } = await apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
    
    if (data.success) {
      // トークンを保存
      AppState.token = data.data.token
      AppState.user = data.data.user
      localStorage.setItem('token', data.data.token)
      localStorage.setItem('user', JSON.stringify(data.data.user))
      
      // ダッシュボードにリダイレクト
      window.location.href = '/dashboard'
    } else {
      alert(data.error.message || 'ログインに失敗しました')
    }
  } catch (error) {
    console.error('Login error:', error)
    alert('ログインに失敗しました')
  }
}

// ログアウト処理
async function handleLogout() {
  try {
    await apiCall('/api/auth/logout', { method: 'POST' })
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    // ローカルストレージをクリア
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    AppState.token = null
    AppState.user = null
    
    // ログイン画面にリダイレクト
    window.location.href = '/'
  }
}

// 新規登録処理
async function handleRegister(event) {
  event.preventDefault()
  
  const form = event.target
  const name = form.name.value
  const email = form.email.value
  const password = form.password.value
  const confirmPassword = form.confirmPassword.value
  
  if (password !== confirmPassword) {
    alert('パスワードが一致しません')
    return
  }
  
  if (password.length < 8) {
    alert('パスワードは8文字以上である必要があります')
    return
  }
  
  try {
    const { response, data } = await apiCall('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    })
    
    if (data.success) {
      // トークンを保存
      AppState.token = data.data.token
      AppState.user = data.data.user
      localStorage.setItem('token', data.data.token)
      localStorage.setItem('user', JSON.stringify(data.data.user))
      
      // ダッシュボードにリダイレクト
      window.location.href = '/dashboard'
    } else {
      alert(data.error.message || '登録に失敗しました')
    }
  } catch (error) {
    console.error('Register error:', error)
    alert('登録に失敗しました')
  }
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
  // ログインフォーム
  const loginForm = document.getElementById('loginForm')
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin)
  }
  
  // 新規登録フォーム
  const registerForm = document.getElementById('registerForm')
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister)
  }
  
  // ログアウトボタン
  const logoutButtons = document.querySelectorAll('.logout-btn, #logoutBtn')
  logoutButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      handleLogout()
    })
  })
  
  // ダッシュボード機能
  if (window.location.pathname === '/dashboard') {
    initDashboard()
  }
  
  // テンプレート詳細ページ
  if (window.location.pathname.startsWith('/templates/')) {
    initTemplateDetail()
  }
})

// ダッシュボード初期化
async function initDashboard() {
  // テンプレート一覧を読み込み
  await loadTemplates()
  
  // アップロードボタン
  const uploadBtn = document.getElementById('uploadBtn')
  const uploadModal = document.getElementById('uploadModal')
  const cancelUploadBtn = document.getElementById('cancelUploadBtn')
  const uploadForm = document.getElementById('uploadForm')
  
  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      uploadModal.classList.remove('hidden')
    })
  }
  
  if (cancelUploadBtn) {
    cancelUploadBtn.addEventListener('click', () => {
      uploadModal.classList.add('hidden')
      uploadForm.reset()
    })
  }
  
  if (uploadForm) {
    uploadForm.addEventListener('submit', handleTemplateUpload)
  }
}

// テンプレート一覧を読み込み
async function loadTemplates() {
  try {
    const { data } = await apiCall('/api/templates')
    
    if (data.success) {
      AppState.templates = data.data.templates
      renderTemplates(data.data.templates)
    } else {
      console.error('Failed to load templates:', data.error)
    }
  } catch (error) {
    console.error('Load templates error:', error)
  }
}

// テンプレート一覧を描画
function renderTemplates(templates) {
  const templatesList = document.getElementById('templatesList')
  
  if (!templatesList) return
  
  if (templates.length === 0) {
    templatesList.innerHTML = '<p class="text-gray-500 text-center py-8">テンプレートがまだありません</p>'
    return
  }
  
  templatesList.innerHTML = templates.map(template => `
    <div class="border rounded-lg p-4 mb-4 hover:shadow-md transition">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <h4 class="font-bold text-lg mb-2">${escapeHtml(template.template_name)}</h4>
          <div class="text-sm text-gray-600 space-y-1">
            <p><i class="fas fa-file-excel mr-2"></i>ファイル形式: ${template.file_type.toUpperCase()}</p>
            <p><i class="fas fa-database mr-2"></i>サイズ: ${formatFileSize(template.file_size)}</p>
            <p><i class="fas fa-chart-line mr-2"></i>作成した見積書: ${template.quotes_created}件</p>
            <p><i class="fas fa-clock mr-2"></i>作成日: ${formatDate(template.created_at)}</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button 
            onclick="viewTemplate(${template.template_id})"
            class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <i class="fas fa-eye"></i> 詳細
          </button>
          <button 
            onclick="deleteTemplate(${template.template_id}, '${escapeHtml(template.template_name)}')"
            class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            <i class="fas fa-trash"></i> 削除
          </button>
        </div>
      </div>
    </div>
  `).join('')
}

// テンプレートアップロード処理
async function handleTemplateUpload(event) {
  event.preventDefault()
  
  const form = event.target
  const formData = new FormData(form)
  
  try {
    const uploadBtn = form.querySelector('button[type="submit"]')
    uploadBtn.disabled = true
    uploadBtn.textContent = 'アップロード中...'
    
    const { data } = await apiCall('/api/templates', {
      method: 'POST',
      body: formData
    })
    
    if (data.success) {
      alert('テンプレートをアップロードしました')
      document.getElementById('uploadModal').classList.add('hidden')
      form.reset()
      
      // テンプレート一覧を再読み込み
      await loadTemplates()
      
      // ユーザー情報を更新
      const user = JSON.parse(localStorage.getItem('user'))
      user.templates_created = (user.templates_created || 0) + 1
      localStorage.setItem('user', JSON.stringify(user))
      
      // プランステータスを更新
      document.getElementById('planStatus').textContent = `テンプレート: ${user.templates_created} / 1 使用中`
    } else {
      alert(data.error.message || 'アップロードに失敗しました')
    }
  } catch (error) {
    console.error('Upload error:', error)
    alert('アップロードに失敗しました')
  } finally {
    const uploadBtn = form.querySelector('button[type="submit"]')
    uploadBtn.disabled = false
    uploadBtn.textContent = 'アップロード'
  }
}

// テンプレート詳細表示
function viewTemplate(templateId) {
  window.location.href = `/templates/${templateId}`
}

// テンプレート削除
async function deleteTemplate(templateId, templateName) {
  if (!confirm(`「${templateName}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
    return
  }
  
  try {
    const { data } = await apiCall(`/api/templates/${templateId}`, {
      method: 'DELETE'
    })
    
    if (data.success) {
      alert('テンプレートを削除しました')
      
      // テンプレート一覧を再読み込み
      await loadTemplates()
      
      // ユーザー情報を更新
      const user = JSON.parse(localStorage.getItem('user'))
      user.templates_created = Math.max(0, (user.templates_created || 0) - 1)
      localStorage.setItem('user', JSON.stringify(user))
      
      // プランステータスを更新
      document.getElementById('planStatus').textContent = `テンプレート: ${user.templates_created} / 1 使用中`
    } else {
      alert(data.error.message || '削除に失敗しました')
    }
  } catch (error) {
    console.error('Delete error:', error)
    alert('削除に失敗しました')
  }
}

// ユーティリティ関数
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
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

// テンプレート詳細ページ初期化
async function initTemplateDetail() {
  const templateId = window.TEMPLATE_ID
  
  // テンプレート情報を読み込み
  await loadTemplateDetail(templateId)
  
  // 項目一覧を読み込み
  await loadTemplateFields(templateId)
  
  // AI抽出ボタン
  const extractBtn = document.getElementById('extractBtn')
  if (extractBtn) {
    extractBtn.addEventListener('click', () => handleExtractFields(templateId))
  }
}

// テンプレート詳細を読み込み
async function loadTemplateDetail(templateId) {
  try {
    const { data } = await apiCall(`/api/templates/${templateId}`)
    
    if (data.success) {
      const template = data.data.template
      
      document.getElementById('templateTitle').textContent = template.template_name
      document.getElementById('templateInfo').innerHTML = `
        <div class="space-y-2">
          <p><strong>ファイル形式:</strong> ${template.file_type.toUpperCase()}</p>
          <p><strong>ファイルサイズ:</strong> ${formatFileSize(template.file_size)}</p>
          <p><strong>作成した見積書:</strong> ${template.quotes_created}件</p>
          <p><strong>作成日:</strong> ${formatDate(template.created_at)}</p>
          <p><strong>更新日:</strong> ${formatDate(template.updated_at)}</p>
        </div>
      `
    } else {
      document.getElementById('templateInfo').innerHTML = '<p class="text-red-600">テンプレート情報の読み込みに失敗しました</p>'
    }
  } catch (error) {
    console.error('Load template detail error:', error)
    document.getElementById('templateInfo').innerHTML = '<p class="text-red-600">テンプレート情報の読み込みに失敗しました</p>'
  }
}

// テンプレート項目を読み込み
async function loadTemplateFields(templateId) {
  try {
    const { data } = await apiCall(`/api/templates/${templateId}`)
    
    if (data.success && data.data.fields && data.data.fields.length > 0) {
      renderFields(data.data.fields)
    } else {
      document.getElementById('fieldsList').innerHTML = '<p class="text-gray-500 text-center py-8">まだ項目が抽出されていません</p>'
    }
  } catch (error) {
    console.error('Load fields error:', error)
  }
}

// 項目一覧を描画
function renderFields(fields) {
  const fieldsList = document.getElementById('fieldsList')
  
  if (!fieldsList) return
  
  if (fields.length === 0) {
    fieldsList.innerHTML = '<p class="text-gray-500 text-center py-8">まだ項目が抽出されていません</p>'
    return
  }
  
  const fieldTypeLabels = {
    'input': '入力項目',
    'calc': '計算項目',
    'fixed': '固定値'
  }
  
  const dataTypeLabels = {
    'text': 'テキスト',
    'number': '数値',
    'date': '日付'
  }
  
  const fieldTypeColors = {
    'input': 'bg-blue-100 text-blue-800',
    'calc': 'bg-green-100 text-green-800',
    'fixed': 'bg-gray-100 text-gray-800'
  }
  
  fieldsList.innerHTML = `
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">順序</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">項目名</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイプ</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">データ型</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">セル位置</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">必須</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">計算式/固定値</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          ${fields.map(field => `
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${field.display_order}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(field.field_name)}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${fieldTypeColors[field.field_type]}">
                  ${fieldTypeLabels[field.field_type]}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${dataTypeLabels[field.data_type]}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${field.cell_position}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${field.is_required ? '<span class="text-red-600">必須</span>' : '任意'}
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">
                ${field.calculation_formula ? `<code class="bg-gray-100 px-2 py-1 rounded">${escapeHtml(field.calculation_formula)}</code>` : ''}
                ${field.fixed_value ? escapeHtml(field.fixed_value) : ''}
                ${!field.calculation_formula && !field.fixed_value ? '-' : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="mt-4 text-sm text-gray-600">
      <p>合計 ${fields.length} 項目</p>
    </div>
  `
}

// AI項目抽出を実行
async function handleExtractFields(templateId) {
  const extractBtn = document.getElementById('extractBtn')
  const extractionStatus = document.getElementById('extractionStatus')
  
  if (!confirm('AI項目抽出を実行しますか？\n既存の項目情報は上書きされます。')) {
    return
  }
  
  try {
    extractBtn.disabled = true
    extractBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>抽出中...'
    extractionStatus.classList.remove('hidden')
    
    const { data } = await apiCall(`/api/templates/${templateId}/extract`, {
      method: 'POST'
    })
    
    extractionStatus.classList.add('hidden')
    
    if (data.success) {
      alert(`AI項目抽出が完了しました！\n\n抽出された項目数: ${data.data.total_fields}件\n信頼度: ${(data.data.confidence * 100).toFixed(0)}%`)
      
      // 項目一覧を再読み込み
      await loadTemplateFields(templateId)
    } else {
      alert(data.error.message || 'AI項目抽出に失敗しました')
    }
  } catch (error) {
    console.error('Extract fields error:', error)
    alert('AI項目抽出に失敗しました')
    extractionStatus.classList.add('hidden')
  } finally {
    extractBtn.disabled = false
    extractBtn.innerHTML = '<i class="fas fa-magic mr-2"></i>AI項目抽出を実行'
  }
}
