package app.routinetracker;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationManagerCompat;

/** Trata o botão "Ignorar" da notificação de descoberta (funciona com o app fechado). */
public class ActionReceiver extends BroadcastReceiver {
    static final String ACTION_IGNORE = "app.routinetracker.IGNORE";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_IGNORE.equals(intent.getAction())) return;
        double lat = intent.getDoubleExtra("lat", Double.NaN);
        double lng = intent.getDoubleExtra("lng", Double.NaN);
        if (!Double.isNaN(lat) && !Double.isNaN(lng)) NativeStore.addIgnored(context, lat, lng);
        NotificationManagerCompat.from(context).cancel(intent.getIntExtra("nid", 0));
    }
}
