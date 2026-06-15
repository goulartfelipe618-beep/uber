# Backend Transporte.PRÓ

## 1. Visão de arquitetura

O backend do Transporte.PRÓ roda integralmente em uma VPS própria, com todos os componentes isolados por Docker:

- `nginx`: única porta pública de entrada, atua como reverse proxy e ponto de terminação HTTP/TLS.
- `geo-go`: microsserviço crítico em Go para geolocalização, busca espacial e match.
- `core-node`: API em Node.js + TypeScript para usuários, pagamentos, notificações e orquestração de fluxos de negócio.
- `postgres`: banco relacional principal com extensão PostGIS para consultas geoespaciais.
- `redis`: cache, rate limiting distribuído, filas leves e armazenamento temporário de sessões/eventos.

## 2. Comunicação entre serviços

### Rede

- Apenas o `nginx` publica portas para fora da VPS.
- `geo-go`, `core-node`, `postgres` e `redis` ficam somente na rede Docker interna `backend_internal`.
- A comunicação interna usa DNS nativo do Docker Compose: `postgres`, `redis`, `geo-go` e `core-node`.

### Segurança

- Firewall da VPS deve expor somente `22`, `80` e `443`.
- `postgres` e `redis` não publicam portas no host.
- Serviços usam credenciais via variáveis de ambiente carregadas de `.env`.
- Chamadas internas entre `core-node` e `geo-go` podem exigir `INTERNAL_SHARED_TOKEN` em header dedicado.
- Containers de aplicação usam filesystem somente leitura, `tmpfs` e `no-new-privileges`.

### Fluxo de chamadas

1. Cliente chama `nginx`.
2. `nginx` encaminha `/api/v1/geo/*` e `/api/v1/match/*` para `geo-go`.
3. `nginx` encaminha `/api/*` restantes para `core-node`.
4. `core-node` pode chamar `geo-go` diretamente pela rede interna para rotinas de match.
5. `geo-go` e `core-node` acessam `postgres` e `redis` pela rede interna.

## 3. Estrutura inicial de diretórios

```text
.
|-- .env.example
|-- docker-compose.yml
|-- docs/
|   `-- backend-architecture.md
|-- infra/
|   |-- nginx/
|   |   `-- nginx.conf
|   `-- postgres/
|       `-- 001_init.sql
`-- services/
    |-- geo-go/
    |   |-- Dockerfile
    |   |-- go.mod
    |   |-- cmd/
    |   |   `-- api/
    |   |       `-- main.go
    |   `-- internal/
    |       |-- delivery/
    |       |   `-- http/
    |       |       `-- server.go
    |       |-- domain/
    |       |   `-- health/
    |       |       `-- status.go
    |       |-- platform/
    |       |   `-- config/
    |       |       `-- config.go
    |       `-- usecase/
    |           `-- health/
    |               `-- service.go
    `-- core-node/
        |-- Dockerfile
        |-- package.json
        |-- tsconfig.json
        `-- src/
            |-- application/
            |   `-- health/
            |       `-- health.service.ts
            |-- config/
            |   `-- env.ts
            |-- infrastructure/
            |   `-- http/
            |       `-- server.ts
            `-- main.ts
```

## 4. Decisão de arquitetura

### Go

- `domain`: entidades e contratos de negócio críticos para geolocalização e match.
- `usecase`: regras de negócio puras, sem dependência de transporte ou banco.
- `delivery`: entrada HTTP/gRPC/WebSocket.
- `repository`: adaptação para PostgreSQL/PostGIS, Redis e filas.
- `platform`: config, logger, conexões e bootstrap.

### Node.js

- `domain`: agregados e contratos das áreas de usuários, pagamentos e notificações.
- `application`: casos de uso.
- `infrastructure`: HTTP, persistência, cache, mensageria e integrações externas.
- `config` e `shared`: bootstrap, env, middlewares, erros e utilitários comuns.

## 5. Plano de desenvolvimento

### Fase 1. Base operacional

- Subir stack local e de homologação com `docker compose`.
- Implementar health checks, logging estruturado e tracing básico.
- Criar pipeline de migrations e strategy de rollback.

### Fase 2. Core de usuários e motoristas

- Cadastro, autenticação e autorização no `core-node`.
- Cadastro de documentos e status do motorista.
- Auditoria de eventos críticos.

### Fase 3. Geolocalização e match

- Endpoint de atualização de posição do motorista no `geo-go`.
- Consulta de motoristas próximos via PostGIS.
- Lógica de match por raio, ETA e score operacional.

### Fase 4. Viagens

- Solicitação, aceite, início, conclusão e cancelamento de viagens.
- Sincronização de status entre `core-node` e `geo-go`.
- Cache e filas em Redis para reduzir contenção.

### Fase 5. Pagamentos e notificações

- Integração de gateway no `core-node`.
- Webhooks e reconciliação.
- Notificações transacionais e operacionais.

## 6. Estratégia de deploy na VPS

### Provisionamento

- Ubuntu Server LTS atualizado.
- Docker Engine + Docker Compose Plugin.
- Usuário dedicado para deploy, sem uso do root.
- Firewall com `ufw` liberando somente `22`, `80` e `443`.

### Processo recomendado

1. Clonar ou atualizar o repositório na VPS.
2. Copiar `.env.example` para `.env` e preencher segredos.
3. Validar compose: `docker compose config`.
4. Buildar imagens: `docker compose build`.
5. Subir stack: `docker compose up -d`.
6. Conferir saúde: `docker compose ps` e logs por serviço.

### Operação segura

- Manter backups diários do volume do PostgreSQL.
- Executar migrations antes de liberar novas versões.
- Aplicar deploy blue/green simples com diretório de release ou janela controlada.
- Usar tag semântica por release e rollback com imagem anterior.
- Configurar TLS com Let's Encrypt ou proxy externo antes da entrada em produção pública.
