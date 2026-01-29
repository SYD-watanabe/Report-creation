import { Hono } from 'hono';
import { Bindings, ApiResponse } from '../types';

const forms = new Hono<{ Bindings: Bindings }>();

// UTC時刻を日本時間（JST）に変換
function toJST(utcDateString: string): string {
  const date = new Date(utcDateString);
  // 日本時間は UTC+9
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(date.getTime() + jstOffset);
  return jstDate.toISOString().replace('T', ' ').substring(0, 19);
}

// フォーム生成（認証必要）
forms.post('/', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const body = await c.req.json();
    const { template_id, form_title, form_description } = body;

    if (!template_id || !form_title) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'テンプレートIDとフォームタイトルは必須です'
        }
      };
      return c.json(response, 400);
    }

    // テンプレートの所有者確認と存在確認
    const template = await env.DB.prepare(`
      SELECT t.*, COUNT(f.field_id) as field_count
      FROM templates t
      LEFT JOIN template_fields f ON t.template_id = f.template_id AND f.include_in_form = 1
      WHERE t.template_id = ? AND t.user_id = ?
      GROUP BY t.template_id
    `).bind(template_id, user.user_id).first();

    if (!template) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'テンプレートが見つかりません'
        }
      };
      return c.json(response, 404);
    }

    // フォームに含まれる項目数を確認
    if ((template.field_count as number) === 0) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NO_FIELDS',
          message: 'フォームに含める項目がありません。先にAI項目抽出を実行してください。'
        }
      };
      return c.json(response, 400);
    }

    // ユニークなフォームURLを生成
    const formUrl = generateFormUrl();

    // フォームをデータベースに保存
    const result = await env.DB.prepare(`
      INSERT INTO forms (
        template_id, user_id, form_url, form_title, form_description, is_active
      ) VALUES (?, ?, ?, ?, ?, 1)
    `).bind(
      template_id,
      user.user_id,
      formUrl,
      form_title,
      form_description || null
    ).run();

    const response: ApiResponse = {
      success: true,
      message: 'フォームを作成しました',
      data: {
        form_id: result.meta.last_row_id,
        form_url: formUrl,
        public_url: `/forms/${formUrl}`
      }
    };

    return c.json(response);
  } catch (error: any) {
    console.error('Form creation error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'フォームの作成に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// テンプレートのフォーム一覧取得（認証必要）
forms.get('/template/:templateId', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const templateId = c.req.param('templateId');

    // テンプレートの所有者確認
    const template = await env.DB.prepare(`
      SELECT * FROM templates WHERE template_id = ? AND user_id = ?
    `).bind(templateId, user.user_id).first();

    if (!template) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'テンプレートが見つかりません'
        }
      };
      return c.json(response, 404);
    }

    // フォーム一覧を取得
    const result = await env.DB.prepare(`
      SELECT 
        form_id, form_url, form_title, form_description,
        is_active, access_count, submission_count,
        created_at, updated_at
      FROM forms
      WHERE template_id = ?
      ORDER BY created_at DESC
    `).bind(templateId).all();

    // created_atを日本時間に変換
    const formsWithJST = result.results?.map((form: any) => ({
      ...form,
      created_at: toJST(form.created_at),
      updated_at: form.updated_at ? toJST(form.updated_at) : null
    }));

    const response: ApiResponse = {
      success: true,
      data: {
        forms: formsWithJST
      }
    };

    return c.json(response);
  } catch (error: any) {
    console.error('Forms list error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'フォーム一覧の取得に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// フォーム詳細取得（公開・認証不要）
forms.get('/:formUrl', async (c) => {
  try {
    const { env } = c;
    const formUrl = c.req.param('formUrl');

    // フォーム情報を取得
    const form = await env.DB.prepare(`
      SELECT 
        f.form_id, f.template_id, f.form_url, f.form_title, f.form_description,
        f.is_active, f.access_count, f.submission_count, f.created_at,
        t.template_name
      FROM forms f
      JOIN templates t ON f.template_id = t.template_id
      WHERE f.form_url = ?
    `).bind(formUrl).first();

    if (!form) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'フォームが見つかりません'
        }
      };
      return c.json(response, 404);
    }

    // フォームがアクティブかチェック
    if (!form.is_active) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORM_INACTIVE',
          message: 'このフォームは現在利用できません'
        }
      };
      return c.json(response, 403);
    }

    // フォームのフィールド情報を取得（include_in_form=1のみ）
    const fields = await env.DB.prepare(`
      SELECT 
        field_id, field_name, field_type, data_type,
        cell_position, is_required, display_order
      FROM template_fields
      WHERE template_id = ? AND include_in_form = 1
      ORDER BY display_order ASC
    `).bind(form.template_id).all();

    // アクセス数をインクリメント
    await env.DB.prepare(`
      UPDATE forms SET access_count = access_count + 1
      WHERE form_id = ?
    `).bind(form.form_id).run();

    const response: ApiResponse = {
      success: true,
      data: {
        form,
        fields: fields.results
      }
    };

    return c.json(response);
  } catch (error: any) {
    console.error('Form detail error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'フォームの取得に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// フォーム送信（公開・認証不要）
forms.post('/:formUrl/submit', async (c) => {
  try {
    const { env } = c;
    const formUrl = c.req.param('formUrl');
    const body = await c.req.json();
    const { input_data } = body;

    if (!input_data || typeof input_data !== 'object') {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_DATA',
          message: '入力データが不正です'
        }
      };
      return c.json(response, 400);
    }

    // フォーム情報を取得
    const form = await env.DB.prepare(`
      SELECT form_id, template_id, user_id, is_active
      FROM forms
      WHERE form_url = ?
    `).bind(formUrl).first();

    if (!form) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'フォームが見つかりません'
        }
      };
      return c.json(response, 404);
    }

    if (!form.is_active) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORM_INACTIVE',
          message: 'このフォームは現在利用できません'
        }
      };
      return c.json(response, 403);
    }

    // サブスクリプション情報とプラン制限を取得
    const subscription = await env.DB.prepare(`
      SELECT form_submission_limit, quote_storage_limit
      FROM user_subscriptions
      WHERE user_id = ? AND payment_status = 'active'
    `).bind(form.user_id).first();

    if (!subscription) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NO_SUBSCRIPTION',
          message: 'アクティブなサブスクリプションがありません'
        }
      };
      return c.json(response, 403);
    }

    // フォーム送信回数制限チェック（-1は無制限）
    const formSubmissionLimit = subscription.form_submission_limit as number;
    if (formSubmissionLimit !== -1) {
      // このフォームの送信回数を取得
      const submissionCount = await env.DB.prepare(`
        SELECT submission_count FROM forms WHERE form_id = ?
      `).bind(form.form_id).first();

      if (submissionCount && (submissionCount.submission_count as number) >= formSubmissionLimit) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'SUBMISSION_LIMIT_REACHED',
            message: `フォーム送信回数の上限（${formSubmissionLimit}回）に達しています。プレミアムプランにアップグレードしてください。`
          }
        };
        return c.json(response, 403);
      }
    }

    // 見積書保存件数制限チェック（-1は無制限）
    const quoteStorageLimit = subscription.quote_storage_limit as number;
    if (quoteStorageLimit !== -1) {
      const quoteCount = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM quotes WHERE user_id = ?
      `).bind(form.user_id).first();

      if (quoteCount && (quoteCount.count as number) >= quoteStorageLimit) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'QUOTE_LIMIT_REACHED',
            message: `見積書保存件数の上限（${quoteStorageLimit}件）に達しています。既存の見積書を削除するか、プレミアムプランにアップグレードしてください。`
          }
        };
        return c.json(response, 403);
      }
    }

    // 必須項目のバリデーション
    const requiredFields = await env.DB.prepare(`
      SELECT field_name, field_id
      FROM template_fields
      WHERE template_id = ? AND is_required = 1 AND include_in_form = 1
    `).bind(form.template_id).all();

    for (const field of requiredFields.results) {
      const fieldName = field.field_name as string;
      if (!input_data[fieldName] || input_data[fieldName].toString().trim() === '') {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: `必須項目「${fieldName}」が入力されていません`
          }
        };
        return c.json(response, 400);
      }
    }

    // 計算項目を取得
    const calcFields = await env.DB.prepare(`
      SELECT field_id, field_name, calculation_formula
      FROM template_fields
      WHERE template_id = ? AND field_type = 'calc' AND include_in_form = 1
    `).bind(form.template_id).all();

    // 計算項目を計算
    const calculated_data: any = {};
    for (const calcField of calcFields.results) {
      const fieldName = calcField.field_name as string;
      const formula = calcField.calculation_formula as string;
      
      if (formula) {
        try {
          calculated_data[fieldName] = evaluateFormula(formula, input_data);
        } catch (error) {
          console.error(`Formula evaluation error for ${fieldName}:`, error);
          calculated_data[fieldName] = null;
        }
      }
    }

    // 見積書データをデータベースに保存
    const fileName = `quote_${Date.now()}.pdf`;
    const filePath = `quotes/${form.user_id}/${fileName}`;

    const result = await env.DB.prepare(`
      INSERT INTO quotes (
        form_id, template_id, user_id, input_data, calculated_data, file_path, file_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      form.form_id,
      form.template_id,
      form.user_id,
      JSON.stringify(input_data),
      JSON.stringify(calculated_data),
      filePath,
      fileName
    ).run();

    // フォームの送信数をインクリメント
    await env.DB.prepare(`
      UPDATE forms SET submission_count = submission_count + 1
      WHERE form_id = ?
    `).bind(form.form_id).run();

    // テンプレートの見積書作成数をインクリメント
    await env.DB.prepare(`
      UPDATE templates SET quotes_created = quotes_created + 1
      WHERE template_id = ?
    `).bind(form.template_id).run();

    const response: ApiResponse = {
      success: true,
      message: '見積書を作成しました',
      data: {
        quote_id: result.meta.last_row_id,
        input_data,
        calculated_data
      }
    };

    return c.json(response);
  } catch (error: any) {
    console.error('Form submission error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'フォームの送信に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// フォーム状態を更新（認証必要）
forms.patch('/:formId', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const formId = c.req.param('formId');
    const body = await c.req.json();
    const { is_active, form_title, form_description } = body;

    // フォームの所有者確認
    const form = await env.DB.prepare(`
      SELECT * FROM forms WHERE form_id = ? AND user_id = ?
    `).bind(formId, user.user_id).first();

    if (!form) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'フォームが見つかりません'
        }
      };
      return c.json(response, 404);
    }

    // フォームを更新
    await env.DB.prepare(`
      UPDATE forms
      SET 
        is_active = COALESCE(?, is_active),
        form_title = COALESCE(?, form_title),
        form_description = COALESCE(?, form_description),
        updated_at = CURRENT_TIMESTAMP
      WHERE form_id = ? AND user_id = ?
    `).bind(
      is_active !== undefined ? is_active : null,
      form_title || null,
      form_description !== undefined ? form_description : null,
      formId,
      user.user_id
    ).run();

    const response: ApiResponse = {
      success: true,
      message: 'フォームを更新しました'
    };

    return c.json(response);
  } catch (error: any) {
    console.error('Form update error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'フォームの更新に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// フォーム削除（認証必要）
forms.delete('/:formId', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const formId = c.req.param('formId');

    console.log('Delete form request:', { formId, userId: user.user_id });

    // フォームの所有者確認
    const form = await env.DB.prepare(`
      SELECT * FROM forms WHERE form_id = ? AND user_id = ?
    `).bind(formId, user.user_id).first();

    console.log('Form found:', form);

    if (!form) {
      console.log('Form not found or not owned by user');
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'フォームが見つかりません'
        }
      };
      return c.json(response, 404);
    }

    // フォームを削除（CASCADE設定により関連データも削除）
    const deleteResult = await env.DB.prepare(`
      DELETE FROM forms WHERE form_id = ? AND user_id = ?
    `).bind(formId, user.user_id).run();

    console.log('Delete result:', deleteResult);

    const response: ApiResponse = {
      success: true,
      message: 'フォームを削除しました'
    };

    return c.json(response);
  } catch (error: any) {
    console.error('Form delete error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'フォームの削除に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// ユニークなフォームURLを生成
function generateFormUrl(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 簡易的な数式評価関数
function evaluateFormula(formula: string, data: any): number | null {
  try {
    // フィールド名を値に置換
    let expression = formula;
    for (const [key, value] of Object.entries(data)) {
      const numValue = parseFloat(value as string);
      if (!isNaN(numValue)) {
        expression = expression.replace(new RegExp(key, 'g'), numValue.toString());
      }
    }
    
    // 安全な演算子のみ許可
    if (!/^[\d\s+\-*/().]+$/.test(expression)) {
      return null;
    }
    
    // 評価
    const result = Function(`"use strict"; return (${expression})`)();
    return typeof result === 'number' && !isNaN(result) ? result : null;
  } catch (error) {
    console.error('Formula evaluation error:', error);
    return null;
  }
}

export default forms;
