# Bella Review Action

<p align="center">
  <img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExczlkOTEyaWd2dDZuano0Nm1keW10M3JzOHExbWt4aTdkdGt2Ynl1NCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/XrocL0zuteSUU/giphy.gif" alt="Bella" width="280">
</p>

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

O jeito mais simples é pelo [painel web](https://github.com/Natan-Lucena/bella-review-web): cadastre o repositório, gere o token na tela de configurações e cole o valor como secret — o próprio wizard leva direto para a tela certa de secrets do GitHub (`Settings → Secrets and variables → Actions → New repository secret`, nome `BELLA_TOKEN`). O painel também consegue abrir automaticamente um Pull Request instalando este workflow no repositório, sem precisar colar o YAML manualmente.

Sem o painel, o mesmo token pode ser gerado chamando a API diretamente:

```
POST /repos/:id/action-token
Authorization: Bearer <sessão do usuário>
```

De uma forma ou de outra, o token aparece em texto plano **uma única vez** — copie na hora. Se perder o valor, é preciso gerar um novo (o backend guarda só o hash, nunca o texto plano de volta).

## Inputs

| Input          | Obrigatório | Padrão                                 | Descrição                                                                                          |
| -------------- | ----------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `bella-token`  | sim         | —                                      | Token do repositório, gerado no painel/API da Bella Reviewer.                                      |
| `api-url`      | não         | ambiente de produção da Bella Reviewer | Só precisa ser alterado para apontar a um ambiente de teste.                                       |
| `github-token` | não         | `${{ github.token }}`                  | Usado só para ler os arquivos do PR via API do GitHub — o token automático do job já é suficiente. |

## O que esperar depois de instalar

O step fica verde assim que o backend confirma o recebimento — isso **não** significa que a revisão terminou, só que foi aceita para processamento. Os comentários de revisão aparecem no Pull Request de forma assíncrona, alguns minutos depois. Comentários com uma correção concreta e local vêm como um bloco "Apply suggestion" nativo do GitHub — um clique já aplica a mudança, e a Bella reconcilia sozinha se cada sugestão foi de fato adotada. O histórico completo de execuções, comentários e métricas de aceitação fica disponível no [painel web](https://github.com/Natan-Lucena/bella-review-web) ou consultando a API do backend diretamente (`GET /repos/:id/review-runs`).
