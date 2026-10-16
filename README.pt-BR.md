<div align="center">

<img src="android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png" width="88" alt="Ícone do RoutineTracker" />

# RoutineTracker

[English](README.md) · **Português**

App Android que registra sozinho, em segundo plano, quando você chega e sai dos seus lugares (casa, trabalho, academia…), com extrato, gráficos, metas e sugestão de cadastrar lugares novos. Tudo fica só no seu celular.

![Android](https://img.shields.io/badge/Android-292524?logo=android&logoColor=3DDC84)
![Capacitor](https://img.shields.io/badge/Capacitor_8-292524?logo=capacitor&logoColor=119EFF)
![React](https://img.shields.io/badge/React_19-292524?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-292524?logo=typescript&logoColor=3178C6)
![Java](https://img.shields.io/badge/Java-292524?logo=openjdk&logoColor=white)
![OpenStreetMap](https://img.shields.io/badge/OpenStreetMap-292524?logo=openstreetmap&logoColor=7EBC6F)

</div>

## Funcionalidades

- **Registro automático** de entrada e saída nos lugares cadastrados, com o app fechado
- **Agora**: onde você está e há quanto tempo
- **Extrato** do dia, com barra do tempo em cada lugar
- **Gráficos** e **metas** semanais (ex.: horas de trabalho, idas à academia)
- **Descoberta de lugares**: detecta permanências longas em lugares não cadastrados e sugere cadastrá-los
- **Cadastro no mapa** com busca de endereço (OpenStreetMap, sem chave de API)
- **Resumo diário** por notificação
- **Backup em JSON** e **exportação em CSV** pela folha de compartilhamento do Android
- **Privacidade**: nenhum servidor; os dados não saem do aparelho

## Como funciona

- **Geofences nativas** (Google Play Services): quem monitora é o Android, não o app. O consumo de bateria é quase nulo e funciona com o app fechado.
- Uma leitura de localização de baixo consumo a cada ~15 min (WorkManager) corrige saídas perdidas e detecta permanências em lugares não cadastrados.
- O Android acumula os eventos e o app os processa ao abrir (`src/core/engine.ts`).
- A lógica de registros, descoberta e estatísticas é pura e coberta por testes (`src/core/*.test.ts`).

```
Android (Java)                                   App (React + Capacitor)
 ├── GeofenceReceiver ── entrada/saída ──┐
 ├── SamplerWorker ───── leitura ~15 min ─┼──► NativeStore ──► bridge.ts ──► core/engine.ts ──► telas
 ├── SummaryWorker ───── resumo diário    │                                  core/discovery.ts
 └── BootReceiver ────── reativa geofences após reiniciar                    core/stats.ts
```

## Stack

| Camada | Tecnologia |
| --- | --- |
| Interface | React 19, TypeScript, Tailwind CSS 4, Leaflet |
| Nativo | Capacitor 8 + plugin próprio em Java (geofences, WorkManager, notificações) |
| Mapas | OpenStreetMap / Nominatim |
| Testes | `node:test` via `tsx` |
| CI | GitHub Actions: testes, build e APK assinado publicado em Releases |

## Instalar no celular

1. Abra a aba **Actions**: o workflow **Build APK** roda a cada push (ou manualmente em *Run workflow*).
2. No celular, abra a página **Releases** do repositório, baixe **RoutineTracker.apk** e instale. Se o Android pedir, permita "instalar apps desconhecidos" para o navegador.
3. Abra o app e siga a tela inicial: **Localização → "Permitir o tempo todo"**, notificações e bateria "Sem restrições".

Para atualizar, basta dar `git push`: o novo APK instala por cima do anterior sem perder dados, porque todas as builds usam a mesma chave (guardada nos Secrets do GitHub).

## Desenvolvimento

```bash
npm install
npm test          # lógica pura (motor, descoberta, estatísticas)
npm run dev       # interface no navegador (dados de demonstração em Config)
npm run build && npx cap sync android
```

## Limitações conhecidas

- Fabricantes como Xiaomi, Samsung e Motorola podem encerrar apps em segundo plano: use bateria "Sem restrições".
- O Android pode levar alguns minutos para avisar uma entrada ou saída de geofence.
- Resumo diário, aviso de lugar novo e status são notificações de "melhor esforço".
- A notificação de lugar novo cobre uma única permanência longa; visitas curtas repetidas aparecem na aba Lugares.

> **Assinatura do APK:** a chave fica só nos *Secrets* do GitHub (`ANDROID_KEYSTORE_BASE64` e `ANDROID_KEYSTORE_PASSWORD`), nunca no repositório. Sem eles, o workflow compila com uma chave temporária e não publica em Releases.

## Licença

[MIT](LICENSE)
