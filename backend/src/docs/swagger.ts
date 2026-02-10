// docs/swagger.ts
import swaggerJSDoc from "swagger-jsdoc";

/**
 * Public base URL for docs "Try it out" (e.g., your ngrok URL).
 * Set one of these in your .env when tunneling:
 *   PUBLIC_BASE_URL=https://<your-subdomain>.ngrok-free.app
 *   NGROK_URL=https://<your-subdomain>.ngrok-free.app
 */
const PORT = process.env.PORT || 4000;
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  process.env.NGROK_URL ||
  `http://localhost:${PORT}`;

const options = {
  definition: {
    openapi: "3.0.3",
    info: { title: "CribSpot Kenya API", version: "1.0.0" },
    servers: [
      { url: PUBLIC_BASE_URL },           // e.g., ngrok if provided
      { url: `http://localhost:${PORT}` } // fallback for local dev
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Keep this pointed at your annotated route files
  apis: ["src/routes/**/*.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);

/**
 * OPTIONAL: If you added alias routes in payments.routes.ts like:
 *   router.post("/checkout", verifyToken, initMpesaPayment);
 *   router.post("/stkpush", verifyToken, initMpesaPayment);
 * then set PAYMENTS_ALIAS_ROUTES=true and we’ll mirror the spec for them.
 * (If you did NOT add the alias routes, leave this env unset.)
 */
if (process.env.PAYMENTS_ALIAS_ROUTES === "true") {
  const canonicalPath = "/api/payments/mpesa/init";
  const src = (swaggerSpec as any).paths?.[canonicalPath];

  if (src) {
    const cloneWithDeprecation = JSON.parse(JSON.stringify(src));
    for (const method of Object.keys(cloneWithDeprecation)) {
      if (cloneWithDeprecation[method] && typeof cloneWithDeprecation[method] === "object") {
        cloneWithDeprecation[method].deprecated = true; // steer clients to the canonical path
        const prev = cloneWithDeprecation[method].description || "";
        cloneWithDeprecation[method].description =
          `${prev ? prev + "\n\n" : ""}Alias of POST ${canonicalPath}.`;
      }
    }

    (swaggerSpec as any).paths = (swaggerSpec as any).paths || {};
    (swaggerSpec as any).paths["/api/payments/checkout"] = cloneWithDeprecation;
    (swaggerSpec as any).paths["/api/payments/stkpush"] = cloneWithDeprecation;
  }
}
