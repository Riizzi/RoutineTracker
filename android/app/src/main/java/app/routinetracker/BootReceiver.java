package app.routinetracker;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Geofences somem ao reiniciar o aparelho (e podem sumir ao atualizar o app): recadastra tudo. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String a = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(a) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) return;
        if (NativeStore.paused(context)) return;
        GeofenceHelper.sync(context, null);
        Scheduler.ensure(context);
        Notifier.refreshStatus(context);
    }
}
