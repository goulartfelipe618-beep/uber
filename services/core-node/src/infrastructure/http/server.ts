import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { HealthService } from "../../application/health/health.service";
import { SupabaseService } from "../../integrations/supabase/supabase.service";
import { CategoriesController } from "../../modules/categories/presentation/categories.controller";
import { DynamicPricingController } from "../../modules/dynamic-pricing/presentation/dynamic-pricing.controller";
import { GeocodingController } from "../../modules/geocoding/presentation/geocoding.controller";
import { PaymentsController } from "../../modules/payments/presentation/payments.controller";
import { PlacesController } from "../../modules/places/presentation/places.controller";
import { PricingController } from "../../modules/pricing/presentation/pricing.controller";
import { ReviewsController } from "../../modules/reviews/presentation/reviews.controller";
import { ReputationController } from "../../modules/reputation/presentation/reputation.controller";
import { RideStartController } from "../../modules/ride-start/presentation/ride-start.controller";
import { RidesController } from "../../modules/rides/presentation/rides.controller";
import { UsersController } from "../../modules/users/presentation/users.controller";
import { VehiclesController } from "../../modules/vehicles/presentation/vehicles.controller";
import { WeatherController } from "../../modules/weather/presentation/weather.controller";

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function writeHtml(res: ServerResponse, statusCode: number, payload: string): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(payload);
}

