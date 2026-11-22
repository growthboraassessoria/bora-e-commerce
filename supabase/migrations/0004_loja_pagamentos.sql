-- BORA Store · 0004 (no BORA OS: 0030_loja_pagamentos.sql) · regras de pagamento definidas no BORA OS (Loja → Pagar.me).
-- payment: { pixEnabled, pixDiscountPct, pixExpiresMinutes, cardEnabled, maxInstallments, minInstallmentCents, brands[], statementDescriptor }
-- Vazio = regras padrão da loja (Pix 5%, QR de 60 min, cartão em até 3x com parcela mínima de R$ 30, Visa/Master/Amex/Elo).
alter table loja.settings add column if not exists payment jsonb not null default '{}';
