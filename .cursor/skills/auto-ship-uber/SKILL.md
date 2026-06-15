---
name: auto-ship-uber
description: >-
  Ao concluir qualquer desenvolvimento, commita e envia automaticamente todas as
  alterações para goulartfelipe618-beep/uber. Preserva todo o trabalho — nunca
  exclui arquivos nem descarta edições. Use após implementar features, corrigir
  bugs, editar código ou finalizar qualquer tarefa de desenvolvimento neste projeto.
---

# Auto Ship — goulartfelipe618-beep/uber

Esta skill **substitui** a regra genérica de "só commitar quando pedido". Neste projeto, enviar ao repositório faz parte de concluir a tarefa.

## Repositório alvo

| Campo | Valor |
|-------|-------|
| GitHub | `goulartfelipe618-beep/uber` |
| Remote | `origin` → `https://github.com/goulartfelipe618-beep/uber.git` |
| Push | branch atual (`git push -u origin HEAD` na primeira vez) |

## Política de preservação (obrigatória)

**Todas as edições nunca sejam excluídas.**

- Nunca use `git reset --hard`, `git clean`, `git checkout --`, `git restore` para descartar trabalho.
- Nunca delete arquivos criados ou editados, salvo pedido explícito do usuário.
- Nunca omita arquivos do commit (`git add -A` — incluir tudo).
- Nunca faça `push --force` em `main`/`master` sem pedido explícito.
- Nunca commite `.env`, chaves ou credenciais — avise o usuário se aparecerem no diff.

## Quando executar

Ao **terminar** qualquer tarefa de desenvolvimento (feature, fix, refactor, migration, config), execute o fluxo abaixo **antes** de encerrar a resposta — mesmo que o usuário não peça "commit" ou "push".

## Fluxo (nesta ordem)

### 0. Verificar persistência

Confirmar que o código existe no disco:

```powershell
git status --short
```

Se arquivos esperados não existirem, recrie ou corrija antes de continuar.

### 1. Inspecionar alterações

Em paralelo:

```powershell
git status --short
git diff
git diff --staged
git log -3 --oneline
```

### 2. Configurar remote (se necessário)

```powershell
git remote get-url origin
```

Se não existir ou apontar para outro repo:

```powershell
git remote remove origin
git remote add origin https://github.com/goulartfelipe618-beep/uber.git
```

### 3. Commitar **todas** as alterações

```powershell
git add -A
```

Mensagem: 1–2 frases focadas no **porquê**. Estilo do histórico recente.

PowerShell:

```powershell
git commit -m "mensagem aqui"
```

Se não houver nada para commitar, pule para o passo 4.

### 4. Enviar ao GitHub

```powershell
git push -u origin HEAD
```

Se o push falhar por divergência, use `git pull --rebase origin HEAD` (nunca `--force` sem pedido explícito) e tente o push de novo.

### 5. Confirmar

```powershell
git status
```

Informe ao usuário: commit hash, branch e que o push foi para `goulartfelipe618-beep/uber`.

## Checklist rápido

```
- [ ] Arquivos persistidos no disco
- [ ] git add -A (nenhuma edição omitida)
- [ ] Commit criado
- [ ] Push para goulartfelipe618-beep/uber
- [ ] Nenhum arquivo deletado sem pedido explícito
```
