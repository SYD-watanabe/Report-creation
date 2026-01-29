// フォーム受信見積書一覧用JavaScript

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname === '/quotes') {
    initQuotesManagement()
  }
})

// フォーム受信見積書一覧ページ初期化
async function initQuotesManagement() {
  // 見積書一覧を読み込み
  await loadQuotes()
  
  // 詳細モーダルのクローズボタン
  const closeDetailBtn = document.getElementById('closeDetailBtn')
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener('click', () => {
      document.getElementById('quoteDetailModal').classList.add('hidden')
    })
  }
}

// 見積書一覧を読み込み
async function loadQuotes() {
  try {
    const { data } = await apiCall('/api/quotes')
    
    if (data.success) {
      renderQuotes(data.data.quotes)
      
      // 件数を更新
      const quoteCount = document.getElementById('quoteCount')
      if (quoteCount) {
        quoteCount.textContent = data.data.quotes.length
      }
    } else {
      document.getElementById('quotesList').innerHTML = '<p class="text-red-600 text-center py-8">見積書一覧の読み込みに失敗しました</p>'
    }
  } catch (error) {
    console.error('Load quotes error:', error)
    document.getElementById('quotesList').innerHTML = '<p class="text-red-600 text-center py-8">見積書一覧の読み込みに失敗しました</p>'
  }
}

