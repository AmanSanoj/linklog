import { csvQueries } from "./csv-db.js";
import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { rateLimit } from "elysia-rate-limit";

import { capRoutes } from "./cap.js";
import { apiRoutes } from "./api.js";
import { minify } from "terser";

const app = new Elysia()
  .onBeforeHandle(async (ctx) => {
    // Skip host validation in development or if CF-HOST is not set
    if (
      process.env["ENV"] === "dev" ||
      !process.env["CF-HOST"] ||
      ctx.headers["host"] === process.env["CF-HOST"] ||
      ctx.headers["host"]?.includes("devtunnels.ms") // Allow DevTunnels
    ) {
      return; // Allow the request
    }
    
    await Bun.sleep(Math.random() * 10);
    return "Invalid host header";
  })
  .use(staticPlugin())
  .use(
    rateLimit({
      duration: 10_000,
      max: 100,
      generator: (request) =>
        request.headers.get("cf-connecting-ip") || "0.0.0.0",
    })
  )
  .use(capRoutes)
  .use(apiRoutes)

  .get("/", () => Bun.file("public/index.html"))
  .get("//", () => Bun.file("public/index.html"))
  .get("/links", () => Bun.file("public/dash/index.html"))
  .get("/legal", () => Bun.file("public/legal/index.html"))

  .get("/api/extensions.json", async () => {
    return JSON.stringify(
      JSON.parse(await Bun.file("public/assets/extensions.json").text())
    );
  })

  .get("/api/script.js", async ({ set }) => {
    try {
      const raw = await Bun.file("public/assets/grabber.js").text();
      const result = await minify(raw, { mangle: true, compress: true });
      
      set.headers["content-type"] = "application/javascript";
      set.headers["cache-control"] = "public, max-age=3600";
      set.headers["access-control-allow-origin"] = "*";
      
      return result.code || raw; // Fallback to raw if minification fails
    } catch (error) {
      console.error("Error serving script.js:", error);
      set.status = 500;
      return "console.error('Failed to load script');";
    }
  })

  .get("/:slug", async ({ params }) => {
    return csvQueries.findLinkById(params.slug)
      ? Bun.file("public/collect.html")
      : Bun.file("public/404.html");
  })

  .listen(process.env.PORT || 3000);

console.log(`Server running at http://localhost:${app.server?.port}`);
