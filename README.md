# Bella Review Action

GitHub Action que calcula o diff completo de um Pull Request e envia para revisão automática pela [Bella Reviewer](https://github.com/Natan-Lucena/bella-reviewer-api). A Action só confirma o envio — a revisão em si roda de forma assíncrona, e os comentários aparecem no PR alguns minutos depois.

## Uso

```yaml
name: Bella Reviewer

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  bella-review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: read
    steps:
      - uses: Natan-Lucena/bella-review-action@v1
        with:
          bella-token: ${{ secrets.BELLA_TOKEN }}
```

O bloco `permissions: pull-requests: read` é necessário — o token automático do job (`github.token`) precisa dessa permissão para ler os arquivos alterados do Pull Request via API do GitHub. Sem isso, a Action falha com um erro de autorização ao tentar calcular o diff.

## De onde vem o `BELLA_TOKEN`

Gerado uma única vez, chamando a API da Bella Reviewer para o repositório já cadastrado:

```
POST /repos/:id/action-token
Authorization: Bearer <sessão do usuário>
```

A resposta traz o token em texto plano **uma única vez** — copie e configure como secret do repositório (`Settings → Secrets and variables → Actions → New repository secret`, nome `BELLA_TOKEN`). Se perder o valor, é preciso gerar um novo (o backend guarda só o hash, nunca o texto plano de volta).

## Inputs

| Input          | Obrigatório | Padrão                                 | Descrição                                                                                          |
| -------------- | ----------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `bella-token`  | sim         | —                                      | Token do repositório, gerado no painel/API da Bella Reviewer.                                      |
| `api-url`      | não         | ambiente de produção da Bella Reviewer | Só precisa ser alterado para apontar a um ambiente de teste.                                       |
| `github-token` | não         | `${{ github.token }}`                  | Usado só para ler os arquivos do PR via API do GitHub — o token automático do job já é suficiente. |

## O que esperar depois de instalar

O step fica verde assim que o backend confirma o recebimento — isso **não** significa que a revisão terminou, só que foi aceita para processamento. Os comentários de revisão aparecem no Pull Request de forma assíncrona; o histórico completo de execuções fica disponível consultando a API do backend (`GET /repos/:id/review-runs`).
