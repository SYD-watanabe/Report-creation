// 公開フォーム用JavaScript

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
  if (window.FORM_URL) {
    loadPublicForm(window.FORM_URL)
  }
})

// API呼び出しヘルパー
async function apiCall(endpoint, options = {}) {
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  }
  
  const response = await fetch(endpoint, config)
  const data = await response.json()
  
  return { response, data }
}

// 公開フォームを読み込み
async function loadPublicForm(formUrl) {
  try {
    const { data } = await apiCall(`/api/forms/${formUrl}`)
    
    if (data.success) {
      renderPublicForm(data.data.form, data.data.fields)
    } else {
      showError(data.error.message || 'フォームの読み込みに失敗しました')
    }
  } catch (error) {
    console.error('Load form error:', error)
    showError('フォームの読み込みに失敗しました')
  }
}

// 公開フォームを描画
function renderPublicForm(form, fields) {
  const formContainer = document.getElementById('formContainer')
  
  if (!formContainer) return
  
  // 入力項目のみフィルタリング
  const inputFields = fields.filter(f => f.field_type === 'input')
  
  formContainer.innerHTML = `
    <div class="mb-8">
      <h2 class="text-3xl font-bold mb-2">${escapeHtml(form.form_title)}</h2>
    </div>
    
    <form id="publicForm" class="space-y-6">
      <!-- 案件名入力欄 -->
      <div class="mb-6">
        <label class="block text-sm font-semibold text-gray-700 mb-2">
          案件名 <span class="text-red-600">*</span>
        </label>
        <input 
          type="text" 
          name="_project_name"
          required
          class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="例：株式会社SYD"
        />
        <p class="text-sm text-gray-500 mt-1">受信した事務担当者様がわかるように社名等を入力してください</p>
      </div>
      
      ${inputFields.map(field => renderFormField(field)).join('')}
      
      <div class="flex justify-end gap-4 pt-4 border-t">
        <button 
          type="reset"
          class="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 transition"
        >
          <i class="fas fa-undo mr-2"></i>リセット
        </button>
        <button 
          type="submit"
          class="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition"
        >
          <i class="fas fa-paper-plane mr-2"></i>送信
        </button>
      </div>
    </form>
  `
  
  // フォーム送信イベント
  const publicForm = document.getElementById('publicForm')
  if (publicForm) {
    publicForm.addEventListener('submit', handleFormSubmit)
  }
}

// フォームフィールドを描画
function renderFormField(field) {
  const isRequired = field.is_required === 1
  const requiredMark = isRequired ? '<span class="text-red-600">*</span>' : ''
  
  let inputHtml = ''
  
  switch (field.data_type) {
    case 'number':
      inputHtml = `
        <input 
          type="number" 
          name="${escapeHtml(field.field_name)}"
          ${isRequired ? 'required' : ''}
          step="any"
          class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="数値を入力してください"
        />
      `
      break
    
    case 'date':
      inputHtml = `
        <input 
          type="date" 
          name="${escapeHtml(field.field_name)}"
          ${isRequired ? 'required' : ''}
          class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      `
      break
    
    case 'text':
    default:
      // 長いテキストの場合はtextarea
      if (field.field_name.includes('備考') || field.field_name.includes('説明') || field.field_name.includes('詳細')) {
        inputHtml = `
          <textarea 
            name="${escapeHtml(field.field_name)}"
            ${isRequired ? 'required' : ''}
            rows="3"
            class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="内容を入力してください"
          ></textarea>
        `
      } else {
        inputHtml = `
          <input 
            type="text" 
            name="${escapeHtml(field.field_name)}"
            ${isRequired ? 'required' : ''}
            class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="入力してください"
          />
        `
      }
      break
  }
  
  return `
    <div>
      <label class="block text-gray-700 font-semibold mb-2">
        ${escapeHtml(field.field_name)} ${requiredMark}
      </label>
      ${inputHtml}
    </div>
  `
}

// フォーム送信処理
async function handleFormSubmit(event) {
  event.preventDefault()
  
  const form = event.target
  const formData = new FormData(form)
  
  // フォームデータをオブジェクトに変換
  const input_data = {}
  for (const [key, value] of formData.entries()) {
    input_data[key] = value
  }
  
  try {
    const submitBtn = form.querySelector('button[type="submit"]')
    submitBtn.disabled = true
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>送信中...'
    
    const { data } = await apiCall(`/api/forms/${window.FORM_URL}/submit`, {
      method: 'POST',
      body: JSON.stringify({ input_data })
    })
    
    if (data.success) {
      // 成功メッセージを表示
      document.getElementById('formContainer').classList.add('hidden')
      document.getElementById('successMessage').classList.remove('hidden')
      
      // 計算結果を表示
      if (data.data.calculated_data && Object.keys(data.data.calculated_data).length > 0) {
        const calculatedHtml = Object.entries(data.data.calculated_data)
          .map(([key, value]) => `<p><strong>${escapeHtml(key)}:</strong> ${value}</p>`)
          .join('')
        
        document.getElementById('successMessage').innerHTML += `
          <div class="mt-4 p-4 bg-white rounded-lg border">
            <h4 class="font-bold mb-2">計算結果：</h4>
            ${calculatedHtml}
          </div>
        `
      }
      
      // ページトップにスクロール
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      alert(data.error.message || 'フォームの送信に失敗しました')
      submitBtn.disabled = false
      submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>送信'
    }
  } catch (error) {
    console.error('Form submission error:', error)
    alert('フォームの送信に失敗しました')
    
    const submitBtn = form.querySelector('button[type="submit"]')
    submitBtn.disabled = false
    submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>送信'
  }
}

// エラー表示
function showError(message) {
  const formContainer = document.getElementById('formContainer')
  
  if (!formContainer) return
  
  formContainer.innerHTML = `
    <div class="text-center py-12">
      <i class="fas fa-exclamation-circle text-5xl text-red-600 mb-4"></i>
      <h3 class="text-xl font-bold text-gray-800 mb-2">エラーが発生しました</h3>
      <p class="text-gray-600">${escapeHtml(message)}</p>
    </div>
  `
}

// ユーティリティ関数
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
