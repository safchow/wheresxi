/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttleApi, throttleAuth, throttleSignup } from '#start/limiter'

const AuthController = () => import('#controllers/auth_controller')
const LeaderboardController = () =>
  import('#controllers/leaderboard_controller')
const MarketController = () => import('#controllers/market_controller')
const BetsController = () => import('#controllers/bets_controller')
const StatsController = () => import('#controllers/stats_controller')
const AdminMarketsController = () =>
  import('#controllers/admin/markets_controller')
const AdminInvitesController = () =>
  import('#controllers/admin/invites_controller')
const AdminAuditController = () =>
  import('#controllers/admin/audit_controller')

router.get('/', async () => ({ name: 'wheresxi-api', ok: true }))
router.get('/health', async () => ({
  status: 'ok',
  time: new Date().toISOString(),
}))

router
  .group(() => {
    // ─── Auth (public) ────────────────────────────────────────────────
    router.post('/auth/signup', [AuthController, 'signup']).use([throttleSignup])
    router.post('/auth/login', [AuthController, 'login']).use([throttleAuth])

    // ─── Authenticated ────────────────────────────────────────────────
    router
      .group(() => {
        router.get('/auth/me', [AuthController, 'me'])
        router.post('/auth/logout', [AuthController, 'logout'])

        router.get('/market/week', [MarketController, 'week'])
        router.get('/market/:id/exact-minute', [
          MarketController,
          'exactMinute',
        ])

        router.get('/leaderboard', [LeaderboardController, 'index'])
        router.get('/stats/taylor', [StatsController, 'taylor'])

        router.post('/bets', [BetsController, 'store'])
        router.get('/bets/me', [BetsController, 'mine'])
        router.delete('/bets/:id', [BetsController, 'cancel'])
        router.post('/bankruptcy', [BetsController, 'bankruptcy'])

        // ─── Admin ────────────────────────────────────────────────
        router
          .group(() => {
            router.get('/admin/markets', [AdminMarketsController, 'index'])
            router.get('/admin/markets/:id/bets', [
              AdminMarketsController,
              'bets',
            ])
            router.post('/admin/markets/resolve', [
              AdminMarketsController,
              'resolve',
            ])
            router.post('/admin/markets/refund', [
              AdminMarketsController,
              'refund',
            ])

            router.get('/admin/invites', [AdminInvitesController, 'index'])
            router.post('/admin/invites', [AdminInvitesController, 'store'])
            router.delete('/admin/invites/:id', [
              AdminInvitesController,
              'destroy',
            ])

            router.get('/admin/audit', [AdminAuditController, 'index'])
          })
          .use(middleware.role({ role: 'ADMIN' }))
      })
      .use([middleware.auth(), throttleApi])
  })
  .prefix('/api')
