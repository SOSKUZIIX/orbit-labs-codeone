# Offline setup (Local provider)

CodeOne's **Local (offline)** provider runs a coding model entirely on the
user's machine — no API key, no account, no network egress. Code never leaves
the PC. Until the runtime is bundled with the app (planned), set it up manually:

## 1. Install a local runtime

Install [Ollama](https://ollama.com/download) (macOS, Windows, Linux). Any
OpenAI-compatible server that exposes `/v1/chat/completions` also works
(llama.cpp `llama-server`, LM Studio) — point the app at it with
`ORBIT_LOCAL_ENDPOINT` (must be loopback; see below).

## 2. Pull the model

```sh
ollama pull qwen2.5-coder:32b
```

Hardware guidance for the 32B model (4-bit):

| Machine | Result |
|---|---|
| 32–64GB RAM Mac (Apple Silicon) / 24GB GPU | Recommended — GPT-4-class coding |
| 16GB RAM, no GPU | Too small for 32B; use a 7B–14B coder model instead |
| 48GB+ GPU workstation | Can run 70B+ for higher quality |

## 3. Raise the context window (important)

Agentic tool use injects the tool schema + tool-use prompt (~2.3k tokens)
**before** any of your code, and accumulates file contents across up to 8
tool-loop turns. Ollama's default context (`num_ctx` 2048/4096) is far too
small and will **silently drop** the tool instructions and earlier results,
degrading multi-step edits with no visible error.

Run the server with a large context:

```sh
OLLAMA_CONTEXT_LENGTH=32768 ollama serve
```

Or bake it into a derived model via a `Modelfile`:

```
FROM qwen2.5-coder:32b
PARAMETER num_ctx 32768
```

```sh
ollama create qwen2.5-coder-32b-ctx -f Modelfile
```

## 4. Use it in CodeOne

Pick **Local (offline)** in the model picker and select `qwen2.5-coder:32b`.
The agent (file edits, plan/question cards, search) works exactly as with the
cloud providers, but fully offline.

### Endpoint override

`ORBIT_LOCAL_ENDPOINT` may point the app at a different local server, e.g.
`http://127.0.0.1:8080/v1/chat/completions`. **It must resolve to loopback**
(`127.0.0.1`, `localhost`, or `::1`); any non-loopback value is refused and the
default is used, to preserve the air-gap guarantee.
