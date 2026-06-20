# Expose local Ollama to Render via Cloudflare Tunnel (alternative)

> The current recommended setup uses **Tailscale Funnel**. See [`docs/ollama-tailscale.md`](./ollama-tailscale.md) for the Tailscale guide.

This is an alternative that lets the Taskboard app on Render talk to a local Ollama instance on
your laptop. Useful for demos, dev, or small-team use. Your laptop must
stay online while the tunnel is up.

## One-time setup

1. Install `cloudflared`:
   - Windows: `winget install --id Cloudflare.cloudflared`
   - macOS: `brew install cloudflared`
   - Linux: see https://pkg.cloudflare.dev/

2. Sign up / log in at https://one.dash.cloudflare.com (free).

3. Create a free tunnel. Pick either:

   ### 3a. Quick tunnel (no account setup, random URL — fine for trying it out)
   ```bash
   cloudflared tunnel --url http://localhost:11434
   ```
   Note the `https://...trycloudflare.com` URL it prints. That's your
   public Ollama URL. It changes every restart.

   ### 3b. Named tunnel (stable URL — recommended)
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create taskboard-ollama
   cloudflared tunnel route dns taskboard-ollama ollama.your-domain.com
   ```
   Then add `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: taskboard-ollama
   credentials-file: /path/to/.cloudflared/<tunnel-id>.json
   ingress:
     - hostname: ollama.your-domain.com
       service: http://localhost:11434
     - service: http_status:404
   ```
   Run: `cloudflared tunnel run taskboard-ollama`. The URL
   `https://ollama.your-domain.com` stays the same.

## Run

1. Make sure Ollama is running locally and has a model pulled:
   ```bash
   ollama serve
   ollama pull llama3.1:8b
   ```

2. Start the tunnel (one of the two commands above). Confirm it works:
   ```bash
   curl https://your-tunnel-url/
   ```
   You should get `Ollama is running`.

3. In Render → your service → **Environment**:
   - Set `OLLAMA_URL=https://your-tunnel-url`
   - (Do **not** set `OLLAMA_ENABLED=false` — leave it unset.)
   - Save. Render will redeploy.

4. Verify from the deployed app:
   - Hit `https://your-app.onrender.com/api/ollama/health`
   - You should get back `{ "connected": true, "url": "https://your-tunnel-url", "models": ["llama3.1:8b", ...] }`

5. In the app's **Settings** page, set the Ollama URL to the same
   tunnel URL and pick the model you pulled. Save.

## Day-to-day

Keep your laptop awake and `cloudflared` running. If the tunnel drops,
the app returns 502 on `/api/ollama/health` and AI features stop
working — the rest of the app keeps functioning.

## Hardening (optional, recommended if anyone else is using it)

The tunnel exposes your Ollama without auth. To add a shared secret:

1. Front Ollama with a reverse proxy that requires a header, e.g.
   Caddy:
   ```caddyfile
   ollama.your-domain.com {
     @blocked not header X-Taskboard-Key {secret}
     respond @blocked 403
     reverse_proxy localhost:11434
   }
   ```
2. Set both `OLLAMA_URL=https://ollama.your-domain.com` and
   `OLLAMA_AUTH_HEADER=X-Taskboard-Key: secret` (single env var, full
   header value). The next code change would read this env var and
   attach it to every Ollama request.
