import { createFileRoute } from "@tanstack/react-router";

type Body = {
  scene: string;
  universe?: string;
  character?: string;
};

export const Route = createFileRoute("/api/scene-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { scene, universe, character } = (await request.json()) as Body;
        if (!scene) return new Response("scene required", { status: 400 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Isomorphism prompt — render the scene as an inner-symbolic tableau.
        const prompt = `Painterly, candlelit, dark fantasy oil painting in the style of a worn tabletop RPG illustration. Symbolic, dreamlike, mythic — every element is a mirror of the inner world. No text, no captions, no UI.
Universe: ${universe || "open mythic"}.
Character present: ${character || "unseen protagonist"}.
Scene: ${scene.slice(0, 1800)}`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image-preview",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
            stream: true,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "image gateway error", { status: upstream.status });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
