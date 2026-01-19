import { Context, Next } from 'hono'
import { verifyToken, extractToken } from '../utils/auth'
import type { Bindings, JWTPayload } from '../types'

// Context型を拡張してユーザー情報を含める
export interface AuthContext extends Context {
  user?: JWTPayload
}

/**
 * JWT認証ミドルウェア
 */
export async function authenticate(c: Context<{ Bindings: Bindings }>, next: Next) {
  const authHeader = c.req.header('Authorization')
  const token = extractToken(authHeader)
  
  if (!token) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '認証が必要です'
      }
    }, 401)
  }
  
  const payload = await verifyToken(token)
  
  if (!payload) {
    return c.json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'トークンが無効です'
      }
    }, 401)
  }
  
  // ユーザー情報をコンテキストに設定
  c.set('user', payload)
  
  await next()
}

/**
 * オプショナル認証ミドルウェア（トークンがあれば検証、なくてもOK）
 */
export async function optionalAuth(c: Context<{ Bindings: Bindings }>, next: Next) {
  const authHeader = c.req.header('Authorization')
  const token = extractToken(authHeader)
  
  if (token) {
    const payload = await verifyToken(token)
    if (payload) {
      c.set('user', payload)
    }
  }
  
  await next()
}
