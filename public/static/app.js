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
    // フォーム管理ページかテンプレート詳細ページか判定
    if (window.location.pathname.endsWith('/forms')) {
      initFormManagement()
    } else {
      initTemplateDetail()
    }
  }
})

// ダッシュボード初期化
async function initDashboard() {
  // ユーザー情報を更新（最新のプラン情報を取得）
  await refreshUserInfo()
  
  // プラン情報を表示
  updatePlanStatus()
  
  // テンプレート一覧を読み込み
  await loadTemplates()
  
  // メニュートグルボタン
  const menuToggleBtn = document.getElementById('menuToggleBtn')
  const dropdownMenu = document.getElementById('dropdownMenu')
  
  if (menuToggleBtn && dropdownMenu) {
    menuToggleBtn.addEventListener('click', () => {
      dropdownMenu.classList.toggle('hidden')
    })
    
    // メニュー外をクリックしたら閉じる
    document.addEventListener('click', (e) => {
      if (!menuToggleBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.classList.add('hidden')
      }
    })
  }
  
  // フォーム管理ボタン
  const formsMenuBtn = document.getElementById('formsMenuBtn')
  if (formsMenuBtn) {
    formsMenuBtn.addEventListener('click', () => {
      alert('フォーム管理機能は開発中です。\n各テンプレートの詳細ページからフォームを作成・管理できます。')
    })
  }
  
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

  // アカウント情報ボタン
  const accountBtn = document.getElementById('accountBtn')
  const accountModal = document.getElementById('accountModal')
  const cancelAccountBtn = document.getElementById('cancelAccountBtn')
  const accountForm = document.getElementById('accountForm')

  if (accountBtn) {
    accountBtn.addEventListener('click', () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      document.getElementById('accountEmail').value = user.email || ''
      document.getElementById('accountName').value = user.name || ''
      accountModal.classList.remove('hidden')
    })
  }

  if (cancelAccountBtn) {
    cancelAccountBtn.addEventListener('click', () => {
      accountModal.classList.add('hidden')
      accountForm.reset()
    })
  }

  if (accountForm) {
    accountForm.addEventListener('submit', handleSaveAccount)
  }

  // お問い合わせボタン
  const contactBtn = document.getElementById('contactBtn')
  const contactModal = document.getElementById('contactModal')
  const closeContactBtn = document.getElementById('closeContactBtn')

  if (contactBtn) {
    contactBtn.addEventListener('click', () => {
      contactModal.classList.remove('hidden')
    })
  }

  if (closeContactBtn) {
    closeContactBtn.addEventListener('click', () => {
      contactModal.classList.add('hidden')
    })
  }
}

// ユーザー情報を最新の状態に更新
async function refreshUserInfo() {
  try {
    const { data } = await apiCall('/api/auth/profile')
    
    if (data.success) {
      // LocalStorageのユーザー情報を更新
      const user = data.data.user
      localStorage.setItem('user', JSON.stringify(user))
      AppState.user = user
      
      console.log('ユーザー情報を更新しました:', user)
    }
  } catch (error) {
    console.error('Failed to refresh user info:', error)
  }
}

