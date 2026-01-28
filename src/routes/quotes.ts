import { Hono } from 'hono';
import { Bindings, ApiResponse } from '../types';
import ExcelJS from 'exceljs';

const quotes = new Hono<{ Bindings: Bindings }>();

// UTC時刻を日本時間（JST）に変換
function toJST(utcDateString: string): string {
  const date = new Date(utcDateString);
  // 日本時間は UTC+9
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(date.getTime() + jstOffset);
  return jstDate.toISOString().replace('T', ' ').substring(0, 19);
}

// 見積書一覧取得（認証必要）
quotes.get('/', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;

    // ユーザーの見積書一覧を取得
    const result = await env.DB.prepare(`
      SELECT 
        q.quote_id,
        q.form_id,
        q.template_id,
        q.input_data,
        q.calculated_data,
        q.file_name,
        q.created_at,
        t.template_name,
        f.form_title
      FROM quotes q
      JOIN templates t ON q.template_id = t.template_id
      JOIN forms f ON q.form_id = f.form_id
      WHERE q.user_id = ?
      ORDER BY q.created_at DESC
    `).bind(user.user_id).all();

    // created_atを日本時間に変換
    const quotesWithJST = result.results?.map((quote: any) => ({
      ...quote,
      created_at: toJST(quote.created_at)
    }));

    const response: ApiResponse = {
      success: true,
      data: {
        quotes: quotesWithJST
      }
    };

    return c.json(response);
  } catch (error: any) {
    console.error('Quotes list error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '見積書一覧の取得に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// 見積書詳細取得（認証必要）
quotes.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const quoteId = c.req.param('id');

    // 見積書情報を取得
    const quote = await env.DB.prepare(`
      SELECT 
        q.quote_id,
        q.form_id,
        q.template_id,
        q.input_data,
        q.calculated_data,
        q.file_name,
        q.created_at,
        t.template_name,
        f.form_title,
        f.form_url
      FROM quotes q
      JOIN templates t ON q.template_id = t.template_id
      JOIN forms f ON q.form_id = f.form_id
      WHERE q.quote_id = ? AND q.user_id = ?
    `).bind(quoteId, user.user_id).first();

    if (!quote) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '見積書が見つかりません'
        }
      };
      return c.json(response, 404);
    }

    // created_atを日本時間に変換
    const quoteWithJST = {
      ...quote,
      created_at: toJST(quote.created_at as string)
    };

    const response: ApiResponse = {
      success: true,
      data: {
        quote: quoteWithJST
      }
    };

    return c.json(response);
  } catch (error: any) {
    console.error('Quote detail error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '見積書の取得に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// 見積書削除（認証必要）
quotes.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const quoteId = c.req.param('id');

    // 見積書の所有者確認
    const quote = await env.DB.prepare(`
      SELECT * FROM quotes WHERE quote_id = ? AND user_id = ?
    `).bind(quoteId, user.user_id).first();

    if (!quote) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '見積書が見つかりません'
        }
      };
      return c.json(response, 404);
    }

    // 見積書を削除
    await env.DB.prepare(`
      DELETE FROM quotes WHERE quote_id = ? AND user_id = ?
    `).bind(quoteId, user.user_id).run();

    // テンプレートの見積書作成数をデクリメント
    await env.DB.prepare(`
      UPDATE templates SET quotes_created = quotes_created - 1
      WHERE template_id = ? AND quotes_created > 0
    `).bind(quote.template_id).run();

    // フォームの送信数をデクリメント
    await env.DB.prepare(`
      UPDATE forms SET submission_count = submission_count - 1
      WHERE form_id = ? AND submission_count > 0
    `).bind(quote.form_id).run();

    const response: ApiResponse = {
      success: true,
      message: '見積書を削除しました'
    };

    return c.json(response);
  } catch (error: any) {
    console.error('Quote delete error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: '見積書の削除に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// Excel生成（認証必要）
quotes.post('/:id/generate', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const quoteId = c.req.param('id');

    // 見積書情報を取得
    const quote = await env.DB.prepare(`
      SELECT 
        q.*,
        t.file_path as template_path
      FROM quotes q
      JOIN templates t ON q.template_id = t.template_id
      WHERE q.quote_id = ? AND q.user_id = ?
    `).bind(quoteId, user.user_id).first();

    if (!quote) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '見積書が見つかりません'
        }
      };
      return c.json(response, 404);
    }

    // テンプレートのフィールド情報を取得
    const fields = await env.DB.prepare(`
      SELECT field_name, cell_position, field_type
      FROM template_fields
      WHERE template_id = ?
      ORDER BY display_order ASC
    `).bind(quote.template_id).all();

    // R2からテンプレートファイルを取得
    const templateFile = await env.R2.get(quote.template_path as string);
    if (!templateFile) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'テンプレートファイルが見つかりません'
        }
      };
      return c.json(response, 404);
    }

    // ExcelJSでワークブックを読み込み
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await templateFile.arrayBuffer());
    
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'WORKSHEET_NOT_FOUND',
          message: 'ワークシートが見つかりません'
        }
      };
      return c.json(response, 404);
    }

    // 入力データと計算データを取得
    const inputData = JSON.parse(quote.input_data as string);
    const calculatedData = quote.calculated_data ? JSON.parse(quote.calculated_data as string) : {};

    // セルにデータを埋め込み
    for (const field of fields.results) {
      const fieldName = field.field_name as string;
      const cellPosition = field.cell_position as string;
      const fieldType = field.field_type as string;

      if (!cellPosition) continue;

      let value;
      if (fieldType === 'input') {
        value = inputData[fieldName];
      } else if (fieldType === 'calc') {
        value = calculatedData[fieldName];
      }

      if (value !== undefined && value !== null) {
        try {
          const cell = worksheet.getCell(cellPosition);
          // 数値は数値として、それ以外は文字列として設定
          if (typeof value === 'number' || !isNaN(Number(value))) {
            cell.value = Number(value);
          } else {
            cell.value = String(value);
          }
        } catch (error) {
          console.error(`Error setting cell ${cellPosition}:`, error);
        }
      }
    }

    // 計算式を再計算
    workbook.calcProperties.fullCalcOnLoad = true;

    // Excelファイルをバッファに書き出し
    const buffer = await workbook.xlsx.writeBuffer();

    // R2に保存
    const excelFileName = `quote_${quoteId}_${Date.now()}.xlsx`;
    const excelPath = `quotes/${user.user_id}/${excelFileName}`;
    
    await env.R2.put(excelPath, buffer, {
      httpMetadata: {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    });

    // データベースにExcelファイル情報を更新
    await env.DB.prepare(`
      UPDATE quotes 
      SET file_path = ?, file_name = ?
      WHERE quote_id = ?
    `).bind(excelPath, excelFileName, quoteId).run();

    const response: ApiResponse = {
      success: true,
      message: 'Excelファイルを生成しました',
      data: {
        file_name: excelFileName,
        file_path: excelPath
      }
    };

    return c.json(response);
  } catch (error: any) {
    console.error('Excel generation error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'GENERATION_ERROR',
        message: `Excelファイルの生成に失敗しました: ${error.message}`
      }
    };
    return c.json(response, 500);
  }
});

// Excelダウンロード（認証必要）
quotes.get('/:id/download', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const quoteId = c.req.param('id');

    // 見積書情報を取得
    const quote = await env.DB.prepare(`
      SELECT file_path, file_name
      FROM quotes
      WHERE quote_id = ? AND user_id = ?
    `).bind(quoteId, user.user_id).first();

    if (!quote) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '見積書が見つかりません'
        }
      };
      return c.json(response, 404);
    }

    if (!quote.file_path || !quote.file_name) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FILE_NOT_GENERATED',
          message: 'Excelファイルがまだ生成されていません。先に「Excel生成」を実行してください。'
        }
      };
      return c.json(response, 404);
    }

    // R2からファイルを取得
    const file = await env.R2.get(quote.file_path as string);
    if (!file) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'ファイルが見つかりません'
        }
      };
      return c.json(response, 404);
    }

    // ファイルをダウンロード
    return new Response(file.body, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${quote.file_name}"`,
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error: any) {
    console.error('Excel download error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'DOWNLOAD_ERROR',
        message: 'ファイルのダウンロードに失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

export default quotes;
