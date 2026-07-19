# 宣知网站腾讯云生产部署手册

目标架构：腾讯云 Ubuntu 24.04 + Docker Compose + 宿主机 Nginx + Let's Encrypt，域名为 `xiaoxuanvip.com`。

## 1. 架构与目录

```text
公网 80/443
    ↓
宿主机 Nginx（TLS、限流、后台 Basic Auth）
    ↓ 127.0.0.1:3000
Docker Compose / Next.js Node 20 容器
    ↓
/srv/xiaoxuan/shared/content  # 正文和上传文件，持久化
/srv/xiaoxuan/shared/data     # 专题配置，持久化
Supabase                      # 登录、收藏等用户数据
```

服务器目录：

```text
/srv/xiaoxuan/app       Git 仓库
/srv/xiaoxuan/shared    生产环境变量和持久化内容
/srv/xiaoxuan/backups   本地备份
```

代码部署不会覆盖 `shared`。容器第一次启动时会把仓库内的初始 `content/`、`data/` 复制进去；此后后台上传和修改都保留在持久化目录。

## 2. 腾讯云和域名准备

1. 购买 Ubuntu 24.04 云服务器，建议至少 2 核 4 GB、60 GB SSD。
2. 腾讯云安全组仅开放：
   - TCP 22：最好只允许管理员固定 IP；
   - TCP 80：所有来源；
   - TCP 443：所有来源；
   - 不开放 3000。
3. DNS 添加：

```text
@    A    服务器公网 IP
www  A    服务器公网 IP
```

4. 使用中国内地服务器时，先完成公司主体 ICP 备案。证书签发前，确认 80/443 已开放且 DNS 已生效。

## 3. 初始化 Ubuntu

使用有 sudo 权限的初始账户登录：

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git nginx apache2-utils ufw

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo mkdir -p /srv/xiaoxuan/{app,shared/content,shared/data,backups}
sudo chown -R deploy:deploy /srv/xiaoxuan
```

启用主机防火墙：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

退出 SSH 后重新登录，使 `docker` 用户组生效。

## 4. GitHub 仓库与服务器拉取密钥

当前本地项目尚未配置 Git remote。先在 GitHub 创建私有仓库，然后在本机执行：

```powershell
cd C:\Users\17433\Desktop\xiaoxuan-party-knowledge-base
git remote add origin git@github.com:你的GitHub账号/你的仓库名.git
git push -u origin master
```

在服务器用 `deploy` 用户生成“服务器读取 GitHub”专用密钥：

```bash
sudo -iu deploy
ssh-keygen -t ed25519 -f ~/.ssh/github_readonly -C xiaoxuan-server -N ''
cat ~/.ssh/github_readonly.pub
```

把公钥添加到 GitHub 仓库 `Settings → Deploy keys`，只授予读取权限。服务器写入：

```bash
cat > ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_readonly
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
ssh-keyscan github.com >> ~/.ssh/known_hosts
chmod 600 ~/.ssh/known_hosts
git clone git@github.com:你的GitHub账号/你的仓库名.git /srv/xiaoxuan/app
```

## 5. 生产环境变量

```bash
cp /srv/xiaoxuan/app/deploy/app.env.example /srv/xiaoxuan/shared/app.env
nano /srv/xiaoxuan/shared/app.env
```

填写真实 Supabase 参数，并把 UID/GID 改成部署用户的值：

```bash
id -u
id -g
chmod 600 /srv/xiaoxuan/shared/app.env
```

注意：`NEXT_PUBLIC_*` 会在 Docker 构建期写入浏览器代码，所以变更后必须重新执行部署脚本。

在 Supabase Authentication URL Configuration 中设置：

```text
Site URL: https://xiaoxuanvip.com
Redirect URLs:
https://xiaoxuanvip.com/auth/callback
https://xiaoxuanvip.com/reset-password
```

## 6. 第一次启动

```bash
sudo -iu deploy
cd /srv/xiaoxuan/app
bash deploy/deploy.sh
curl http://127.0.0.1:3000/api/health
docker compose --env-file /srv/xiaoxuan/shared/app.env ps
```

健康接口应返回：

```json
{"status":"ok","service":"xiaoxuan-party-knowledge-base"}
```

## 7. Nginx、后台保护和 HTTPS

创建后台访问密码：

```bash
sudo htpasswd -c /etc/nginx/.htpasswd-xiaoxuan admin
```

先启用 HTTP 配置：

```bash
sudo cp /srv/xiaoxuan/app/deploy/nginx/xiaoxuanvip-http.conf /etc/nginx/sites-available/xiaoxuanvip.com
sudo ln -sfn /etc/nginx/sites-available/xiaoxuanvip.com /etc/nginx/sites-enabled/xiaoxuanvip.com
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

