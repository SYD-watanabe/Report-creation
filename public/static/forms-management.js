// 統合フォーム管理ページ用JavaScript

// ページ初期化
document.addEventListener('DOMContentLoaded', async () => {
  await loadAllForms()
})

// 全フォームを読み込み
async function loadAllForms() {
  try {
    console.log('全フォーム一覧を読み込み中...')
    
    // 全フォームを取得（新しいAPIエンドポイント）
    const { data: formsData } = await apiCall('/api/forms/all')
    
    console.log('APIレスポンス:', formsData)
    
    if (!formsData.success) {
      document.getElementById('allFormsList').innerHTML = `
        <p class="text-red-600 text-center py-8">${formsData.error?.message || 'フォームの読み込みに失敗しました'}</p>
      `
      return
    }
    
    const forms = formsData.data.forms
    console.log('取得したフォーム数:', forms.length)
    
    if (forms.length === 0) {
      document.getElementById('allFormsList').innerHTML = `
        <div class="text-center py-8">
          <p class="text-gray-500 mb-4">フォームがありません</p>
          <a href="/dashboard" class="text-blue-600 hover:underline">
            新しいフォームを作成する
          </a>
        </div>
      `
      return
    }
    
    // テンプレート別にグループ化
    const groupedForms = {}
    forms.forEach(form => {
      const templateName = form.template_name || '不明なテンプレート'
      if (!groupedForms[templateName]) {
        groupedForms[templateName] = []
      }
      groupedForms[templateName].push(form)
    })
    
    console.log('グループ化されたフォーム:', groupedForms)
    
    // HTMLを生成
    let allFormsHtml = ''
    for (const [templateName, templateForms] of Object.entries(groupedForms)) {
      allFormsHtml += `
        <div class="mb-8">
          <h3 class="text-lg font-bold mb-4 text-gray-800">
            📄 ${escapeHtml(templateName)}
          </h3>
          <div class="space-y-4">
            ${templateForms.map(form => renderFormCard(form)).join('')}
          </div>
        </div>
      `
    }
    
    document.getElementById('allFormsList').innerHTML = allFormsHtml
  } catch (error) {
    console.error('Failed to load forms:', error)
    document.getElementById('allFormsList').innerHTML = `
      <p class="text-red-600 text-center py-8">フォームの読み込みに失敗しました: ${error.message}</p>
    `
  }
}

// フォームカードを描画
function renderFormCard(form) {
  const publicUrl = `${window.location.origin}/forms/${form.form_url}`
  const statusBadge = form.is_active
    ? '<span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold"><i class="fas fa-check-circle mr-1"></i>✓ 公開</span>'
    : '<span class="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold"><i class="fas fa-times-circle mr-1"></i>× 非公開</span>'
  
  return `
    <div class="border rounded-lg p-4 hover:shadow-md transition">
      <div class="flex justify-between items-start mb-3">
        <div class="flex items-center gap-3 flex-1">
          ${statusBadge}
          <h4 class="font-semibold text-gray-800">${escapeHtml(form.form_title)}</h4>
        </div>
      </div>
      
      <div class="text-sm text-gray-600 space-y-2 mb-4">
        <div class="flex items-center gap-2">
          <i class="fas fa-link"></i>
          <a href="${publicUrl}" target="_blank" class="text-blue-600 hover:underline break-all">
            ${publicUrl}
          </a>
        </div>
        <p><i class="fas fa-clock mr-2"></i>作成日: ${formatDate(form.created_at)}</p>
      </div>
      
      <div class="flex gap-2 flex-wrap">
        <button 
          onclick="copyFormUrl('${publicUrl}')"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
        >
          <i class="fas fa-copy mr-1"></i>URLコピー
        </button>
        <button 
          onclick="toggleFormStatus(${form.form_id}, ${form.is_active ? 0 : 1})"
          class="px-4 py-2 ${form.is_active ? 'bg-gray-600' : 'bg-green-600'} text-white rounded-lg hover:opacity-80 transition text-sm"
        >
          <i class="fas fa-${form.is_active ? 'eye-slash' : 'eye'} mr-1"></i>${form.is_active ? '非公開' : '公開'}
        </button>
        <button 
          onclick="deleteForm(${form.form_id}, '${escapeHtml(form.form_title)}')"
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
        >
          <i class="fas fa-trash mr-1"></i>削除
        </button>
      </div>
    </div>
  `
}

// URLをコピー
function copyFormUrl(url) {
  navigator.clipboard.writeText(url).then(() => {
    alert('URLをコピーしました')
  }).catch(err => {
    console.error('Failed to copy:', err)
    alert('コピーに失敗しました')
  })
}

// フォームの公開/非公開を切り替え
async function toggleFormStatus(formId, isActive) {
  try {
    const { data } = await apiCall(`/api/forms/${formId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive })
    })
    
    if (data.success) {
      // フォーム一覧を再読み込み
      await loadAllForms()
    } else {
      alert(data.error?.message || '更新に失敗しました')
    }
  } catch (error) {
    console.error('Toggle form status error:', error)
    alert('更新に失敗しました')
  }
}

// フォームを削除
async function deleteForm(formId, formTitle) {
  if (!confirm(`フォーム「${formTitle}」を削除しますか？\n\nこの操作は取り消せません。`)) {
    return
  }
  
  try {
    const { data } = await apiCall(`/api/forms/${formId}`, {
      method: 'DELETE'
    })
    
    if (data.success) {
      // フォーム一覧を再読み込み
      await loadAllForms()
    } else {
      alert(data.error?.message || '削除に失敗しました')
    }
  } catch (error) {
    console.error('Delete form error:', error)
    alert('削除に失敗しました')
  }
}

// HTML エスケープ
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 日付フォーマット
function formatDate(dateString) {
  return dateString.replace('T', ' ').substring(0, 19)
}
