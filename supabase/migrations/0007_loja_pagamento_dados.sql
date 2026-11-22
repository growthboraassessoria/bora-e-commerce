-- BORA Store · 0007 (no BORA OS: 0033_loja_pagamento_dados.sql) · resumo do pagamento no pedido.
-- payment_data: o que a Pagar.me devolve (pedido, cobrança, transação, cartão mascarado, adquirente, antifraude, Pix)
-- e o histórico de avisos (webhooks) e consultas. Nunca guarda número completo do cartão, CVV nem QR Code.
-- Formato em lib/payment-data.ts (loja) e lib/loja/types.ts (OS).
alter table loja.orders add column if not exists payment_data jsonb;
