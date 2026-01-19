import { SignJWT, jwtVerify } from 'jose'
import type { JWTPayload } from '../types'

// JWT秘密鍵（本番環境では環境変数から取得）
const JWT_SECRET = 'your-secret-key-change-in-production-min-32-chars-long'

/**
 * パスワードをハッシュ化（簡易版 - Web Crypto API使用）
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * パスワードを検証
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const hash = await hashPassword(password)
  return hash === hashedPassword
}

/**
 * JWTトークンを生成
 */
export async function generateToken(payload: JWTPayload): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET)
  
  const token = await new SignJWT({ 
    user_id: payload.user_id,
    email: payload.email,
    current_plan: payload.current_plan
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret)
  
  return token
}

/**
 * JWTトークンを検証
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    
    return {
      user_id: payload.user_id as number,
      email: payload.email as string,
      current_plan: payload.current_plan as 'free' | 'premium',
      iat: payload.iat,
      exp: payload.exp
    }
  } catch (error) {
    return null
  }
}

/**
 * リクエストからトークンを抽出
 */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null
  
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null
  
  return parts[1]
}
