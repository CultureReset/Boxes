# The 580 box

Bringing the voice stack up on the Ryzen 5 / RX 580 Ubuntu machine, and the
things in the walkthrough you were handed that will bite you.

## The card

The RX 580 is Polaris — `gfx803`. AMD supported it through ROCm 5.x and
**dropped it in ROCm 6.x**. Anything that says "install ROCm, then run Ollama"
is written for a newer card. On this one Ollama starts, loads the model onto
the CPU, and never mentions it. The Ryzen 5 will run a 3B model at a few
tokens a second, which is enough to make you think it is working and slow
enough to be useless on a phone call.

Check it the moment the model is pulled:

    ollama ps

A `PROCESSOR` column reading `100% CPU` means the GPU is not in it.

Two ways forward:

1. **Vulkan.** Mesa's RADV driver supports Polaris properly and llama.cpp's
   Vulkan backend goes through it, skipping ROCm entirely. Ollama shipped an
   experimental Vulkan backend in 0.12.6-rc (Oct 2025) — build from source with
   it enabled — and it is slated to be on by default in 0.30. If you would
   rather not build Ollama, `llama.cpp`'s `llama-server` with `-DGGML_VULKAN=ON`
   speaks the same OpenAI-compatible API on the same port and the daemon cannot
   tell the difference: set `NODEOS_LLM_URL` and it just works.
2. **A recompiled ROCm 5 stack**, with `HSA_OVERRIDE_GFX_VERSION=8.0.3` and
   community rocBLAS/PyTorch builds. It works. It is a pinned, unpatchable
   install that breaks on the next kernel bump. For a bench box, fine. Not for
   something you ship.

Take Vulkan.

    sudo apt install mesa-vulkan-drivers vulkan-tools
    vulkaninfo --summary | grep -i "deviceName\|driverName"

You want to see `AMD Radeon RX 580` and `radv`. If `vulkaninfo` finds nothing,
nothing above will help and it is a driver problem first.

## Four things wrong with the walkthrough you pasted

1. **Port collision.** It maps Open WebUI with `-p 3000:8080` and then Kokoro
   with `-p 3000:3000`. The second container will not start — the port is
   taken. Kokoro's own port is 8880. `docker-compose.yml` here has them apart.
2. **`curl -fsSL https://tailscale.com | sh`** pipes the marketing homepage
   into a shell. The installer is at `https://tailscale.com/install.sh`.
3. **`git clone https://github.com`** appears twice with the repo path missing.
4. **The Kokoro GPU image is a CUDA image.** `kokoro-fastapi-gpu` will not run
   on this card. Use `kokoro-fastapi-cpu`; Kokoro is 82M parameters and keeps
   up on CPU for single-caller use. Better still, skip the container — the same
   weights run as a plain local binary, see below.

Also: "OpenJarvis" in that text is not the Stanford project of a similar name
that your own documents reference, and I could not verify "Rakazo" as anything
at all. Neither is load-bearing — nothing here needs them.

## The voice does not need a server

`NODEOS_TTS_CMD` takes a command line: the sentence goes in on stdin, the WAV
comes out at whatever path is substituted for `{out}`. Piper works that way and
is the default; anything else that does is a drop-in.

    NODEOS_TTS_CMD="kokoro-onnx --voice af_sky --out {out}"

Nothing is listening, nothing is published, and there is nothing to be down.
`NODEOS_TTS_URL` still exists and is tried last, for the case where an engine
only ships as a container. The shipped box leaves it unset.

## Bring it up

    cd box/testbox
    docker compose up -d
    docker compose exec ollama ollama pull qwen2.5:3b

Then the daemon, on the host, not in a container — it needs the compositor and
the sound device:

    cp box/testbox/env.example daemon/.env   # edit it
    cd daemon && npm start

Prove the whole loop in one call:

    curl -s localhost:7770/api/voice/text -d '{"said":"what time do we close today"}' \
      -H 'content-type: application/json'

and hear it:

    curl -s localhost:7770/api/voice/aloud -d '{"said":"what is on the menu"}' \
      -H 'content-type: application/json'

`GET /api/voice` reports which hearing, which voice, which model, and the
share of questions the router did not recognise.

## What talks to what

    iPhone ──Tailscale──► 100.x.y.z:7770   the daemon        ← the product
                          100.x.y.z:3000   Open WebUI        ← for you
                                    :11434 ollama            ← not exposed
                                    :8880  kokoro            ← not exposed

Tailscale, not a public tunnel: the daemon has no auth in front of it yet, and
11434 answers anyone who asks. Bind them to localhost or leave them on the
Docker network, as the compose file does.

    curl -fsSL https://tailscale.com/install.sh | sh
    sudo tailscale up

Add `http://100.x.y.z:7770` to the iPhone home screen and it opens like an app.

## Not the appliance

This is the bench. The shipped box has no Docker on it, runs Piper rather than
Kokoro, and reaches nothing on the network but the platform. What carries over
is the shape: the router answers what it recognises, the model only chooses and
phrases, the figures come from a capability that actually ran, and the voice is
a binary rather than a service. Changing the
engine changes none of that — which is the point of the env vars.
