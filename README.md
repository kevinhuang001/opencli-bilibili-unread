# opencli-bilibili-unread

一个 [opencli](https://github.com/jackwener/opencli) 插件：一条命令拿到 B 站消息中心**各类未读数** —— 我的消息 / 回复我的 / @我的 / 收到的赞 / 系统通知。

对应 B 站消息中心左侧那排红点数字，数值与网页完全一致（用的就是网页自身调用的接口），不会再出现「只看到有新消息，但不知道是哪个分类」。

## 安装

前置条件：

- opencli `>= 2.0.0`（`npm i -g @jackwener/opencli`）
- 本机 Chrome 已登录 bilibili.com
- [OpenCLI 浏览器扩展](https://chromewebstore.google.com/detail/opencli/ildkmabpimmkaediidaifkhjpohdnifk) 已安装并连接（`opencli doctor` 全绿）

```bash
opencli plugin install github:kevinhuang001/opencli-bilibili-unread
```

## 使用

```bash
opencli bilibili unread            # 默认 JSON
opencli bilibili unread -f table   # 表格
opencli bilibili unread -f csv     # CSV
```

输出（三条命令共享同一份 3 列结构）：

| category | count | source |
|---|---|---|
| 我的消息 | 2 | `single_unread.follow_unread` |
| 回复我的 | 0 | `msgfeed.reply` |
| @我的 | 1 | `msgfeed.at` |
| 收到的赞 | 0 | `msgfeed.like` |
| 系统通知 | 0 | `msgfeed.sys_msg` |

```bash
# 只要数字，方便 shell 里判断
opencli bilibili unread -f json | jq '[.data[] | select(.count > 0)]'

# 未关注人消息已折叠的用户（消息中心里没有单独的「未关注人消息」会话）
opencli bilibili unread --unfollow-fold
```

`count > 0` 时才会额外出现两行：`群消息`（应援团等）、`疑似不良消息`（被拦截的消息），避免日常输出里塞一堆 0。

## 口径说明

| 输出行 | 含义 | 上游字段 |
|---|---|---|
| 我的消息 | 私信未读（关注的人的私信 + 未关注人的私信） | `single_unread.follow_unread`（为 0 时回退 `biz_msg_follow_unread`） |
| 回复我的 | 评论/回复我的未读 | `msgfeed.reply` |
| @我的 | @ 我的未读 | `msgfeed.at` |
| 收到的赞 | 收到的赞未读 | `msgfeed.like` |
| 系统通知 | 系统通知未读 | `msgfeed.sys_msg` |
| 群消息 | 应援团等群未读（仅 >0 时输出） | `my_group_unread.unread_count` |
| 疑似不良消息 | 被拦截消息未读（仅 >0 时输出） | `single_unread.dustbin_unread` |

`我的消息` 的算法照抄消息中心前端 `updateWhisperNotify`：优先 `follow_unread`，为 0 时用 `biz_msg_follow_unread`；默认把未关注人私信并进去（对应前端 `unfollow_fold=0`）。传 `--unfollow-fold` 则只算关注的人。

## 用到的接口

| 接口 | 提供 |
|---|---|
| `api.vc.bilibili.com/x/im/web/msgfeed/unread` | 回复我的 / @我的 / 收到的赞 / 系统通知 |
| `api.vc.bilibili.com/session_svr/v1/session_svr/single_unread` | 我的消息、疑似不良消息 |
| `api.vc.bilibili.com/session_svr/v1/session_svr/my_group_unread` | 群消息 |

命令会先导航到 `message.bilibili.com`，再在已登录的页面上下文里带 cookie 请求上述接口，不抓 DOM、不需要扫码登录。登录态失效时按 opencli 约定抛 `AuthRequiredError`。

## 卸载 / 更新

```bash
opencli plugin update bilibili-unread
opencli plugin uninstall bilibili-unread
```

## 开发

repo 根目录本身就是一个插件目录（`opencli-plugin.json` + `unread.js`），本地改动即时生效：

```bash
git clone https://github.com/kevinhuang001/opencli-bilibili-unread.git
opencli plugin install file:///<本机绝对路径>/opencli-bilibili-unread
opencli bilibili unread -v
```

## License

MIT
