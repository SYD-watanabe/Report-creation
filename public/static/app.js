// グローバルな状態管理
const AppState = {
  token: localStorage.getItem('token') || null,
  user: null
}

// API呼び出しヘルパー
async function apiCall(endpoint, options = {}) {
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(AppState.token && { 'Authorization': `Bearer ${AppState.token}` }),
      ...options.headers
    }
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
  const logoutButtons = document.querySelectorAll('.logout-btn')
  logoutButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      handleLogout()
    })
  })
})
