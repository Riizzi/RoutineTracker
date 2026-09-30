# RoutineTracker

App Android que registra sozinho, em segundo plano, quando você chega e sai dos seus lugares
(casa, trabalho, academia…), com extrato, gráficos, metas e sugestão de cadastrar lugares novos.
Tudo fica só no seu celular.

## Como funciona (resumo técnico)

- **Geofences nativas** (Google Play Services): quem monitora é o Android, não o app → consumo de bateria quase nulo e funciona com o app fechado.
- Uma leitura de localização de baixo consumo a cada ~15 min corrige saídas perdidas e detecta permanências em lugares não cadastrados.
- O Android acumula os eventos; o app os processa ao abrir (`src/core/engine.ts`, testado em `src/core/*.test.ts`).
- Mapa/busca: OpenStreetMap (sem chave de API).

## Instalar no celular (uma vez, ~10 min)

1. **Crie um repositório PRIVADO** vazio em <https://github.com/new> (ex.: `routinetracker`).
2. No computador, dentro desta pasta:
   ```bash
   git init -b main
   git add .
   git commit -m "RoutineTracker"
   git remote add origin https://github.com/SEU_USUARIO/routinetracker.git
   git push -u origin main
   ```
3. Abra a aba **Actions** do repositório: o job “Build APK” começa sozinho (~6–10 min na primeira vez).
4. Quando terminar, abra no **celular**: `https://github.com/SEU_USUARIO/routinetracker/releases/latest`
   (entre na sua conta do GitHub), baixe **RoutineTracker.apk** e instale.
   Se o Android pedir, permita “instalar apps desconhecidos” para o navegador.
5. Abra o app e siga a tela inicial: **Localização → “Permitir o tempo todo”**, notificações e bateria “Sem restrições”.

## Atualizar

Altere o código, `git push`. Um novo APK é publicado em Releases e instala **por cima** do anterior sem perder dados
(o app é sempre assinado com a mesma chave, `android/app/routinetracker.keystore`).

## Se o build falhar

Abra Actions → execução com ✗ → copie o log do passo que falhou e me envie.

## Desenvolvimento

```bash
npm install
npm test          # lógica pura (motor, descoberta, estatísticas)
npm run dev       # interface no navegador (dados de demonstração em Config)
npm run build && npx cap sync android
```

## Limitações conhecidas

- Fabricantes como Xiaomi, Samsung e Motorola podem encerrar apps em segundo plano: use bateria “Sem restrições”.
- O Android pode levar alguns minutos para avisar uma entrada/saída de geofence.
- Resumo diário, aviso de lugar novo e status são notificações “melhor esforço”.
- A notificação de lugar novo cobre uma única permanência longa; visitas curtas repetidas aparecem na aba Lugares.
- A keystore fica no repositório (uso pessoal, repo privado). Não publique este repositório.