// プラン情報を表示（プランアップグレードボタンの表示制御）
function updatePlanStatus() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const upgradeBtn = document.getElementById('upgradeBtn')
  
  if (upgradeBtn && user) {
    if (user.current_plan === 'premium') {
      // プレミアムユーザーには「プランアップグレード」ボタンを非表示
      upgradeBtn.style.display = 'none'
    } else {
      // フリーユーザーには「プランアップグレード」ボタンを表示
      upgradeBtn.style.display = 'inline-flex'
    }
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
      // アップロード成功メッセージ
      alert('テンプレートをアップロードしました。AI項目抽出を自動で開始します。')
      
      // ユーザー情報を更新
      const user = JSON.parse(localStorage.getItem('user'))
      user.templates_created = (user.templates_created || 0) + 1
      localStorage.setItem('user', JSON.stringify(user))
      
      // テンプレート詳細ページへ遷移（AI抽出を自動実行）
      const templateId = data.data.template_id
      window.location.href = `/templates/${templateId}?autoExtract=true`
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
    console.log('削除開始:', templateId)
    const response = await apiCall(`/api/templates/${templateId}`, {
      method: 'DELETE'
    })
    
    console.log('削除APIレスポンス:', response)
    const data = response.data
    
    if (data.success) {
      console.log('削除成功、テンプレート一覧を再読み込み')
      
      // テンプレート一覧を再読み込み
      try {
        await loadTemplates()
        console.log('テンプレート一覧の再読み込み完了')
      } catch (loadError) {
        console.error('テンプレート一覧の再読み込みエラー（無視）:', loadError)
      }
      
      // ユーザー情報を更新
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        if (user) {
          user.templates_created = Math.max(0, (user.templates_created || 0) - 1)
          localStorage.setItem('user', JSON.stringify(user))
          
          // プランステータスを更新
          updatePlanStatus()
        }
      } catch (updateError) {
        console.error('ユーザー情報更新エラー（無視）:', updateError)
      }
      
      console.log('削除処理が正常に完了しました')
      alert('テンプレートを削除しました')
    } else {
      console.error('削除API失敗:', data.error)
      alert(data.error?.message || '削除に失敗しました')
    }
  } catch (error) {
    console.error('Delete error:', error)
    console.error('Error stack:', error.stack)
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
  // URLからテンプレートIDを取得
  const pathParts = window.location.pathname.split('/')
  const templateId = pathParts[pathParts.length - 1]
  
  if (!templateId || templateId === 'templates') {
    alert('テンプレートIDが不正です')
    window.location.href = '/dashboard'
    return
  }
  
  // プロトタイプ用の状態を初期化
  AppState.formFields = []
  
  // テンプレート情報を読み込み
  await loadTemplateDetail(templateId)
  
  // 【プロトタイプ】Excelプレビューを読み込み
  await loadExcelPreview(templateId)
  
  // 項目一覧を読み込み
  await loadTemplateFields(templateId)
  
  // フォームプレビューを初期化
  updateFormPreview()
  
  // URLパラメータをチェック（autoExtract=true）
  const urlParams = new URLSearchParams(window.location.search)
  const autoExtract = urlParams.get('autoExtract')
  
  // AI抽出ボタン
  const extractBtn = document.getElementById('extractBtn')
  if (extractBtn) {
    extractBtn.addEventListener('click', () => handleExtractFields(templateId))
  }
  
  // フォーム作成ボタン
  const createFormFromPreviewBtn = document.getElementById('createFormFromPreviewBtn')
  if (createFormFromPreviewBtn) {
    createFormFromPreviewBtn.addEventListener('click', async () => {
      // 選択された項目があるかチェック
      if (!AppState.formFields || AppState.formFields.length === 0) {
        alert('項目を追加してからフォームを作成してください')
        return
      }
      
      // ローディング表示
      createFormFromPreviewBtn.disabled = true
      createFormFromPreviewBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>作成中...'
      
      try {
        console.log('保存する項目:', AppState.formFields)
        
        // まず選択した項目をtemplate_fieldsテーブルに保存
        const savePromises = AppState.formFields.map(async (field, index) => {
          const response = await apiCall(`/api/templates/${templateId}/fields`, {
            method: 'POST',
            body: JSON.stringify({
              field_name: field.field_name,
              cell_position: field.cell_position,
              field_type: 'input', // 'input', 'calc', 'fixed' のいずれか（デフォルトは 'input'）
              data_type: field.field_type || 'text', // 'text', 'number', 'date'
              include_in_form: 1,
              display_order: index + 1
            })
          })
          console.log(`項目 ${index + 1} 保存結果:`, response.data)
          return response
        })
        
        const results = await Promise.all(savePromises)
        
        // すべての保存が成功したか確認
        const allSuccess = results.every(r => r.data.success)
        if (!allSuccess) {
          const failedResults = results.filter(r => !r.data.success)
          console.error('保存失敗:', failedResults)
          alert('項目の保存に失敗しました')
          createFormFromPreviewBtn.disabled = false
          createFormFromPreviewBtn.innerHTML = '<i class="fas fa-plus-circle mr-2"></i>フォーム作成'
          return
        }
        
        console.log('全項目の保存が完了しました')
        
        // 少し待機（データベースの書き込みを確実にするため）
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // フォームを作成
        console.log('フォームを作成します...')
        const { data } = await apiCall(`/api/forms`, {
          method: 'POST',
          body: JSON.stringify({
            template_id: templateId,
            form_title: `フォーム - ${new Date().toLocaleDateString('ja-JP')}`,
            form_description: '自動生成されたフォーム'
          })
        })
        
        console.log('フォーム作成結果:', data)
        
        if (data.success) {
          // 成功したらフォーム管理ページに遷移
          window.location.href = `/templates/${templateId}/forms`
        } else {
          alert(`エラー: ${data.error?.message || 'フォームの作成に失敗しました'}`)
          // ボタンを元に戻す
          createFormFromPreviewBtn.disabled = false
          createFormFromPreviewBtn.innerHTML = '<i class="fas fa-plus-circle mr-2"></i>フォーム作成'
        }
      } catch (error) {
        console.error('Create form error:', error)
        alert('フォームの作成に失敗しました')
        // ボタンを元に戻す
        createFormFromPreviewBtn.disabled = false
        createFormFromPreviewBtn.innerHTML = '<i class="fas fa-plus-circle mr-2"></i>フォーム作成'
      }
    })
  }
  
  // autoExtract=trueの場合、自動でAI抽出を実行
  if (autoExtract === 'true' && extractBtn) {
    // URLパラメータをクリア
    window.history.replaceState({}, '', `/templates/${templateId}`)
    
    // 少し待ってからAI抽出を自動実行
    setTimeout(() => {
      handleExtractFields(templateId, true) // 自動実行フラグを追加
    }, 500)
  }
}

