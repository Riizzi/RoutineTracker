package app.routinetracker;

import android.annotation.SuppressLint;
import android.content.Context;
import android.location.Location;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;
import com.google.android.gms.tasks.Tasks;
import java.util.concurrent.TimeUnit;

/**
 * A cada ~15 min pega UMA posição de baixo consumo (precisão "balanceada", sem ligar o GPS) para:
 *  1) reconciliar saídas/entradas de geofence que o sistema tenha perdido;
 *  2) detectar estadias em lugares não cadastrados (descoberta).
 */
public class SamplerWorker extends Worker {
    private static final long MAX_AGE_MS = 20L * 60 * 1000;

    public SamplerWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @SuppressLint("MissingPermission")
    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        if (NativeStore.paused(c) || !Perm.hasFine(c)) return Result.success();
        CancellationTokenSource cts = new CancellationTokenSource();
        try {
            FusedLocationProviderClient client = LocationServices.getFusedLocationProviderClient(c);
            Location loc = Tasks.await(
                    client.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, cts.getToken()),
                    30,
                    TimeUnit.SECONDS);
            if (loc == null) loc = Tasks.await(client.getLastLocation(), 10, TimeUnit.SECONDS);
            if (loc == null) return Result.success();

            long now = System.currentTimeMillis();
            long age = now - loc.getTime();
            if (age > MAX_AGE_MS || age < -60_000L) return Result.success(); // posição velha demais: descarta
            long ts = Math.min(now, loc.getTime());
            float acc = loc.hasAccuracy() ? loc.getAccuracy() : 999f;

            NativeStore.addSample(c, ts, loc.getLatitude(), loc.getLongitude(), acc);
            Discovery.check(c, ts, loc.getLatitude(), loc.getLongitude(), acc);
        } catch (Exception e) {
            cts.cancel();
            NativeStore.setLastError(c, "sampler: " + e);
        }
        return Result.success();
    }
}
