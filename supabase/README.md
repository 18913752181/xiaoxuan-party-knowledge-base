# Supabase SQL 管理

本目录用于保存所有需要在 Supabase SQL Editor 中执行的数据库变更脚本。

## SQL 文件说明

- `schema.sql`：早期完整演示数据库脚本，包含 profiles、materials、favorites、downloads 等旧结构。当前资料内容已改为本地 `content/` 文件夹读取，不建议继续用它作为新增功能的唯一依据。
- `favorites.sql`：早期收藏表脚本，保留用于历史参考。
- `002_favorites.sql`：当前收藏功能使用的收藏表脚本。收藏只保存本地文章的 `article_slug`、标题和分类，不把文章正文迁移到 Supabase。
- `007_wechat_binding.sql`：微信登录/绑定支持。为 `profiles` 增加 `wechat_openid` 字段（部分唯一索引），用于微信一键登录与邮箱账号绑定微信。
- `008_work_cat.sql`：Dimmo「工作小猫」服务号消息、对话、专业问题转人工与提醒留言表。
- `014_dimmo_expressions.sql`：Dimmo 成年与煤球双形态表情库，包含首批 25 个状态、公开读取策略和后台图片存储桶。
- `017_education_base_guides.sql`：为教育基地增加讲解服务、费用、公开来源和核验日期字段，并导入首批已核实资料；未查到的信息保持为空。
- `018_education_base_images.sql`：为教育基地增加后台配图、来源与权利状态字段，并建立私有图片存储桶；小程序通过网站同域图片接口读取。
- `019_education_base_member_guides.sql`：增加开放预约、活动形式、人群、路线、周边组合、活动方案和相关资料等会员基地攻略字段；无可靠信息时保持为空。

## 如何执行 SQL

新年卡规则使用 `048_annual_material_downloads.sql`，必须在 045、046、047 后执行，且在发布对应网站版本之前完成。请勿重新执行旧迁移来覆盖 048 中的函数。

048 首次执行时固定已购买会员名单：原免积分会员标记为 `legacy_free`，其他已购会员标记为 `legacy_points`；历史订单、积分余额、解锁记录和原发放规则不改动，续费继续保留。新用户默认 `annual_daily`，只有有效年卡可单份/批量下载，每个北京时间自然日最多10个不同文件。当天重复下载不重复占名额，跨天重下载占当天名额；首次解锁按后台资料积分价格扣分，以后不再扣分。

新年卡开通或续费的成功订单一次性增加10长期积分；从开通当天起每天再赠送5当天有效积分。每日积分由独立 `material_daily_point_wallets` 保存，优先消费，过期钱包保留审计记录但不再计入可用余额；不清空长期积分。`point_transactions` 为每次赠送和解锁保留唯一业务键。`material_daily_downloads` 用用户、北京时间日期、资料 slug 作为唯一键，单份和批量共用同一数据库锁与事务，不足时整批不扣分、不占名额。

`annual_material_memberships` 按年卡支付订单保存下载有效期；月/季卡不会延长年卡专属下载周期，退款年卡不再参与权益核验。年卡升级立即生效，会员总有效期仍按原支付规则累计顺延。网页余额显示长期积分与当天剩余积分之和。后台任务每分钟核验每日赠送，账户读取和下载时也会幂等补发当天赠送，均不补发已过期的每日额度。旧会员原有年度积分补发逻辑保持不变。

验证命令：`node scripts/test-annual-material-downloads.cjs <已安装的 @electric-sql/pglite 模块路径>`，在独立内存 PostgreSQL 中测试，不向生产写入测试会员或订单。

积分规则启用前必须依次执行 `045_membership_points.sql`、`046_material_point_unlocks.sql`、`047_legacy_membership_benefits.sql`，完成后再切换网站版本。047 首次执行的事务时间为规则切换时间：当时仍有效的付费会员只初始化一次 `profiles.legacy_material_benefits` 标记，续费保留原权益，会员到期时原权限失效。新增会员默认使用积分制。`membership_rule_cutovers` 保存切换记录，重跑 047 不扩大存量名单。

047 在数据库扣减函数内统一豁免有效的原权益会员，单份和批量下载均不扣积分；续费不新增积分发放周期。旧会员已有积分余额、积分流水和订单保持不变。浏览器无权修改原权益标记。请勿在 047 后重新执行旧版 045/046，以免覆盖最新兼容逻辑。

1. 打开 Supabase 项目后台。
2. 进入 `SQL Editor`。
3. 打开本目录中的目标 SQL 文件。
4. 复制文件全部内容到 SQL Editor。
5. 点击 `Run` 执行。

## 新增数据库表规范

新增数据库表或修改数据库结构时，必须在 `supabase/` 文件夹中新建编号 SQL 文件，例如：

- `001_profiles.sql`
- `002_favorites.sql`
- `003_downloads.sql`

不允许只口头提示“执行某某 SQL”。必须确保对应 SQL 文件真实存在，并在 README 中说明用途。
