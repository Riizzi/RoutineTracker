package app.routinetracker;

import android.content.Context;
import androidx.work.Data;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

final class Scheduler {
    static final String SAMPLER = "rt-sampler";
    static final String SUMMARY_0 = "rt-summary-0";
    static final String SUMMARY_1 = "rt-summary-1";

    private Scheduler() {}

    /** Garante o worker de amostragem (15 min, o mínimo do WorkManager) e o resumo diário. */
    static void ensure(Context ctx) {
        Context c = ctx.getApplicationContext();
        WorkManager wm = WorkManager.getInstance(c);
        PeriodicWorkRequest sampler =
                new PeriodicWorkRequest.Builder(SamplerWorker.class, 15, TimeUnit.MINUTES).build();
        wm.enqueueUniquePeriodicWork(SAMPLER, ExistingPeriodicWorkPolicy.KEEP, sampler);
        scheduleSummary(c, 0);
    }

    static void cancelAll(Context ctx) {
        WorkManager wm = WorkManager.getInstance(ctx.getApplicationContext());
        wm.cancelUniqueWork(SAMPLER);
        wm.cancelUniqueWork(SUMMARY_0);
        wm.cancelUniqueWork(SUMMARY_1);
    }

    /**
     * Agenda o próximo resumo. Dois "slots" alternados: o worker em execução agenda o outro slot,
     * porque REPLACE no próprio nome cancelaria o worker que está rodando. Ao (re)agendar de fora
     * (abrir o app / reboot / mudar horário) os dois slots são limpos antes → nunca há resumo duplicado.
     */
    static void scheduleSummary(Context ctx, int slot) {
        Context c = ctx.getApplicationContext();
        WorkManager wm = WorkManager.getInstance(c);
        if (slot == 0) {
            wm.cancelUniqueWork(SUMMARY_0);
            wm.cancelUniqueWork(SUMMARY_1);
        }
        if (!NativeStore.summaryOn(c) || NativeStore.paused(c)) return;
        long delay = Clock.msUntilHour(NativeStore.summaryHour(c), System.currentTimeMillis());
        Data data = new Data.Builder().putInt("slot", slot).build();
        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(SummaryWorker.class)
                .setInitialDelay(delay, TimeUnit.MILLISECONDS)
                .setInputData(data)
                .build();
        wm.enqueueUniqueWork(slot == 0 ? SUMMARY_0 : SUMMARY_1, ExistingWorkPolicy.REPLACE, req);
    }
}
