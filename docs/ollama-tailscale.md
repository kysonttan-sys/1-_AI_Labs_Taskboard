# Expose local Ollama to Render via Tailscale Funnel

This guide lets the Taskboard app on Render talk to a local Ollama instance on your PC. Your PC must stay online while team members use the AI features.

> ⚠️ **Critical security note**: Ollama's local API (`http://localhost:11434`) has **no built-in authentication**. Tailscale Funnel creates a **public HTTPS URL** on the open internet. If you funnel Ollama directly, anyone who finds the URL can use your PC's GPU/compute and pull models. You **must** put a reverse proxy with auth (Caddy or Nginx) in front of Ollama, then funnel that proxy.

## Architecture

```
Browser → Render (Next.js /api/ai/suggest) → Tailscale Funnel
                                                    │
                                                    ▼
                              Caddy/Nginx on your PC (checks token)
                                                    │
                                                    ▼
                                        Ollama @ 127.0.0.1:11434
```

## One-time setup on your PC

### 1. Install Ollama and a model

```bash
ollama serve
ollama pull llama3.1
```

### 2. Install Caddy

- Windows: `winget install --id Caddy.Caddy`
- macOS: `brew install caddy`
- Linux: see https://caddyserver.com/docs/install

### 3. Create a Caddyfile with bearer-token auth

Create a file named `Caddyfile` in the folder where you will run Caddy:

:8080 {
    @hasToken header X-Taskboard-Key "my-secret-token-123"
    handle @hasToken {
        reverse_proxy 127.0.0.1:11434 {
            # Ollama binds to localhost and may reject non-local Host headers.
            header_up Host 127.0.0.1:11434
        }
    }
    handle {
        respond "Unauthorized" 401
    }
}
```

Replace `my-secret-token-123` with a long random string. Ollama stays bound to `127.0.0.1:11434` (default).

### 4. Install and log in to Tailscale

- Download Tailscale: https://tailscale.com/download
- Run `tailscale up` and authenticate.

### 5. Start Caddy and Tailscale Funnel

In one terminal:

```bash
caddy run
```

In another terminal:

```bash
tailscale funnel 8080
```

Tailscale will print a public HTTPS URL like:

```
https://your-pc.tailnet-name.ts.net
```

Test it from any machine:

```bash
curl -H "X-Taskboard-Key: my-secret-token-123" https://your-pc.tailnet-name.ts.net/api/tags
```

You should see a list of tags. Without the header, you should get `401 Unauthorized`.

## Configure Render

In your Render service dashboard → **Environment**:

```
OLLAMA_URL=https://your-pc.tailnet-name.ts.net
OLLAMA_MODEL=llama3.1
OLLAMA_API_KEY=my-secret-token-123
```

`OLLAMA_API_KEY` is sent as a custom `X-Taskboard-Key` header to Caddy. We use a custom header because Tailscale Funnel can strip or interfere with the standard `Authorization` header. It is **not** checked by Ollama itself.

Save. Render will redeploy.

## Day-to-day

Keep your PC awake, Ollama running, Caddy running, and `tailscale funnel 8080` active. If the tunnel drops, the AI panel will show an error but the rest of Taskboard keeps working.

## Alternative: basic auth instead of bearer token

If you prefer basic auth, use this Caddyfile:

```caddyfile
:8080 {
    basicauth {
        ollama_user $2a$14$...
    }
    reverse_proxy 127.0.0.1:11434
}
```

And on Render set:

```
OLLAMA_BASIC_AUTH=ollama_user:their-password
```

The app will send `Authorization: Basic ...`.

## Alternative: expose only inside your tailnet (more secure)

If you don't want a public URL, you can use `tailscale serve` instead of `tailscale funnel`. Then only devices in your tailnet can reach Ollama. However, the Render server is not in your tailnet by default, so you would need to deploy a Tailscale subnet router on Render instead. See the [Render Tailscale example](https://github.com/render-examples/tailscale).
