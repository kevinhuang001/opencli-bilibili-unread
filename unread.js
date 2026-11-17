/**
 * bilibili/unread — 消息中心各类未读数。
 *
 * opencli 插件版：https://github.com/kevinhuang001/opencli-bilibili-unread
 *
 * 与 message.bilibili.com 前端用的是同一组接口：
 *   /x/im/web/msgfeed/unread                    → 回复我的 / @我的 / 收到的赞 / 系统通知
 *   /session_svr/v1/session_svr/single_unread   → 我的消息（私信）、疑似不良消息
 *   /session_svr/v1/session_svr/my_group_unread → 群消息（应援团等）
 *
 * 私信口径对齐前端 updateWhisperNotify：有普通私信时以 follow_unread 为准，
 * 为 0 时回退 biz_msg_follow_unread；默认把未关注人私信并入「我的消息」，
 * 与前端 unfollow_fold=0 时的角标一致（已折叠的用户传 --unfollow-fold 即可）。
 */
import { cli, Strategy } from '@jackwener/opencli/registry';
import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';

const VC_API = 'https://api.vc.bilibili.com';

async function getJson(page, url) {
    const urlJs = JSON.stringify(url);
    return page.evaluate(`
    async () => {
      const res = await fetch(${urlJs}, { credentials: "include" });
      const text = await res.text();
      try {
        return JSON.parse(text);
      }
      catch {
        return { code: -1, message: "Non-JSON response (HTTP " + res.status + ")" };
      }
    }
  `);
}

function toCount(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

function requireOk(payload, label) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Object.hasOwn(payload, 'code')) {
        throw new CommandExecutionError(`Bilibili ${label} 接口返回了异常数据`);
    }
    if (payload.code !== 0) {
        const message = payload.message ?? 'unknown error';
        if (payload.code === -101 || payload.code === -400 || /登录|未登录|login/i.test(String(message))) {
            throw new AuthRequiredError('bilibili.com', `Bilibili ${label} 需要登录态：${message} (${payload.code})`);
        }
        throw new CommandExecutionError(`Bilibili ${label} 接口失败：${message} (${payload.code})`);
    }
    return payload.data ?? {};
}

cli({
    site: 'bilibili',
    name: 'unread',
    access: 'read',
    description: '获取消息中心各类未读数（我的消息 / 回复我的 / @我的 / 收到的赞 / 系统通知）',
    domain: 'message.bilibili.com',
    strategy: Strategy.COOKIE,
    args: [
        {
            name: 'unfollow-fold',
            type: 'boolean',
            required: false,
            help: '「未关注人消息」已折叠时传 true：此时其未读数不再并入「我的消息」',
        },
    ],
    columns: ['category', 'count', 'source'],
    func: async (page, kwargs) => {
        if (!page) {
            throw new CommandExecutionError('bilibili unread 需要浏览器会话');
        }

        const feed = requireOk(
            await getJson(page, `${VC_API}/x/im/web/msgfeed/unread?build=0&mobi_app=web`),
            'msgfeed/unread',
        );
        const single = requireOk(
            await getJson(page, `${VC_API}/session_svr/v1/session_svr/single_unread?unread_type=0&show_dustbin=1&build=0&mobi_app=web`),
            'single_unread',
        );

        const folded = kwargs['unfollow-fold'] === true;
        let follow = toCount(single.follow_unread);
        let biz = toCount(single.biz_msg_follow_unread);
        if (!folded) {
            follow += toCount(single.unfollow_unread);
            biz += toCount(single.biz_msg_unfollow_unread);
        }
        const whisper = follow > 0 ? follow : biz;

        let group = 0;
        try {
            const payload = await getJson(page, `${VC_API}/session_svr/v1/session_svr/my_group_unread?build=0&mobi_app=web`);
            if (payload?.code === 0) {
                group = toCount(payload.data?.unread_count);
            }
        }
        catch {
            group = 0;
        }
        const dustbin = toCount(single.dustbin_unread);

        const rows = [
            { category: '我的消息', count: whisper, source: 'single_unread.follow_unread' },
            { category: '回复我的', count: toCount(feed.reply), source: 'msgfeed.reply' },
            { category: '@我的', count: toCount(feed.at), source: 'msgfeed.at' },
            { category: '收到的赞', count: toCount(feed.like), source: 'msgfeed.like' },
            { category: '系统通知', count: toCount(feed.sys_msg), source: 'msgfeed.sys_msg' },
        ];
        if (group > 0) {
            rows.push({ category: '群消息', count: group, source: 'my_group_unread.unread_count' });
        }
        if (dustbin > 0) {
            rows.push({ category: '疑似不良消息', count: dustbin, source: 'single_unread.dustbin_unread' });
        }
        return rows;
    },
});
