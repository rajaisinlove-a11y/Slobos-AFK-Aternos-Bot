# Minecraft Java Edition AFK Bot

A Mineflayer bot for **Minecraft Java Edition** servers running in offline mode. It is deploy-friendly for Render, Railway, VPS, or local Node.js. It includes auto-reconnect, anti-AFK movement, periodic chat, optional `/login` and `/register`, a health endpoint, dashboard, and logs.

> **Personal deployment note:** this repo is pre-configured for `lollorabaz.play.hosting:25603` (bot name `SlobosAFK`, version `26.1` via ViaBackwards). It runs with zero configuration — just `npm install && npm start`, or deploy on Render where `render.yaml` sets everything automatically. Environment variables still override any default.

## Important
This is a **Java Edition client**. Mineflayer speaks the Java protocol. It does not connect directly as a Bedrock client. A Bedrock player can join a Java server through Geyser, but this bot itself is Java.

## Deploy
Use Node 18+ and set the environment variables from `.env.example`. The start command is:

```bash
npm install
npm start
```

For Render/Railway, use a Web Service and set the build command to `npm install` and start command to `npm start`. The app listens on the platform-provided `PORT` and binds to `0.0.0.0`.

Required variables:
- `MC_HOST`: Java server hostname
- `MC_PORT`: Java server port, normally `25565`
- `MC_USERNAME`: offline-mode bot username
- `MC_AUTH=offline`

Optional:
- `MC_VERSION`: leave empty for auto-detection
- `ANTI_AFK=true`
- `CHAT_MESSAGES`: messages separated by `|`
- `AUTO_AUTH=true`, `AUTO_AUTH_PASSWORD=...`
- `COMBAT=true` to attack nearby mobs (use carefully; leave false by default)
- `DASHBOARD_TOKEN`: a long random string that protects the control endpoints

## SOCKS5 proxy support

Some server hosts (including `play.hosting`) may refuse connections from
datacenter IP ranges, which prevents cloud deployments like Render from
connecting directly. The bot can route its Minecraft connection through a
SOCKS5 proxy — typically a residential/ISP-tier proxy whose IP the server
accepts. Set these variables (all optional; leave `PROXY_HOST` empty to
connect directly):

- `PROXY_HOST`: SOCKS proxy hostname/IP (empty = no proxy)
- `PROXY_PORT`: proxy port (default `1080`)
- `PROXY_TYPE`: SOCKS version, `5` or `4` (default `5`)
- `PROXY_USERNAME`: proxy auth username (optional)
- `PROXY_PASSWORD`: proxy auth password (optional)

Set the credentials only as deployment environment variables — never commit
them. Proxy credentials are never written to the logs. See
[PROXY-SETUP.md](PROXY-SETUP.md) for a full guide: why the proxy is needed,
provider comparison, a Webshare walkthrough, Render configuration,
troubleshooting, and a complete environment-variable reference.

## Endpoints
- `GET /` — dashboard (public, shows status only)
- `GET /health` — JSON status for hosting health checks (public, no sensitive data)
- `GET /logs` — recent logs (requires token)
- `GET /stop` — stop the bot (requires token)
- `GET /start` — start the bot after a stop (requires token)

The protected endpoints require the header `Authorization: Bearer <DASHBOARD_TOKEN>`:

```bash
curl -H "Authorization: Bearer $DASHBOARD_TOKEN" https://your-deployment-url/logs
```

If `DASHBOARD_TOKEN` is not set, `/start`, `/stop`, and `/logs` are disabled (they return `503`) so they can never be used anonymously.

Do not put passwords or webhook URLs in Git. Use environment variables. Only use this on servers where you have permission; it does not bypass Aternos queues or server policies.
