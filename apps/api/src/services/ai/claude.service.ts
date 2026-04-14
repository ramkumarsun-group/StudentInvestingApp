import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';
import { db } from '../../config/db';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an AI investing coach for a student investing education platform.
Your role is to educate students (ages 13-25) about investing concepts, explain portfolio performance,
answer questions about stocks, ETFs, crypto, and bonds, and encourage learning.

Guidelines:
- Use clear, simple language appropriate for beginners
- Always clarify that this is educational only and not real financial advice
- Be encouraging and positive about learning
- Reference the student's portfolio data when relevant
- Suggest relevant learning modules when appropriate
- Never recommend specific investments or make buy/sell suggestions`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export async function chat(
  userId: string,
  sessionId: string,
  userMessage: string,
  onChunk: (chunk: string) => void,
): Promise<{ tokensUsed: number }> {
  // Load conversation history
  const { rows } = await db.query(
    'SELECT messages FROM ai_conversations WHERE user_id=$1 AND session_id=$2',
    [userId, sessionId],
  );
  const history: Message[] = rows[0]?.messages ?? [];

  // Build portfolio context
  const portRes = await db.query(
    `SELECT p.total_value, p.total_return_pct, p.virtual_cash,
       ux.current_level, l.name AS level_name, ux.total_xp
     FROM portfolios p
     JOIN user_xp ux ON ux.user_id=p.user_id
     JOIN levels l ON l.id=ux.current_level
     WHERE p.user_id=$1 AND p.is_active=true`,
    [userId],
  );
  const port = portRes.rows[0];

  const contextSuffix = port
    ? `\n\nStudent context: Level ${port.current_level} (${port.level_name}), ${port.total_xp} XP, portfolio value $${parseFloat(port.total_value).toFixed(2)} (${parseFloat(port.total_return_pct) > 0 ? '+' : ''}${parseFloat(port.total_return_pct).toFixed(2)}% return).`
    : '';

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  let fullResponse = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT + contextSuffix,
    messages,
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      fullResponse += chunk.delta.text;
      onChunk(chunk.delta.text);
    }
    if (chunk.type === 'message_delta' && chunk.usage) {
      outputTokens = chunk.usage.output_tokens;
    }
    if (chunk.type === 'message_start' && chunk.message.usage) {
      inputTokens = chunk.message.usage.input_tokens;
    }
  }

  const newHistory: Message[] = [
    ...history,
    { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
    { role: 'assistant', content: fullResponse, timestamp: new Date().toISOString() },
  ].slice(-20); // Keep last 20 messages

  const totalTokens = inputTokens + outputTokens;

  await db.query(
    `INSERT INTO ai_conversations(user_id, session_id, messages, context_type, tokens_used)
     VALUES($1,$2,$3,'general',$4)
     ON CONFLICT(user_id, session_id) DO UPDATE
     SET messages=$3, tokens_used=ai_conversations.tokens_used+$4, updated_at=NOW()`,
    [userId, sessionId, JSON.stringify(newHistory), totalTokens],
  ).catch(() => {
    // If UNIQUE constraint not set, just do INSERT
    return db.query(
      `INSERT INTO ai_conversations(user_id, session_id, messages, context_type, tokens_used)
       VALUES($1,$2,$3,'general',$4)`,
      [userId, sessionId, JSON.stringify(newHistory), totalTokens],
    );
  });

  return { tokensUsed: totalTokens };
}

export async function analyzePortfolio(userId: string): Promise<string> {
  const holdingsRes = await db.query(
    `SELECT symbol, asset_type, quantity, avg_cost_basis, market_value, unrealized_pnl_pct
     FROM holdings h
     JOIN portfolios p ON p.id=h.portfolio_id
     WHERE p.user_id=$1 AND p.is_active=true`,
    [userId],
  );

  const portRes = await db.query(
    `SELECT total_value, total_return_pct, virtual_cash FROM portfolios WHERE user_id=$1 AND is_active=true`,
    [userId],
  );

  const holdings = holdingsRes.rows;
  const port = portRes.rows[0];
  if (!port) return 'No portfolio data available.';

  const holdingsSummary = holdings.length > 0
    ? holdings.map((h) =>
        `${h.symbol} (${h.asset_type}): ${h.quantity} shares @ $${h.avg_cost_basis}, P&L: ${h.unrealized_pnl_pct}%`
      ).join('\n')
    : 'No holdings yet — all cash.';

  const prompt = `Analyze this student's investment portfolio and provide educational feedback:\n\nPortfolio Value: $${parseFloat(port.total_value).toFixed(2)}\nTotal Return: ${parseFloat(port.total_return_pct).toFixed(2)}%\nCash: $${parseFloat(port.virtual_cash).toFixed(2)}\n\nHoldings:\n${holdingsSummary}\n\nProvide constructive feedback on diversification, risk, and what concepts they might want to learn next. Keep it educational and encouraging.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  return (message.content[0] as { text: string }).text;
}
