import { Hono } from 'hono'
import type { Bindings, ApiResponse } from '../types'

const admin = new Hono<{ Bindings: Bindings }>()

/**
 * GET /api/admin/users
 * 全ユーザー一覧取得（管理者用）
 * Note: 本番環境では適切な管理者認証を追加してください
 */
admin.get('/users', async (c) => {
  try {
    // ユーザー情報を取得（パスワードハッシュは除外）
    const usersResult = await c.env.DB.prepare(`
      SELECT 
        u.user_id,
        u.email,
        u.name,
        u.current_plan,
        u.templates_created,
        u.created_at,
        u.updated_at,
        s.plan_type,
        s.template_limit,
        s.payment_status,
        s.start_date,
        s.expiry_date
      FROM users u
      LEFT JOIN user_subscriptions s ON u.user_id = s.user_id
      ORDER BY u.created_at DESC
    `).all()
    
    return c.json<ApiResponse>({
      success: true,
      data: {
        users: usersResult.results,
        total: usersResult.results.length
      }
    })
  } catch (error) {
    console.error('Admin users list error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'ユーザー一覧の取得に失敗しました'
      }
    }, 500)
  }
})

/**
 * GET /api/admin/stats
 * システム統計情報取得
 */
admin.get('/stats', async (c) => {
  try {
    // ユーザー数
    const usersCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM users'
    ).first()
    
    // プラン別ユーザー数
    const planStats = await c.env.DB.prepare(`
      SELECT current_plan, COUNT(*) as count 
      FROM users 
      GROUP BY current_plan
    `).all()
    
    // テンプレート数
    const templatesCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM templates'
    ).first()
    
    // フォーム数
    const formsCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM forms'
    ).first()
    
    // 見積書数
    const quotesCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM quotes'
    ).first()
    
    // アクティブフォーム数
    const activeFormsCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM forms WHERE is_active = 1'
    ).first()
    
    return c.json<ApiResponse>({
      success: true,
      data: {
        users: {
          total: usersCount?.count || 0,
          byPlan: planStats.results
        },
        templates: templatesCount?.count || 0,
        forms: {
          total: formsCount?.count || 0,
          active: activeFormsCount?.count || 0
        },
        quotes: quotesCount?.count || 0
      }
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '統計情報の取得に失敗しました'
      }
    }, 500)
  }
})

/**
 * GET /api/admin/user/:userId
 * 特定ユーザーの詳細情報取得
 */
admin.get('/user/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')
    
    // ユーザー情報
    const user = await c.env.DB.prepare(`
      SELECT 
        u.user_id,
        u.email,
        u.name,
        u.current_plan,
        u.templates_created,
        u.created_at,
        u.updated_at,
        s.plan_type,
        s.template_limit,
        s.payment_status,
        s.start_date,
        s.expiry_date,
        s.stripe_subscription_id
      FROM users u
      LEFT JOIN user_subscriptions s ON u.user_id = s.user_id
      WHERE u.user_id = ?
    `).bind(userId).first()
    
    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'ユーザーが見つかりません'
        }
      }, 404)
    }
    
    // ユーザーのテンプレート
    const templates = await c.env.DB.prepare(`
      SELECT template_id, template_name, file_type, file_size, quotes_created, created_at
      FROM templates
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(userId).all()
    
    // ユーザーのフォーム
    const forms = await c.env.DB.prepare(`
      SELECT form_id, form_url, form_title, is_active, access_count, submission_count, created_at
      FROM forms
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(userId).all()
    
    // ユーザーの見積書
    const quotes = await c.env.DB.prepare(`
      SELECT quote_id, template_id, form_id, file_name, created_at
      FROM quotes
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(userId).all()
    
    return c.json<ApiResponse>({
      success: true,
      data: {
        user,
        templates: templates.results,
        forms: forms.results,
        quotes: quotes.results
      }
    })
  } catch (error) {
    console.error('Admin user detail error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'ユーザー詳細の取得に失敗しました'
      }
    }, 500)
  }
})

export default admin
