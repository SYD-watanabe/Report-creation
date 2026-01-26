import { Hono } from 'hono'
import type { Bindings, ApiResponse, User } from '../types'
import { hashPassword, verifyPassword, generateToken } from '../utils/auth'

const auth = new Hono<{ Bindings: Bindings }>()

/**
 * POST /api/auth/register
 * 新規ユーザー登録
 */
auth.post('/register', async (c) => {
  try {
    const { email, password, name } = await c.req.json()
    
    // バリデーション
    if (!email || !password || !name) {
      return c.json<ApiResponse>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'メールアドレス、パスワード、名前は必須です'
        }
      }, 400)
    }
    
    if (password.length < 8) {
      return c.json<ApiResponse>({
        success: false,
        error: {
          code: 'PASSWORD_TOO_SHORT',
          message: 'パスワードは8文字以上である必要があります'
        }
      }, 400)
    }
    
    // メールアドレスの重複チェック
    const existingUser = await c.env.DB.prepare(
      'SELECT user_id FROM users WHERE email = ?'
    ).bind(email).first()
    
    if (existingUser) {
      return c.json<ApiResponse>({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'このメールアドレスは既に登録されています'
        }
      }, 409)
    }
    
    // パスワードハッシュ化
    const passwordHash = await hashPassword(password)
    
    // ユーザー作成
    const result = await c.env.DB.prepare(`
      INSERT INTO users (email, password_hash, name, current_plan, templates_created)
      VALUES (?, ?, ?, ?, ?)
    `).bind(email, passwordHash, name, 'free', 0).run()
    
    const userId = result.meta.last_row_id
    
    // サブスクリプション作成
    await c.env.DB.prepare(`
      INSERT INTO user_subscriptions (user_id, plan_type, template_limit, start_date, payment_status)
      VALUES (?, ?, ?, date('now'), ?)
    `).bind(userId, 'free', 1, 'active').run()
    
    // ユーザー情報を取得
    const user = await c.env.DB.prepare(
      'SELECT user_id, email, name, current_plan, templates_created FROM users WHERE user_id = ?'
    ).bind(userId).first<User>()
    
    // JWTトークン生成
    const token = await generateToken({
      user_id: user!.user_id,
      email: user!.email,
      current_plan: user!.current_plan
    })
    
    return c.json<ApiResponse>({
      success: true,
      message: 'ユーザー登録が完了しました',
      data: {
        user: {
          user_id: user!.user_id,
          email: user!.email,
          name: user!.name,
          current_plan: user!.current_plan,
          templates_created: user!.templates_created
        },
        token
      }
    }, 201)
    
  } catch (error: any) {
    console.error('Registration error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'サーバーエラーが発生しました'
      }
    }, 500)
  }
})

/**
 * POST /api/auth/login
 * ログイン
 */
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json()
    
    // バリデーション
    if (!email || !password) {
      return c.json<ApiResponse>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'メールアドレスとパスワードは必須です'
        }
      }, 400)
    }
    
    // ユーザー検索
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first<User>()
    
    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'メールアドレスまたはパスワードが正しくありません'
        }
      }, 401)
    }
    
    // パスワード検証
    const isValidPassword = await verifyPassword(password, user.password_hash)
    
    if (!isValidPassword) {
      return c.json<ApiResponse>({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'メールアドレスまたはパスワードが正しくありません'
        }
      }, 401)
    }
    
    // JWTトークン生成
    const token = await generateToken({
      user_id: user.user_id,
      email: user.email,
      current_plan: user.current_plan
    })
    
    return c.json<ApiResponse>({
      success: true,
      message: 'ログインしました',
      data: {
        user: {
          user_id: user.user_id,
          email: user.email,
          name: user.name,
          current_plan: user.current_plan,
          templates_created: user.templates_created
        },
        token
      }
    })
    
  } catch (error: any) {
    console.error('Login error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'サーバーエラーが発生しました'
      }
    }, 500)
  }
})

/**
 * POST /api/auth/logout
 * ログアウト
 */
auth.post('/logout', async (c) => {
  return c.json<ApiResponse>({
    success: true,
    message: 'ログアウトしました'
  })
})

/**
 * GET /api/auth/me
 * 現在のユーザー情報取得（認証必須）
 */
auth.get('/me', async (c) => {
  try {
    const user = c.get('user')
    
    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です'
        }
      }, 401)
    }
    
    // 最新のユーザー情報を取得
    const userData = await c.env.DB.prepare(
      'SELECT user_id, email, name, current_plan, templates_created FROM users WHERE user_id = ?'
    ).bind(user.user_id).first<User>()
    
    if (!userData) {
      return c.json<ApiResponse>({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません'
        }
      }, 404)
    }
    
    return c.json<ApiResponse>({
      success: true,
      data: {
        user: {
          user_id: userData.user_id,
          email: userData.email,
          name: userData.name,
          current_plan: userData.current_plan,
          templates_created: userData.templates_created
        }
      }
    })
    
  } catch (error: any) {
    console.error('Get user error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'サーバーエラーが発生しました'
      }
    }, 500)
  }
})

/**
 * PUT /api/auth/update-profile
 * プロフィール更新（認証必須）
 */
auth.put('/update-profile', async (c) => {
  try {
    const user = c.get('user')
    
    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です'
        }
      }, 401)
    }

    const { name } = await c.req.json()
    
    // バリデーション
    if (!name || !name.trim()) {
      return c.json<ApiResponse>({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ユーザー名は必須です'
        }
      }, 400)
    }
    
    // ユーザー名を更新
    await c.env.DB.prepare(`
      UPDATE users 
      SET name = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ?
    `).bind(name.trim(), user.user_id).run()
    
    // 更新後のユーザー情報を取得
    const updatedUser = await c.env.DB.prepare(
      'SELECT user_id, email, name, current_plan, templates_created FROM users WHERE user_id = ?'
    ).bind(user.user_id).first<User>()
    
    return c.json<ApiResponse>({
      success: true,
      message: 'プロフィールを更新しました',
      data: {
        user: {
          user_id: updatedUser!.user_id,
          email: updatedUser!.email,
          name: updatedUser!.name,
          current_plan: updatedUser!.current_plan,
          templates_created: updatedUser!.templates_created
        }
      }
    })
    
  } catch (error: any) {
    console.error('Update profile error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'サーバーエラーが発生しました'
      }
    }, 500)
  }
})

export default auth
