import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole, requirePro } from '../middleware/role.middleware';

// Controllers
import * as auth from '../controllers/auth.controller';
import * as portfolio from '../controllers/portfolio.controller';
import * as trade from '../controllers/trade.controller';
import * as market from '../controllers/market.controller';
import * as learn from '../controllers/learn.controller';
import * as gamification from '../controllers/gamification.controller';
import * as leaderboard from '../controllers/leaderboard.controller';
import * as teacher from '../controllers/teacher.controller';
import * as challenge from '../controllers/challenge.controller';
import * as ai from '../controllers/ai.controller';
import * as subscription from '../controllers/subscription.controller';
import * as analytics from '../controllers/analytics.controller';

const router = Router();

// ─── Analytics (first-party, no auth) ────────────────────────────────────────
router.post('/analytics/event', analytics.trackEvent);

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.post('/auth/refresh', auth.refreshTokens);
router.post('/auth/logout', authMiddleware, auth.logout);
router.get('/auth/me', authMiddleware, auth.getMe);
router.post('/auth/oauth/callback', auth.oauthCallback);

// ─── Portfolio ────────────────────────────────────────────────────────────────
router.get('/portfolio', authMiddleware, portfolio.getPortfolio);
router.get('/portfolio/holdings', authMiddleware, portfolio.getHoldings);
router.get('/portfolio/history', authMiddleware, portfolio.getPortfolioHistory);
router.post('/portfolio/reset', authMiddleware, portfolio.resetPortfolio);

// ─── Market ───────────────────────────────────────────────────────────────────
router.get('/market/quote/:symbol', authMiddleware, market.getQuote);
router.get('/market/chart/:symbol', authMiddleware, market.getChart);
router.get('/market/search', authMiddleware, market.searchTickers);
router.get('/market/news', authMiddleware, market.getNews);
router.get('/market/trending', authMiddleware, market.getTrending);

// ─── Trading ──────────────────────────────────────────────────────────────────
router.post('/trade/order', authMiddleware, trade.createOrder);
router.get('/trade/orders', authMiddleware, trade.getOrders);
router.delete('/trade/orders/:orderId', authMiddleware, trade.cancelOrder);

// ─── Learning ─────────────────────────────────────────────────────────────────
router.get('/learn/modules', authMiddleware, learn.getModules);
router.get('/learn/modules/:slug', authMiddleware, learn.getModule);
router.get('/learn/lessons/:lessonId', authMiddleware, learn.getLesson);
router.post('/learn/lessons/:lessonId/start', authMiddleware, learn.startLesson);
router.post('/learn/lessons/:lessonId/complete', authMiddleware, learn.completeLesson);
router.post('/learn/quizzes/:quizId/submit', authMiddleware, learn.submitQuiz);
router.get('/learn/progress', authMiddleware, learn.getProgress);

// ─── Gamification ─────────────────────────────────────────────────────────────
router.get('/gamification/xp', authMiddleware, gamification.getXp);
router.get('/gamification/badges', authMiddleware, gamification.getBadges);
router.get('/gamification/streak', authMiddleware, gamification.getStreak);
router.post('/gamification/activity', authMiddleware, gamification.recordActivityEndpoint);
router.get('/gamification/xp-log', authMiddleware, gamification.getXpLog);

// ─── Leaderboard ──────────────────────────────────────────────────────────────
router.get('/leaderboard/global', leaderboard.getGlobalLeaderboard);
router.get('/leaderboard/global/me', authMiddleware, leaderboard.getMyRank);

// ─── Teacher (Phase 2) ────────────────────────────────────────────────────────
router.post('/teacher/classes', authMiddleware, requireRole('teacher', 'admin'), teacher.createClass);
router.get('/teacher/classes', authMiddleware, requireRole('teacher', 'admin'), teacher.getTeacherClasses);
router.get('/teacher/classes/:classId', authMiddleware, requireRole('teacher', 'admin'), teacher.getClassDetail);
router.get('/teacher/classes/:classId/progress', authMiddleware, requireRole('teacher', 'admin'), teacher.getClassProgress);
router.post('/teacher/classes/:classId/challenges', authMiddleware, requireRole('teacher', 'admin'), challenge.createChallenge);

// ─── Student Classes (Phase 2) ────────────────────────────────────────────────
router.post('/classes/join', authMiddleware, teacher.joinClass);
router.get('/classes/my', authMiddleware, teacher.getMyClasses);

// ─── Challenges (Phase 2) ────────────────────────────────────────────────────
router.get('/challenges', authMiddleware, challenge.getChallenges);
router.post('/challenges/:id/join', authMiddleware, challenge.joinChallenge);
router.get('/challenges/:id', authMiddleware, challenge.getChallengeDetail);

// ─── AI Coach (Phase 3) ───────────────────────────────────────────────────────
router.post('/ai/chat', authMiddleware, requirePro, ai.sendMessage);
router.get('/ai/conversations', authMiddleware, requirePro, ai.getConversations);
router.get('/ai/conversations/:sessionId', authMiddleware, requirePro, ai.getConversation);
router.post('/ai/portfolio-review', authMiddleware, requirePro, ai.portfolioReview);

// ─── Subscriptions (Phase 3) ──────────────────────────────────────────────────
router.post('/subscriptions/checkout', authMiddleware, subscription.createCheckout);
router.post('/subscriptions/portal', authMiddleware, subscription.createPortalSession);
router.get('/subscriptions/status', authMiddleware, subscription.getStatus);
// Webhook has no JWT — raw body required, handled at app level
router.post('/subscriptions/webhook', subscription.handleWebhook);

export default router;