// 見積書一覧を描画
function renderQuotes(quotes) {
  const quotesList = document.getElementById('quotesList')
  
  if (!quotesList) return
  
  if (quotes.length === 0) {
    quotesList.innerHTML = '<p class="text-gray-500 text-center py-8">まだ見積書がありません</p>'
    return
  }
  
  quotesList.innerHTML = quotes.map(quote => {
    const inputData = JSON.parse(quote.input_data)
    const calculatedData = quote.calculated_data ? JSON.parse(quote.calculated_data) : {}
    
    // 案件名を取得（見積書名として使用）
    const quoteName = inputData._project_name || `見積書 #${quote.quote_id}`
    
    // 案件名以外の入力データを取得（表示用）
    const displayFields = Object.entries(inputData)
      .filter(([key]) => !key.startsWith('_')) // アンダースコアで始まるフィールドを除外
      .slice(0, 3)
    
    return `
      <div class="border rounded-lg p-4 mb-4 hover:shadow-md transition">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <h4 class="font-bold text-lg">${escapeHtml(quoteName)}</h4>
              <span class="text-sm text-gray-500">
                ${escapeHtml(quote.template_name)}
              </span>
            </div>
            <div class="text-sm text-gray-600 space-y-1 mb-3">
              <p>フォーム: ${escapeHtml(quote.form_title)}</p>
              <p>作成日: ${formatDate(quote.created_at)}</p>
            </div>
            <div class="bg-gray-50 p-3 rounded-lg">
              <p class="text-xs text-gray-500 mb-1">入力データ（抜粋）:</p>
              ${displayFields.map(([key, value]) => 
                `<p class="text-sm"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</p>`
              ).join('')}
              ${displayFields.length > 3 ? 
                `<p class="text-xs text-gray-500 mt-1">他 ${Object.entries(inputData).filter(([key]) => !key.startsWith('_')).length - 3} 項目...</p>` : ''}
            </div>
          </div>
          <div class="flex flex-row gap-2 ml-4">
            <button 
              onclick="viewQuoteDetail(${quote.quote_id})"
              class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm whitespace-nowrap"
            >
              <i class="fas fa-eye"></i> 詳細
            </button>
            <button 
              onclick="deleteQuote(${quote.quote_id})"
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

// 見積書詳細を表示
async function viewQuoteDetail(quoteId) {
  const modal = document.getElementById('quoteDetailModal')
  const content = document.getElementById('quoteDetailContent')
  
  modal.classList.remove('hidden')
  content.innerHTML = '<p class="text-gray-500 text-center py-8">読み込み中...</p>'
  
  try {
    const { data } = await apiCall(`/api/quotes/${quoteId}`)
    
    if (data.success) {
      const quote = data.data.quote
      const inputData = JSON.parse(quote.input_data)
      const calculatedData = quote.calculated_data ? JSON.parse(quote.calculated_data) : {}
      
      // 案件名を取得
      const quoteName = inputData._project_name || `見積書 #${quote.quote_id}`
      
      // 案件名以外の入力データを取得（表示用）
      const displayInputData = Object.entries(inputData)
        .filter(([key]) => !key.startsWith('_')) // アンダースコアで始まるフィールドを除外
      
      content.innerHTML = `
        <div class="space-y-6">
          <div class="border-b pb-4">
            <h4 class="text-lg font-bold mb-2">基本情報</h4>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="text-gray-600">見積書名</p>
                <p class="font-semibold text-xl">${escapeHtml(quoteName)}</p>
              </div>
              <div>
                <p class="text-gray-600">見積書ID</p>
                <p class="font-semibold">#${quote.quote_id}</p>
              </div>
              <div>
                <p class="text-gray-600">テンプレート</p>
                <p class="font-semibold">${escapeHtml(quote.template_name)}</p>
              </div>
              <div>
                <p class="text-gray-600">フォーム</p>
                <p class="font-semibold">${escapeHtml(quote.form_title)}</p>
              </div>
              <div>
                <p class="text-gray-600">作成日時</p>
                <p class="font-semibold">${formatDate(quote.created_at)}</p>
              </div>
            </div>
          </div>
          
          <div class="border-b pb-4">
            <h4 class="text-lg font-bold mb-3">入力データ</h4>
            <div class="bg-gray-50 p-4 rounded-lg space-y-2">
              ${displayInputData.map(([key, value]) => `
                <div class="flex border-b border-gray-200 pb-2">
                  <span class="font-semibold text-gray-700 w-1/3">${escapeHtml(key)}:</span>
                  <span class="text-gray-900 w-2/3">${escapeHtml(String(value))}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          ${Object.keys(calculatedData).length > 0 ? `
            <div class="border-b pb-4">
              <h4 class="text-lg font-bold mb-3">計算結果</h4>
              <div class="bg-blue-50 p-4 rounded-lg space-y-2">
                ${Object.entries(calculatedData).map(([key, value]) => `
                  <div class="flex border-b border-blue-200 pb-2">
                    <span class="font-semibold text-blue-700 w-1/3">${escapeHtml(key)}:</span>
                    <span class="text-blue-900 w-2/3">${value !== null ? value : '計算不可'}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <div class="flex justify-end gap-4">
            <button 
              onclick="generateExcel(${quote.quote_id})"
              class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <i class="fas fa-file-excel mr-2"></i>Excel生成
            </button>
            <button 
              onclick="downloadExcel(${quote.quote_id})"
              class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <i class="fas fa-download mr-2"></i>Excelダウンロード
            </button>
            <button 
              onclick="document.getElementById('quoteDetailModal').classList.add('hidden')"
              class="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
            >
              閉じる
            </button>
          </div>
        </div>
      `
    } else {
      content.innerHTML = '<p class="text-red-600 text-center py-8">見積書の読み込みに失敗しました</p>'
    }
  } catch (error) {
    console.error('View quote detail error:', error)
    content.innerHTML = '<p class="text-red-600 text-center py-8">見積書の読み込みに失敗しました</p>'
  }
}

// 見積書を削除
async function deleteQuote(quoteId) {
  if (!confirm('この見積書を削除してもよろしいですか？\nこの操作は取り消せません。')) {
    return
  }
  
  try {
    const { data } = await apiCall(`/api/quotes/${quoteId}`, {
      method: 'DELETE'
    })
    
    if (data.success) {
      alert('見積書を削除しました')
      await loadQuotes()
    } else {
      alert(data.error.message || '削除に失敗しました')
    }
  } catch (error) {
    console.error('Delete quote error:', error)
    alert('削除に失敗しました')
  }
}

// Excel生成
async function generateExcel(quoteId) {
  if (!confirm('Excelファイルを生成しますか？\n元のテンプレートにデータを埋め込んだExcelファイルを作成します。')) {
    return
  }
  
  try {
    // ボタンを無効化（複数回クリック防止）
    const modal = document.getElementById('quoteDetailModal')
    const buttons = modal.querySelectorAll('button')
    buttons.forEach(btn => btn.disabled = true)
    
    const { data } = await apiCall(`/api/quotes/${quoteId}/generate`, {
      method: 'POST'
    })
    
    if (data.success) {
      alert('Excelファイルを生成しました！\n「Excelダウンロード」ボタンからダウンロードできます。')
    } else {
      alert(data.error.message || 'Excel生成に失敗しました')
    }
  } catch (error) {
    console.error('Generate Excel error:', error)
    alert('Excel生成に失敗しました')
  } finally {
    // ボタンを再度有効化
    const modal = document.getElementById('quoteDetailModal')
    const buttons = modal.querySelectorAll('button')
    buttons.forEach(btn => btn.disabled = false)
  }
}

// Excelダウンロード
async function downloadExcel(quoteId) {
  try {
    const token = localStorage.getItem('token')
    
    // fetch APIでダウンロード
    const response = await fetch(`/api/quotes/${quoteId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      const data = await response.json()
      alert(data.error.message || 'ダウンロードに失敗しました')
      return
    }
    
    // ファイル名を取得
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = `quote_${quoteId}.xlsx`
    if (contentDisposition) {
      const matches = /filename="([^"]+)"/.exec(contentDisposition)
      if (matches && matches[1]) {
        filename = matches[1]
      }
    }
    
    // ブロブとしてダウンロード
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    
    alert('Excelファイルをダウンロードしました')
  } catch (error) {
    console.error('Download Excel error:', error)
    alert('ダウンロードに失敗しました')
  }
}

// ユーティリティ関数
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function formatDate(dateString) {
  // サーバーから既に日本時間で送られてくる前提
  return dateString.replace('T', ' ').substring(0, 19);
}

// API呼び出しヘルパー（app.jsと共通）
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