// テンプレート詳細を読み込み
async function loadTemplateDetail(templateId) {
  try {
    const { data } = await apiCall(`/api/templates/${templateId}`)
    
    if (data.success) {
      const template = data.data.template
      
      // テンプレートタイトルを更新
      const titleElement = document.getElementById('templateTitle')
      if (titleElement) {
        titleElement.textContent = template.template_name
      }
      
      // テンプレート情報を更新（要素が存在する場合のみ）
      const infoElement = document.getElementById('templateInfo')
      if (infoElement) {
        infoElement.innerHTML = `
          <div class="space-y-2">
            <p><strong>ファイル形式:</strong> ${template.file_type.toUpperCase()}</p>
            <p><strong>ファイルサイズ:</strong> ${formatFileSize(template.file_size)}</p>
            <p><strong>作成した見積書:</strong> ${template.quotes_created}件</p>
            <p><strong>作成日:</strong> ${formatDate(template.created_at)}</p>
            <p><strong>更新日:</strong> ${formatDate(template.updated_at)}</p>
          </div>
        `
      }
    } else {
      const infoElement = document.getElementById('templateInfo')
      if (infoElement) {
        infoElement.innerHTML = '<p class="text-red-600">テンプレート情報の読み込みに失敗しました</p>'
      }
    }
  } catch (error) {
    console.error('Load template detail error:', error)
    const infoElement = document.getElementById('templateInfo')
    if (infoElement) {
      infoElement.innerHTML = '<p class="text-red-600">テンプレート情報の読み込みに失敗しました</p>'
    }
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
    <div class="mb-4 flex justify-between items-center">
      <div class="flex gap-4">
        <button 
          onclick="toggleAllFields(true)" 
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <i class="fas fa-check-square mr-2"></i>すべて選択
        </button>
        <button 
          onclick="toggleAllFields(false)" 
          class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
        >
          <i class="fas fa-square mr-2"></i>すべて解除
        </button>
      </div>
      <button 
        onclick="saveFieldChanges()" 
        class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
      >
        <i class="fas fa-save mr-2"></i>変更を保存
      </button>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <input type="checkbox" id="selectAll" onchange="toggleAllFields(this.checked)" class="rounded" />
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">フォームに含む</th>
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
            <tr data-field-id="${field.field_id}" class="${field.include_in_form === 0 ? 'bg-gray-50' : ''}">
              <td class="px-4 py-4 whitespace-nowrap">
                <input 
                  type="checkbox" 
                  class="field-checkbox rounded" 
                  data-field-id="${field.field_id}"
                  ${field.include_in_form !== 0 ? 'checked' : ''}
                  onchange="toggleFieldInForm(${field.field_id}, this.checked)"
                />
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span class="include-status-${field.field_id}">
                  ${field.include_in_form !== 0 ? 
                    '<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>含む</span>' : 
                    '<span class="text-gray-400"><i class="fas fa-times-circle mr-1"></i>除外</span>'}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${field.display_order}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <span class="field-name-${field.field_id}">${escapeHtml(field.field_name)}</span>
                <button 
                  onclick="editFieldName(${field.field_id}, '${escapeHtml(field.field_name).replace(/'/g, "\\'")}')"
                  class="ml-2 text-blue-600 hover:text-blue-800"
                  title="項目名を編集"
                >
                  <i class="fas fa-edit"></i>
                </button>
              </td>
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
    <div class="mt-4 flex justify-between items-center">
      <div class="text-sm text-gray-600">
        <p>合計 ${fields.length} 項目 | フォームに含む: <span id="includedCount">${fields.filter(f => f.include_in_form !== 0).length}</span>項目</p>
      </div>
      <button 
        onclick="saveFieldChanges()" 
        class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
      >
        <i class="fas fa-save mr-2"></i>変更を保存
      </button>
    </div>
  `
  
  // グローバル変数に保存
  window.currentFields = fields
}

// AI項目抽出を実行
async function handleExtractFields(templateId, autoRun = false) {
  const extractBtn = document.getElementById('extractBtn')
  const extractionStatus = document.getElementById('extractionStatus')
  
  // 手動実行の場合は確認ダイアログを表示
  if (!autoRun && !confirm('AI項目抽出を実行しますか？\n既存の項目情報は上書きされます。')) {
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

// フォームに含む/除外をトグル
function toggleFieldInForm(fieldId, include) {
  const statusElement = document.querySelector(`.include-status-${fieldId}`)
  const row = document.querySelector(`tr[data-field-id="${fieldId}"]`)
  
  if (statusElement) {
    if (include) {
      statusElement.innerHTML = '<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>含む</span>'
      row.classList.remove('bg-gray-50')
    } else {
      statusElement.innerHTML = '<span class="text-gray-400"><i class="fas fa-times-circle mr-1"></i>除外</span>'
      row.classList.add('bg-gray-50')
    }
  }
  
  // currentFieldsを更新
  if (window.currentFields) {
    const field = window.currentFields.find(f => f.field_id === fieldId)
    if (field) {
      field.include_in_form = include ? 1 : 0
    }
  }
  
  updateIncludedCount()
}

// すべての項目を選択/解除
function toggleAllFields(include) {
  const checkboxes = document.querySelectorAll('.field-checkbox')
  checkboxes.forEach(checkbox => {
    checkbox.checked = include
    const fieldId = parseInt(checkbox.getAttribute('data-field-id'))
    toggleFieldInForm(fieldId, include)
  })
  
  // 「すべて選択」チェックボックスも更新
  const selectAllCheckbox = document.getElementById('selectAll')
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = include
  }
}

// フォームに含む項目数を更新
function updateIncludedCount() {
  const includedCount = document.getElementById('includedCount')
  if (includedCount && window.currentFields) {
    const count = window.currentFields.filter(f => f.include_in_form !== 0).length
    includedCount.textContent = count
  }
}

// 項目名を編集
function editFieldName(fieldId, currentName) {
  const newName = prompt('項目名を入力してください:', currentName)
  if (newName && newName !== currentName) {
    const nameElement = document.querySelector(`.field-name-${fieldId}`)
    if (nameElement) {
      nameElement.textContent = newName
    }
    
    // currentFieldsを更新
    if (window.currentFields) {
      const field = window.currentFields.find(f => f.field_id === fieldId)
      if (field) {
        field.field_name = newName
      }
    }
  }
}

// 変更を保存
async function saveFieldChanges() {
  if (!window.currentFields) {
    alert('保存する変更がありません')
    return
  }
  
  const pathParts = window.location.pathname.split('/')
  const templateId = pathParts[pathParts.length - 1]
  
  try {
    // 変更された項目のみを送信
    const fieldsToUpdate = window.currentFields.map(field => ({
      field_id: field.field_id,
      field_name: field.field_name,
      include_in_form: field.include_in_form,
      is_required: field.is_required
    }))
    
    const { data } = await apiCall(`/api/templates/${templateId}/fields`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: fieldsToUpdate })
    })
    
    if (data.success) {
      alert(data.message || '変更を保存しました')
      // 項目一覧を再読み込み
      await loadTemplateFields(templateId)
    } else {
      alert(data.error.message || '保存に失敗しました')
    }
  } catch (error) {
    console.error('Save fields error:', error)
    alert('保存に失敗しました')
  }
}

// フォーム管理ページ初期化
async function initFormManagement() {
  const pathParts = window.location.pathname.split('/')
  const templateId = pathParts[pathParts.length - 2]
  
  if (!templateId || templateId === 'templates') {
    alert('テンプレートIDが不正です')
    window.location.href = '/dashboard'
    return
  }
  
  // フォーム一覧を読み込み
  await loadForms(templateId)
  
  // フォーム作成ボタン
  const createFormBtn = document.getElementById('createFormBtn')
  const createFormModal = document.getElementById('createFormModal')
  const cancelCreateFormBtn = document.getElementById('cancelCreateFormBtn')
  const createFormForm = document.getElementById('createFormForm')
  
  if (createFormBtn) {
    createFormBtn.addEventListener('click', () => {
      createFormModal.classList.remove('hidden')
    })
  }
  
  if (cancelCreateFormBtn) {
    cancelCreateFormBtn.addEventListener('click', () => {
      createFormModal.classList.add('hidden')
      createFormForm.reset()
    })
  }
  
  if (createFormForm) {
    createFormForm.addEventListener('submit', (e) => handleCreateForm(e, templateId))
  }
}

// フォーム一覧を読み込み
async function loadForms(templateId) {
  try {
    const { data } = await apiCall(`/api/forms/template/${templateId}`)
    
    if (data.success) {
      renderForms(data.data.forms, templateId)
    } else {
      document.getElementById('formsList').innerHTML = '<p class="text-red-600 text-center py-8">フォーム一覧の読み込みに失敗しました</p>'
    }
  } catch (error) {
    console.error('Load forms error:', error)
    document.getElementById('formsList').innerHTML = '<p class="text-red-600 text-center py-8">フォーム一覧の読み込みに失敗しました</p>'
  }
}

// フォーム一覧を描画
function renderForms(forms, templateId) {
  const formsList = document.getElementById('formsList')
  
  if (!formsList) return
  
  if (forms.length === 0) {
    formsList.innerHTML = '<p class="text-gray-500 text-center py-8">まだフォームがありません</p>'
    return
  }
  
  formsList.innerHTML = forms.map(form => {
    const publicUrl = `${window.location.origin}/forms/${form.form_url}`
    const statusColor = form.is_active ? 'text-green-600' : 'text-gray-400'
    const statusIcon = form.is_active ? 'fa-check-circle' : 'fa-times-circle'
    const statusText = form.is_active ? '公開中' : '非公開'
    
    return `
      <div class="border rounded-lg p-4 mb-4 hover:shadow-md transition">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <h4 class="font-bold text-lg">${escapeHtml(form.form_title)}</h4>
              <span class="${statusColor}">
                <i class="fas ${statusIcon} mr-1"></i>${statusText}
              </span>
            </div>
            ${form.form_description ? `<p class="text-gray-600 mb-3">${escapeHtml(form.form_description)}</p>` : ''}
            <div class="text-sm text-gray-600 space-y-1">
              <p><i class="fas fa-link mr-2"></i>URL: <a href="${publicUrl}" target="_blank" class="text-blue-600 hover:underline">${publicUrl}</a></p>
              <p><i class="fas fa-eye mr-2"></i>アクセス数: ${form.access_count}回</p>
              <p><i class="fas fa-paper-plane mr-2"></i>送信数: ${form.submission_count}件</p>
              <p><i class="fas fa-clock mr-2"></i>作成日: ${formatDate(form.created_at)}</p>
            </div>
          </div>
          <div class="flex flex-col gap-2 ml-4">
            <button 
              onclick="copyFormUrl('${publicUrl}')"
              class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm whitespace-nowrap"
            >
              <i class="fas fa-copy"></i> URLコピー
            </button>
            <button 
              onclick="toggleFormStatus(${form.form_id}, ${form.is_active ? 0 : 1}, ${templateId})"
              class="${form.is_active ? 'bg-gray-600' : 'bg-green-600'} text-white px-4 py-2 rounded-lg hover:opacity-80 transition text-sm whitespace-nowrap"
            >
              <i class="fas ${form.is_active ? 'fa-eye-slash' : 'fa-eye'}"></i> ${form.is_active ? '非公開' : '公開'}
            </button>
            <button 
              onclick="deleteForm(${form.form_id}, '${escapeHtml(form.form_title)}', ${templateId})"
              class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-sm whitespace-nowrap"
            >
              <i class="fas fa-trash"></i> 削除
            </button>
          </div>
        </div>
      </div>
    `
  }).join('')
}

// フォームを作成
async function handleCreateForm(event, templateId) {
  event.preventDefault()
  
  const form = event.target
  const formTitle = form.form_title.value
  const formDescription = form.form_description.value
  
  try {
    const submitBtn = form.querySelector('button[type="submit"]')
    submitBtn.disabled = true
    submitBtn.textContent = '作成中...'
    
    const { data } = await apiCall('/api/forms', {
      method: 'POST',
      body: JSON.stringify({
        template_id: parseInt(templateId),
        form_title: formTitle,
        form_description: formDescription || null
      })
    })
    
    if (data.success) {
      alert('フォームを作成しました！')
      document.getElementById('createFormModal').classList.add('hidden')
      form.reset()
      
      // フォーム一覧を再読み込み
      await loadForms(templateId)
      
      // 公開URLを表示
      const publicUrl = `${window.location.origin}${data.data.public_url}`
      if (confirm(`フォームを作成しました！\n\n公開URL: ${publicUrl}\n\nURLをコピーしますか？`)) {
        copyFormUrl(publicUrl)
      }
    } else {
      alert(data.error.message || 'フォームの作成に失敗しました')
    }
  } catch (error) {
    console.error('Create form error:', error)
    alert('フォームの作成に失敗しました')
  } finally {
    const submitBtn = form.querySelector('button[type="submit"]')
    submitBtn.disabled = false
    submitBtn.textContent = '作成'
  }
}

// フォームURLをコピー
function copyFormUrl(url) {
  navigator.clipboard.writeText(url).then(() => {
    alert('URLをコピーしました！')
  }).catch(err => {
    console.error('Copy failed:', err)
    prompt('URLをコピーしてください:', url)
  })
}

// フォーム状態を切り替え
async function toggleFormStatus(formId, isActive, templateId) {
  const action = isActive ? '公開' : '非公開'
  
  if (!confirm(`フォームを${action}にしますか？`)) {
    return
  }
  
  try {
    const { data } = await apiCall(`/api/forms/${formId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive })
    })
    
    if (data.success) {
      alert(`フォームを${action}にしました`)
      await loadForms(templateId)
    } else {
      alert(data.error.message || '更新に失敗しました')
    }
  } catch (error) {
    console.error('Toggle form status error:', error)
    alert('更新に失敗しました')
  }
}

