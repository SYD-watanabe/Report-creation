import { Hono } from 'hono';
import { Bindings, ApiResponse, Template } from '../types';
import { analyzeExcelFile, generateExcelSummary } from '../utils/excel';
import { extractFieldsWithGemini, convertToDbFields } from '../utils/gemini';

const templates = new Hono<{ Bindings: Bindings }>();

// テンプレート一覧取得
templates.get('/', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;

    // ユーザーのテンプレート一覧を取得
    const result = await env.DB.prepare(`
      SELECT 
        template_id,
        template_name,
        file_type,
        file_size,
        quotes_created,
        created_at,
        updated_at
      FROM templates
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(user.user_id).all();

    const response: ApiResponse<{ templates: Template[] }> = {
      success: true,
      data: {
        templates: result.results as Template[]
      }
    };

    return c.json(response);
  } catch (error) {
    console.error('Template list error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'テンプレート一覧の取得に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// テンプレート詳細取得
templates.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const templateId = c.req.param('id');

    // テンプレート情報を取得
    const template = await env.DB.prepare(`
      SELECT * FROM templates
      WHERE template_id = ? AND user_id = ?
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

    // テンプレートのフィールド情報を取得
    const fields = await env.DB.prepare(`
      SELECT * FROM template_fields
      WHERE template_id = ?
      ORDER BY display_order ASC
    `).bind(templateId).all();

    const response: ApiResponse = {
      success: true,
      data: {
        template,
        fields: fields.results
      }
    };

    return c.json(response);
  } catch (error) {
    console.error('Template detail error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'テンプレートの取得に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// テンプレートアップロード
templates.post('/', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;

    // サブスクリプション情報を取得
    const subscription = await env.DB.prepare(`
      SELECT template_limit FROM user_subscriptions
      WHERE user_id = ? AND payment_status = 'active'
    `).bind(user.user_id).first();

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

    const templateLimit = subscription.template_limit as number;

    // テンプレート数をチェック（-1は無制限）
    if (templateLimit !== -1) {
      const count = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM templates WHERE user_id = ?
      `).bind(user.user_id).first();

      if (count && (count.count as number) >= templateLimit) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'TEMPLATE_LIMIT_REACHED',
            message: `テンプレート上限（${templateLimit}個）に達しています。プレミアムプランにアップグレードしてください。`
          }
        };
        return c.json(response, 403);
      }
    }

    // フォームデータを取得
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const templateName = formData.get('template_name') as string;

    if (!file || !templateName) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'ファイルとテンプレート名は必須です'
        }
      };
      return c.json(response, 400);
    }

    // ファイルサイズチェック（10MB）
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'ファイルサイズは10MB以下にしてください'
        }
      };
      return c.json(response, 400);
    }

    // ファイルタイプチェック
    const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!allowedTypes.includes(file.type)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Excelファイル（.xlsx, .xls）のみアップロード可能です'
        }
      };
      return c.json(response, 400);
    }

    // ファイル拡張子を判定
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'xlsx';
    const fileType = fileExt === 'xls' ? 'xls' : 'xlsx';

    // R2にファイルを保存
    const fileName = `${user.user_id}/${Date.now()}_${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    
    await env.R2.put(fileName, arrayBuffer, {
      httpMetadata: {
        contentType: file.type
      }
    });

    // データベースに記録
    const result = await env.DB.prepare(`
      INSERT INTO templates (
        user_id, template_name, file_path, file_type, file_size
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      user.user_id,
      templateName,
      fileName,
      fileType,
      file.size
    ).run();

    // templates_createdを更新
    await env.DB.prepare(`
      UPDATE users SET templates_created = templates_created + 1
      WHERE user_id = ?
    `).bind(user.user_id).run();

    const response: ApiResponse = {
      success: true,
      message: 'テンプレートをアップロードしました',
      data: {
        template_id: result.meta.last_row_id
      }
    };

    return c.json(response);
  } catch (error) {
    console.error('Template upload error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'テンプレートのアップロードに失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// テンプレート削除
templates.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const templateId = c.req.param('id');

    // テンプレート情報を取得
    const template = await env.DB.prepare(`
      SELECT file_path FROM templates
      WHERE template_id = ? AND user_id = ?
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

    // R2からファイルを削除
    await env.R2.delete(template.file_path as string);

    // データベースから削除（CASCADE設定により関連データも削除）
    await env.DB.prepare(`
      DELETE FROM templates WHERE template_id = ? AND user_id = ?
    `).bind(templateId, user.user_id).run();

    // templates_createdを更新
    await env.DB.prepare(`
      UPDATE users SET templates_created = templates_created - 1
      WHERE user_id = ? AND templates_created > 0
    `).bind(user.user_id).run();

    const response: ApiResponse = {
      success: true,
      message: 'テンプレートを削除しました'
    };

    return c.json(response);
  } catch (error) {
    console.error('Template delete error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'テンプレートの削除に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// AI項目抽出
templates.post('/:id/extract', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const templateId = c.req.param('id');

    // Gemini APIキーを確認
    const geminiApiKey = env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'API_KEY_MISSING',
          message: 'Gemini APIキーが設定されていません'
        }
      };
      return c.json(response, 500);
    }

    // テンプレート情報を取得
    const template = await env.DB.prepare(`
      SELECT * FROM templates
      WHERE template_id = ? AND user_id = ?
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

    // R2からファイルを取得
    const file = await env.R2.get(template.file_path as string);
    if (!file) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'テンプレートファイルが見つかりません'
        }
      };
      return c.json(response, 404);
    }

    // ファイルをArrayBufferとして読み込み
    const arrayBuffer = await file.arrayBuffer();

    // Excelファイルを解析
    const analysis = await analyzeExcelFile(arrayBuffer);
    const summary = generateExcelSummary(analysis);

    // Gemini APIで項目を抽出
    const extractionResult = await extractFieldsWithGemini(summary, geminiApiKey);

    // 既存のフィールドを削除
    await env.DB.prepare(`
      DELETE FROM template_fields WHERE template_id = ?
    `).bind(templateId).run();

    // 抽出したフィールドをデータベースに保存
    for (const field of extractionResult.fields) {
      await env.DB.prepare(`
        INSERT INTO template_fields (
          template_id, field_name, field_type, data_type,
          cell_position, calculation_formula, fixed_value,
          is_required, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        templateId,
        field.field_name,
        field.field_type,
        field.data_type,
        field.cell_position,
        field.calculation_formula || null,
        field.fixed_value || null,
        field.is_required,
        field.display_order
      ).run();
    }

    const response: ApiResponse = {
      success: true,
      message: 'AI項目抽出が完了しました',
      data: {
        fields: extractionResult.fields,
        confidence: extractionResult.confidence,
        suggestions: extractionResult.suggestions,
        total_fields: extractionResult.fields.length
      }
    };

    return c.json(response);
  } catch (error: any) {
    console.error('AI extraction error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'EXTRACTION_ERROR',
        message: error.message || 'AI項目抽出に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// 項目の更新（フォーム含む/除外、項目名編集）
templates.patch('/:id/fields/:fieldId', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const templateId = c.req.param('id');
    const fieldId = c.req.param('fieldId');

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

    const body = await c.req.json();
    const { field_name, include_in_form, is_required } = body;

    // 項目を更新
    await env.DB.prepare(`
      UPDATE template_fields
      SET 
        field_name = COALESCE(?, field_name),
        include_in_form = COALESCE(?, include_in_form),
        is_required = COALESCE(?, is_required)
      WHERE field_id = ? AND template_id = ?
    `).bind(
      field_name || null,
      include_in_form !== undefined ? include_in_form : null,
      is_required !== undefined ? is_required : null,
      fieldId,
      templateId
    ).run();

    const response: ApiResponse = {
      success: true,
      message: '項目を更新しました'
    };

    return c.json(response);
  } catch (error: any) {
    console.error('Field update error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: '項目の更新に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// 複数項目の一括更新
templates.patch('/:id/fields', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const templateId = c.req.param('id');

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

    const body = await c.req.json();
    const { fields } = body;

    if (!Array.isArray(fields)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'fieldsは配列である必要があります'
        }
      };
      return c.json(response, 400);
    }

    // 各項目を更新
    for (const field of fields) {
      await env.DB.prepare(`
        UPDATE template_fields
        SET 
          field_name = COALESCE(?, field_name),
          include_in_form = COALESCE(?, include_in_form),
          is_required = COALESCE(?, is_required)
        WHERE field_id = ? AND template_id = ?
      `).bind(
        field.field_name || null,
        field.include_in_form !== undefined ? field.include_in_form : null,
        field.is_required !== undefined ? field.is_required : null,
        field.field_id,
        templateId
      ).run();
    }

    const response: ApiResponse = {
      success: true,
      message: `${fields.length}件の項目を更新しました`
    };

    return c.json(response);
  } catch (error: any) {
    console.error('Bulk field update error:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: '項目の一括更新に失敗しました'
      }
    };
    return c.json(response, 500);
  }
});

// Excelプレビュー取得（プロトタイプ）
templates.get('/:id/preview', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const templateId = c.req.param('id');

    console.log('Preview request:', { templateId, userId: user.user_id });

    // テンプレート情報を取得
    const template = await env.DB.prepare(`
      SELECT file_path, file_type FROM templates
      WHERE template_id = ? AND user_id = ?
    `).bind(templateId, user.user_id).first();

    console.log('Template found:', template);

    if (!template) {
      console.log('Template not found');
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'テンプレートが見つかりません' }
      }, 404);
    }

    // R2からExcelファイルを取得
    console.log('Fetching file from R2:', template.file_path);
    const file = await env.R2.get(template.file_path as string);
    if (!file) {
      console.log('File not found in R2');
      return c.json({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'ファイルが見つかりません' }
      }, 404);
    }

    console.log('File fetched, size:', file.size);

    // ファイルサイズが大きい場合は警告
    if (file.size > 1000000) { // 1MB以上
      console.warn('Large file detected:', file.size);
    }

    // ExcelJSでファイルを読み込み（タイムアウト対策）
    console.log('Loading Excel file...');
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    // バッファを取得
    const buffer = await file.arrayBuffer();
    console.log('Buffer size:', buffer.byteLength);
    
    // Excel読み込み（タイムアウト対策: オプションを追加）
    try {
      await Promise.race([
        workbook.xlsx.load(buffer),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Excel読み込みタイムアウト')), 8000) // 8秒でタイムアウト
        )
      ]);
    } catch (error: any) {
      if (error.message === 'Excel読み込みタイムアウト') {
        console.error('Excel loading timeout');
        return c.json({
          success: false,
          error: { 
            code: 'TIMEOUT', 
            message: 'ファイルの読み込みに時間がかかりすぎています。ファイルサイズを小さくするか、シンプルな形式で保存してください。'
          }
        }, 408);
      }
      throw error;
    }

    console.log('Workbook loaded, sheets:', workbook.worksheets.length);

    // 最初のシートを取得
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      console.log('No worksheet found');
      return c.json({
        success: false,
        error: { code: 'NO_WORKSHEET', message: 'ワークシートが見つかりません' }
      }, 400);
    }

    console.log('Processing worksheet:', worksheet.name);

    const cells: any[] = [];
    const merges: any[] = [];
    const rowHeights: any = {};
    const colWidths: any = {};

    // セル結合情報を取得
    if (worksheet.model && worksheet.model.merges) {
      worksheet.model.merges.forEach((merge: string) => {
        merges.push(merge);
      });
    }

    // 実際に使用されている範囲を取得（パフォーマンス重視: 100行×50列まで）
    const actualRows = worksheet.actualRowCount || worksheet.rowCount;
    const actualCols = worksheet.actualColumnCount || worksheet.columnCount;
    const maxRows = Math.min(actualRows, 100); // 200 → 100に削減
    const maxCols = Math.min(actualCols, 50);  // 100 → 50に削減

    console.log('Processing cells:', { actualRows, actualCols, maxRows, maxCols });

    // 列の幅を取得
    worksheet.columns.forEach((col: any, index: number) => {
      const colNumber = index + 1;
      if (colNumber <= maxCols) {
        // ExcelJSの幅は文字数単位、ピクセルに変換（約7ピクセル/文字）
        const width = col.width ? Math.round(col.width * 7) : 80;
        colWidths[colNumber] = width;
      }
    });

    // セルデータと行の高さを取得
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber > maxRows) return;
      
      // 行の高さを取得（ポイント単位→ピクセル変換: 約1.33倍）
      const height = row.height ? Math.round(row.height * 1.33) : 20;
      rowHeights[rowNumber] = height;
      
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber > maxCols) return;

        // セルのスタイル情報を取得
        const style = cell.style || {};
        const fill = style.fill;
        const font = style.font;
        const border = style.border;
        const alignment = style.alignment;

        // 背景色を取得
        let bgColor = null;
        if (fill && fill.type === 'pattern' && fill.fgColor) {
          if (fill.fgColor.argb) {
            bgColor = `#${fill.fgColor.argb.substring(2)}`;
          }
        }

        // フォント色を取得
        let fontColor = null;
        if (font && font.color && font.color.argb) {
          fontColor = `#${font.color.argb.substring(2)}`;
        }

        cells.push({
          row: rowNumber,
          col: colNumber,
          address: cell.address,
          value: cell.value,
          formula: cell.formula || null,
          type: cell.type,
          style: {
            bgColor: bgColor,
            fontColor: fontColor,
            bold: font?.bold || false,
            italic: font?.italic || false,
            fontSize: font?.size || 11,
            alignment: alignment?.horizontal || 'left',
            verticalAlignment: alignment?.vertical || 'middle',
            border: border || null
          }
        });
      });
    });

    console.log('Preview generated successfully:', { cellCount: cells.length, mergeCount: merges.length });

    return c.json({
      success: true,
      data: {
        sheetName: worksheet.name,
        rowCount: maxRows,
        colCount: maxCols,
        cells: cells,
        merges: merges,
        rowHeights: rowHeights,
        colWidths: colWidths
      }
    });

  } catch (error: any) {
    console.error('Preview error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // より詳細なエラーメッセージを返す
    let errorMessage = 'プレビューの取得に失敗しました';
    if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    
    return c.json({
      success: false,
      error: { 
        code: 'SERVER_ERROR', 
        message: errorMessage,
        details: error.message
      }
    }, 500);
  }
});

