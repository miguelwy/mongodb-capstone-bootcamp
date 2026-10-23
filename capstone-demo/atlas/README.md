# Atlas setup — Trendify TFW demo (RC 1 · RC 2 · RC 3)

Um único **Global Cluster** cobre os três RCs:

| RC | O que fica real |
|---|---|
| RC 1 | Atlas Search + Atlas Vector Search na coleção `products` (com `stock` vindo do dado operacional) |
| RC 2 | Transação multi-documento (pedido + baixa de estoque) e coleção `orders` shardada |
| RC 3 | Pedidos com `location: "DE"/"FR"` gravados no shard da zona EU; `US`/`CA` na zona NA |

Dados 100% sintéticos. Não é benchmark.

## 1. Criar o cluster (Atlas UI → Create cluster)

| Campo | Valor |
|---|---|
| Tipo | **Dedicated** |
| Cloud provider | AWS |
| **Global Cluster Configuration** | **Enable Global Writes** (habilitar na criação) |
| Template | Custom → 2 zonas |
| Zona 1 · "North America" | `us-east-1` (N. Virginia) · 1 shard · 3 nós eletivos |
| Zona 2 · "Europe" | `eu-west-1` (Ireland) ou `eu-central-1` (Frankfurt) · 1 shard · 3 nós eletivos |
| Tier | **M30** (mínimo para Global Cluster) |
| Versão | MongoDB 8.0 |
| Backup | Off (demo) |
| Nome | `trendify-tfw` |

Custo é por hora: suba antes de gravar, **pause ou termine depois**. Confira o preço exibido no console.

## 2. Location mappings

Cluster → **Global Configuration** → **Add common location mappings** (ou mapeie manualmente):
`US`, `CA` → North America · `DE`, `FR`, `IE` → Europe.

Depois crie as coleções globais **pela UI** (o Atlas só mantém zone ranges de coleções shardadas assim;
ranges criadas via shell são removidas em ~1 min):

1. Crie `trendify_demo.orders` e `trendify_demo.customers` vazias (Data Explorer → Create Collection).
2. **Data Explorer** → coleção → aba **Global Writes** → *Second shard key field*: `customerId` → Default → **Shard Collection**.
3. Repita para a outra coleção. O Atlas gera as zone ranges a partir dos location mappings.

## 3. Acesso

- **Database Access** → usuário `tfw_admin` com papel **Atlas admin** (o setup lê `config` para verificar shard e zonas).
  Depois da demo, crie um usuário só `readWrite` em `trendify_demo` para o app.
- **Network Access** → adicione seu IP atual.
- **Connect → Drivers** → copie a connection string.

## 4. (Opcional) Voyage AI para Vector Search

Crie uma API key em Voyage AI. Sem ela, só o índice de texto (Atlas Search) é criado.

## 5. Rodar

```bash
cp atlas/.env.example atlas/.env      # preencha MONGODB_URI (e VOYAGE_API_KEY)
npm run atlas:setup                   # verifica shard/zonas, insere documentos, embeddings, índices
npm run atlas:check                   # prova ao vivo dos 3 RCs
```

`npm run atlas:setup -- --reset` apaga e recria o db `trendify_demo`.

## O que o setup cria

**`products`** (não shardada) — 8 itens do catálogo sintético:
```json
{ "_id": "p1", "name": "Aero Knit City Sneaker", "category": "Shoes", "color": "Sand",
  "price": 98, "qty": 40, "stock": "In stock", "tags": ["comfortable", "summer", "city", "..."],
  "description": "...", "embedding": [/* 1024 floats */], "updatedAt": "<date>" }
```

**`customers`** — shard key `{ location: 1, customerId: 1 }`:
```json
{ "location": "DE", "customerId": "c-eu-001", "name": "Demo Shopper EU 1", "email": "eu1@example.test" }
```

**`orders`** — shard key `{ location: 1, customerId: 1 }`:
```json
{ "location": "DE", "customerId": "c-eu-001", "orderId": "SEED-0003",
  "items": [{ "productId": "p4", "qty": 1, "price": 74 }], "total": 74, "status": "placed", "createdAt": "<date>" }
```

**Índices em `products`**
- `products_text` (Atlas Search): `name`, `description`, `tags` (lucene.english), `category` e `stock` (token).
- `products_vec` (Vector Search): `embedding` (cosine, dims do modelo), filtros `category` e `stock`.

## O que o check mostra

1. **RC 1** — busca de texto "comfortable shoes for a summer city trip" sem itens fora de estoque; busca vetorial semântica.
2. **RC 2** — pedido DE commitado com baixa de estoque na mesma transação; pedido de item sem estoque abortado.
3. **RC 2/3** — `explain()` de cada pedido mostrando **qual shard / zona** respondeu (esperado: US/CA → NA, DE/FR → EU).

Momento "real" para a gravação: altere `qty`/`stock` de um produto no Data Explorer e rode a busca de novo —
o resultado muda porque o índice acompanha o dado operacional (eventualmente consistente; não cite tempo).

## Lembretes para o roleplay

- Global Cluster é **placement**, não compliance GDPR. Backups, logs e índices de search têm regras próprias.
- Shard key `{location, customerId}` é uma escolha de demo, não recomendação para a Trendify.
- 8 produtos e 5 pedidos não provam latência, throughput nem escala.
