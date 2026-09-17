# SOCKS5 Proxy Setup

This bot supports connecting to the Minecraft server through a SOCKS5 proxy.
This guide explains why that exists, how to pick a provider, and how to
configure it on Render or locally.

## Why the proxy is required

Some Minecraft server hosts filter incoming connections by the reputation of
the source IP address. In this project's case, the target server
(`lollorabaz.play.hosting:25603`) was observed to refuse connections that
originate from datacenter IP ranges — which includes Render, AWS, most cloud
sandboxes, and many status-checking services. When that happens the bot's TCP
connection is dropped or reset before the Minecraft handshake completes, even
though the same server accepts connections from a home (residential) internet
connection.

This is **not** a claim that every server or every hosting provider blocks
datacenter IPs — many don't. But when it happens, the only practical fix from
a cloud deployment is to make the connection appear to come from a different,
acceptable source IP. A **residential or ISP-tier SOCKS5 proxy** does exactly
that: the bot connects to the proxy, and the proxy connects to the Minecraft
server from its own IP.

If `PROXY_HOST` is left empty, the bot connects directly, exactly as before.

## Provider comparison

> **Important:** provider plans, quotas, protocols, and pricing change
> frequently. The examples below are planning references only — **verify each
> provider's current terms and SOCKS5 availability before relying on them.**

| Provider   | Type                                   | Example allowance/plan information                          | Notes                                                                                     |
| ---------- | -------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Webshare   | Datacenter                             | Free plan: 10 proxies / 1 GB                                | Easy to set up, but datacenter proxy IPs may be blocked for the same reason your cloud host's IP is — it may not solve an IP-reputation problem |
| StarVPN    | Residential                            | Guest mode: 100 GB                                          | Residential IPs are more likely to be accepted; verify current limits and SOCKS5 support before use |
| Windscribe | ISP-tier / residential-style options   | 10 GB plan                                                  | Availability of SOCKS-capable residential/ISP endpoints varies by plan and region          |

**Do not use random public proxy lists.** Public "free proxy" IPs are
unreliable, frequently malicious (they can read and tamper with your
traffic), and usually already blacklisted. Only use a proxy from a provider
you have an account with.

## Webshare walkthrough (example)

Webshare is the quickest way to get a working SOCKS5 endpoint for testing,
even though its datacenter IPs may not get past an IP-reputation block:

1. Create an account at webshare.io and open the dashboard.
2. Go to **Proxy → List**. Each proxy row shows an **address** (host or IP)
   and a **port**.
3. Set the connection method/protocol to **SOCKS5** (Webshare proxies
   support both HTTP and SOCKS5 on documented ports — check the proxy list
   page for the SOCKS5 port).
4. Go to **Proxy → Settings** (or the credentials section) to find your
   **proxy username** and **proxy password**. These are proxy-specific
   credentials, not your Webshare login.
5. You now have the four values you need:

   ```text
   host      -> the proxy address from the list
   port      -> the SOCKS5 port for that proxy
   username  -> your proxy username
   password  -> your proxy password
   ```

Never commit these values to Git. They belong only in environment variables.

## Render environment variables

In the Render dashboard, open your service → **Environment** and add:

| Variable         | Default | Purpose                       |
| ---------------- | ------: | ----------------------------- |
| `PROXY_HOST`     |   empty | SOCKS proxy hostname/IP. Empty = no proxy (direct connection) |
| `PROXY_PORT`     |  `1080` | SOCKS proxy port              |
| `PROXY_TYPE`     |     `5` | SOCKS protocol version (`5` or `4`) |
| `PROXY_USERNAME` |   empty | Proxy authentication username (leave empty if the proxy needs no auth) |
| `PROXY_PASSWORD` |   empty | Proxy authentication password (leave empty if the proxy needs no auth) |

The application defaults and `.env.example` intentionally leave proxy
credentials empty. Add real values only in the Render environment — never
commit them. `render.yaml` does not contain proxy credentials.

## Local environment example

Windows CMD:

```cmd
set PROXY_HOST=proxy.example.com
set PROXY_PORT=1080
set PROXY_TYPE=5
set PROXY_USERNAME=your_username
set PROXY_PASSWORD=your_password
npm start
```

Linux/macOS (bash/zsh):

```bash
PROXY_HOST=proxy.example.com \
PROXY_PORT=1080 \
PROXY_TYPE=5 \
PROXY_USERNAME=your_username \
PROXY_PASSWORD=your_password \
npm start
```

Use your real proxy values in place of the placeholders. The examples above
are placeholders, never real credentials.

## Expected logs

Without a proxy (direct connection):

```text
Connecting to Java server lollorabaz.play.hosting:25603 (version 26.1)
```

With a proxy configured:

