# CoBalance — índice de planejamento na branch SPEC003

**Atualizado em:** 2026-11-09
**Contexto:** worktree exclusiva `feat/spec003-modulo-emprestimos`, baseada em `578bf70`.

> Esta branch inclui somente a documentação canônica da **nova feature SPEC003**. No checkout original `development`, as SPEC001/002 e suas implementações/revisões existiam como modificações **não commitadas**; por isolamento, não foram copiadas nem estão disponíveis aqui. Consulte o Obsidian ou a documentação local do checkout original **somente para leitura** se precisar da cronologia. Não faça merge/cópia automática.

| Documento | Estado |
| --- | --- |
| [SPEC003 — Módulos Cartões e Empréstimos](specs/SPEC003-modulo-emprestimos.md) | Documento de produto/técnica, não implementado, candidato a revisão independente |
| [Plano SPEC003 ONE-SHOT](plans/SPEC003-one-shot-tdd-e2e.md) | P0–P5 + checkpoints de autorrevisão R1–R5, TDD/E2E e gates |
| [Prompt único executor](prompts/SPEC003-one-shot-executor.md) | Handoff de implementação em worktree isolada, sem push/merge/deploy |
| [Autorrevisão R0](reviews/SPEC003-R0-autorrevisao-documental.md) | Diagnóstico documental/risco herdado, **não** revisão independente |

**Próximo gate:** executor pode implementar na worktree local conforme escopo, com testes PostgreSQL descartável e browser real; revisão independente posterior antes de qualquer migração em banco existente/publicação.
