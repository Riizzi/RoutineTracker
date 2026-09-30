package app.routinetracker;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** Posta o resumo do dia (calculado a partir do log nativo de transições) e agenda o próximo. */
public class SummaryWorker extends Worker {
    public SummaryWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        try {
            if (!NativeStore.paused(c) && NativeStore.summaryOn(c)) {
                String text = NativeStore.summaryText(c, System.currentTimeMillis());
                if (text != null) Notifier.postSummary(c, text);
            }
        } catch (Exception e) {
            NativeStore.setLastError(c, "summary: " + e);
        }
        int slot = getInputData().getInt("slot", 0);
        Scheduler.scheduleSummary(c, slot == 0 ? 1 : 0);
        return Result.success();
    }
}
