import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { chat, analyzePortfolio } from '../services/ai/claude.service';
import { db } from '../config/db';

export async function sendMessage(req: Request, res: Response) {
  const { message, sessionId } = req.body;
  const userId = req.user!.userId;
  const sid = sessionId || uuidv4();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    await chat(userId, sid, message, (chunk) => {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ done: true, sessionId: sid })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: 'AI service error' })}\n\n`);
  }
  res.end();
}

export async function portfolioReview(req: Request, res: Response) {
  const analysis = await analyzePortfolio(req.user!.userId);
  return res.json({ data: { analysis } });
}

export async function getConversations(req: Request, res: Response) {
  const { rows } = await db.query(
    `SELECT session_id, context_type, tokens_used, created_at, updated_at,
       (messages->-1->>'content')::text AS last_message
     FROM ai_conversations WHERE user_id=$1
     ORDER BY updated_at DESC LIMIT 20`,
    [req.user!.userId],
  );
  return res.json({ data: rows });
}

export async function getConversation(req: Request, res: Response) {
  const { sessionId } = req.params;
  const { rows } = await db.query(
    'SELECT * FROM ai_conversations WHERE user_id=$1 AND session_id=$2',
    [req.user!.userId, sessionId],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Conversation not found' });
  return res.json({ data: rows[0] });
}