确认 `http://xiaoxuanvip.com` 可访问后安装 Certbot：

```bash
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sfn /snap/bin/certbot /usr/local/bin/certbot
sudo certbot certonly --nginx -d xiaoxuanvip.com -d www.xiaoxuanvip.com
```

切换完整 HTTPS 配置：

```bash
sudo cp /srv/xiaoxuan/app/deploy/nginx/xiaoxuanvip-https.conf /etc/nginx/sites-available/xiaoxuanvip.com
sudo nginx -t && sudo systemctl reload nginx
sudo certbot renew --dry-run
```

访问：

```text
https://xiaoxuanvip.com
https://xiaoxuanvip.com/admin
```

`/admin` 和 `/api/admin` 会先要求输入 Nginx 管理密码。

## 8. GitHub Actions 自动发布

这是第二把 SSH 密钥，方向是“GitHub Actions 登录服务器”，不要与 GitHub Deploy Key 混用。

在可信的管理员电脑生成：

```bash
ssh-keygen -t ed25519 -f xiaoxuan_actions -C github-actions -N ''
```

将 `xiaoxuan_actions.pub` 追加到服务器：

```bash
sudo -iu deploy
cat >> ~/.ssh/authorized_keys
# 粘贴公钥，按 Ctrl-D
chmod 600 ~/.ssh/authorized_keys
```

在 GitHub 仓库创建 `production` Environment，并添加 Secrets：

```text
DEPLOY_HOST        腾讯云公网 IP
DEPLOY_PORT        22
DEPLOY_USER        deploy
DEPLOY_SSH_KEY     xiaoxuan_actions 私钥全文
DEPLOY_KNOWN_HOSTS ssh-keyscan -H 服务器公网IP 的可信输出
```

之后每次推送 `master`：

```bash
git add .
git commit -m "update site"
git push origin master
```

GitHub Actions 将自动执行：拉取代码 → Docker 构建 → 启动新容器 → 健康检查。健康检查失败时，`deploy/deploy.sh` 会恢复上一个镜像。

## 9. 自动备份

安装每日 03:20 备份任务：

```bash
sudo crontab -e
```

加入：

```cron
20 3 * * * /bin/bash /srv/xiaoxuan/app/deploy/backup.sh >> /var/log/xiaoxuan-backup.log 2>&1
```

默认保留 14 天。建议再用腾讯云 COSCMD 或对象存储生命周期规则，把 `/srv/xiaoxuan/backups` 异地同步到私有 COS Bucket。

## 10. 运维命令

```bash
cd /srv/xiaoxuan/app
docker compose --env-file /srv/xiaoxuan/shared/app.env ps
docker compose --env-file /srv/xiaoxuan/shared/app.env logs -f --tail=200 web
curl -fsS http://127.0.0.1:3000/api/health
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
bash deploy/backup.sh
```

手动发布：

```bash
cd /srv/xiaoxuan/app
git fetch origin master
git reset --hard origin/master
bash deploy/deploy.sh
```

恢复最近备份前，应先停止容器并额外备份当前数据：

```bash
docker compose --env-file /srv/xiaoxuan/shared/app.env stop web
tar -xzf /srv/xiaoxuan/backups/备份文件.tar.gz -C /srv/xiaoxuan/shared
docker compose --env-file /srv/xiaoxuan/shared/app.env up -d web
```