// フォームを削除
async function deleteForm(formId, formTitle, templateId) {
  if (!confirm(`フォーム「${formTitle}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
    return
  }
  
  try {
    const { data } = await apiCall(`/api/forms/${formId}`, {
      method: 'DELETE'
    })
    
    if (data.success) {
      alert('フォームを削除しました')
      await loadForms(templateId)
    } else {
      alert(data.error.message || '削除に失敗しました')
    }
  } catch (error) {
    console.error('Delete form error:', error)
    alert('削除に失敗しました')
  }
}

// アカウント情報を保存
async function handleSaveAccount(e) {
  e.preventDefault()
  
  const name = document.getElementById('accountName').value.trim()
  
  if (!name) {
    alert('ユーザー名を入力してください')
    return
  }
  
  try {
    const { data } = await apiCall('/api/auth/update-profile', {
      method: 'PUT',
      body: JSON.stringify({ name })
    })
    
    if (data.success) {
      // LocalStorageのユーザー情報を更新
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      user.name = name
      localStorage.setItem('user', JSON.stringify(user))
      
      // 画面の表示を更新
      document.getElementById('userGreeting').textContent = 'こんにちは、' + name + 'さん'
      
      alert('アカウント情報を更新しました')
      document.getElementById('accountModal').classList.add('hidden')
    } else {
      alert(data.error?.message || '更新に失敗しました')
    }
  } catch (error) {
    console.error('Save account error:', error)
    alert('更新に失敗しました')
  }
}

// 【プロトタイプ】Excelプレビューを読み込み（改善版：セル結合、スタイル、サイズ対応）
async function loadExcelPreview(templateId) {
  try {
    const response = await apiCall(`/api/templates/${templateId}/preview`)
    const data = response.data
    
    // レスポンスがJSONでない場合（HTMLエラーページが返された場合）
    if (typeof data === 'string' && (data.includes('<!DOCTYPE') || data.includes('<html'))) {
      console.error('Received HTML instead of JSON:', data.substring(0, 500))
      document.getElementById('excelPreview').innerHTML = 
        `<p class="text-red-500 text-center py-4">プレビューの読み込みに失敗しました<br><br>詳細: サーバーエラー（HTMLレスポンスを受信）<br>ローカルでビルド&デプロイを実行してください</p>`
      return
    }
    
    if (data.success) {
      const { cells, rowCount, colCount, merges, rowHeights, colWidths } = data.data
      
      // セルデータをグリッド形式に変換
      const grid = []
      for (let r = 1; r <= rowCount; r++) {
        grid[r] = {}
        for (let c = 1; c <= colCount; c++) {
          grid[r][c] = null
        }
      }
      
      cells.forEach(cell => {
        grid[cell.row][cell.col] = cell
      })
      
      // セル結合情報を解析
      const mergedCells = new Map()
      if (merges && merges.length > 0) {
        merges.forEach(merge => {
          // 例: "A1:C3" -> {startRow: 1, startCol: 1, endRow: 3, endCol: 3}
          const [start, end] = merge.split(':')
          const startMatch = start.match(/([A-Z]+)(\d+)/)
          const endMatch = end.match(/([A-Z]+)(\d+)/)
          
          if (startMatch && endMatch) {
            const startCol = colToNumber(startMatch[1])
            const startRow = parseInt(startMatch[2])
            const endCol = colToNumber(endMatch[1])
            const endRow = parseInt(endMatch[2])
            
            const rowSpan = endRow - startRow + 1
            const colSpan = endCol - startCol + 1
            
            // 開始セルに情報を保存
            mergedCells.set(`${startRow}-${startCol}`, { rowSpan, colSpan })
            
            // 結合範囲内の他のセルは非表示フラグ
            for (let r = startRow; r <= endRow; r++) {
              for (let c = startCol; c <= endCol; c++) {
                if (r !== startRow || c !== startCol) {
                  mergedCells.set(`${r}-${c}`, { hidden: true })
                }
              }
            }
          }
        })
      }
      
      // HTMLテーブルを生成
      let html = '<table class="border-collapse text-xs" style="table-layout: fixed;">'
      
      // colgroup で列幅を設定
      html += '<colgroup>'
      html += '<col style="width: 40px;">' // 行番号列
      for (let c = 1; c <= colCount; c++) {
        const width = colWidths[c] || 80
        html += `<col style="width: ${width}px;">`
      }
      html += '</colgroup>'
      
      // ヘッダー行（列番号 A, B, C...）
      html += '<thead><tr><th class="border border-gray-300 bg-gray-100 px-2 py-1"></th>'
      for (let c = 1; c <= colCount; c++) {
        const colName = numberToCol(c)
        html += `<th class="border border-gray-300 bg-gray-100 px-2 py-1">${colName}</th>`
      }
      html += '</tr></thead><tbody>'
      
      // データ行
      for (let r = 1; r <= rowCount; r++) {
        const rowHeight = rowHeights[r] || 20
        html += `<tr style="height: ${rowHeight}px;">`
        html += `<td class="border border-gray-300 bg-gray-100 px-2 py-1 text-center font-semibold">${r}</td>`
        
        for (let c = 1; c <= colCount; c++) {
          const mergeInfo = mergedCells.get(`${r}-${c}`)
          
          // 結合されたセルの内側は非表示
          if (mergeInfo && mergeInfo.hidden) {
            continue
          }
          
          const cell = grid[r][c]
          const value = cell && cell.value ? cell.value : ''
          const formula = cell && cell.formula
          const address = cell ? cell.address : ''
          const style = cell?.style || {}
          
          // セルのスタイルを構築
          let cellStyle = 'border border-gray-300 px-2 py-1 hover:bg-blue-100 cursor-pointer excel-cell'
          let inlineStyle = ''
          
          // 背景色
          if (style.bgColor && style.bgColor !== '#FFFFFFFF' && style.bgColor !== '#FFFFFF') {
            inlineStyle += `background-color: ${style.bgColor};`
          }
          
          // フォント色
          if (style.fontColor && style.fontColor !== '#000000') {
            inlineStyle += `color: ${style.fontColor};`
          }
          
          // フォントサイズ
          if (style.fontSize) {
            inlineStyle += `font-size: ${style.fontSize}px;`
          }
          
          // 太字・イタリック
          if (style.bold) {
            cellStyle += ' font-bold'
          }
          if (style.italic) {
            cellStyle += ' italic'
          }
          
          // テキスト配置
          if (style.alignment === 'center') {
            cellStyle += ' text-center'
          } else if (style.alignment === 'right') {
            cellStyle += ' text-right'
          }
          
          // 縦方向の配置
          if (style.verticalAlignment === 'top') {
            cellStyle += ' align-top'
          } else if (style.verticalAlignment === 'bottom') {
            cellStyle += ' align-bottom'
          } else {
            cellStyle += ' align-middle'
          }
          
          // 関数セルは薄いオレンジ色で表示
          if (formula) {
            cellStyle += ' bg-orange-100'
          }
          
          // rowspan/colspan属性
          const rowSpan = mergeInfo?.rowSpan || 1
          const colSpan = mergeInfo?.colSpan || 1
          const spanAttrs = `rowspan="${rowSpan}" colspan="${colSpan}"`
          
          html += `<td class="${cellStyle}" 
                      ${spanAttrs}
                      style="${inlineStyle}"
                      data-address="${address}" 
                      data-row="${r}" 
                      data-col="${c}"
                      data-has-formula="${formula ? 'true' : 'false'}"
                      onclick="handleCellClick('${address}', ${r}, ${c}, ${formula ? 'true' : 'false'})">`
          
          // 値を表示（関数セルには警告アイコン）
          if (formula) {
            html += `<span title="数式: ${formula}">⚠️ ${value}</span>`
          } else {
            html += value
          }
          
          html += '</td>'
        }
        html += '</tr>'
      }
      
      html += '</tbody></table>'
      
      document.getElementById('excelPreview').innerHTML = html
    } else {
      document.getElementById('excelPreview').innerHTML = 
        `<p class="text-red-500 text-center py-4">${data.error?.message || 'プレビューの読み込みに失敗しました'}<br><br>エラーコード: ${data.error?.code || 'UNKNOWN'}</p>`
    }
  } catch (error) {
    console.error('Load Excel preview error:', error)
    document.getElementById('excelPreview').innerHTML = 
      `<p class="text-red-500 text-center py-4">プレビューの読み込みに失敗しました<br><br>詳細: ${error.message}</p>`
  }
}

// 列番号をアルファベットに変換（1 -> A, 27 -> AA）
function numberToCol(num) {
  let col = ''
  while (num > 0) {
    const rem = (num - 1) % 26
    col = String.fromCharCode(65 + rem) + col
    num = Math.floor((num - 1) / 26)
  }
  return col
}

// アルファベットを列番号に変換（A -> 1, AA -> 27）
function colToNumber(col) {
  let num = 0
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + (col.charCodeAt(i) - 64)
  }
  return num
}

// 【プロトタイプ】セルクリック処理（項目追加機能付き）
function handleCellClick(address, row, col, hasFormula) {
  console.log('セルクリック:', { address, row, col, hasFormula })
  
  // 既に選択済みのセルか確認
  const existingField = AppState.formFields?.find(f => f.cell_position === address)
  if (existingField) {
    alert(`セル ${address} は既に項目として追加されています。\n\n項目名: ${existingField.field_name}`)
    return
  }
  
  if (hasFormula) {
    const confirmed = confirm(`⚠️ セル ${address} には数式が入っています。\n\nこのセルを項目として追加すると、数式が失われる可能性があります。\n\n続けますか？`)
    if (!confirmed) {
      return
    }
  }
  
  // 項目名を入力してもらう
  const fieldName = prompt(`セル ${address} の項目名を入力してください:`, `項目_${address}`)
  
  if (!fieldName || fieldName.trim() === '') {
    return
  }
  
  // 項目をフォームプレビューに追加
  addFieldToForm({
    field_name: fieldName.trim(),
    cell_position: address,
    field_type: 'text',
    row: row,
    col: col,
    hasFormula: hasFormula
  })
  
  // セルの色を変更（赤色）
  const cellElement = document.querySelector(`[data-address="${address}"]`)
  if (cellElement) {
    cellElement.classList.add('bg-red-100')
    cellElement.classList.remove('hover:bg-blue-100')
  }
  
  // フォームプレビューを更新
  updateFormPreview()
}

// フォームに項目を追加
function addFieldToForm(field) {
  if (!AppState.formFields) {
    AppState.formFields = []
  }
  
  // 一意のIDを生成
  field.temp_id = Date.now() + Math.random()
  
  AppState.formFields.push(field)
  console.log('項目を追加:', field)
}

// フォームから項目を削除
function removeFieldFromForm(tempId) {
  const fieldIndex = AppState.formFields.findIndex(f => f.temp_id === tempId)
  if (fieldIndex === -1) return
  
  const field = AppState.formFields[fieldIndex]
  const address = field.cell_position
  
  // 配列から削除
  AppState.formFields.splice(fieldIndex, 1)
  
  // セルの色を元に戻す
  const cellElement = document.querySelector(`[data-address="${address}"]`)
  if (cellElement) {
    cellElement.classList.remove('bg-red-100')
    cellElement.classList.add('hover:bg-blue-100')
  }
  
  // フォームプレビューを更新
  updateFormPreview()
}

// 【プロトタイプ】フォームプレビューを更新
function updateFormPreview() {
  const fields = AppState.formFields || []
  
  if (fields.length === 0) {
    document.getElementById('formPreview').innerHTML = '<p class="text-gray-500 text-center py-8">項目がありません<br><br>Excelのセルをクリックして項目を追加してください</p>'
    return
  }
  
  let html = '<div class="space-y-3">'
  fields.forEach((field, index) => {
    html += `
      <div class="border border-gray-300 rounded-lg p-3 bg-white hover:shadow-md transition cursor-move"
           draggable="true"
           data-field-id="${field.temp_id}"
           ondragstart="handleDragStart(event, ${field.temp_id})"
           ondragover="handleDragOver(event)"
           ondrop="handleDrop(event, ${field.temp_id})"
           ondragend="handleDragEnd(event)">
        <div class="flex justify-between items-start mb-2">
          <div class="flex-1">
            <div class="flex items-center mb-1">
              <i class="fas fa-grip-vertical mr-2 text-gray-400" title="ドラッグして並び替え"></i>
              <div class="font-semibold text-sm text-gray-800">
                <i class="fas fa-edit mr-1 text-blue-500"></i>
                <span contenteditable="true" 
                      id="field-name-${field.temp_id}"
                      class="hover:bg-yellow-50 px-1 rounded"
                      onblur="updateFieldName(${field.temp_id}, this.textContent)">${escapeHtml(field.field_name)}</span>
              </div>
            </div>
            <div class="text-xs text-gray-500">
              <i class="fas fa-table mr-1"></i>セル: <span class="font-mono font-semibold">${escapeHtml(field.cell_position)}</span>
            </div>
            ${field.hasFormula ? '<div class="text-xs text-orange-600 mt-1"><i class="fas fa-exclamation-triangle mr-1"></i>数式セル</div>' : ''}
          </div>
          <button 
            onclick="removeFieldFromForm(${field.temp_id}); event.stopPropagation();"
            class="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition"
            title="削除">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="text-xs text-gray-400 italic">
          項目名をクリックして編集 / ドラッグして並び替え
        </div>
      </div>
    `
  })
  
  // 手動で項目追加ボタン
  html += `
    <button 
      onclick="showAddFieldManuallyDialog()"
      class="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition">
      <i class="fas fa-plus-circle mr-2"></i>
      手動で項目を追加
    </button>
  `
  
  html += '</div>'
  
  document.getElementById('formPreview').innerHTML = html
}

// 項目名を更新
function updateFieldName(tempId, newName) {
  const field = AppState.formFields.find(f => f.temp_id === tempId)
  if (field && newName.trim()) {
    field.field_name = newName.trim()
    console.log('項目名を更新:', field)
  }
}

// 手動で項目追加ダイアログ
function showAddFieldManuallyDialog() {
  const fieldName = prompt('項目名を入力してください:')
  if (!fieldName || fieldName.trim() === '') {
    return
  }
  
  const address = prompt('セル位置を入力してください（例: A1, B5）:', 'A1')
  if (!address || address.trim() === '') {
    return
  }
  
  // セルアドレスのバリデーション
  const addressPattern = /^[A-Z]+\d+$/
  if (!addressPattern.test(address.toUpperCase())) {
    alert('セル位置が不正です。例: A1, B5, AA10')
    return
  }
  
  // 既に追加済みかチェック
  const existingField = AppState.formFields?.find(f => f.cell_position === address.toUpperCase())
  if (existingField) {
    alert(`セル ${address} は既に項目として追加されています。`)
    return
  }
  
  // 項目を追加
  addFieldToForm({
    field_name: fieldName.trim(),
    cell_position: address.toUpperCase(),
    field_type: 'text',
    row: null,
    col: null,
    hasFormula: false
  })
  
  // セルの色を変更
  const cellElement = document.querySelector(`[data-address="${address.toUpperCase()}"]`)
  if (cellElement) {
    cellElement.classList.add('bg-red-100')
    cellElement.classList.remove('hover:bg-blue-100')
  }
  
  updateFormPreview()
}

// ドラッグ&ドロップ用の状態
let draggedFieldId = null

// ドラッグ開始
function handleDragStart(event, fieldId) {
  draggedFieldId = fieldId
  event.target.style.opacity = '0.5'
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/html', event.target.innerHTML)
}

// ドラッグオーバー
function handleDragOver(event) {
  if (event.preventDefault) {
    event.preventDefault()
  }
  event.dataTransfer.dropEffect = 'move'
  
  // ドラッグ中の視覚的フィードバック
  const target = event.currentTarget
  if (target.getAttribute('draggable') === 'true') {
    target.style.borderTop = '3px solid #3b82f6'
  }
  
  return false
}

// ドロップ
function handleDrop(event, targetFieldId) {
  if (event.stopPropagation) {
    event.stopPropagation()
  }
  
  event.currentTarget.style.borderTop = ''
  
  if (draggedFieldId === targetFieldId) {
    return false
  }
  
  // 配列内の項目を入れ替え
  const draggedIndex = AppState.formFields.findIndex(f => f.temp_id === draggedFieldId)
  const targetIndex = AppState.formFields.findIndex(f => f.temp_id === targetFieldId)
  
  if (draggedIndex !== -1 && targetIndex !== -1) {
    const [draggedItem] = AppState.formFields.splice(draggedIndex, 1)
    AppState.formFields.splice(targetIndex, 0, draggedItem)
    
    console.log('項目を並び替えました:', { draggedIndex, targetIndex })
    
    // フォームプレビューを更新
    updateFormPreview()
  }
  
  return false
}

// ドラッグ終了
function handleDragEnd(event) {
  event.target.style.opacity = '1'
  
  // すべての要素のボーダーをリセット
  document.querySelectorAll('[draggable="true"]').forEach(el => {
    el.style.borderTop = ''
  })
  
  draggedFieldId = null
}