// テンプレートフィールドを追加（認証必要）
templates.post('/:id/fields', async (c) => {
  try {
    const user = c.get('user');
    const { env } = c;
    const templateId = c.req.param('id');
    const body = await c.req.json();
    const { field_name, cell_position, field_type, data_type, include_in_form, display_order } = body;

    console.log('Add field request:', { templateId, user: user.user_id, body });

    if (!field_name || !cell_position) {
      return c.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: '項目名とセル位置は必須です' }
      }, 400);
    }

    // テンプレートの所有者確認
    const template = await env.DB.prepare(
      'SELECT * FROM templates WHERE template_id = ? AND user_id = ?'
    ).bind(templateId, user.user_id).first();

    console.log('Template found:', template);

    if (!template) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'テンプレートが見つかりません' }
      }, 404);
    }

    // 既存の同じセル位置のフィールドを削除
    const deleteResult = await env.DB.prepare(
      'DELETE FROM template_fields WHERE template_id = ? AND cell_position = ?'
    ).bind(templateId, cell_position).run();
    
    console.log('Delete result:', deleteResult);

    // 新しいフィールドを追加
    const result = await env.DB.prepare(`
      INSERT INTO template_fields (
        template_id, field_name, cell_position, field_type, data_type, include_in_form, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      templateId,
      field_name,
      cell_position,
      field_type || 'input', // 'input', 'calc', 'fixed'
      data_type || 'text', // 'text', 'number', 'date'
      include_in_form !== undefined ? include_in_form : 1,
      display_order || 1
    ).run();

    console.log('Insert result:', result);

    return c.json({
      success: true,
      message: 'フィールドを追加しました',
      data: {
        field_id: result.meta.last_row_id
      }
    });
  } catch (error: any) {
    console.error('Add field error:', error);
    console.error('Error stack:', error.stack);
    return c.json({
      success: false,
      error: { code: 'SERVER_ERROR', message: `フィールドの追加に失敗しました: ${error.message}` }
    }, 500);
  }
});

export default templates;