```text
Connecting to Java server lollorabaz.play.hosting:25603 (version 26.1) via SOCKS5 proxy proxy.example.com:1080
```

The log line shows only the proxy **host and port**. The proxy username and
password are never written to the logs or to the `/logs` endpoint.

## Failure modes

These are diagnostic interpretations — likely causes, not absolute
guarantees. Network failures can have multiple explanations.

| Error                                | Meaning                                             | Fix                                                    |
| ------------------------------------ | --------------------------------------------------- | ------------------------------------------------------ |
| SOCKS timeout (`Proxy connection timed out`) | Proxy did not respond within 30 seconds       | Check proxy host/port; check the provider's status     |
| Authentication failed                | Proxy rejected the credentials                      | Recheck `PROXY_USERNAME` / `PROXY_PASSWORD`            |
| `ECONNREFUSED` at proxy              | The proxy endpoint refused the connection           | Check the endpoint address/port; confirm the proxy is active with the provider |
| `ECONNREFUSED` from target after proxy | Tunnel reached the destination but the Minecraft server refused | Check that the server is online and whether it also blocks the proxy's IP range |
| `write EPIPE`                        | The connection/socket was closed while writing      | Check proxy/server availability; the bot's auto-reconnect will retry |

## Fallbacks if a proxy doesn't work

- **Ask the hosting provider or its community** whether the Minecraft server
  (or `play.hosting` in general) permits connections from cloud/datacenter
  IPs, and whether an allowlist is possible.
- **Run the bot from a residential connection** — any home machine with
  Node.js 18+ can run `npm install && npm start`.
- **Run it on a home device 24/7** — a spare PC, Raspberry Pi, or an Android
  phone with Termux can work where practical.
- **Check whether the bot is needed at all** — if the server does not shut
  down when empty (or shuts down independently of player count), an AFK bot
  may not achieve anything.

None of these alternatives bypass any provider's policies — always follow
the terms of the server host, the proxy provider, and your deployment
platform.

## Complete environment-variable reference

| Variable                | Default                     | Purpose                                                                  | Secret? | Example |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------ | ------- | ------- |
| `MC_HOST`               | `lollorabaz.play.hosting`   | Minecraft Java server hostname                                           | No      | `mc.example.com` |
| `MC_PORT`               | `25603`                     | Minecraft Java server port                                               | No      | `25565` |
| `MC_USERNAME`           | `SlobosAFK`                 | Bot's username (offline-mode name)                                       | No      | `MyAfkBot` |
| `MC_PASSWORD`           | empty                       | Mojang/Microsoft account password (unused in offline mode)               | **Yes** | — |
| `MC_AUTH`               | `offline`                   | Auth mode: `offline`, `microsoft`, or `mojang`                           | No      | `offline` |
| `MC_VERSION`            | `26.1`                      | Protocol version to present; empty = auto-detect. Server is Paper 26.2 with ViaBackwards, so a 26.1 client can join | No | `1.20.4` |
| `PORT`                  | `5000`                      | HTTP dashboard port (set automatically by Render/Railway)                | No      | `10000` |
| `CHAT_MESSAGES`         | empty                       | Messages to send periodically, separated by `\|`; empty = silent bot     | No      | `hi\|still here` |
| `CHAT_INTERVAL_SECONDS` | `300`                       | Seconds between chat messages (minimum 15)                               | No      | `600` |
| `ANTI_AFK`              | `true`                      | Periodic jump/look movement to avoid idle kicks                          | No      | `true` |
| `AUTO_AUTH`             | `false`                     | Automatically answer `/register` / `/login` prompts (AuthMe-style plugins) | No    | `false` |
| `AUTO_AUTH_PASSWORD`    | empty                       | Password used for auto `/register` / `/login`                            | **Yes** | — |
| `COMBAT`                | `false`                     | Attack hostile mobs within 4 blocks                                      | No      | `false` |
| `DASHBOARD_TOKEN`       | empty                       | Bearer token protecting `/logs`, `/start`, `/stop`; empty disables them (503) | **Yes** | long random string |
| `PROXY_HOST`            | empty                       | SOCKS proxy hostname/IP; empty = direct connection                       | No      | `proxy.example.com` |
| `PROXY_PORT`            | `1080`                      | SOCKS proxy port                                                         | No      | `1080` |
| `PROXY_TYPE`            | `5`                         | SOCKS protocol version (`5` or `4`)                                      | No      | `5` |
| `PROXY_USERNAME`        | empty                       | Proxy authentication username                                            | **Yes** | — |
| `PROXY_PASSWORD`        | empty                       | Proxy authentication password                                            | **Yes** | — |

Variables marked **Yes** in the Secret column must only ever be set as
deployment environment variables — never committed to the repository.