export function createHttpServer(
  healthService: HealthService,
  supabaseService: SupabaseService,
  categoriesController?: CategoriesController,
  pricingController?: PricingController,
  dynamicPricingController?: DynamicPricingController,
  ridesController?: RidesController,
  reviewsController?: ReviewsController,
  reputationController?: ReputationController,
  vehiclesController?: VehiclesController,
  placesController?: PlacesController,
  paymentsController?: PaymentsController,
  rideStartController?: RideStartController,
  usersController?: UsersController,
  geocodingController?: GeocodingController,
  weatherController?: WeatherController,
) {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    if (
      categoriesController &&
      (req.url === "/api/v1/categories" || (req.url ?? "").startsWith("/api/v1/categories/"))
    ) {
      void categoriesController
        .handle(req, res)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "unknown error";
          const status = message === "category not found" ? 404 : message.startsWith("invalid") || message.includes("must be") || message.includes("is required") ? 400 : 500;
          writeJson(res, status, { message });
        });
      return;
    }

    if (vehiclesController && (req.url ?? "").startsWith("/api/v1/vehicles")) {
      void vehiclesController
        .handle(req, res)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "unknown error";
          const status = message === "vehicle not found" ? 404 : message.startsWith("invalid") || message.includes("must be") || message.includes("is required") ? 400 : 500;
          writeJson(res, status, { message });
        });
      return;
    }

    if (placesController && (req.url ?? "").includes("/places")) {
      void placesController
        .handle(req, res)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "unknown error";
          const status = message.startsWith("invalid") || message.includes("must be") || message.includes("is required") ? 400 : 500;
          writeJson(res, status, { message });
        });
      return;
    }

    if (paymentsController && ((req.url ?? "").startsWith("/api/v1/payments/") || (req.url ?? "").includes("/payment-intent"))) {
      void paymentsController
        .handle(req, res)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "unknown error";
          const status = message === "payment intent not found" ? 404 : message.startsWith("invalid") || message.includes("must be") || message.includes("is required") ? 400 : 500;
          writeJson(res, status, { message });
        });
      return;
    }

    if (dynamicPricingController && (req.url ?? "").startsWith("/api/v1/pricing/dynamic")) {
      void dynamicPricingController
        .handle(req, res)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "unknown error";
          const status = message.startsWith("invalid") || message.includes("must be") || message.includes("is required") ? 400 : 500;
          writeJson(res, status, { message });
        });
      return;
    }

    if (pricingController && (req.url ?? "").startsWith("/api/v1/pricing/")) {
      void pricingController
        .handle(req, res)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "unknown error";
          const status = message === "category not found" ? 404 : message.startsWith("invalid") || message.includes("must be") || message.includes("is required") ? 400 : 500;
          writeJson(res, status, { message });
        });
      return;
    }

    if (usersController && (req.url ?? "").startsWith("/api/v1/users/")) {
      const path = req.url ?? "";
      if (path === "/api/v1/users/register" || path === "/api/v1/users/login" || path === "/api/v1/users/me") {
        void usersController
          .handle(req, res)
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "unknown error";
            const status =
              message === "invalid credentials" || message === "unauthorized"
                ? 401
                : message.includes("already registered")
                  ? 409
                  : message.startsWith("invalid") || message.includes("must be") || message.includes("is required")
                    ? 400
                    : 500;
            writeJson(res, status, { message });
          });
        return;
      }
    }

    if (geocodingController && (req.url ?? "").startsWith("/api/v1/geocoding/")) {
      void geocodingController
        .handle(req, res)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "unknown error";
          writeJson(res, 400, { message });
        });
      return;
    }

    if (weatherController && (req.url ?? "").startsWith("/api/v1/weather/")) {
      void weatherController
        .handle(req, res)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "unknown error";
          writeJson(res, 400, { message });
        });
      return;
    }

    if (reputationController && (req.url ?? "").startsWith("/api/v1/users/") && (req.url ?? "").includes("/reputation")) {
      void reputationController
        .handle(req, res)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "unknown error";
          const status = message === "userId is required" || message === "role is required" ? 400 : 500;
          writeJson(res, status, { message });
        });
      return;
    }

    if (rideStartController && (req.url ?? "").includes("/start-codes")) {
      void rideStartController
        .handle(req, res)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "unknown error";
          const status = message.includes("not found") || message.includes("expired") ? 404 : message.startsWith("invalid") || message.includes("must be") || message.includes("is required") || message.includes("maximum") ? 400 : 500;
          writeJson(res, status, { message });
        });
      return;
    }

    if (reviewsController && (req.url ?? "").includes("/reviews") && ((req.url ?? "").startsWith("/api/v1/rides/") || (req.url ?? "").startsWith("/api/v1/users/"))) {
      void reviewsController
        .handle(req, res)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "unknown error";
          const status = message === "ride not found" || message === "category not found" ? 404 : message.startsWith("invalid") || message.includes("must be") || message.includes("is required") ? 400 : 500;
          writeJson(res, status, { message });
        });
      return;
    }

    if (ridesController && (req.url ?? "").startsWith("/api/v1/rides")) {
      void ridesController
        .handle(req, res)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "unknown error";
          const status =
            message === "ride not found"
              ? 404
              : message.includes("not in") || message.includes("invalid status") || message.includes("not assignable")
                ? 409
                : message.startsWith("invalid") || message.includes("must be") || message.includes("is required")
                  ? 400
                  : 500;
          writeJson(res, status, { message });
        });
      return;
    }

    if (req.url === "/") {
      writeHtml(
        res,
        200,
        `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Transporte.PRO | Preview Operacional</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07111c;
        --panel: rgba(13, 23, 38, 0.9);
        --panel-strong: rgba(10, 18, 30, 0.98);
        --panel-border: rgba(98, 137, 183, 0.24);
        --text: #f4f8ff;
        --muted: #9eb4d1;
        --accent: #38bdf8;
        --accent-2: #8b5cf6;
        --success: #22c55e;
        --warning: #f59e0b;
        --danger: #ef4444;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 25%),
          radial-gradient(circle at top right, rgba(139, 92, 246, 0.16), transparent 22%),
          linear-gradient(180deg, #06101a 0%, #09131f 100%);
        color: var(--text);
      }

      .container {
        max-width: 1240px;
        margin: 0 auto;
        padding: 40px 24px 64px;
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 24px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .brand-mark {
        width: 48px;
        height: 48px;
        border-radius: 16px;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        display: grid;
        place-items: center;
        font-size: 22px;
        font-weight: 700;
        box-shadow: 0 12px 28px rgba(56, 189, 248, 0.26);
      }

      .brand-copy small {
        display: block;
        color: var(--muted);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 4px;
      }

      .hero {
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 28px;
        padding: 34px;
        box-shadow: 0 26px 60px rgba(0, 0, 0, 0.28);
        overflow: hidden;
        position: relative;
      }

      .hero::after {
        content: "";
        position: absolute;
        inset: auto -80px -80px auto;
        width: 260px;
        height: 260px;
        background: radial-gradient(circle, rgba(56, 189, 248, 0.22), transparent 70%);
        pointer-events: none;
      }

      .hero-grid {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 26px;
        align-items: center;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(34, 197, 94, 0.12);
        color: #b8f7cc;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .badge.warning {
        background: rgba(245, 158, 11, 0.12);
        color: #fed7aa;
      }

      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--success);
        box-shadow: 0 0 12px rgba(34, 197, 94, 0.8);
      }

      h1 {
        margin: 18px 0 10px;
        font-size: 46px;
        line-height: 1.1;
      }

      p {
        margin: 0;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.6;
      }

      .hero-copy p + p {
        margin-top: 12px;
      }

      .cta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        padding: 0 18px;
        border-radius: 14px;
        color: #eff8ff;
        text-decoration: none;
        font-weight: 700;
        border: 1px solid var(--panel-border);
        background: rgba(15, 27, 45, 0.95);
      }

      .btn.primary {
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        border: none;
      }

      .mini-panel {
        background: var(--panel-strong);
        border: 1px solid var(--panel-border);
        border-radius: 22px;
        padding: 22px;
      }

      .mini-panel h2 {
        margin: 0 0 16px;
        font-size: 20px;
      }

      .stat-list {
        display: grid;
        gap: 14px;
      }

      .stat-item {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
      }

      .stat-item strong {
        font-size: 18px;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 18px;
        margin-top: 28px;
      }

      .card {
        background: rgba(9, 18, 31, 0.95);
        border: 1px solid var(--panel-border);
        border-radius: 16px;
        padding: 20px;
      }

      .card h2 {
        margin: 0 0 12px;
        font-size: 18px;
      }

      .label {
        color: var(--muted);
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .value {
        margin-top: 8px;
        font-size: 24px;
        font-weight: 700;
      }

      .section {
        margin-top: 24px;
        padding: 26px;
        border-radius: 24px;
        background: var(--panel);
        border: 1px solid var(--panel-border);
      }

      .section-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 18px;
      }

      .section-header h2 {
        margin: 0;
        font-size: 28px;
      }

      .section-header p {
        max-width: 720px;
      }

      .flow {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 12px;
      }

      .flow-step {
        padding: 16px;
        border-radius: 18px;
        background: var(--panel-strong);
        border: 1px solid var(--panel-border);
      }

      .flow-step span {
        display: inline-block;
        margin-bottom: 10px;
        color: var(--accent);
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .mockups {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
      }

      .phone {
        min-height: 520px;
        padding: 14px;
        border-radius: 34px;
        background: #02060d;
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.38);
      }

      .phone-screen {
        height: 100%;
        border-radius: 26px;
        overflow: hidden;
        background: linear-gradient(180deg, #eef6ff 0%, #f9fbff 100%);
        color: #102033;
        display: flex;
        flex-direction: column;
      }

      .statusbar {
        display: flex;
        justify-content: space-between;
        padding: 12px 16px 0;
        font-size: 12px;
        font-weight: 700;
      }

      .screen-body {
        padding: 16px;
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 14px;
      }

      .splash {
        justify-content: center;
        align-items: center;
        text-align: center;
        background:
          radial-gradient(circle at top, rgba(56, 189, 248, 0.25), transparent 26%),
          linear-gradient(180deg, #08111d 0%, #0f1b2d 100%);
        color: white;
      }

      .logo-large {
        width: 88px;
        height: 88px;
        border-radius: 28px;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        display: grid;
        place-items: center;
        font-size: 34px;
        font-weight: 800;
        box-shadow: 0 20px 40px rgba(56, 189, 248, 0.3);
      }

      .loader {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: 4px solid rgba(255, 255, 255, 0.16);
        border-top-color: #ffffff;
      }

      .login-card,
      .white-card,
      .ride-panel {
        background: white;
        border-radius: 20px;
        padding: 16px;
        box-shadow: 0 16px 28px rgba(16, 32, 51, 0.08);
      }

      .field {
        height: 46px;
        border-radius: 14px;
        background: #f2f6fb;
        border: 1px solid #d9e5f3;
        padding: 0 14px;
        display: flex;
        align-items: center;
        color: #5d728b;
      }

      .btn-solid {
        height: 48px;
        border-radius: 16px;
        background: linear-gradient(135deg, #0ea5e9, #8b5cf6);
        color: white;
        display: grid;
        place-items: center;
        font-weight: 700;
      }

      .map-area {
        flex: 1;
        border-radius: 24px;
        padding: 16px;
        background:
          radial-gradient(circle at 70% 30%, rgba(56, 189, 248, 0.3), transparent 18%),
          linear-gradient(180deg, #cde7ff 0%, #dff0ff 100%);
        position: relative;
        overflow: hidden;
      }

      .road {
        position: absolute;
        background: rgba(255, 255, 255, 0.72);
        border-radius: 999px;
      }

      .road.r1 {
        width: 240px;
        height: 18px;
        top: 120px;
        left: -30px;
        transform: rotate(18deg);
      }

      .road.r2 {
        width: 320px;
        height: 18px;
        bottom: 110px;
        right: -60px;
        transform: rotate(-20deg);
      }

      .road.r3 {
        width: 18px;
        height: 260px;
        top: 40px;
        left: 160px;
      }

      .pin,
      .car-dot {
        position: absolute;
        border-radius: 50%;
      }

      .pin {
        width: 18px;
        height: 18px;
        background: #0f172a;
        border: 4px solid #38bdf8;
      }

      .car-dot {
        width: 12px;
        height: 12px;
        background: #7c3aed;
        box-shadow: 0 0 0 8px rgba(124, 58, 237, 0.12);
      }

      .map-fab {
        position: absolute;
        right: 16px;
        bottom: 16px;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: white;
        display: grid;
        place-items: center;
        box-shadow: 0 10px 20px rgba(15, 23, 42, 0.12);
        font-weight: 700;
      }

      .search-pill {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        border-radius: 18px;
        background: white;
        box-shadow: 0 14px 26px rgba(15, 23, 42, 0.08);
      }

      .ride-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 0;
        border-bottom: 1px solid #e9eef5;
      }

      .ride-option:last-child {
        border-bottom: none;
      }

      .chip-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .chip {
        padding: 8px 12px;
        border-radius: 999px;
        background: #eef5ff;
        color: #204064;
        font-size: 13px;
        font-weight: 700;
      }

      .endpoints {
        margin-top: 28px;
      }

      .endpoints h2 {
        margin: 0 0 16px;
        font-size: 22px;
      }

      .endpoint-list {
        display: grid;
        gap: 12px;
      }

      .endpoint {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 18px;
        background: rgba(9, 18, 31, 0.95);
        border: 1px solid var(--panel-border);
        border-radius: 14px;
      }

      .endpoint code {
        color: #dbeafe;
        font-size: 15px;
      }

      .endpoint a {
        color: var(--accent);
        text-decoration: none;
        font-weight: 700;
      }

      .endpoint a:hover {
        text-decoration: underline;
      }

      @media (max-width: 920px) {
        .hero-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        h1 {
          font-size: 34px;
        }

        .endpoint {
          flex-direction: column;
          align-items: flex-start;
        }

        .container {
          padding-inline: 16px;
        }

        .hero,
        .section {
          padding: 20px;
        }
      }
    </style>
  </head>
  <body>
    <main class="container">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">TP</div>
          <div class="brand-copy">
            <small>Preview Visual</small>
            <strong>Transporte.PRO</strong>
          </div>
        </div>
        <div class="badge warning">Mockup do fluxo principal</div>
      </header>

      <section class="hero">
        <div class="hero-grid">
          <div class="hero-copy">
            <div class="badge"><span class="dot"></span> Backend ativo</div>
            <h1>Alteracoes visuais do app ja podem ser vistas no navegador.</h1>
            <p>Esta pagina mostra o contexto atual do projeto e uma representacao visual das principais telas do passageiro: splash, login, home com mapa e solicitacao de corrida.</p>
            <p>O objetivo aqui e materializar visualmente o que ja foi estruturado no backend e o que sera evoluido no produto.</p>

            <div class="cta-row">
              <a class="btn primary" href="#mockups">Ver telas principais</a>
              <a class="btn" href="#endpoints">Ver endpoints ativos</a>
            </div>

            <div class="grid">
              <article class="card">
                <div class="label">Status</div>
                <div class="value">ONLINE</div>
              </article>
              <article class="card">
                <div class="label">Servico ativo</div>
                <div class="value">Core Node.js</div>
              </article>
              <article class="card">
                <div class="label">Escopo visual</div>
                <div class="value">Fluxo do passageiro</div>
              </article>
            </div>
          </div>

          <aside class="mini-panel">
            <h2>Contexto do que foi feito</h2>
            <div class="stat-list">
              <div class="stat-item">
                <span>Arquitetura base</span>
                <strong>Go + Node + PostGIS + Redis</strong>
              </div>
              <div class="stat-item">
                <span>Infraestrutura</span>
                <strong>Docker Compose + Nginx</strong>
              </div>
              <div class="stat-item">
                <span>Banco inicial</span>
                <strong>usuarios, viagens, localizacoes</strong>
              </div>
              <div class="stat-item">
                <span>Visual atual</span>
                <strong>Preview navegavel do produto</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>Fluxo priorizado</h2>
            <p>Este e o fluxo principal do passageiro que vai guiar a evolucao do aplicativo e do backend operacional.</p>
          </div>
        </div>
        <div class="flow">
          <div class="flow-step"><span>01</span><strong>Splash</strong><p>Carrega sessao e decide proximo passo.</p></div>
          <div class="flow-step"><span>02</span><strong>Login</strong><p>Acesso com email ou telefone.</p></div>
          <div class="flow-step"><span>03</span><strong>Permissoes</strong><p>Localizacao como requisito central.</p></div>
          <div class="flow-step"><span>04</span><strong>Mapa</strong><p>Home com busca e veiculos proximos.</p></div>
          <div class="flow-step"><span>05</span><strong>Destino</strong><p>Origem, sugestoes, historico e favoritos.</p></div>
          <div class="flow-step"><span>06</span><strong>Solicitacao</strong><p>Escolha da categoria e criacao da corrida.</p></div>
          <div class="flow-step"><span>07</span><strong>Match</strong><p>Busca automatica do motorista ideal.</p></div>
          <div class="flow-step"><span>08</span><strong>Tracking</strong><p>Acompanhamento em tempo real.</p></div>
        </div>
      </section>

      <section class="section" id="mockups">
        <div class="section-header">
          <div>
            <h2>Telas principais</h2>
            <p>Mockups visuais do app baseados nas funcionalidades que voce descreveu. Eles representam a direcao do produto e ajudam a validar o fluxo antes da implementacao completa do frontend mobile.</p>
          </div>
        </div>

        <div class="mockups">
          <article class="phone">
            <div class="phone-screen splash">
              <div class="logo-large">TP</div>
              <h2 style="margin: 18px 0 8px; font-size: 28px;">Transporte.PRO</h2>
              <p style="max-width: 220px; color: rgba(255,255,255,0.76);">Mobilidade urbana com geolocalizacao, match e operacao em tempo real.</p>
              <div class="loader" style="margin-top: 24px;"></div>
              <p style="margin-top: 16px; color: rgba(255,255,255,0.64); font-size: 14px;">Verificando login e carregando dados iniciais...</p>
            </div>
          </article>

          <article class="phone">
            <div class="phone-screen">
              <div class="statusbar">
                <span>09:41</span>
                <span>5G 100%</span>
              </div>
              <div class="screen-body">
                <div>
                  <div class="badge" style="background: rgba(56, 189, 248, 0.14); color: #0369a1;">Acesso</div>
                  <h2 style="margin: 14px 0 6px; font-size: 28px;">Entrar na conta</h2>
                  <p style="font-size: 15px;">Use email ou telefone para continuar no app.</p>
                </div>
                <div class="login-card">
                  <div class="field">E-mail ou telefone</div>
                  <div class="field" style="margin-top: 12px;">Senha</div>
                  <div class="btn-solid" style="margin-top: 14px;">Entrar</div>
                  <div style="display:flex; justify-content:space-between; margin-top:12px; color:#5d728b; font-size:14px;">
                    <span>Criar conta</span>
                    <span>Esqueci minha senha</span>
                  </div>
                </div>
                <div class="white-card">
                  <strong>Cadastro rapido</strong>
                  <p style="margin-top:8px; font-size:14px;">Nome completo, e-mail, telefone, senha e confirmacao de senha.</p>
                </div>
              </div>
            </div>
          </article>

          <article class="phone">
            <div class="phone-screen">
              <div class="statusbar">
                <span>09:41</span>
                <span>5G 100%</span>
              </div>
              <div class="screen-body">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <strong style="font-size:18px;">Boa tarde, Felipe</strong>
                  <span style="font-size:22px;">🔔</span>
                </div>
                <div class="map-area">
                  <div class="road r1"></div>
                  <div class="road r2"></div>
                  <div class="road r3"></div>
                  <div class="pin" style="top: 92px; left: 116px;"></div>
                  <div class="car-dot" style="top: 180px; left: 72px;"></div>
                  <div class="car-dot" style="top: 248px; left: 210px;"></div>
                  <div class="car-dot" style="top: 136px; left: 236px;"></div>
                  <div class="map-fab">◎</div>
                </div>
                <div class="search-pill">
                  <strong>Para onde vamos?</strong>
                  <span style="color:#64748b;">Pesquisar</span>
                </div>
                <div class="white-card">
                  <div style="font-size:13px; color:#64748b; text-transform:uppercase; letter-spacing:0.08em;">Local atual</div>
                  <strong style="display:block; margin-top:8px;">Av. Central, 450</strong>
                  <p style="margin-top:8px; font-size:14px;">Veiculos proximos detectados em tempo real.</p>
                </div>
              </div>
            </div>
          </article>

          <article class="phone">
            <div class="phone-screen">
              <div class="statusbar">
                <span>09:41</span>
                <span>5G 100%</span>
              </div>
              <div class="screen-body">
                <div>
                  <strong style="font-size:22px;">Escolha sua viagem</strong>
                  <p style="margin-top:6px; font-size:14px;">Destino selecionado: Shopping Central</p>
                </div>
                <div class="white-card">
                  <div class="chip-row">
                    <div class="chip">Moto</div>
                    <div class="chip">Economico</div>
                    <div class="chip">Executivo</div>
                    <div class="chip">SUV</div>
                  </div>
                </div>
                <div class="ride-panel">
                  <div class="ride-option">
                    <div>
                      <strong>Moto</strong>
                      <div style="color:#64748b; font-size:13px;">Chega em 3 min</div>
                    </div>
                    <strong>R$ 12,50</strong>
                  </div>
                  <div class="ride-option">
                    <div>
                      <strong>Economico</strong>
                      <div style="color:#64748b; font-size:13px;">Chega em 5 min</div>
                    </div>
                    <strong>R$ 18,90</strong>
                  </div>
                  <div class="ride-option">
                    <div>
                      <strong>Executivo</strong>
                      <div style="color:#64748b; font-size:13px;">Chega em 7 min</div>
                    </div>
                    <strong>R$ 34,50</strong>
                  </div>
                </div>
                <div class="white-card">
                  <div style="display:flex; justify-content:space-between; font-size:14px;">
                    <span>Tempo estimado</span>
                    <strong>14 min</strong>
                  </div>
                  <div style="display:flex; justify-content:space-between; font-size:14px; margin-top:8px;">
                    <span>Distancia</span>
                    <strong>6,8 km</strong>
                  </div>
                  <div class="btn-solid" style="margin-top:14px;">Solicitar viagem</div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="section" id="endpoints">
        <div class="section-header">
          <div>
            <h2>Endpoints ativos agora</h2>
            <p>Essas rotas ja estao respondendo no ambiente atual e servem para validar que o servico Node.js esta vivo enquanto a interface visual evolui.</p>
          </div>
        </div>

        <div class="endpoint-list">
          <div class="endpoint">
            <code>/healthz</code>
            <a href="/healthz">Abrir endpoint</a>
          </div>
          <div class="endpoint">
            <code>/api/v1/users/health</code>
            <a href="/api/v1/users/health">Abrir endpoint</a>
          </div>
          <div class="endpoint">
            <code>/api/v1/payments/health</code>
            <a href="/api/v1/payments/health">Abrir endpoint</a>
          </div>
          <div class="endpoint">
            <code>/api/v1/notifications/health</code>
            <a href="/api/v1/notifications/health">Abrir endpoint</a>
          </div>
          <div class="endpoint">
            <code>/api/v1/supabase/health</code>
            <a href="/api/v1/supabase/health">Abrir endpoint</a>
          </div>
          <div class="endpoint">
            <code>/api/v1/categories</code>
            <a href="/api/v1/categories">Abrir endpoint</a>
          </div>
        </div>
      </section>
    </main>
  </body>
</html>`,
      );
      return;
    }

    if (req.url === "/healthz") {
      writeJson(res, 200, healthService.check());
      return;
    }

    if (req.url === "/api/v1/users/health") {
      writeJson(res, 200, { service: "core-node", module: "users", status: "ok" });
      return;
    }

    if (req.url === "/api/v1/payments/health") {
      writeJson(res, 200, { service: "core-node", module: "payments", status: "ok" });
      return;
    }

    if (req.url === "/api/v1/notifications/health") {
      writeJson(res, 200, { service: "core-node", module: "notifications", status: "ok" });
      return;
    }

    if (req.url === "/api/v1/supabase/health") {
      void supabaseService
        .checkHealth()
        .then((report) => {
          writeJson(res, 200, {
            service: "core-node",
            module: "supabase",
            status: report.publicApiReachable ? "ok" : "degraded",
            integration: report,
          });
        })
        .catch((error: unknown) => {
          writeJson(res, 500, {
            service: "core-node",
            module: "supabase",
            status: "error",
            message: error instanceof Error ? error.message : "unknown error",
          });
        });
      return;
    }

    writeJson(res, 404, { message: "route not found" });
  });
}
